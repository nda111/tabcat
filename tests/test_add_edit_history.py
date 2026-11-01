# Adding and editing are undoable too: a new group, link or folder, an edited link, a group's note;
# an edit that changes nothing leaves the history alone.
import json
from harness import *

ws = workspace('AE', [group('Box', [link('a')])])
def items(sw, gid):
    w = [x for x in json.loads(sw.evaluate("chrome.storage.local.get('tabcat').then(r=>JSON.stringify(r.tabcat.workspaces))")) if x['id'] == 'AE'][0]
    gs = w['categories'][0]['groups']
    return gs if gid is None else next(g for g in gs if g['id'] == gid)

serve()
errors = []
with sync_playwright() as p:
    ctx, sw = launch(p)
    d = dashboard(ctx, errors); seed(sw, d, ws)
    def undo(): d.keyboard.press('Control+z'); time.sleep(1.2)
    def redo(): d.keyboard.press('Control+Shift+z'); time.sleep(1.2)
    def submit(): d.click('#editor-form button[type=submit]'); time.sleep(1.2)
    # a new group
    d.hover('#board .col[data-col="0"] .add-group'); d.click('#board .col[data-col="0"] .add-group'); time.sleep(.5)
    d.locator('#editor-fields input').first.fill('Fresh'); submit()
    check([g['name'] for g in items(sw, None)] == ['Box', 'Fresh'], 'set up: a group added')
    undo()
    check([g['name'] for g in items(sw, None)] == ['Box'], 'Ctrl+Z takes the new group away')
    check('Fresh' not in d.locator('#toast').inner_text() and d.locator('#toast').inner_text() != '', 'a toast says so')
    redo()
    check([g['name'] for g in items(sw, None)] == ['Box', 'Fresh'], 'Ctrl+Shift+Z adds it again')
    undo()
    # editing a link
    d.hover('#board [data-id=a] .link-row'); d.click('#board [data-id=a] .head-actions button:nth-child(1)'); time.sleep(.5)
    d.fill('#editor-fields input[name=name]', 'Renamed'); submit()
    check(items(sw, 'Box')['items'][0]['name'] == 'Renamed', 'set up: the link renamed')
    undo()
    check(items(sw, 'Box')['items'][0]['name'] == 'a', 'Ctrl+Z puts its old name back')
    # an edit that changes nothing isn't remembered: Ctrl+Z after it undoes the change before
    d.hover('#board [data-id=a] .link-row'); d.click('#board [data-id=a] .head-actions button:nth-child(1)'); time.sleep(.5)
    d.fill('#editor-fields input[name=name]', 'Again'); submit()
    d.hover('#board [data-id=a] .link-row'); d.click('#board [data-id=a] .head-actions button:nth-child(1)'); time.sleep(.5)
    submit(); undo()
    check(items(sw, 'Box')['items'][0]['name'] == 'a', 'an unchanged save leaves the history alone')
    check(not errors, f'no page errors {errors}')
    ctx.close()
done()
