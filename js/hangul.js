// Searching Korean by its letters (jamo), not only whole syllables: what's being typed matches as it's typed
// ("하" or "한" finds "하나"; "닭" is found by "달ㄱ" too, as the keyboard builds it). Each syllable is taken
// apart into its letters, a double vowel or final consonant into its two (ㅘ: ㅗㅏ, ㄺ: ㄹㄱ), and so is the
// query; the match is then a plain substring one. The server's user search does the same (hangul.py).

const L = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const V = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅗㅏ', 'ㅗㅐ', 'ㅗㅣ', 'ㅛ', 'ㅜ', 'ㅜㅓ', 'ㅜㅔ', 'ㅜㅣ', 'ㅠ', 'ㅡ', 'ㅡㅣ', 'ㅣ'];
const T = ['', 'ㄱ', 'ㄲ', 'ㄱㅅ', 'ㄴ', 'ㄴㅈ', 'ㄴㅎ', 'ㄷ', 'ㄹ', 'ㄹㄱ', 'ㄹㅁ', 'ㄹㅂ', 'ㄹㅅ', 'ㄹㅌ', 'ㄹㅍ', 'ㄹㅎ', 'ㅁ', 'ㅂ', 'ㅂㅅ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
// (letters typed on their own, double ones as the syllables' are taken apart)
const SPLIT = { 'ㄳ': 'ㄱㅅ', 'ㄵ': 'ㄴㅈ', 'ㄶ': 'ㄴㅎ', 'ㄺ': 'ㄹㄱ', 'ㄻ': 'ㄹㅁ', 'ㄼ': 'ㄹㅂ', 'ㄽ': 'ㄹㅅ', 'ㄾ': 'ㄹㅌ', 'ㄿ': 'ㄹㅍ', 'ㅀ': 'ㄹㅎ', 'ㅄ': 'ㅂㅅ',
  'ㅘ': 'ㅗㅏ', 'ㅙ': 'ㅗㅐ', 'ㅚ': 'ㅗㅣ', 'ㅝ': 'ㅜㅓ', 'ㅞ': 'ㅜㅔ', 'ㅟ': 'ㅜㅣ', 'ㅢ': 'ㅡㅣ' };

// The text in letters (lower case), and for each letter the index of the character it came from
export function letters(text) {
  let out = '';
  const at = [];
  const s = String(text || '').toLowerCase();
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    let part;
    if (c >= 0xac00 && c <= 0xd7a3) { const n = c - 0xac00; part = L[Math.floor(n / 588)] + V[Math.floor((n % 588) / 28)] + T[n % 28]; }
    else part = SPLIT[s[i]] || s[i];
    out += part;
    for (let k = 0; k < part.length; k++) at.push(i);
  }
  return { out, at };
}

// How `q` is in `text`, letter by letter: as it is (score 0 and up: the earlier, the better), or failing that,
// consonants alone as syllables' initials in order ('ㅎㄱ' in '한글': 500 and up), or its letters in order with others
// between ('adf' in 'abcdef': 1000 and up; the closer together, the better; `loose` false: neither), or not at all (null). `ranges`: [start, end)
// character ranges matched, a syllable matched in part counting whole.
export function matchLetters(text, q, loose = true) {
  const a = letters(text), b = letters(q).out;
  if (!b) return { score: 0, ranges: [] };
  const i = a.out.indexOf(b);
  if (i >= 0) return { score: i, ranges: spans(a.at, Array.from(b, (_, k) => i + k)) };
  const c = b.replace(/\s+/g, '');
  if (!loose || !c) return null;
  // (consonants alone: each one a syllable's first, in order (Korean typed by initials: 'ㅎㄱㄹ' in '한글 레시피'))
  if (/^[ㄱ-ㅎ]+$/.test(c)) {
    const heads = initials(text), got = run(heads.out, c);
    if (got) return { score: 500 + got[got.length - 1] - got[0], ranges: spans(heads.at, got) };
  }
  const best = run(a.out, c);
  return best && { score: 1000 + best[best.length - 1] - best[0], ranges: spans(a.at, best) };
}
// (where `c`'s letters are in `s` in order, the tightest run: from each place its first is, the rest as soon as they come)
function run(s, c) {
  let best = null;
  for (let i = s.indexOf(c[0]); i >= 0; i = s.indexOf(c[0], i + 1)) {
    const at = [i];
    for (let k = 1, j = i + 1; k < c.length; k++, j++) {
      j = s.indexOf(c[k], j);
      if (j < 0) { at.length = 0; break; }
      at.push(j);
    }
    if (!at.length) break; // (none from here: none from further on either)
    if (!best || at[at.length - 1] - at[0] < best[best.length - 1] - best[0]) best = at;
  }
  return best;
}
// (each syllable's first consonant, anything else as it is; and where each came from)
function initials(text) {
  let out = '';
  const at = [], s = String(text || '').toLowerCase();
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    out += c >= 0xac00 && c <= 0xd7a3 ? L[Math.floor((c - 0xac00) / 588)] : s[i];
    at.push(i);
  }
  return { out, at };
}
// (letters matched, as the characters they came from: neighbours run together)
function spans(at, idx) {
  const out = [];
  for (const ch of [...new Set(idx.map((k) => at[k]))].sort((x, y) => x - y)) {
    const last = out[out.length - 1];
    if (last && ch === last[1]) last[1] = ch + 1; else out.push([ch, ch + 1]);
  }
  return out;
}

// Whether `text` has `q` in it (see matchLetters)
export const hasLetters = (text, q, loose = true) => !q || !!matchLetters(text, q, loose);
// Where: [start, end) character ranges
export const findLetters = (text, q, loose = true) => matchLetters(text, q, loose)?.ranges || [];
