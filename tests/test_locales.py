# Every language file loads and has the same strings as English (none missing, none extra).
from harness import *

LANGS = ['en', 'ko', 'ja', 'zh-CN', 'de', 'es', 'fr', 'pt-BR']
serve()
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(); pg.goto(URL + 'privacy.html')
    keys = {l: pg.evaluate(f"import('./js/locales/{l}.js').then(m => Object.keys(m.default).sort(), e => 'ERR ' + e.message)") for l in LANGS}
    for l in LANGS:
        check(isinstance(keys[l], list), f'{l} loads ({keys[l] if isinstance(keys[l], str) else "ok"})')
        if isinstance(keys[l], list) and l != 'en':
            check(keys[l] == keys['en'], f"{l} has English's strings (missing {sorted(set(keys['en']) - set(keys[l]))[:5]}, extra {sorted(set(keys[l]) - set(keys['en']))[:5]})")
    b.close()
done()
