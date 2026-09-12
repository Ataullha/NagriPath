/**
 * Server-side proxy to the Sylheti Nagri TTS Space.
 *
 * Why this exists: Gradio refuses cross-origin browser requests as a CSRF
 * protection, so a page on your own domain can never call the Space directly.
 * This runs on the server instead — server to server, where CORS does not
 * apply. It also streams the audio back through itself, so the browser never
 * contacts hf.space at all.
 *
 * Used by both hosts:
 *   Netlify -> as a serverless function at /api/tts
 *   Render  -> required by server.js and served at /api/tts
 *
 * Deliberately zero npm dependencies, so there is nothing to bundle.
 *
 * HF_TOKEN
 * --------
 * The Space runs on ZeroGPU, which gives anonymous callers a small quota.
 * Once it runs out the Space replies "You have exceeded your ZeroGPU runs
 * limit". Set an HF_TOKEN environment variable and it is sent as a bearer
 * token, which raises the quota to that account's allowance.
 *
 *   Render  : Environment -> Add Environment Variable -> HF_TOKEN
 *   Netlify : Site configuration -> Environment variables -> HF_TOKEN
 *
 * Get one at https://huggingface.co/settings/tokens (a read token is enough).
 * Never put the token in frontend code — it belongs only here.
 */

const SPACE = process.env.TTS_SPACE || 'Ataullha/Sylheti_Nagri_TTS';
const HF_TOKEN = process.env.HF_TOKEN || process.env.HUGGING_FACE_TOKEN || '';

/**
 * Only predict_syl is called. It takes ROMAN Sylheti text, so the app converts
 * every script to Roman first (see lib/nagri.ts).
 *
 * predict_nagri is deliberately NOT used as a fallback. Feeding it Nagri text
 * makes its embedding layer index out of range, which raises a CUDA
 * device-side assert. That does not fail politely: it kills the GPU worker, and
 * every later request on the Space returns "No CUDA GPUs are available" until
 * someone restarts it. One bad click would take the whole demo down, so we
 * never call it.
 */
const FUNCTIONS = ['predict_syl'];

/** Mirrors sanitizeRoman/padForModel in lib/nagri.ts, as a server-side net. */
const MIN_WORDS = 3;
const MIN_CHARS = 8;
const MAX_REPEATS = 6;

function prepareText(input) {
  const clean = String(input)
    .toLowerCase()
    .replace(/[^a-z0-9 .,!?'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) return '';

  let out = clean;
  let repeats = 1;
  while ((out.split(' ').length < MIN_WORDS || out.length < MIN_CHARS) && repeats < MAX_REPEATS) {
    out = `${out} ${clean}`;
    repeats += 1;
  }
  return out;
}

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

/** Bearer token, when one is configured. */
function authHeaders() {
  return HF_TOKEN ? { Authorization: `Bearer ${HF_TOKEN}` } : {};
}

/** "Ataullha/Sylheti_Nagri_TTS" -> the hf.space host */
function spaceHost(space) {
  return 'https://' + space.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.hf.space';
}

/**
 * Read Gradio's SSE stream.
 * Returns the last data payload, and any error the model reported.
 */
function parseEventStream(raw) {
  const lines = raw.split(/\r?\n/);
  let event = null;
  let result = null;
  let error = null;

  for (const line of lines) {
    if (line.startsWith('event:')) {
      event = line.slice(6).trim();
      continue;
    }
    if (!line.startsWith('data:')) continue;

    const chunk = line.slice(5).trim();
    if (!chunk) continue;

    let parsed;
    try {
      parsed = JSON.parse(chunk);
    } catch {
      parsed = chunk;
    }

    if (event === 'error') {
      if (typeof parsed === 'string' && parsed && parsed !== 'null') error = parsed;
      else if (parsed && typeof parsed === 'object' && parsed.message) error = parsed.message;
      else if (!error) error = 'The model reported an error without a message.';
    } else if (parsed !== null) {
      result = parsed;
    }
  }
  return { result, error };
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
  let lastError = null;

  for (const base of bases) {
    let start;
    try {
      start = await fetch(base, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
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

    const stream = await fetch(`${base}/${eventId}`, { headers: authHeaders() });
    if (!stream.ok) continue;

    const { result, error } = parseEventStream(await stream.text());
    if (error) lastError = error;
    if (result) return { result, error: null };
  }
  return { result: null, error: lastError };
}

/** Turn the model's own error text into something a visitor can act on. */
function describeModelError(message) {
  const quota = /quota|exceeded|runs limit/i.test(message);
  if (quota) {
    return {
      status: 429,
      error: 'The speech model has run out of free GPU quota for now.',
      hint: HF_TOKEN
        ? 'The configured Hugging Face token has also hit its limit. Try again later, or use a token from an account with more quota.'
        : 'Set an HF_TOKEN environment variable on the host to raise the limit. See netlify/functions/tts.js for details.',
    };
  }
  if (/no cuda gpus are available|device-side assert/i.test(message)) {
    return {
      status: 503,
      error: 'The speech model on Hugging Face has crashed and needs a restart.',
      hint: 'Open the Space and use Settings -> Restart this Space. Until then no audio can be generated.',
    };
  }
  if (/longer sentence|too short/i.test(message)) {
    return {
      status: 400,
      error: 'That was too short for the model.',
      hint: 'Try a few words together.',
    };
  }
  if (/gpu|cuda|out of memory/i.test(message)) {
    return {
      status: 503,
      error: 'The speech model could not get a GPU slot.',
      hint: 'Wait a few seconds and try again.',
    };
  }
  return { status: 502, error: 'The speech model reported an error.', hint: message };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') {
    return reply(405, { error: 'Use POST.', tokenConfigured: Boolean(HF_TOKEN) });
  }

  let text = '';
  try {
    text = prepareText(JSON.parse(event.body || '{}').text || '');
  } catch {
    return reply(400, { error: 'Malformed request body.' });
  }
  if (!text) {
    return reply(400, {
      error: 'Nothing to say.',
      hint: 'The text contained no characters the model can read.',
    });
  }

  const host = spaceHost(SPACE);

  let result = null;
  let modelError = null;
  for (const fn of FUNCTIONS) {
    const attempt = await callSpace(host, fn, [text]);
    if (attempt.result) {
      result = attempt.result;
      break;
    }
    if (attempt.error) modelError = attempt.error;
  }

  if (!result) {
    if (modelError) {
      const described = describeModelError(modelError);
      return reply(described.status, { error: described.error, hint: described.hint });
    }
    return reply(502, {
      error: 'The speech model did not respond.',
      hint: 'The Hugging Face Space may be starting up. Wait a few seconds and try again.',
    });
  }

  const file = findFile(result);
  if (!file) return reply(502, { error: 'The model replied, but without any audio.' });

  const audioUrl = typeof file === 'string' ? file : `${host}/gradio_api/file=${file.path}`;

  let audioRes = await fetch(audioUrl, { headers: authHeaders() });
  if (!audioRes.ok && typeof file !== 'string') {
    audioRes = await fetch(`${host}/file=${file.path}`, { headers: authHeaders() });
  }
  if (!audioRes.ok) return reply(502, { error: 'Could not download the generated audio.' });

  const bytes = Buffer.from(await audioRes.arrayBuffer());
  return reply(200, {
    audio: `data:${audioRes.headers.get('content-type') || 'audio/wav'};base64,${bytes.toString('base64')}`,
  });
};
