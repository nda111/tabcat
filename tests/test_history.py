# Undo / redo is one history for every open dashboard: a delete in one tab undoes from another.
from harness import *

ws = workspace('Hist', [group('Box', [link('a'), link('b'), link('c')])])
LINKS = "[...document.querySelectorAll('#board .group[data-id=\"Box\"] .item.link')].map(e=>e.dataset.id).join(',')"
def delete(d, lid):
    d.bring_to_front()  # (a background tab doesn't animate, so its rows never settle for the pointer)
    d.hover(f'#board [data-id={lid}] .link-row'); d.click(f'#board [data-id={lid}] .head-actions button:nth-child(2)'); time.sleep(1)

serve()
errors = []
with sync_playwright() as p:
    ctx, sw = launch(p)
    a = dashboard(ctx, errors); seed(sw, a, ws)
    b = dashboard(ctx, errors); b.click('.ws-item[title="Hist"]'); time.sleep(1); b.mouse.move(5, 790)
    for pg in (a, b): pg.on('dialog', lambda dl: dl.accept())
    delete(a, 'b'); time.sleep(.5)
    check(b.evaluate(LINKS) == 'a,c', 'a delete in tab A shows in tab B')
    b.bring_to_front(); b.keyboard.press('Control+z'); time.sleep(1.2)
    check(a.evaluate(LINKS) == 'a,b,c' and b.evaluate(LINKS) == 'a,b,c', "Ctrl+Z in tab B undoes tab A's delete")
    a.bring_to_front(); a.keyboard.press('Control+Shift+z'); time.sleep(1.2)
    check(b.evaluate(LINKS) == 'a,c', 'Ctrl+Shift+Z in tab A redoes it')
    delete(b, 'a'); a.bring_to_front(); a.keyboard.press('Control+z'); time.sleep(1.2)
    check(a.evaluate(LINKS) == 'a,c', 'undo takes back the latest change, from either tab')
    a.keyboard.press('Control+z'); time.sleep(1.2)
    check(a.evaluate(LINKS) == 'a,b,c', 'and the one before it')
    # a toast's Undo for an older delete also undoes what came after it
    delete(a, 'a'); delete(b, 'b')
    a.bring_to_front(); a.locator('#toast button').last.click(); time.sleep(1.2)
    check(b.evaluate(LINKS) in ('a,b,c',), f"an older toast's Undo puts back both ({b.evaluate(LINKS)})")
    n = sw.evaluate("chrome.storage.local.get(null).then(r=>Object.keys(r).filter(k=>k.startsWith('tabcat:snap:')).length)")
    h = sw.evaluate("chrome.storage.local.get('tabcat:history').then(r=>r['tabcat:history'])")
    check(n == len(h['undo']) + len(h['redo']), f'one stored state per history entry ({n} for {len(h["undo"])}+{len(h["redo"])})')
    check(not errors, f'no page errors {errors}')
    ctx.close()
done()
