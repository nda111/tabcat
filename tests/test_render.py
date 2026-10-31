# A change on a big board redraws only what changed (and a folder opens in one piece): the other cards stay the same elements, in place,
# and the hover mirror (.hover) stays inside the card (on the board's columns, .hover * would restyle
# every card on the board). (A card still fading a hover in or out is drawn afresh: not reused mid-animation.)
from harness import *

serve()
errors = []
with sync_playwright() as p:
    ctx, sw = launch(p)
    d = dashboard(ctx, errors)
    groups = [group(f'g{i}', [link(f'g{i}-l{k}') for k in range(6)], column=i % 5, note='[ ] task' if i == 0 else '') for i in range(20)]
    seed(sw, d, workspace('Big', groups))
    d.evaluate("document.querySelectorAll('#board .group').forEach((g) => { g.__mark = g.dataset.id; })")
    # (a card taken out and put back, even the same element, is styled and laid out again)
    d.evaluate("window.__out = []; new MutationObserver((ms) => ms.forEach((m) => m.removedNodes.forEach((n) => n.classList?.contains('group') && __out.push(n.dataset.id)))).observe(document.querySelector('#board'), { childList: true, subtree: true })")
    box = '#board .group[data-id="g0"] .note input[type=checkbox]'
    d.click(box); time.sleep(1.2)
    kept = d.evaluate("[...document.querySelectorAll('#board .group')].filter((g) => g.dataset.id !== 'g0').every((g) => g.__mark === g.dataset.id)")
    redrawn = d.evaluate("[...document.querySelectorAll('#board .group')].filter((g) => g.__mark !== g.dataset.id).map((g) => g.dataset.id)")
    check(d.evaluate(f"document.querySelector('{box}').checked") and kept, f'a note ticked: the other cards are the same elements (redrawn: {redrawn})')
    out = d.evaluate("__out.filter((id) => id !== 'g0')")
    check(not out, f'and none of them was taken out and put back {out}')
    d.hover('#board .group[data-id="g6"] .link-row'); time.sleep(.2)
    sw.evaluate("chrome.storage.local.get('tabcat').then(r=>{const s=r.tabcat; s.workspaces.find(w=>w.id==='Big').categories[0].groups[3].name='Renamed'; return chrome.storage.local.set({tabcat:s})})"); time.sleep(1.2)
    check('Renamed' in d.inner_text('#board .group[data-id="g3"]'), 'a change from elsewhere is drawn')
    hovered = d.evaluate("[...document.querySelectorAll('.hover')].map((e) => e.id || e.className.split(' ')[0])")
    check(not any(x in ('columns', 'col', 'board', 'main', '') for x in hovered) and 'link-row' in hovered, f'the hover mirror stays inside the card {hovered}')
    # a folder opening: its contents open with it, not each popping in on its own (which left them
    # settling after the open); and rows are a whole number of pixels tall, links and folders alike
    f = folder('F', [link('fa'), link('fb'), folder('Sub', [link('fc')])])
    seed(sw, d, workspace('Folders', [group('G', [link('top'), f, link('after')])]))
    tw = '#board .folder[data-id="F"] > .folder-head .twisty'
    d.click(tw); time.sleep(1); d.mouse.move(5, 790)
    d.evaluate("() => { window.__pop = 0; const go = (t0) => { document.querySelectorAll('#board .folder[data-id=\"F\"] .item').forEach((i) => { __pop += i.getAnimations().length; }); if (performance.now() - t0 < 500) requestAnimationFrame(() => go(t0)); }; requestAnimationFrame(() => go(performance.now())); }")
    d.click(tw); time.sleep(1)
    check(d.evaluate('__pop') == 0 and d.is_visible('#board .item[data-id="fb"]'), f"a folder opens with its contents, none popping in on its own ({d.evaluate('__pop')})")
    # its chevron turns as it closes and opens (the drawing inside the icon turns, so it stays sharp)
    ANG = """() => { const e = document.querySelector('#board .folder[data-id="F"] > .folder-head .twisty'); const p = e.querySelector('svg > *');
      const a = (el) => { const m = getComputedStyle(el).transform; if (m === 'none') return 0; const [x, y] = m.slice(7, -1).split(',').map(Number); return Math.atan2(y, x) * 180 / Math.PI; };
      return Math.round(a(e) + a(p)); }"""
    for want in ['closes', 'opens']:
        d.evaluate("(f) => { window.__ang = []; const g = eval(f); const t0 = performance.now(); const go = () => { __ang.push(g()); if (performance.now() - t0 < 500) requestAnimationFrame(go); }; requestAnimationFrame(go); }", ANG)
        d.click(tw); time.sleep(.8)
        ang = d.evaluate('__ang')
        between = [a for a in ang if -85 < a < -5]
        check(len(between) >= 3 and ang[-1] == (-90 if want == 'closes' else 0), f'the chevron turns as the folder {want} ({ang[0]} → {ang[-1]}, {len(between)} frames between)')
    # a group dragged out of a column: that column's New group card, now where the drag began, doesn't
    # show as if hovered (the browser keeps the hover there until the mouse moves); it does once it moves there
    seed(sw, d, workspace('Drag', [group('A', [link('da1')], column=0), group('B', [link('db1'), link('db2')], column=0), group('D', [link('dd1')], column=2)]))
    hb = d.locator('#board .group[data-id="B"] > .group-head').bounding_box(); db = d.locator('#board .group[data-id="D"]').bounding_box()
    sx, sy, tx, ty = hb['x'] + hb['width'] - 70, hb['y'] + 22, db['x'] + db['width'] / 2, db['y'] + db['height'] + 40
    d.mouse.move(sx, sy); d.mouse.down()
    for i in range(1, 21): d.mouse.move(sx + (tx - sx) * i / 20, sy + (ty - sy) * i / 20); d.wait_for_timeout(16)
    d.wait_for_timeout(300); d.mouse.up(); time.sleep(1.2)
    card = lambda: float(d.evaluate("getComputedStyle(document.querySelector('#board .col[data-col=\"0\"] .add-group')).opacity"))
    check(d.evaluate("document.querySelector('#board .group[data-id=\"B\"]').closest('.col').dataset.col") == '2' and card() == 0, f'a group dragged away: its old column shows no New group card ({card()})')
    tail = d.locator('#board .col[data-col="0"] .add-group').bounding_box()
    d.mouse.move(tail['x'] + 30, tail['y'] + 20); time.sleep(.4)
    check(card() > .5, f'the mouse moved there: it shows ({card()})')
    for theme in ['light', 'dark']:
        settings(sw, theme=theme); time.sleep(.8)
        hs = d.evaluate("[...new Set([...document.querySelectorAll('#board .link-row, #board .folder-head')].filter((r) => r.offsetParent).map((r) => r.getBoundingClientRect().height))]")
        check(len(hs) == 1 and float(hs[0]).is_integer(), f'{theme}: links and folders are rows of one whole-pixel height {hs}')
    check(not errors, f'no page errors {errors}')
    ctx.close()
done()
