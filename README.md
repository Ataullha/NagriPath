# Nagri Path

Teaches the Sylheti Nagri script, speaks each letter and sentence aloud, and
converts Bangla writing into Nagri.

Department of Computer Science & Engineering,
Shahjalal University of Science & Technology, Sylhet.
Supervisor: Prof. Dr. M. Shahidur Rahman.

## Deploy

Two ways, both work:

**A. Drag and drop (fastest).** Take `Nagri_Path_Netlify_Deploy.zip`, go to
Netlify -> Sites -> "Deploy manually", and drop the zip in. It is a plain
static site: no build step, no server, no environment variables.

**B. From source.** See "Deploying from Git" below.

## Which zip goes where

    *_Netlify_Deploy.zip   ->  Netlify "Deploy manually" (drag and drop) ONLY
    *_Source.zip           ->  Git, or local development

They are not interchangeable. The deploy zip is a finished site with no
package.json; pushing it to Git makes the build fail with
"Your publish directory cannot be the same as the base directory".

## Deploying from Git

Push the contents of the Source zip, then check one setting:

    Site configuration -> Build & deploy -> Build plugins

If "Next.js Runtime" is listed, remove it. This app is a static export, so
the runtime is not needed, and leaving it installed causes exactly the
publish-directory error above. Build command and publish directory come from
netlify.toml already (`npm run build` and `out`).

## How the speech works

Gradio refuses cross-origin requests from browsers as a CSRF protection, so a
static page can never call the Space directly — the request is blocked before
it leaves the browser. This is not a Space problem and cannot be fixed in the
frontend. The call therefore takes one extra hop:

    browser  ->  /api/tts  ->  netlify/functions/tts.js  ->  Hugging Face

Server to server, CORS does not apply. The function also streams the audio back
through itself, so the browser never contacts hf.space at all. It has zero npm
dependencies, so it deploys as a plain file with nothing to bundle.

    Space:    Ataullha/Sylheti_Nagri_TTS
    Endpoint: predict_nagri   (Syloti Nagri input, one voice)

Only the Nagri endpoint is used, because that is the one currently serving.
Every script is converted to Nagri before it is sent:

    Bangla  ->  Nagri  ->  model
    Roman   ->  Nagri  ->  model
    Nagri   ->  model

The same path is used for a whole sentence and for a single letter in the
Learn tab, so all 32 letters are pronounced by the real model rather than by
a recording.

The function tries both `/gradio_api/call/<fn>` and the older `/call/<fn>`
path, and falls back from `predict_nagri` to `predict_syl`.

## Deploying on Render (recommended if Netlify gives you trouble)

Render runs a normal Node process, so there is no serverless function to worry
about. `server.js` serves the built site and answers `/api/tts` itself.

Render deploys from a Git repo, so push the contents of the Source zip to
GitHub first. Then either:

**Blueprint (one click).** In Render: New -> Blueprint, select the repo.
`render.yaml` already contains everything.

**Or a Web Service by hand.** New -> Web Service, select the repo, and set:

    Runtime         Node
    Build Command   npm install && npm run build
    Start Command   node server.js

Leave the port alone; the server reads Render's `PORT` automatically.

IMPORTANT: choose **Web Service**, not **Static Site**. A static site has no
server, so `/api/tts` would not exist and the speech would fail for the same
CORS reason explained above.

Health check path is `/healthz` if Render asks.

### One catch with the free plan

A free Render web service sleeps after about 15 minutes idle and takes roughly
a minute to wake up. Before demoing, open the site once to wake it, and keep a
tab open so it stays warm.

## Changing the Space

Edit `SPACE` at the top of `netlify/functions/tts.js`, or set a `TTS_SPACE`
environment variable in the Netlify dashboard. The Space is never named in the
browser bundle, so no frontend rebuild is needed.

## Tuning the transliteration

All of the letter mapping lives in `lib/nagri.ts`:

- `LETTERS`      the 32 letters; `char` is sent to the model, `roman` is the
                 pronunciation hint shown in the interface
- `BN_CONS`, `BN_VOWEL`, `BN_SIGN`   Bangla -> Nagri
- `ROMAN_CONS`, `ROMAN_VOWEL`        Roman -> Nagri
- `CONS_ROMAN`, `VOWEL_ROMAN`, `SIGN_ROMAN`   Nagri -> Roman, used only for
  the on-screen pronunciation hint

Roman and Bangla input produce identical Nagri, so both routes reach the model
in the same form: "aponi kemon achen" and "আপনি কেমন আছেন" both become
ꠀꠙꠘꠤ ꠇꠦꠝꠘ ꠀꠍꠦꠘ.

## Local development

    npm install
    npm run dev      # Next dev server, http://localhost:3000
                     # note: /api/tts does not exist in this mode
    npm run build    # static export into ./out
    npm start        # server.js on http://localhost:3000, with /api/tts working

Use `npm run build && npm start` to test speech locally.
