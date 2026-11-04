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

// Whether `text` has `q` in it, letter by letter
export const hasLetters = (text, q) => !q || letters(text).out.includes(letters(q).out);

// Where `q` is in `text`: [start, end) character ranges (a syllable matched in part, all of it)
export function findLetters(text, q) {
  const a = letters(text), b = letters(q).out, found = [];
  if (!b) return found;
  let i = 0, j;
  while ((j = a.out.indexOf(b, i)) !== -1) {
    const start = a.at[j], end = a.at[j + b.length - 1] + 1;
    if (found.length && start < found[found.length - 1][1]) found[found.length - 1][1] = Math.max(found[found.length - 1][1], end);
    else found.push([start, end]);
    i = j + b.length;
  }
  return found;
}
