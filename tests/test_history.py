# Undo / redo is one history for every open dashboard: a delete in one tab undoes from another.
from harness import *

ws = workspace('Hist', [group('Box', [link('a'), link('b'), link('c')])])
LINKS = "[...document.querySelectorAll('#board .group[data-id=\"Box\"] .item.link')].map(e=>e.dataset.id).join(',')"
def delete(d, lid):
    d.bring_to_front()  # (a background tab doesn't animate, so its rows never settle for the pointer)
    d.hover(f'#board [data-id={lid}] .link-row'); d.click(f'#board [data-id={lid}] .head-actions button:nth-child(2)'); until(lambda: lid not in d.evaluate(LINKS).split(',')); settle(d)

serve()
errors = []
with sync_playwright() as p:
    ctx, sw = launch(p)
    a = dashboard(ctx, errors); seed(sw, a, ws)
    b = second_dashboard(ctx, sw, errors); b.click('.ws-item:has(.name:text-is("Hist"))'); until(lambda: b.evaluate(LINKS) == 'a,b,c'); settle(b); b.mouse.move(5, 790)
    for pg in (a, b): pg.on('dialog', lambda dl: dl.accept())
    delete(a, 'b'); until(lambda: b.evaluate(LINKS) == 'a,c')
    check(b.evaluate(LINKS) == 'a,c', 'a delete in tab A shows in tab B')
    b.bring_to_front(); b.keyboard.press('Control+z'); until(lambda: a.evaluate(LINKS) == 'a,b,c' and b.evaluate(LINKS) == 'a,b,c')
    check(a.evaluate(LINKS) == 'a,b,c' and b.evaluate(LINKS) == 'a,b,c', "Ctrl+Z in tab B undoes tab A's delete")
    a.bring_to_front(); a.keyboard.press('Control+Shift+z'); until(lambda: b.evaluate(LINKS) == 'a,c')
    check(b.evaluate(LINKS) == 'a,c', 'Ctrl+Shift+Z in tab A redoes it')
    delete(b, 'a'); a.bring_to_front(); until(lambda: a.evaluate(LINKS) == 'c'); a.keyboard.press('Control+z'); until(lambda: a.evaluate(LINKS) == 'a,c')
    check(a.evaluate(LINKS) == 'a,c', 'undo takes back the latest change, from either tab')
    a.keyboard.press('Control+z'); until(lambda: a.evaluate(LINKS) == 'a,b,c')
    check(a.evaluate(LINKS) == 'a,b,c', 'and the one before it')
    # a toast's Undo for an older delete also undoes what came after it
    delete(a, 'a'); delete(b, 'b')
    until(lambda: a.evaluate(LINKS) == 'c'); a.bring_to_front(); a.locator('#toast button').last.click(); until(lambda: b.evaluate(LINKS) == 'a,b,c')
    check(b.evaluate(LINKS) in ('a,b,c',), f"an older toast's Undo puts back both ({b.evaluate(LINKS)})")
    # closing duplicate tabs: undo opens them again where they were (window, tab group); redo closes them
    DUP, MID = 'data:text/plain,dup', 'data:text/plain,mid'  # (not the dashboard's site, which close duplicates leaves alone)
    sw.evaluate(f"""(async()=>{{ const w = await chrome.windows.create({{url:['{DUP}','{MID}','{DUP}']}}); self.__dw = w.id;
      self.__g = await chrome.tabs.group({{tabIds:[w.tabs[1].id, w.tabs[2].id], createProperties:{{windowId:w.id}}}}); }})()"""); time.sleep(1)
    LAYOUT = "chrome.tabs.query({windowId:self.__dw}).then(ts=>ts.map(t=>[(t.pendingUrl||t.url).split(',').pop(), t.groupId===self.__g]))"
    before = sw.evaluate(LAYOUT)
    a.bring_to_front(); a.click('#btn-dedupe'); until(lambda: sw.evaluate(LAYOUT) == [['dup', False], ['mid', True]] and a.locator('#toast button').count() > 0)
    check(sw.evaluate(LAYOUT) == [['dup', False], ['mid', True]], f'close duplicates closes the second copy ({sw.evaluate(LAYOUT)})')
    check(a.locator('#toast button').count() > 0, 'its toast offers Undo')
    b.bring_to_front(); b.keyboard.press('Control+z'); until(lambda: sw.evaluate(LAYOUT) == before)
    check(sw.evaluate(LAYOUT) == before, f'Ctrl+Z (in another dashboard) opens it again in its place and tab group {sw.evaluate(LAYOUT)}')
    b.keyboard.press('Control+Shift+z'); until(lambda: sw.evaluate(LAYOUT) == [['dup', False], ['mid', True]])
    check(sw.evaluate(LAYOUT) == [['dup', False], ['mid', True]], 'Ctrl+Shift+Z closes it again')
    b.keyboard.press('Control+z'); until(lambda: sw.evaluate(LAYOUT) == before)
    a.bring_to_front(); a.click('#btn-dedupe'); until(lambda: sw.evaluate(LAYOUT) == [['dup', False], ['mid', True]] and a.locator('#toast button').count() > 0); a.locator('#toast button').last.click(); until(lambda: sw.evaluate(LAYOUT) == before)
    check(sw.evaluate(LAYOUT) == before, "the toast's Undo opens it again")
    sw.evaluate("chrome.windows.remove(self.__dw)"); time.sleep(.5)
    # removing duplicate links from a group
    seed(sw, a, workspace('Dup', [group('DupBox', [link('d1', 'https://x.example/1'), link('d2', 'https://x.example/1'), link('d3', 'https://x.example/2')])]))
    DL = "[...document.querySelectorAll('#board .group[data-id=\"DupBox\"] .item.link')].map(e=>e.dataset.id).join(',')"
    a.click('#board .group[data-id="DupBox"] .group-head .name', button='right'); settle(a)
    a.click("#menu button:has-text('Remove duplicate links')"); until(lambda: a.evaluate(DL) == 'd1,d3')
    check(a.evaluate(DL) == 'd1,d3', f'remove duplicate links ({a.evaluate(DL)})')
    a.keyboard.press('Control+z'); until(lambda: a.evaluate(DL) == 'd1,d2,d3')
    until(lambda: sw.evaluate("chrome.storage.local.get(null).then(r=>{const h=r['tabcat:history']; return Object.keys(r).filter(k=>k.startsWith('tabcat:snap:')).length === h.undo.length + h.redo.length})"))
    check(a.evaluate(DL) == 'd1,d2,d3', 'Ctrl+Z puts them back')
    n = sw.evaluate("chrome.storage.local.get(null).then(r=>Object.keys(r).filter(k=>k.startsWith('tabcat:snap:')).length)")
    h = sw.evaluate("chrome.storage.local.get('tabcat:history').then(r=>r['tabcat:history'])")
    check(n == len(h['undo']) + len(h['redo']), f'one stored state per history entry ({n} for {len(h["undo"])}+{len(h["redo"])})')
    check(not errors, f'no page errors {errors}')
    ctx.close()
done()
