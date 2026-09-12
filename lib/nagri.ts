/**
 * Sylheti Nagri script engine.
 *
 * The TTS model behind this app accepts ROMAN (Latin) Sylheti text only.
 * So every input script is funnelled to Roman before it reaches the model:
 *
 *     Bangla  ->  Nagri  ->  Roman  ->  model
 *     Nagri   ->  Roman  ->  model
 *     Roman   ->  model
 *
 * That means a single working endpoint can voice all three scripts, and the
 * exact same path is used for a whole sentence or for one single letter.
 *
 * Unicode block: Syloti Nagri, U+A800 - U+A82B.
 */

/* ------------------------------------------------------------------ */
/* Code points                                                         */
/* ------------------------------------------------------------------ */

export const N = {
  A: '\uA800', I: '\uA801', DVISVARA: '\uA802', U: '\uA803', E: '\uA804', O: '\uA805',
  HASANTA: '\uA806',
  KO: '\uA807', KHO: '\uA808', GO: '\uA809', GHO: '\uA80A', ANUSVARA: '\uA80B',
  CO: '\uA80C', CHO: '\uA80D', JO: '\uA80E', JHO: '\uA80F',
  TTO: '\uA810', TTHO: '\uA811', DDO: '\uA812', DDHO: '\uA813',
  TO: '\uA814', THO: '\uA815', DO: '\uA816', DHO: '\uA817', NO: '\uA818',
  PO: '\uA819', PHO: '\uA81A', BO: '\uA81B', BHO: '\uA81C', MO: '\uA81D',
  RO: '\uA81E', LO: '\uA81F', RRO: '\uA820', SO: '\uA821', HO: '\uA822',
  V_A: '\uA823', V_I: '\uA824', V_U: '\uA825', V_E: '\uA826', V_OO: '\uA827',
} as const;

/** The inherent vowel carried by every bare consonant. */
const INHERENT = 'o';

/* ------------------------------------------------------------------ */
/* The 32 letters, as taught in the Learn tab                          */
/* ------------------------------------------------------------------ */

export interface Letter {
  char: string;      // the Nagri glyph
  name: string;      // its traditional name, e.g. "Ko"
  /**
   * The bare Latin sound sent to the model when this letter is tapped:
   * k, kh, g ... rather than the syllable ko, kho, go.
   *
   * This affects the Learn tab ONLY. Inside a word the inherent vowel is
   * still needed — see nagriWordToRoman — or ꠇꠦꠝꠘ would come out as "kemn"
   * instead of "kemon".
   *
   * To go back to syllables, put the vowel back here (k -> ko).
   */
  roman: string;
  bangla: string;    // nearest Bangla letter, for learners
  kind: 'vowel' | 'consonant';
}

export const LETTERS: Letter[] = [
  { char: N.A,   name: 'A',    roman: 'a',   bangla: 'আ', kind: 'vowel' },
  { char: N.I,   name: 'I',    roman: 'i',   bangla: 'ই', kind: 'vowel' },
  { char: N.U,   name: 'U',    roman: 'u',   bangla: 'উ', kind: 'vowel' },
  { char: N.E,   name: 'E',    roman: 'e',   bangla: 'এ', kind: 'vowel' },
  { char: N.O,   name: 'O',    roman: 'o',   bangla: 'ও', kind: 'vowel' },

  { char: N.KO,   name: 'Ko',   roman: 'k',    bangla: 'ক',  kind: 'consonant' },
  { char: N.KHO,  name: 'Kho',  roman: 'kh',   bangla: 'খ',  kind: 'consonant' },
  { char: N.GO,   name: 'Go',   roman: 'g',    bangla: 'গ',  kind: 'consonant' },
  { char: N.GHO,  name: 'Gho',  roman: 'gh',   bangla: 'ঘ',  kind: 'consonant' },
  { char: N.CO,   name: 'Co',   roman: 'c',    bangla: 'চ',  kind: 'consonant' },
  { char: N.CHO,  name: 'Cho',  roman: 'ch',   bangla: 'ছ',  kind: 'consonant' },
  { char: N.JO,   name: 'Jo',   roman: 'j',    bangla: 'জ',  kind: 'consonant' },
  { char: N.JHO,  name: 'Jho',  roman: 'jh',   bangla: 'ঝ',  kind: 'consonant' },
  { char: N.TTO,  name: 'Tto',  roman: 't',    bangla: 'ট',  kind: 'consonant' },
  { char: N.TTHO, name: 'Ttho', roman: 'th',   bangla: 'ঠ',  kind: 'consonant' },
  { char: N.DDO,  name: 'Ddo',  roman: 'd',    bangla: 'ড',  kind: 'consonant' },
  { char: N.DDHO, name: 'Ddho', roman: 'dh',   bangla: 'ঢ',  kind: 'consonant' },
  { char: N.TO,   name: 'To',   roman: 't',    bangla: 'ত',  kind: 'consonant' },
  { char: N.THO,  name: 'Tho',  roman: 'th',   bangla: 'থ',  kind: 'consonant' },
  { char: N.DO,   name: 'Do',   roman: 'd',    bangla: 'দ',  kind: 'consonant' },
  { char: N.DHO,  name: 'Dho',  roman: 'dh',   bangla: 'ধ',  kind: 'consonant' },
  { char: N.NO,   name: 'No',   roman: 'n',    bangla: 'ন',  kind: 'consonant' },
  { char: N.PO,   name: 'Po',   roman: 'p',    bangla: 'প',  kind: 'consonant' },
  { char: N.PHO,  name: 'Pho',  roman: 'ph',   bangla: 'ফ',  kind: 'consonant' },
  { char: N.BO,   name: 'Bo',   roman: 'b',    bangla: 'ব',  kind: 'consonant' },
  { char: N.BHO,  name: 'Bho',  roman: 'bh',   bangla: 'ভ',  kind: 'consonant' },
  { char: N.MO,   name: 'Mo',   roman: 'm',    bangla: 'ম',  kind: 'consonant' },
  { char: N.RO,   name: 'Ro',   roman: 'r',    bangla: 'র',  kind: 'consonant' },
  { char: N.LO,   name: 'Lo',   roman: 'l',    bangla: 'ল',  kind: 'consonant' },
  { char: N.RRO,  name: 'Rro',  roman: 'rh',   bangla: 'ড়',  kind: 'consonant' },
  { char: N.SO,   name: 'So',   roman: 's',    bangla: 'স',  kind: 'consonant' },
  { char: N.HO,   name: 'Ho',   roman: 'h',    bangla: 'হ',  kind: 'consonant' },
];

/* ------------------------------------------------------------------ */
/* Nagri -> Roman                                                      */
/* ------------------------------------------------------------------ */

/** Bare consonant sounds, without the inherent vowel. */
const CONS_ROMAN: Record<string, string> = {
  [N.KO]: 'k',  [N.KHO]: 'kh', [N.GO]: 'g',  [N.GHO]: 'gh',
  [N.CO]: 'c',  [N.CHO]: 'ch', [N.JO]: 'j',  [N.JHO]: 'jh',
  [N.TTO]: 't', [N.TTHO]: 'th', [N.DDO]: 'd', [N.DDHO]: 'dh',
  [N.TO]: 't',  [N.THO]: 'th', [N.DO]: 'd',  [N.DHO]: 'dh',
  [N.NO]: 'n',
  [N.PO]: 'p',  [N.PHO]: 'ph', [N.BO]: 'b',  [N.BHO]: 'bh',
  [N.MO]: 'm',  [N.RO]: 'r',   [N.LO]: 'l',  [N.RRO]: 'rh',
  [N.SO]: 's',  [N.HO]: 'h',
};

/** Independent vowels. */
const VOWEL_ROMAN: Record<string, string> = {
  [N.A]: 'a', [N.I]: 'i', [N.U]: 'u', [N.E]: 'e', [N.O]: 'o',
};

/** Dependent vowel signs, which replace the inherent vowel. */
const SIGN_ROMAN: Record<string, string> = {
  [N.V_A]: 'a', [N.V_I]: 'i', [N.V_U]: 'u', [N.V_E]: 'e', [N.V_OO]: 'o',
};

const IS_NAGRI = /[\uA800-\uA82B]/;

/**
 * Romanise one run of Nagri characters (a single word).
 *
 * Sylheti, like Bangla, drops the inherent vowel at the end of a word:
 * the letters spell out "kemono" but it is pronounced "kemon". Feeding the
 * undropped form to the model makes it read an extra syllable, so the
 * trailing inherent vowel is removed here — except in one-consonant words
 * such as a single letter being sounded out on its own.
 */
function nagriWordToRoman(word: string): string {
  const chars = Array.from(word);
  let out = '';
  let consonants = 0;
  let endsWithInherent = false;

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];

    if (CONS_ROMAN[ch]) {
      consonants++;
      out += CONS_ROMAN[ch];
      const next = chars[i + 1];
      if (next && SIGN_ROMAN[next]) {
        out += SIGN_ROMAN[next];
        endsWithInherent = false;
        i++;
      } else if (next === N.HASANTA) {
        endsWithInherent = false;
        i++;
      } else if (next === N.ANUSVARA) {
        out += INHERENT + 'ng';
        endsWithInherent = false;
        i++;
      } else {
        out += INHERENT;
        endsWithInherent = true;
      }
      continue;
    }

    if (VOWEL_ROMAN[ch]) {
      out += VOWEL_ROMAN[ch];
      endsWithInherent = false;
      const next = chars[i + 1];
      if (next && SIGN_ROMAN[next]) { out += SIGN_ROMAN[next]; i++; }
      continue;
    }

    if (SIGN_ROMAN[ch]) { out += SIGN_ROMAN[ch]; endsWithInherent = false; continue; }
    if (ch === N.ANUSVARA) { out += 'ng'; endsWithInherent = false; continue; }
    if (ch === N.DVISVARA) { out += 'i'; endsWithInherent = false; continue; }
    if (ch === N.HASANTA) { endsWithInherent = false; continue; }
  }

  if (endsWithInherent && consonants >= 2) {
    out = out.slice(0, -INHERENT.length);
  }
  return out;
}

/**
 * Convert Syloti Nagri text to the Roman form the model understands.
 * Text is split into Nagri runs so that each word gets its own
 * inherent-vowel treatment; everything else passes through.
 */
export function nagriToRoman(input: string): string {
  let out = '';
  let buf = '';

  const flush = () => { if (buf) { out += nagriWordToRoman(buf); buf = ''; } };

  for (const ch of Array.from(input)) {
    if (IS_NAGRI.test(ch)) { buf += ch; continue; }
    flush();
    out += mapPunctuation(ch);
  }
  flush();

  return tidy(out);
}

/* ------------------------------------------------------------------ */
/* Bangla -> Nagri                                                     */
/* ------------------------------------------------------------------ */

const BN_CONS: Record<string, string> = {
  'ক': N.KO, 'খ': N.KHO, 'গ': N.GO, 'ঘ': N.GHO, 'ঙ': N.ANUSVARA,
  'চ': N.CO, 'ছ': N.CHO, 'জ': N.JO, 'ঝ': N.JHO, 'ঞ': N.NO,
  'ট': N.TTO, 'ঠ': N.TTHO, 'ড': N.DDO, 'ঢ': N.DDHO, 'ণ': N.NO,
  'ত': N.TO, 'থ': N.THO, 'দ': N.DO, 'ধ': N.DHO, 'ন': N.NO,
  'প': N.PO, 'ফ': N.PHO, 'ব': N.BO, 'ভ': N.BHO, 'ম': N.MO,
  'য': N.JO, 'র': N.RO, 'ল': N.LO,
  'শ': N.SO, 'ষ': N.SO, 'স': N.SO, 'হ': N.HO,
  '\u09DC': N.RRO, '\u09DD': N.RRO, '\u09DF': N.E,   // ড় ঢ় য় as single code points
  'ৎ': N.TO,
};

const BN_VOWEL: Record<string, string> = {
  'অ': N.O, 'আ': N.A, 'ই': N.I, 'ঈ': N.I, 'উ': N.U, 'ঊ': N.U,
  'ঋ': N.RO + N.V_I, 'এ': N.E, 'ঐ': N.O + N.E, 'ও': N.O, 'ঔ': N.O + N.U,
};

const BN_SIGN: Record<string, string> = {
  'া': N.V_A, 'ি': N.V_I, 'ী': N.V_I, 'ু': N.V_U, 'ূ': N.V_U,
  'ৃ': N.RO + N.V_I, 'ে': N.V_E, 'ৈ': N.V_E, 'ো': N.V_OO, 'ৌ': N.V_OO,
};

const BN_DIGIT: Record<string, string> = {
  '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
  '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9',
};

/**
 * Bangla letters carrying a nukta (য় ড় ঢ়) exist in two Unicode forms: one
 * precomposed character, or a base letter followed by the combining nukta
 * U+09BC. Phone keyboards emit either.
 *
 * NFC does NOT merge them, because these compositions are on Unicode's
 * composition exclusion list. So they are folded by hand here. Without this
 * the character loop consumes the base letter first and drops the nukta, and
 * ১০টায় came out as "10taj" instead of "10tae".
 */
function foldNukta(input: string): string {
  return input
    .replace(/\u09A1\u09BC/g, '\u09DC')   // ড + nukta -> ড়
    .replace(/\u09A2\u09BC/g, '\u09DD')   // ঢ + nukta -> ঢ়
    .replace(/\u09AF\u09BC/g, '\u09DF');  // য + nukta -> য়
}

/** Rule-based Bangla to Syloti Nagri. Approximate, as the scripts are not 1:1. */
export function banglaToNagri(input: string): string {
  let out = '';
  for (const ch of Array.from(foldNukta(input))) {
    if (BN_CONS[ch]) { out += BN_CONS[ch]; continue; }
    if (BN_VOWEL[ch]) { out += BN_VOWEL[ch]; continue; }
    if (BN_SIGN[ch]) { out += BN_SIGN[ch]; continue; }
    if (ch === '্') { out += N.HASANTA; continue; }
    if (ch === 'ং') { out += N.ANUSVARA; continue; }
    if (ch === 'ঃ') { out += N.HO; continue; }
    if (ch === 'ঁ') { continue; }                    // no Nagri equivalent
    if (BN_DIGIT[ch]) { out += BN_DIGIT[ch]; continue; }
    if (ch === '।') { out += '.'; continue; }
    out += ch;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Nagri -> Bangla                                                     */
/* ------------------------------------------------------------------ */

const N_TO_BN: Record<string, string> = {
  [N.A]: 'আ', [N.I]: 'ই', [N.U]: 'উ', [N.E]: 'এ', [N.O]: 'ও',
  [N.KO]: 'ক', [N.KHO]: 'খ', [N.GO]: 'গ', [N.GHO]: 'ঘ',
  [N.CO]: 'চ', [N.CHO]: 'ছ', [N.JO]: 'জ', [N.JHO]: 'ঝ',
  [N.TTO]: 'ট', [N.TTHO]: 'ঠ', [N.DDO]: 'ড', [N.DDHO]: 'ঢ',
  [N.TO]: 'ত', [N.THO]: 'থ', [N.DO]: 'দ', [N.DHO]: 'ধ', [N.NO]: 'ন',
  [N.PO]: 'প', [N.PHO]: 'ফ', [N.BO]: 'ব', [N.BHO]: 'ভ', [N.MO]: 'ম',
  [N.RO]: 'র', [N.LO]: 'ল', [N.RRO]: 'ড়', [N.SO]: 'স', [N.HO]: 'হ',
  [N.V_A]: 'া', [N.V_I]: 'ি', [N.V_U]: 'ু', [N.V_E]: 'ে', [N.V_OO]: 'ো',
  [N.ANUSVARA]: 'ং', [N.HASANTA]: '্', [N.DVISVARA]: 'ই',
};

export function nagriToBangla(input: string): string {
  let out = '';
  for (const ch of Array.from(input)) {
    out += N_TO_BN[ch] ?? (ch === '.' ? '।' : ch);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function mapPunctuation(ch: string): string {
  if (ch === '\uA828' || ch === '\uA829') return ',';
  if (ch === '\uA82A' || ch === '\uA82B') return '.';
  if (ch === '।') return '.';
  if (BN_DIGIT[ch]) return BN_DIGIT[ch];
  return ch;
}

function tidy(s: string): string {
  return s.replace(/\s+/g, ' ').replace(/\s+([,.!?])/g, '$1').trim();
}

/* ------------------------------------------------------------------ */
/* Roman -> Nagri                                                      */
/* ------------------------------------------------------------------ */

/** Longest match first, so "kh" wins over "k". */
const ROMAN_CONS: [string, string][] = [
  ['kh', N.KHO], ['gh', N.GHO], ['ch', N.CHO], ['jh', N.JHO],
  ['th', N.THO], ['dh', N.DHO], ['ph', N.PHO], ['bh', N.BHO],
  ['rh', N.RRO], ['ng', N.ANUSVARA], ['sh', N.SO],
  ['k', N.KO], ['g', N.GO], ['c', N.CO], ['j', N.JO],
  ['t', N.TO], ['d', N.DO], ['n', N.NO], ['p', N.PO], ['f', N.PHO],
  ['b', N.BO], ['m', N.MO], ['r', N.RO], ['l', N.LO], ['s', N.SO],
  ['h', N.HO], ['y', N.JO], ['v', N.BO], ['w', N.BO], ['z', N.JO],
  ['x', N.KHO], ['q', N.KO],
];

/** Roman vowel -> [independent form, dependent sign]. */
const ROMAN_VOWEL: [string, string, string][] = [
  ['aa', N.A, N.V_A], ['ee', N.I, N.V_I], ['oo', N.U, N.V_U], ['ou', N.O, N.V_OO],
  ['a', N.A, N.V_A], ['i', N.I, N.V_I], ['u', N.U, N.V_U],
  ['e', N.E, N.V_E], ['o', N.O, N.V_OO],
];

function romanWordToNagri(word: string): string {
  const w = word.toLowerCase();
  let out = '';
  let i = 0;
  let pendingConsonant = false;   // a consonant is waiting for its vowel

  while (i < w.length) {
    const rest = w.slice(i);

    const cons = ROMAN_CONS.find(([r]) => rest.startsWith(r));
    if (cons) {
      if (pendingConsonant) out += N.HASANTA;   // consonant cluster
      out += cons[1];
      pendingConsonant = true;
      i += cons[0].length;
      continue;
    }

    const vowel = ROMAN_VOWEL.find(([r]) => rest.startsWith(r));
    if (vowel) {
      const [r, indep, sign] = vowel;
      const atWordEnd = i + r.length >= w.length;
      if (pendingConsonant) {
        // "o" is the inherent vowel, so it needs no sign mid-word — but at the
        // end of a word the inherent vowel is silent, so it must be written out
        if (r === 'o' && !atWordEnd) {
          /* inherent, nothing to add */
        } else {
          out += sign;
        }
        pendingConsonant = false;
      } else {
        out += indep;
      }
      i += r.length;
      continue;
    }

    out += rest[0];
    pendingConsonant = false;
    i += 1;
  }

  return out;
}

/** Convert Roman Sylheti into Syloti Nagri, so it can be sent to the model. */
export function romanToNagri(input: string): string {
  let out = '';
  let buf = '';
  const flush = () => { if (buf) { out += romanWordToNagri(buf); buf = ''; } };

  for (const ch of Array.from(input)) {
    if (/[A-Za-z]/.test(ch)) { buf += ch; continue; }
    flush();
    out += ch;
  }
  flush();
  return out;
}

/* ------------------------------------------------------------------ */
/* Preparing text for the model                                        */
/* ------------------------------------------------------------------ */

/**
 * Keep only characters the Roman Sylheti model can tokenise.
 *
 * Anything unexpected (a stray Bangla letter, a Nagri poetry mark, an emoji)
 * can land outside the model's vocabulary. On this Space that does not fail
 * politely — it triggers a CUDA index assert that takes the whole GPU worker
 * down until the Space is restarted. So the input is filtered here first.
 */
export function sanitizeRoman(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9 .,!?'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const MIN_WORDS = 3;
const MIN_CHARS = 8;
const MAX_REPEATS = 6;

/**
 * The Space rejects very short input ("Please enter a longer sentence"),
 * which would make every single letter in the Learn tab fail. Short text is
 * therefore repeated until it is long enough — so a learner tapping one
 * letter hears that letter sounded out several times, which is what you want
 * when learning an alphabet anyway.
 *
 * Normal sentences are already long enough and pass through untouched.
 */
export function padForModel(input: string): string {
  const clean = sanitizeRoman(input);
  if (!clean) return '';

  let out = clean;
  let repeats = 1;
  while (
    (out.split(' ').length < MIN_WORDS || out.length < MIN_CHARS) &&
    repeats < MAX_REPEATS
  ) {
    out = `${out} ${clean}`;
    repeats += 1;
  }
  return out;
}

export type Script = 'nagri' | 'bangla' | 'roman' | 'empty';

/** Work out which script the user typed, so we can pick the right pipeline. */
export function detectScript(text: string): Script {
  const t = text.trim();
  if (!t) return 'empty';
  if (/[\uA800-\uA82B]/.test(t)) return 'nagri';
  if (/[\u0980-\u09FF]/.test(t)) return 'bangla';
  return 'roman';
}

/**
 * Everything the model receives goes through here.
 *
 * The working endpoint (predict_syl) takes ROMAN Sylheti text, so every script
 * is converted to Roman before it is sent:
 *
 *     Bangla  ->  Nagri  ->  Roman  ->  model
 *     Nagri   ->  Roman  ->  model
 *     Roman   ->  model
 *
 * `nagri` is returned so the interface can also show the Nagri spelling.
 */
export function toSpeakable(text: string): { roman: string; nagri: string; from: Script } {
  const from = detectScript(text);
  if (from === 'bangla') {
    const nagri = banglaToNagri(text);
    return { roman: nagriToRoman(nagri), nagri, from };
  }
  if (from === 'nagri') {
    return { roman: nagriToRoman(text), nagri: text, from };
  }
  if (from === 'roman') {
    // normalise via Nagri and back, so typed Roman and converted Bangla
    // reach the model in exactly the same spelling
    const nagri = romanToNagri(text);
    return { roman: nagriToRoman(nagri), nagri, from };
  }
  return { roman: '', nagri: '', from };
}

export const EXAMPLES: { bangla: string; gloss: string }[] = [
  { bangla: 'আপনি কেমন আছেন', gloss: 'How are you?' },
  { bangla: 'আমার নাম রহিম', gloss: 'My name is Rahim' },
  { bangla: 'সিলেট আমার দেশ', gloss: 'Sylhet is my homeland' },
  { bangla: 'ভাত খাইছেন নি', gloss: 'Have you eaten?' },
  { bangla: 'আজি বালা দিন', gloss: 'Today is a good day' },
];
