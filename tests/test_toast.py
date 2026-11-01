# A toast goes when clicked (it shrinks away), but its button still does what it says.
import json
from harness import *

serve()
errors = []
with sync_playwright() as p:
    ctx, sw = launch(p)
    d = dashboard(ctx, errors)
    seed(sw, d, workspace('T', [group('G', [link('a'), link('b')])]))
    def delete(lid):
        d.hover(f'#board [data-id={lid}] .link-row'); d.click(f'#board [data-id={lid}] .head-actions button:nth-child(2)'); time.sleep(.8)
    delete('a')
    item = d.locator('#toast .toast-item').last
    d.evaluate("window.__o=[]; const t=[...document.querySelectorAll('#toast .toast-item')].at(-1); (function f(){ const cs=getComputedStyle(t); __o.push([+cs.opacity, new DOMMatrix(cs.transform).a]); if(__o.length<20) requestAnimationFrame(f); })()")
    item.locator('span').click(); time.sleep(.5)
    oo = d.evaluate('__o')
    check(d.locator('#toast .toast-item').count() == 0, 'clicked, the toast goes')
    check(any(0.05 < o < 0.95 and s < 0.999 for o, s in oo), f'shrinking away as it fades ({oo[:6]})')
    items = lambda: [x['id'] for x in [w for w in json.loads(sw.evaluate("chrome.storage.local.get('tabcat').then(r=>JSON.stringify(r.tabcat.workspaces))")) if w['id'] == 'T'][0]['categories'][0]['groups'][0]['items']]
    check(items() == ['b'], 'the delete stays (the click only put the toast away)')
    delete('b')
    d.locator('#toast .toast-item button').last.click(); time.sleep(1)
    check(items() == ['b'], 'its Undo button still undoes')
    check(not errors, f'no page errors {errors}')
    ctx.close()
done()
