# A page on this computer (localhost, 127.0.0.1) is linked up with the extension only once the user allows its address
# in a window of the extension's own: before, it gets nothing (every request "not-allowed", none of the data sent its
# way); allowed, it's loaded again and works. Any program here may serve such a page.
import functools, http.server, threading
from harness import *
import harness

OTHER = PORT + 2000  # (another port on this computer: a page of some other program; clear of the other tests' ports)
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = http.server.ThreadingHTTPServer(('localhost', OTHER), functools.partial(Quiet, directory=harness.WEB))
threading.Thread(target=srv.serve_forever, daemon=True).start()
serve()

errors = []
with sync_playwright() as p:
    ctx, sw = launch(p)
    d = dashboard(ctx, errors)
    check(d.locator('.ws-item').count() > 0, 'the dashboard at its allowed address: works as ever')

    other_errors = []
    page = ctx.new_page(); page.on('pageerror', lambda e: other_errors.append(str(e))); page.goto(f'http://localhost:{OTHER}/')
    # (Playwright hears of a new window only while it's busy: a short wait of its own each time round)
    ask = until(lambda: page.wait_for_timeout(100) or next((pg for pg in ctx.pages if 'allow.html' in pg.url), None), timeout=15)
    check(ask and until(lambda: f'localhost:{OTHER}' in ask.inner_text('#origin')), f'another address: the extension asks, in a window of its own ({ask and ask.url})')
    got = page.evaluate("""() => new Promise((res) => {
      addEventListener('message', (e) => { if (e.data?.source === 'tabcat-ext' && e.data.reply === 'x1') res(e.data.error || 'answered'); });
      postMessage({ source: 'tabcat-page', cmd: 'hello' }, location.origin);
      setTimeout(() => postMessage({ source: 'tabcat-page', id: 'x1', cmd: 'getTabs', args: {} }, location.origin), 300);
      setTimeout(() => res('no answer'), 4000);
    })""")
    check(got == 'not-allowed', f'meanwhile: nothing for it ({got})')
    shown = until(lambda: page.is_visible('#no-ext-allow') and page.inner_text('#no-ext-title'))
    check(shown == 'Let this page use tabcat?' and not page.is_visible('#no-ext ol') and not page.locator('.ws-item').count() and not page.is_visible('#confirm'),
          f'the page says why: allow it in the window tabcat opened (not an empty board, nor the tour) ({shown!r})')
    check(not other_errors, f'and no errors on it ({other_errors[:2]})')
    ask.click('#go')
    check(until(lambda: page.locator('.ws-item').count() > 0, timeout=15), 'allowed: loaded again, linked up')
    allowed = sw.evaluate("chrome.storage.local.get('tabcat:allowedOrigins').then(r => r['tabcat:allowedOrigins'])")
    check(f'http://localhost:{OTHER}' in allowed, f'and remembered ({allowed})')
    check(not errors, f'no page errors ({errors[:2]})')
    ctx.close()
done()
