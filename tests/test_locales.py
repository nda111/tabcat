# Every string table in every language: the same strings as English (none missing, none extra), none left empty, and
# the same {placeholders}. The dashboard's (web/js/locales), the extension's (lib/i18n.js, _locales), the server
# pages' (server/tabcat_server/pages/strings.js), the privacy policy's and the welcome page's (the same shape).
import base64, json, os, re
from harness import *
from harness import ROOT

LANGS = ['en', 'ko', 'ja', 'zh-CN', 'de', 'es', 'fr', 'pt-BR']
# (the extension's own words, {allow} {connect} {command}, a language may name or leave out: the rest must all be there)
holes = lambda v: sorted(set(re.findall(r'\{[a-zA-Z]+\}', json.dumps(v, ensure_ascii=False))) - {'{allow}', '{connect}', '{command}'})

def shape(v):
    """What a value is made of, words left out: its keys, list lengths, and placeholders."""
    if isinstance(v, dict): return {k: shape(x) for k, x in v.items()}
    if isinstance(v, list): return [shape(x) for x in v]
    return ('text', holes(v), bool(str(v).strip()))

def same(table, name, langs=LANGS, key=lambda l: l):
    en = table[key('en')]
    for l in langs:
        if l == 'en': continue
        mine = table.get(key(l))
        if mine is None:
            check(False, f'{name}: {l} is there'); continue
        if isinstance(en, dict) and all(isinstance(x, (str, dict)) for x in en.values()) and name != 'privacy policy' and name != 'welcome page':
            missing, extra = sorted(set(en) - set(mine)), sorted(set(mine) - set(en))
            empty = sorted(k for k, v in mine.items() if not str(v).strip())
            wrong = sorted(k for k in set(en) & set(mine) if holes(en[k]) != holes(mine[k]))
            check(not missing and not extra and not empty and not wrong, f'{name}: {l} whole (missing {missing[:5]}, extra {extra[:5]}, empty {empty[:5]}, placeholders differ {wrong[:5]})')
        else:
            check(shape(mine) == shape(en), f'{name}: {l} the same shape as English')

def module(page, path, names):
    src = base64.b64encode(open(os.path.join(ROOT, path), 'rb').read()).decode()
    return page.evaluate("([src, names]) => import('data:text/javascript;base64,' + src).then(m => Object.fromEntries(names.map(n => [n, m[n]])))", [src, names])

serve()
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(); pg.goto(URL + 'privacy.html')
    keys = {l: pg.evaluate(f"import('./js/locales/{l}.js').then(m => m.default, e => 'ERR ' + e.message)") for l in LANGS}
    for l in LANGS:
        check(isinstance(keys[l], dict), f'dashboard: {l} loads ({keys[l] if isinstance(keys[l], str) else "ok"})')
    same(keys, 'dashboard')
    blank = b.new_page()
    same(module(blank, 'lib/i18n.js', ['STRINGS'])['STRINGS'], 'extension')
    same(module(blank, 'server/tabcat_server/pages/strings.js', ['STRINGS'])['STRINGS'], 'server pages')
    same(module(blank, 'web/js/privacy-text.js', ['TEXT'])['TEXT'], 'privacy policy')
    w = module(blank, 'web/js/welcome-text.js', ['TEXT', 'EXTENSION_WORDS'])
    same(w['TEXT'], 'welcome page'); same(w['EXTENSION_WORDS'], 'welcome page (the extension\'s words)')
    store = {d: json.load(open(os.path.join(ROOT, '_locales', d, 'messages.json'), encoding='utf-8')) for d in os.listdir(os.path.join(ROOT, '_locales'))}
    same({k: {n: v['message'] for n, v in m.items()} for k, m in store.items()}, 'extension (_locales)', key=lambda l: l.replace('-', '_') if '-' in l else l)
    b.close()
done()
