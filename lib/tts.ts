/**
 * Frontend speech client.
 *
 * It does NOT call Hugging Face directly: Gradio rejects cross-origin browser
 * requests, so a request from this site's own origin would be blocked. Instead
 * it calls /api/tts, which Netlify routes to netlify/functions/tts.js, and that
 * function talks to the Space server-to-server.
 *
 * The Space ID lives in the function (netlify/functions/tts.js), not here.
 */

export const SPACE_ID = 'Ataullha/Sylheti_Nagri_TTS';

const ENDPOINT = '/api/tts';

export class TtsError extends Error {
  constructor(message: string, readonly hint?: string) {
    super(message);
    this.name = 'TtsError';
  }
}

/**
 * Send Syloti Nagri text to the model and get back a playable audio source.
 * Used for whole sentences and for single letters alike.
 */
export async function synthesize(nagriText: string): Promise<string> {
  const text = nagriText.trim();
  if (!text) throw new TtsError('There is nothing to say yet.');

  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
  } catch {
    throw new TtsError(
      'Could not reach the speech service.',
      'Check your connection and try again.',
    );
  }

  const raw = await response.text();
  let payload: { audio?: string; error?: string; hint?: string };
  try {
    payload = JSON.parse(raw);
  } catch {
    throw new TtsError(
      'The speech service is not responding correctly.',
      response.status === 404
        ? 'The /api/tts function is missing from this deployment. Redeploy including the netlify folder.'
        : `Unexpected reply (HTTP ${response.status}).`,
    );
  }

  if (!response.ok || !payload.audio) {
    throw new TtsError(
      payload.error || 'The speech model did not return audio.',
      payload.hint,
    );
  }

  return payload.audio;
}
