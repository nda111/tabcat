# A workspace's or category's edits show while its editor is open (the sidebar, the heading, the tab), as a
# group's do, a new symbol springing in: Save keeps them, Cancel puts them back.
from harness import *

ws = workspace('LW', [group('Box', [link('a')])])
serve()
errors = []
with sync_playwright() as p:
    ctx, sw = launch(p)
    d = dashboard(ctx, errors); seed(sw, d, ws)
    side = lambda: d.inner_text('#ws-list .ws-item.active')
    head = lambda: d.inner_text('#ws-head h1')
    d.bring_to_front()
    d.dblclick('#ws-list .ws-item.active'); time.sleep(.5)
    d.fill('#editor-fields input[name=symbol]', '🚀'); time.sleep(.08)
    springs = d.evaluate("[...document.querySelectorAll('#ws-list .ws-item.active > .sym, #ws-head h1 > .sym')].map(e => e.getAnimations().length)")
    check(springs and all(springs), f'its new symbol springs in, in the sidebar and the heading ({springs})')
    d.fill('#editor-fields input[name=name]', 'Rocket'); time.sleep(.3)
    check('🚀' in side() and 'Rocket' in side() and '🚀' in head() and 'Rocket' in head(), f'editing a workspace: the sidebar and heading follow before saving ({side()!r}, {head()!r})')
    d.keyboard.press('Escape'); time.sleep(.6)
    check('Rocket' not in side() and 'Rocket' not in head(), f'cancelled: back as it was ({side()!r})')
    d.dblclick('#ws-list .ws-item.active'); time.sleep(.5)
    d.fill('#editor-fields input[name=symbol]', '🌱'); time.sleep(.2)
    d.click('#editor-form button[type=submit]'); time.sleep(1.2)
    check('🌱' in side() and '🌱' in head(), 'saved: kept')
    d.dblclick('#cat-bar .cat-tab.active'); time.sleep(.5)
    d.fill('#editor-fields input[name=name]', 'Renamed tab'); time.sleep(.3)
    check('Renamed tab' in d.inner_text('#cat-bar .cat-tab.active'), 'editing a category: its tab follows before saving')
    d.keyboard.press('Escape'); time.sleep(.6)
    check('Renamed tab' not in d.inner_text('#cat-bar'), 'cancelled: back')
    check(not errors, f'no page errors {errors}')
    ctx.close()
done()
