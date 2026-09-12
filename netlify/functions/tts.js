/**
 * Server-side proxy to the Sylheti Nagri TTS Space.
 *
 * Why this exists: Gradio refuses cross-origin browser requests, so a static
 * site can never call the Space directly from the user's browser. This runs
 * on Netlify instead — server to server, where CORS does not apply.
 *
 * Deliberately has zero npm dependencies so it deploys as-is, including on
 * manual drag-and-drop deploys where nothing gets bundled.
 */

const SPACE = process.env.TTS_SPACE || 'Ataullha/Sylheti_Nagri_TTS';

/** Endpoint names to try, in order. */
const FUNCTIONS = ['predict_nagri', 'predict_syl'];

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function reply(statusCode, payload) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...CORS },
    body: JSON.stringify(payload),
  };
}

/** "Ataullha/Sylheti_Nagri_TTS" -> "ataullha-sylheti-nagri-tts.hf.space" */
function spaceHost(space) {
  return 'https://' + space.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.hf.space';
}

/** Pull the final JSON payload out of Gradio's SSE stream. */
function parseEventStream(raw) {
  const lines = raw.split(/\r?\n/);
  let last = null;
  for (const line of lines) {
    if (!line.startsWith('data:')) continue;
    const chunk = line.slice(5).trim();
    if (!chunk || chunk === 'null') continue;
    try {
      last = JSON.parse(chunk);
    } catch {
      /* heartbeat or partial line, skip */
    }
  }
  return last;
}

/** Find a file reference anywhere in the returned structure. */
function findFile(node, seen = new Set()) {
  if (!node || typeof node !== 'object' || seen.has(node)) return null;
  seen.add(node);

  if (!Array.isArray(node)) {
    if (typeof node.url === 'string' && node.url) return node.url;
    if (typeof node.path === 'string' && node.path) return { path: node.path };
  }
  for (const value of Object.values(node)) {
    if (typeof value === 'string' && /^https?:\/\/.+\.(wav|mp3|ogg|flac|m4a)/i.test(value)) {
      return value;
    }
    const hit = findFile(value, seen);
    if (hit) return hit;
  }
  return null;
}

async function callSpace(host, fn, data) {
  const bases = [`${host}/gradio_api/call/${fn}`, `${host}/call/${fn}`];

  for (const base of bases) {
    let start;
    try {
      start = await fetch(base, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data }),
      });
    } catch {
      continue;
    }
    if (!start.ok) continue;

    let eventId = null;
    try {
      eventId = (await start.json()).event_id;
    } catch {
      continue;
    }
    if (!eventId) continue;

    const stream = await fetch(`${base}/${eventId}`);
    if (!stream.ok) continue;

    const parsed = parseEventStream(await stream.text());
    if (parsed) return parsed;
  }
  return null;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return reply(405, { error: 'Use POST.' });

  let text = '';
  try {
    text = String(JSON.parse(event.body || '{}').text || '').trim();
  } catch {
    return reply(400, { error: 'Malformed request body.' });
  }
  if (!text) return reply(400, { error: 'No text supplied.' });

  const host = spaceHost(SPACE);

  let result = null;
  for (const fn of FUNCTIONS) {
    result = await callSpace(host, fn, [text]);
    if (result) break;
  }

  if (!result) {
    return reply(502, {
      error: 'The speech model did not respond.',
      hint: 'The Hugging Face Space may be starting up. Wait a few seconds and try again.',
    });
  }

  const file = findFile(result);
  if (!file) {
    return reply(502, { error: 'The model replied, but without any audio.' });
  }

  const audioUrl =
    typeof file === 'string' ? file : `${host}/gradio_api/file=${file.path}`;

  // stream the audio back through this function, so the browser never has to
  // touch hf.space itself
  let audioRes = await fetch(audioUrl);
  if (!audioRes.ok && typeof file !== 'string') {
    audioRes = await fetch(`${host}/file=${file.path}`);
  }
  if (!audioRes.ok) {
    return reply(502, { error: 'Could not download the generated audio.' });
  }

  const bytes = Buffer.from(await audioRes.arrayBuffer());
  return reply(200, {
    audio: `data:${audioRes.headers.get('content-type') || 'audio/wav'};base64,${bytes.toString('base64')}`,
  });
};
