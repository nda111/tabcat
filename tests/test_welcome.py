# The welcome page (opened once tabcat is installed): in each of the 8 languages, its text whole (the same parts as
# English, nothing left as a {placeholder}); the three ways as cards, the online dashboard first and recommended; a
# card's steps fold open with their commands, copied by their button; another language picked, the page follows.
import json
from harness import *

LANGS = ['en', 'ko', 'ja', 'zh-CN', 'es', 'de', 'fr', 'pt-BR']
serve()
with sync_playwright() as p:
    b = p.chromium.launch(channel='chromium')
    ctx = b.new_context(viewport={'width': 1000, 'height': 900})
    ctx.grant_permissions(['clipboard-read', 'clipboard-write'], origin=URL.rstrip('/'))
    pg = ctx.new_page(); errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)))
    shape = None
    for lang in LANGS:
        pg.goto(f'{URL}welcome.html?lang={lang}'); pg.wait_for_selector('.way')
        got = pg.evaluate("""() => ({ lang: document.documentElement.lang, ways: [...document.querySelectorAll('.way')].map(w => w.dataset.way),
          steps: [...document.querySelectorAll('.way')].map(w => w.querySelectorAll('.way-steps li').length),
          cmds: document.querySelectorAll('.cmd code').length, text: document.body.innerText })""")
        here = (got['ways'], got['steps'], got['cmds'])
        shape = shape or here
        check(got['lang'] == lang and here == shape and '{' not in got['text'] and 'undefined' not in got['text'],
              f'{lang}: whole, as English is ({here})')
    check(shape == (['online', 'self', 'server'], [0, 3, 3], 4), f'three ways, the online dashboard first, steps and commands for the others ({shape})')
    check(pg.locator('.way').first.locator('.way-badge').count() == 1 and pg.get_attribute('.way[data-way=online] a.btn', 'href') == './', 'the online dashboard recommended, opening the dashboard')

    pg.goto(f'{URL}welcome.html?lang=en'); pg.wait_for_selector('.way'); time.sleep(.8)
    server = pg.locator('.way[data-way=server]')
    check(not server.locator('.way-steps').is_visible(), 'steps shut to begin with')
    server.locator('.way-toggle').click(); time.sleep(.6)
    check(server.locator('.way-steps').is_visible() and server.locator('.way-toggle').inner_text().strip() == 'Hide the steps', 'a card\'s steps fold open')
    server.locator('.copy').first.click(); time.sleep(.2)
    copied = pg.evaluate('navigator.clipboard.readText()')
    check(copied.startswith('pip install https://github.com/nda111/tabcat/releases/download/server-v') and 'Copied' in server.locator('.copy').first.inner_text(), f'its command copied by its button ({copied[:60]})')
    server.locator('.way-toggle').click(); time.sleep(.6)
    check(not server.locator('.way-steps').is_visible(), 'and folds shut again')
    pg.select_option('#doc-lang', 'ko'); time.sleep(.6)
    check(pg.evaluate('document.documentElement.lang') == 'ko' and '서버' in pg.inner_text('.way[data-way=server] h2') and 'lang=ko' in pg.url, 'another language picked: the page follows')
    check(pg.get_attribute('#privacy-link', 'href') == './privacy?lang=ko', 'its privacy link in that language')
    check(not errors, f'no page errors {errors}')
done()
