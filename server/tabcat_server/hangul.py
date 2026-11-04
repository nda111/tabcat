"""Searching Korean by its letters (jamo), as the dashboard does (web/js/hangul.js): each syllable taken apart
into its letters, a double vowel or final consonant into its two, and the query too; then a substring match."""

L = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'
V = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅗㅏ', 'ㅗㅐ', 'ㅗㅣ', 'ㅛ', 'ㅜ', 'ㅜㅓ', 'ㅜㅔ', 'ㅜㅣ', 'ㅠ', 'ㅡ', 'ㅡㅣ', 'ㅣ']
T = ['', 'ㄱ', 'ㄲ', 'ㄱㅅ', 'ㄴ', 'ㄴㅈ', 'ㄴㅎ', 'ㄷ', 'ㄹ', 'ㄹㄱ', 'ㄹㅁ', 'ㄹㅂ', 'ㄹㅅ', 'ㄹㅌ', 'ㄹㅍ', 'ㄹㅎ', 'ㅁ', 'ㅂ', 'ㅂㅅ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ']
SPLIT = {'ㄳ': 'ㄱㅅ', 'ㄵ': 'ㄴㅈ', 'ㄶ': 'ㄴㅎ', 'ㄺ': 'ㄹㄱ', 'ㄻ': 'ㄹㅁ', 'ㄼ': 'ㄹㅂ', 'ㄽ': 'ㄹㅅ', 'ㄾ': 'ㄹㅌ', 'ㄿ': 'ㄹㅍ', 'ㅀ': 'ㄹㅎ', 'ㅄ': 'ㅂㅅ',
         'ㅘ': 'ㅗㅏ', 'ㅙ': 'ㅗㅐ', 'ㅚ': 'ㅗㅣ', 'ㅝ': 'ㅜㅓ', 'ㅞ': 'ㅜㅔ', 'ㅟ': 'ㅜㅣ', 'ㅢ': 'ㅡㅣ'}


def letters(text: str) -> str:
    out = []
    for ch in (text or '').lower():
        c = ord(ch)
        if 0xac00 <= c <= 0xd7a3:
            n = c - 0xac00
            out.append(L[n // 588] + V[n % 588 // 28] + T[n % 28])
        else:
            out.append(SPLIT.get(ch, ch))
    return ''.join(out)


def score(text: str, q: str):
    """How well `q` is in `text`, letter by letter (lower is better): as it is (0 and up, the earlier the better), or
    consonants alone as syllables' initials in order ('ㅎㄱ' in '한글': 500 and up), or its letters in order with others
    between ('adf' in 'abcdef': 1000 and up; the closer together the better), or not at all (None). As the
    dashboard's matchLetters."""
    a, b = letters(text), letters(q)
    if not b:
        return 0
    i = a.find(b)
    if i >= 0:
        return i
    c = ''.join(b.split())
    if c and all('ㄱ' <= ch <= 'ㅎ' for ch in c):  # (consonants alone: syllables' initials, in order)
        heads = ''.join(L[(ord(ch) - 0xac00) // 588] if 0xac00 <= ord(ch) <= 0xd7a3 else ch for ch in (text or '').lower())
        got = _run(heads, c)
        if got is not None:
            return 500 + got
    got = _run(a, c)
    return None if got is None else 1000 + got


def _run(a: str, c: str):
    """The tightest run of `c`'s letters in order in `a` (its length less one), or None."""
    best = None
    s = a.find(c[0]) if c else -1
    while s >= 0:
        j, end = s, s
        for ch in c[1:]:
            j = a.find(ch, j + 1)
            if j < 0:
                break
            end = j
        if j < 0:
            break
        if best is None or end - s < best:
            best = end - s
        s = a.find(c[0], s + 1)
    return best
