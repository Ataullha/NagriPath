/**
 * Production server for Render (or any plain Node host).
 *
 * Does two things:
 *   1. serves the static build in ./out
 *   2. answers POST /api/tts by calling the Hugging Face Space
 *
 * Step 2 has to happen here on the server. Gradio refuses cross-origin
 * requests from browsers, so the page cannot call the Space itself.
 *
 * The actual Space call lives in netlify/functions/tts.js and is reused here,
 * so there is exactly one copy of that logic whichever host you deploy to.
 *
 * Zero npm dependencies — Node 18+ only.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const tts = require('./netlify/functions/tts.js');

const PORT = process.env.PORT || 3000;
const ROOT = path.join(__dirname, 'out');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.wav': 'audio/wav',
};

/** Long cache for fingerprinted assets, no cache for the service worker. */
function cacheHeader(urlPath) {
  if (urlPath.startsWith('/_next/static/') || urlPath.startsWith('/fonts/')) {
    return 'public, max-age=31536000, immutable';
  }
  if (urlPath === '/sw.js') return 'no-cache';
  return 'public, max-age=0, must-revalidate';
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1e6) reject(new Error('Body too large'));
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

/** Map a URL path to a file inside ./out, refusing anything outside it. */
function resolveFile(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  let target = path.join(ROOT, decoded);

  if (!target.startsWith(ROOT)) return null;        // path traversal attempt

  try {
    if (fs.statSync(target).isDirectory()) target = path.join(target, 'index.html');
  } catch {
    // not on disk as given; try the exported "/name/index.html" form
    const asDir = path.join(ROOT, decoded, 'index.html');
    if (fs.existsSync(asDir)) return asDir;
    const asHtml = target + '.html';
    if (fs.existsSync(asHtml)) return asHtml;
    return null;
  }
  return fs.existsSync(target) ? target : null;
}

const server = http.createServer(async (req, res) => {
  const urlPath = (req.url || '/').split('?')[0];

  // ---- speech endpoint -------------------------------------------------
  if (urlPath === '/api/tts') {
    try {
      const body = req.method === 'POST' ? await readBody(req) : '';
      const result = await tts.handler({ httpMethod: req.method, body });
      res.writeHead(result.statusCode, result.headers);
      return res.end(result.body);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Speech service failed.', hint: String(err && err.message) }));
    }
  }

  // ---- health check ----------------------------------------------------
  if (urlPath === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end('ok');
  }

  // ---- static files ----------------------------------------------------
  const file = resolveFile(urlPath === '/' ? '/index.html' : urlPath);

  if (!file) {
    const notFound = path.join(ROOT, '404.html');
    if (fs.existsSync(notFound)) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(fs.readFileSync(notFound));
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    return res.end('Not found');
  }

  res.writeHead(200, {
    'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
    'Cache-Control': cacheHeader(urlPath),
  });
  fs.createReadStream(file).pipe(res);
});

server.listen(PORT, () => {
  console.log(`Serving ./out and /api/tts on port ${PORT}`);
});
