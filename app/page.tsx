'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LETTERS,
  EXAMPLES,
  banglaToNagri,
  nagriToBangla,
  nagriToRoman,
  toSpeakable,
  detectScript,
  padForModel,
  type Letter,
} from '@/lib/nagri';
import { synthesize, TtsError, SPACE_ID } from '@/lib/tts';

type Tab = 'learn' | 'listen' | 'convert' | 'history' | 'resources' | 'about';

const TABS: { id: Tab; label: string }[] = [
  { id: 'learn', label: 'Learn Nagri' },
  { id: 'listen', label: 'Listen & practise' },
  { id: 'convert', label: 'Bangla ⇄ Nagri' },
  { id: 'history', label: 'History' },
  { id: 'resources', label: 'Resources' },
  { id: 'about', label: 'About' },
];

const HERO_GLYPHS = ['\uA800', '\uA807', '\uA819', '\uA81E', '\uA822'];

/* ------------------------------------------------------------------ */
/* Shared audio hook                                                   */
/* ------------------------------------------------------------------ */

function useSpeech() {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<{ msg: string; hint?: string } | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const speak = useCallback(async (roman: string, key = 'default') => {
    setError(null);
    setBusy(key);
    try {
      const audioUrl = await synthesize(roman);
      setUrl(audioUrl);
      // play immediately; browsers allow it because a click started this
      if (!audioRef.current) audioRef.current = new Audio();
      audioRef.current.src = audioUrl;
      await audioRef.current.play().catch(() => {});
      return audioUrl;
    } catch (err) {
      if (err instanceof TtsError) setError({ msg: err.message, hint: err.hint });
      else setError({ msg: 'Something went wrong while generating speech.' });
      return null;
    } finally {
      setBusy(null);
    }
  }, []);

  return { speak, busy, error, url, setError };
}

/* ------------------------------------------------------------------ */

export default function Page() {
  const [tab, setTab] = useState<Tab>('learn');

  return (
    <>
      <div className="wrap">
        <Masthead />
        <Hero />
        <nav className="tabs" role="tablist" aria-label="Sections">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              className="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <main>
          {tab === 'learn' && <LearnTab />}
          {tab === 'listen' && <ListenTab />}
          {tab === 'convert' && <ConvertTab />}
          {tab === 'history' && <HistoryTab />}
          {tab === 'resources' && <ResourcesTab />}
          {tab === 'about' && <AboutTab />}
        </main>

        <Footer />
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */

function Masthead() {
  return (
    <header className="masthead">
      <div className="masthead-row">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="crest" src="/logos/sust.png" alt="Shahjalal University of Science and Technology" />
        <div className="inst">
          <h1>SHAHJALAL UNIVERSITY OF SCIENCE &amp; TECHNOLOGY</h1>
          <p>Department of Computer Science &amp; Engineering · Sylhet, Bangladesh</p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="fair" src="/logos/fair.png" alt="Bangladesh Innovation Fair 2026" />
      </div>
      <div className="rule" />
    </header>
  );
}

function Hero() {
  return (
    <section className="hero">
      <div className="glyphrow" aria-hidden="true">
        {HERO_GLYPHS.map((g, i) => (
          <span key={g} className={`glyphtile ${i % 2 === 0 ? 'a' : 'b'}`}>{g}</span>
        ))}
      </div>
      <p className="kicker">A 500-YEAR-OLD SCRIPT GETS ITS VOICE BACK</p>
      <h1 className="title">Nagri Path<span className="dot">.</span></h1>
      <div className="panel panel-accent" style={{ marginTop: 14 }}>
        <p className="kicker" style={{ marginBottom: 4 }}>WHAT IS THIS?</p>
        <h2>An app that teaches Sylhet&rsquo;s own alphabet — and speaks it.</h2>
        <p className="lede">
          Sylheti has its own script, Nagri, that almost nobody can read any more. This app
          teaches all 32 letters, says each one out loud, and turns what you write in Bangla
          into Nagri instantly.
        </p>
        <p className="bn muted" style={{ marginTop: 8 }}>
          সিলেটি নাগরী লিপির ৩২টি অক্ষর শিখুন, হারিয়ে যাওয়া লিপিকে ভাষা দিন।
        </p>
        <div className="chips">
          <span className="chip teal"><i />Works on mobile and web</span>
          <span className="chip terra"><i />Installs like an app</span>
          <span className="chip gold"><i />No signup needed</span>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Learn                                                               */
/* ------------------------------------------------------------------ */

function LearnTab() {
  const [selected, setSelected] = useState<Letter>(LETTERS[0]);
  const [heard, setHeard] = useState<string[]>([]);
  const { speak, busy, error } = useSpeech();

  // remember which letters have been played, on this device only
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('nagri-heard');
      if (saved) setHeard(JSON.parse(saved));
    } catch { /* storage unavailable, progress just won't persist */ }
  }, []);

  const play = async (letter: Letter) => {
    setSelected(letter);
    const ok = await speak(padForModel(letter.roman), letter.char);
    if (ok) {
      setHeard((prev) => {
        if (prev.includes(letter.char)) return prev;
        const next = [...prev, letter.char];
        try { window.localStorage.setItem('nagri-heard', JSON.stringify(next)); } catch {}
        return next;
      });
    }
  };

  const pct = Math.round((heard.length / LETTERS.length) * 100);

  return (
    <section className="stack">
      <div className="panel">
        <h2>All 32 letters, one at a time</h2>
        <p className="muted small">
          Tap any letter to hear it spoken by the model. Vowels first, then consonants.
          Each letter is repeated a few times, because the model needs more than one
          syllable to produce clean audio.
        </p>

        <div className="lettergrid">
          {LETTERS.map((l) => (
            <button
              key={l.char}
              className={`letter${selected.char === l.char ? ' active' : ''}${heard.includes(l.char) ? ' learned' : ''}`}
              onClick={() => play(l)}
              disabled={busy !== null}
              aria-label={`Play ${l.name}`}
            >
              <span className="g">{l.char}</span>
              <span className="n">{busy === l.char ? '…' : l.name}</span>
              <span className="b">{l.bangla}</span>
            </button>
          ))}
        </div>

        <div className="detail">
          <div className="big">{selected.char}</div>
          <div className="meta">
            <strong>{selected.name}</strong>
            <span className="muted small">
              <span className="bn">Bangla {selected.bangla}</span> · {selected.kind} ·
              {' '}sent to the model as &ldquo;{padForModel(selected.roman)}&rdquo;
            </span>
          </div>
          <button className="btn btn-terra" onClick={() => play(selected)} disabled={busy !== null}>
            {busy === selected.char ? <span className="spinner" /> : '▶'} Play sound
          </button>
        </div>

        <div style={{ marginTop: 16 }}>
          <div className="small muted" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Your progress</span>
            <span>{heard.length} of {LETTERS.length} letters heard</span>
          </div>
          <div className="progress"><div style={{ width: `${pct}%` }} /></div>
        </div>

        {error && <ErrorBox error={error} />}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Listen                                                              */
/* ------------------------------------------------------------------ */

function ListenTab() {
  const [text, setText] = useState('আপনি কেমন আছেন');
  const { speak, busy, error, url } = useSpeech();

  const prepared = useMemo(() => toSpeakable(text), [text]);
  const scriptLabel =
    prepared.from === 'bangla' ? 'Bangla' :
    prepared.from === 'nagri' ? 'Nagri' :
    prepared.from === 'roman' ? 'Roman Sylheti' : '—';

  return (
    <section className="stack">
      <div className="panel">
        <h2>Type anything, hear it in Sylheti</h2>
        <p className="muted small">
          Write in Bangla, in Nagri, or in Roman letters. Whatever you type is converted to
          the Roman form the model reads, so all three scripts work.
        </p>

        <div style={{ marginTop: 14 }}>
          <label className="field" htmlFor="listen-input">YOUR TEXT · detected as {scriptLabel}</label>
          <textarea
            id="listen-input"
            rows={3}
            value={text}
            maxLength={400}
            onChange={(e) => setText(e.target.value)}
            placeholder="আপনি কেমন আছেন"
          />
          <div className="counter">{text.length} / 400</div>
        </div>

        <div className="btnrow">
          <button
            className="btn btn-primary"
            disabled={busy !== null || !prepared.roman}
            onClick={() => speak(padForModel(prepared.roman))}
          >
            {busy ? <span className="spinner" /> : '▶'} Hear it spoken
          </button>
          <span className="small muted">Sylheti Nagri voice</span>
        </div>

        {(prepared.nagri || prepared.roman) && (
          <div className="result">
            {prepared.nagri && (
              <>
                <h3>IN NAGRI</h3>
                <div className="nagri-out">{prepared.nagri}</div>
              </>
            )}
            <h3 style={{ marginTop: prepared.nagri ? 12 : 0 }}>SENT TO THE MODEL</h3>
            <div className="roman-out">{prepared.roman}</div>
            {url && <audio controls src={url} />}
          </div>
        )}

        {error && <ErrorBox error={error} />}

        <div style={{ marginTop: 18 }}>
          <p className="field">TRY ONE OF THESE</p>
          <div className="btnrow" style={{ marginTop: 0 }}>
            {EXAMPLES.map((ex) => (
              <button key={ex.bangla} className="btn btn-ghost" onClick={() => setText(ex.bangla)}>
                <span className="bn">{ex.bangla}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="note">
        The model reads Roman Sylheti, so Bangla and Nagri are transliterated first using the
        rules in lib/nagri.ts. Typed Roman goes through the same normalisation, so all three
        scripts reach the model in one consistent spelling.
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Convert                                                             */
/* ------------------------------------------------------------------ */

function ConvertTab() {
  const [dir, setDir] = useState<'bn2ng' | 'ng2bn'>('bn2ng');
  const [text, setText] = useState('আপনি কেমন আছেন');
  const { speak, busy, error, url } = useSpeech();

  const output = useMemo(
    () => (dir === 'bn2ng' ? banglaToNagri(text) : nagriToBangla(text)),
    [dir, text],
  );
  const nagri = dir === 'bn2ng' ? output : text;
  const roman = useMemo(() => nagriToRoman(nagri), [nagri]);

  const swap = () => {
    setDir((d) => (d === 'bn2ng' ? 'ng2bn' : 'bn2ng'));
    setText(output);
  };

  return (
    <section className="stack">
      <div className="panel">
        <h2>{dir === 'bn2ng' ? 'Bangla → Nagri' : 'Nagri → Bangla'}</h2>
        <p className="muted small">
          A rule-based converter that maps letter by letter. The two scripts are not a perfect
          one-to-one match, so treat the output as a close approximation.
        </p>

        <div className="btnrow" style={{ marginTop: 12 }}>
          <button className="btn btn-ghost" onClick={swap}>⇄ Swap direction</button>
        </div>

        <div style={{ marginTop: 14 }}>
          <label className="field" htmlFor="conv-input">
            {dir === 'bn2ng' ? 'TYPE IN BANGLA' : 'TYPE IN NAGRI'}
          </label>
          <textarea
            id="conv-input"
            rows={3}
            value={text}
            maxLength={400}
            className={dir === 'bn2ng' ? 'bn' : 'ng'}
            onChange={(e) => setText(e.target.value)}
          />
        </div>

        <div className="result">
          <h3>{dir === 'bn2ng' ? 'IN NAGRI' : 'IN BANGLA'}</h3>
          <div className={dir === 'bn2ng' ? 'nagri-out' : 'nagri-out bn'}>
            {output || <span className="muted">…</span>}
          </div>
          <h3 style={{ marginTop: 12 }}>SENT TO THE MODEL</h3>
          <div className="roman-out">{roman || '…'}</div>
          <div className="btnrow">
            <button className="btn btn-terra" disabled={busy !== null || !roman} onClick={() => speak(padForModel(roman))}>
              {busy ? <span className="spinner" /> : '▶'} Hear it
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => navigator.clipboard?.writeText(output)}
              disabled={!output}
            >
              Copy result
            </button>
          </div>
          {url && <audio controls src={url} />}
        </div>

        {error && <ErrorBox error={error} />}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* History                                                             */
/* ------------------------------------------------------------------ */

const HISTORY = [
  { yr: '1549', t: 'The oldest surviving puthi', d: 'Talib Husan by Gholam Huson — the earliest Nagri manuscript we still have.' },
  { yr: '1855', t: 'A book in every household', d: 'Halat-un-Nabi becomes the most widely printed Nagri book ever made.' },
  { yr: 'c.1870', t: 'Sylhet gets its own press', d: 'Moulvi Abdul Karim learns printing in London and founds Islamia Press at Bandar Bazar.' },
  { yr: '1970s', t: 'The presses fall silent', d: 'Nagri printing stops; the script survives mainly in archives and in memory.' },
  { yr: '2005', t: 'Nagri enters Unicode', d: '32 letters encoded at block U+A800 — the script can finally be typed on a computer.' },
  { yr: '2026', t: 'Nagri learns to speak', d: 'This project gives the script a working AI voice for the first time.' },
];

function HistoryTab() {
  return (
    <section className="stack">
      <div className="panel">
        <h2>The story of Nagri</h2>
        <p className="muted small">Sylhet had its own script for five centuries. Then it went quiet.</p>
        <div className="timeline">
          {HISTORY.map((h, i) => (
            <div key={h.yr} className={`tl${i === HISTORY.length - 1 ? ' last' : ''}`}>
              <div className="yr">{h.yr}</div>
              <h3>{h.t}</h3>
              <p>{h.d}</p>
            </div>
          ))}
        </div>
        <div className="stats">
          <div className="stat"><b>32</b><span>letters taught</span></div>
          <div className="stat"><b>500+</b><span>years of heritage</span></div>
          <div className="stat"><b>3</b><span>scripts supported</span></div>
        </div>
        <p className="small muted" style={{ marginTop: 14 }}>
          Sources: Banglapedia · British Library EAP071 Sylheti manuscript archive · Unicode Consortium.
        </p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Resources                                                           */
/* ------------------------------------------------------------------ */

const RESOURCES = [
  { href: 'https://github.com/Ataullha/Sylheti-Speech-Synthesis-and-related-speech-corpus-preparation', t: 'Project source and corpus preparation', d: 'The research repository behind this work.' },
  { href: 'https://eap.bl.uk/project/EAP071', t: 'British Library — EAP071 Sylheti archive', d: 'Digitised Nagri manuscripts and printed books from Sylhet.' },
  { href: 'https://www.unicode.org/charts/PDF/UA800.pdf', t: 'Unicode chart — Syloti Nagri (U+A800)', d: 'The official code chart for all 32 letters and their signs.' },
  { href: 'https://fonts.google.com/noto/specimen/Noto+Sans+Syloti+Nagri', t: 'Noto Sans Syloti Nagri', d: 'The open font used throughout this app.' },
  { href: 'https://keymanweb.com/', t: 'Keyman — Syloti Nagri keyboard', d: 'Type Nagri directly on your phone or computer.' },
  { href: 'https://en.banglapedia.org/index.php/Sylheti_Nagri', t: 'Banglapedia — Sylheti Nagri', d: 'A concise scholarly history of the script.' },
];

function ResourcesTab() {
  return (
    <section className="stack">
      <div className="panel">
        <h2>Resource library</h2>
        <p className="muted small">Archives, fonts, keyboards and scholarship on the script.</p>
        <ul className="linklist">
          {RESOURCES.map((r) => (
            <li key={r.href}>
              <a href={r.href} target="_blank" rel="noopener noreferrer">{r.t}</a>
              <p>{r.d}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* About                                                               */
/* ------------------------------------------------------------------ */

function AboutTab() {
  return (
    <section className="stack">
      <div className="panel">
        <h2>About this project</h2>
        <p>
          Nagri Path is a research project of the Department of Computer Science &amp;
          Engineering at Shahjalal University of Science &amp; Technology, Sylhet. It pairs a
          neural text-to-speech model for Sylheti with a rule-based transliteration engine, so
          that the Nagri script can be read, written and heard again.
        </p>
        <p>
          The speech model is a VITS system trained on a purpose-built Sylheti Nagri corpus of
          over fifteen hours of studio recordings from a professional voice artist — the first
          corpus of its kind for this language.
        </p>
        <div className="grid3" style={{ marginTop: 16 }}>
          <div className="card">
            <div className="num">1</div>
            <h3>Supervisor</h3>
            <p>Prof. Dr. M. Shahidur Rahman, Department of CSE, SUST</p>
          </div>
          <div className="card">
            <div className="num">2</div>
            <h3>Speech model</h3>
            <p>VITS, served from Hugging Face Spaces ({SPACE_ID})</p>
          </div>
          <div className="card">
            <div className="num">3</div>
            <h3>Transliteration</h3>
            <p>Rule-based Bangla ⇄ Nagri ⇄ Roman, running in your browser</p>
          </div>
        </div>
      </div>

      <div className="panel">
        <h2>Install it as an app</h2>
        <p className="muted small">
          Nagri Path is a progressive web app. On Android, open the browser menu and choose
          &ldquo;Add to Home Screen&rdquo;. On iPhone, tap the Share button and then
          &ldquo;Add to Home Screen&rdquo;. It then opens full screen like any other app, and the
          interface keeps working without a connection — only the speech itself needs the network.
        </p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function ErrorBox({ error }: { error: { msg: string; hint?: string } }) {
  return (
    <div className="error" style={{ marginTop: 14 }}>
      <strong>{error.msg}</strong>
      {error.hint && <span>{error.hint}</span>}
    </div>
  );
}

function Footer() {
  return (
    <footer>
      <strong>Supervisor · Prof. Dr. M. Shahidur Rahman</strong>
      <div>Department of Computer Science &amp; Engineering, Shahjalal University of Science &amp; Technology</div>
      <div>Showcased at Bangladesh Innovation Fair 2026 · Novo Theatre, Dhaka</div>
    </footer>
  );
}
