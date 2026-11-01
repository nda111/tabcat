# Open tabs dragged within the open tabs panel move there, in the browser too: one tab or the picked
# ones, between two rows or onto a window's header (its end), into another window; landing between two
# tabs of a tab group they join it, landing outside they leave it.
from harness import *

ORDER = "(w)=>chrome.tabs.query({windowId:w}).then(ts=>ts.map(t=>(t.url||t.pendingUrl).split('demo=')[1]||'-').join(''))"
GROUPED = "(w)=>chrome.tabs.query({windowId:w}).then(ts=>ts.filter(t=>t.groupId!==-1).map(t=>(t.url||t.pendingUrl).split('demo=')[1]).join(''))"
serve()
errors = []
with sync_playwright() as p:
    ctx, sw = launch(p)
    d = dashboard(ctx, errors, size=(1300, 900))
    w = sw.evaluate("chrome.windows.create({url: ['a','b','c','d','e'].map(x=>'about:blank?demo='+x), focused: false}).then(w=>w.id)"); time.sleep(1.5)
    row = lambda x: d.locator(f'#windows .tab-row[data-url$="demo={x}"]')
    def drop(src, dst, before):
        box = dst.bounding_box()
        src.drag_to(dst, target_position={'x': box['width'] / 2, 'y': 3 if before else box['height'] - 3}); time.sleep(1.2)
    drop(row('e'), row('a'), True)
    check(sw.evaluate(ORDER, w) == 'eabcd', f'a tab dropped before another moves there ({sw.evaluate(ORDER, w)})')
    # the rows move as they're dropped, before the browser's tabs have
    d.evaluate("window.__moved = null; addEventListener('drop', () => { const t0 = performance.now(); new MutationObserver((ms, o) => { __moved = performance.now() - t0; o.disconnect(); }).observe(document.querySelector('#windows'), { childList: true, subtree: true }); }, { capture: true, once: true })")
    drop(row('e'), row('d'), False)
    check(d.evaluate('__moved') is not None and d.evaluate('__moved') < 50, f"the rows move as they're dropped ({d.evaluate('__moved')}ms)")
    check(sw.evaluate(ORDER, w) == 'abcde', f'and after one ({sw.evaluate(ORDER, w)})')
    # the picked ones move together, in their order
    row('a').click(modifiers=['Shift']); row('c').click(modifiers=['Shift']); time.sleep(.2)
    drop(row('a'), row('e'), False)
    check(sw.evaluate(ORDER, w) == 'bdeac', f'picked tabs move together ({sw.evaluate(ORDER, w)})')
    d.mouse.click(700, 500); time.sleep(.3)
    # tab groups: between two of a group it joins; outside it leaves
    sw.evaluate("(w)=>chrome.tabs.query({windowId:w}).then(ts=>chrome.tabs.group({tabIds:[ts[1].id, ts[2].id], createProperties:{windowId:w}}))", w); time.sleep(1.2)
    check(sw.evaluate(GROUPED, w) == 'de', f'set up: d and e grouped ({sw.evaluate(GROUPED, w)})')
    drop(row('a'), row('e'), True)
    check(sw.evaluate(ORDER, w) == 'bdaec' and sw.evaluate(GROUPED, w) == 'dae', f'dropped inside a group, it joins it ({sw.evaluate(ORDER, w)}, {sw.evaluate(GROUPED, w)})')
    drop(row('a'), row('c'), False)
    check(sw.evaluate(ORDER, w) == 'bdeca' and sw.evaluate(GROUPED, w) == 'de', f'dropped outside, it leaves it ({sw.evaluate(ORDER, w)}, {sw.evaluate(GROUPED, w)})')
    # onto another window's header: to its end
    main = d.evaluate("+document.querySelector('#windows .win').dataset.window")
    drop(row('b'), d.locator(f'#windows .win[data-window="{main}"] .win-head'), False)
    check(sw.evaluate(ORDER, w) == 'deca' and sw.evaluate(ORDER, main).endswith('b'), f'onto a window header: to the end of that window ({sw.evaluate(ORDER, main)})')
    check(not errors, f'no page errors {errors}')
    ctx.close()
done()
