# The board's everyday actions: collapse, select, delete, notes, category switches, search, language.
from harness import *

NG = 12
def grp(g):
    items = [link(f'l{g}_{j}', f'https://site{j}.example.com/{g}/{j}') for j in range(8)]
    if g % 5 == 0: items.insert(3, folder(f'f{g}', [link(f'fl{g}_{k}', f'https://f.example.com/{k}') for k in range(3)]))
    return group(f'g{g}', items, column=g % 3, note='Some **note** text\n\n- [ ] task' if g % 4 == 0 else '')
ws = {'id': 'Board', 'type': 'workspace', 'name': 'Board', 'symbol': '', 'description': '', 'categories': [
    {'id': 'big', 'type': 'category', 'name': 'Big', 'groups': [grp(g) for g in range(NG)]},
    {'id': 'small', 'type': 'category', 'name': 'Small', 'groups': [grp(1000)]}]}
G = lambda gid: f'#board .group[data-id="{gid}"]'
has = lambda d, sel, cls: d.evaluate(f"document.querySelector('{sel}').classList.contains('{cls}')")
opaque = lambda d: d.evaluate("[...document.querySelectorAll('#board .group')].every(g=>getComputedStyle(g).opacity==='1')")

serve()
errors = []
with sync_playwright() as p:
    ctx, sw = launch(p)
    d = dashboard(ctx, errors, (1500, 900))
    seed(sw, d, ws)
    d.click(G('g1') + ' .collapse-btn'); until(lambda: has(d, G('g1'), 'collapsed')); settle(d); check(has(d, G('g1'), 'collapsed'), 'collapse')
    d.click(G('g1') + ' .collapse-btn'); until(lambda: not has(d, G('g1'), 'collapsed')); settle(d); check(not has(d, G('g1'), 'collapsed'), 'expand')
    check(d.evaluate(f"getComputedStyle(document.querySelector('{G('g1')} .group-body')).height") != '0px', 'the expanded body has height')
    d.click(G('g2') + ' .group-head .name', modifiers=['Control']); until(lambda: has(d, G('g2'), 'selected')); check(has(d, G('g2'), 'selected'), 'ctrl-click selects a group')
    sw.evaluate("chrome.storage.local.get('tabcat').then(r=>{const s=r.tabcat; s.workspaces.find(w=>w.id==='Board').categories[0].groups[7].name='Seven renamed'; return chrome.storage.local.set({tabcat:s})})"); until(lambda: 'Seven renamed' in d.inner_text(G('g7') + ' .group-head .name'))
    check(has(d, G('g2'), 'selected'), 'the selection survives a re-render')
    check('Seven renamed' in d.inner_text(G('g7') + ' .group-head .name'), 'a rename from elsewhere shows')
    d.click(G('g2') + ' .group-head .name', modifiers=['Control']); until(lambda: not has(d, G('g2'), 'selected')); check(not has(d, G('g2'), 'selected'), 'ctrl-click again deselects')
    n0 = d.locator(G('g3') + ' .item.link').count()
    d.hover('#board [data-id=l3_4] .link-row'); d.click('#board [data-id=l3_4] .head-actions button:nth-child(2)'); until(lambda: d.locator(G('g3') + ' .item.link').count() == n0 - 1); settle(d)
    check(d.locator(G('g3') + ' .item.link').count() == n0 - 1, 'delete a link')
    check(opaque(d), 'all cards opaque after it')
    d.click(G('g0') + ' .note'); until(lambda: d.evaluate("document.activeElement?.classList.contains('note-edit')")); settle(d); d.keyboard.type(' extra'); d.keyboard.press('Control+Enter'); until(lambda: 'extra' in d.inner_text(G('g0') + ' .note'))
    check('extra' in d.inner_text(G('g0') + ' .note'), 'a note edit is saved')
    d.click(G('g0') + ' .note input[type=checkbox]'); until(lambda: d.evaluate(f"document.querySelector('{G('g0')} .note input[type=checkbox]').checked"))
    check(d.evaluate(f"document.querySelector('{G('g0')} .note input[type=checkbox]').checked"), 'a note checkbox toggles')
    d.click(".cat-tab:has-text('Small')"); until(lambda: d.locator('#board .group').count() == 1); settle(d); d.click(".cat-tab:has-text('Big')"); until(lambda: d.locator('#board .group').count() == NG); settle(d)
    check(d.locator('#board .group').count() == NG and opaque(d), f'category round trip: {NG} opaque groups')
    d.click(".cat-tab:has-text('Small')"); time.sleep(.05); d.click(".cat-tab:has-text('Big')"); time.sleep(1.6)
    check(opaque(d), 'quick round trip: all opaque')
    for n in ('', ' again'):
        d.keyboard.press('Control+f'); until(lambda: d.evaluate("document.activeElement?.id === 'search'")); d.keyboard.type('g11'); time.sleep(.4); d.keyboard.press('Enter'); until(lambda: has(d, G('g11'), 'flash'))
        check(has(d, G('g11'), 'flash'), 'search reveal flashes' + n)
        until(lambda: not has(d, G('g11'), 'flash')); check(not has(d, G('g11'), 'flash'), 'the flash clears' + n)
    before = d.locator(G('g5') + ' .node-tools button').first.get_attribute('title')
    settings(sw, language='ko'); until(lambda: d.locator(G('g5') + ' .node-tools button').first.get_attribute('title') != before)
    after = d.locator(G('g5') + ' .node-tools button').first.get_attribute('title')
    check(after and after != before, f'a language switch re-renders the cards ({before!r} -> {after!r})')
    check(not errors, f'no page errors {errors}')
    ctx.close()
done()
