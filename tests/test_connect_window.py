# The "Connect to a server" window: opened as its small window, it fits what it holds in each language
# (no scrolling, no empty space below), and Esc closes it.
from harness import *

errors = []
with sync_playwright() as p:
    ctx, sw = launch(p, no_viewport=True)  # (the window's own size, not a fixed viewport)
    ext = sw.url.rsplit('/', 1)[0]
    for lang in ['en', 'ko', 'de', 'ja']:
        sw.evaluate(f"chrome.storage.local.get('tabcat:settings').then(r=>chrome.storage.local.set({{'tabcat:settings': {{...(r['tabcat:settings']||{{}}), language: '{lang}'}}}}))")
        with ctx.expect_page(lambda pg: 'connect.html' in pg.url) as w:
            sw.evaluate(f"chrome.windows.create({{ url: '{ext}/connect.html', type: 'popup', width: 440, height: 600 }})")
        win = w.value
        win.on('pageerror', lambda e: errors.append(str(e)))
        time.sleep(1.5)
        fits = win.evaluate("[document.documentElement.scrollHeight <= innerHeight, Math.round(innerHeight - document.body.getBoundingClientRect().height), innerHeight]")
        check(fits[0] and abs(fits[1]) <= 2, f'{lang}: the window fits what it holds ({fits})')
        try: win.keyboard.press('Escape')
        except Exception: pass  # (it closes on the key going down: the press can't finish)
        def gone():  # (Playwright can be slow to notice a closed window: does it still answer?)
            try: win.evaluate('1'); return False
            except Exception: return True
        check(gone(), f'{lang}: Esc closes it')
    check(not errors, f'no page errors {errors}')
    ctx.close()
done()
