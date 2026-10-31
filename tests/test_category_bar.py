# The category bar's underline slides to a newly picked category; an empty category's grey New group card
# (first column) steps aside while another column shows its own.
from harness import *

serve()
errors = []
with sync_playwright() as p:
    ctx, sw = launch(p)
    d = dashboard(ctx, errors)
    ws = workspace('w', [group('g0', [link('a')])])
    ws['categories'].append({'id': 'w-c2', 'type': 'category', 'name': 'Second category', 'groups': []})
    seed(sw, d, ws)
    tabs = d.query_selector_all('.cat-tab')
    x0 = d.evaluate("document.querySelector('.cat-tab.active').offsetLeft")
    tabs[1].click(); time.sleep(.08)
    mid = d.evaluate("(() => { const l = document.querySelector('#cat-bar .cat-line'); return l && [l.offsetLeft, getComputedStyle(document.querySelector('.cat-tab.active')).borderBottomColor]; })()")
    x1 = d.evaluate("document.querySelector('.cat-tab.active').offsetLeft")
    check(mid and x0 < mid[0] < x1 and mid[1] == 'rgba(0, 0, 0, 0)', f'the line glides between the buttons {x0} {mid} {x1}')
    time.sleep(.5)
    check(not d.query_selector('#cat-bar .cat-line') and d.evaluate("getComputedStyle(document.querySelector('.cat-tab.active')).borderBottomColor") != 'rgba(0, 0, 0, 0)', 'then the button has its own line again')
    first = lambda: float(d.evaluate("getComputedStyle(document.querySelector('#board .col:first-child .add-group')).opacity"))
    check(first() > .5, f'empty: the first column shows New group ({first()})')
    d.hover('#board .col:nth-child(3) .add-group'); time.sleep(.4)
    check(first() == 0, f'another column shows its own: the first steps aside ({first()})')
    d.mouse.move(5, 790); time.sleep(.4)
    check(first() > .5, f'and comes back after ({first()})')
    check(not errors, f'no page errors {errors}')
    ctx.close()
done()
