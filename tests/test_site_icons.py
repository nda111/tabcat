# A link's icon when the browser has none for its site (Chrome keeps only those of sites visited in it): the
# site's own /favicon.ico, from the site; a site without one, the accent globe.
import base64, http.server, threading
from harness import *

ICON = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAFklEQVR4nGP4z8BAEhrVMKphVAP1NAAAI/sf8T8iMr0AAAAASUVORK5CYII=')
class Site(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_GET(self):
        if self.path == '/favicon.ico':
            self.send_response(200); self.send_header('Content-Type', 'image/png'); self.end_headers(); self.wfile.write(ICON)
        else:
            self.send_response(404); self.end_headers()
for port in (8771, 8772):  # (8771 has an icon; 8772 none)
    s = http.server.ThreadingHTTPServer(('127.0.0.1', port), Site if port == 8771 else type('None', (Site,), {'do_GET': lambda self: (self.send_response(404), self.end_headers())}))
    threading.Thread(target=s.serve_forever, daemon=True).start()

serve()
errors = []
with sync_playwright() as p:
    ctx, sw = launch(p)
    sw.evaluate("""chrome.storage.local.set({ tabcat: { version: 1, workspaces: [{ id: 'w', type: 'workspace', name: 'W', symbol: '', description: '', categories: [{ id: 'c', type: 'category', name: 'C', groups: [{ id: 'g', type: 'group', name: 'G', symbol: '', color: '', note: '', collapsed: false, column: 0, items: [
      { id: 'l1', type: 'link', url: 'http://127.0.0.1:8771/page', name: 'Has one', icon: '', description: '', createdAt: 1 },
      { id: 'l2', type: 'link', url: 'http://127.0.0.1:8772/page', name: 'Has none', icon: '', description: '', createdAt: 1 }] }] }] }] } })""")
    d = dashboard(ctx, errors); time.sleep(2.5)
    one = d.evaluate("(() => { const i = document.querySelector('[data-id=\"l1\"] img.fav'); return [i.src, i.naturalWidth, i.classList.contains('fav-blank')]; })()")
    check(one[0] == 'http://127.0.0.1:8771/favicon.ico' and one[1] == 16 and not one[2], f"a site the browser has no icon of: its own, from the site ({one})")
    none = d.evaluate("document.querySelector('[data-id=\"l2\"] img.fav').classList.contains('fav-blank')")
    check(none, 'a site without one either: the accent globe')
    check(not errors, f'no page errors {errors}')
    ctx.close()
done()
