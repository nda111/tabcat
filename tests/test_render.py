# A change on a big board redraws only what changed: the other cards stay the same elements, in place,
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
    check(not errors, f'no page errors {errors}')
    ctx.close()
done()
