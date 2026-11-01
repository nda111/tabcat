# Recently deleted: deleting a link, a folder, groups or a workspace keeps them; Restore puts one back where
# it was (or the Inbox when its group is gone) and shows it, and can be undone (it's listed again);
# an undone delete leaves the list; one can be deleted for good, or all at once; past 30 days, gone.
import json, os
from harness import *

TRASH = "chrome.storage.local.get('tabcat:trash').then(r=>(r['tabcat:trash']||[]).map(e=>e.node.name))"
def board(sw):
    return sw.evaluate("chrome.storage.local.get('tabcat').then(r=>JSON.stringify(r.tabcat.workspaces))")

serve()
errors = []
with sync_playwright() as p:
    ctx, sw = launch(p)
    d = dashboard(ctx, errors)
    seed(sw, d, workspace('W', [group('G1', [link('l1'), link('l2'), folder('F', [link('f1')])]), group('G2', [link('l3')], column=1)]))
    check(d.is_visible('#btn-trash'), 'the sidebar offers Recently deleted')
    # delete a link from its menu
    def delete(id):
        el = d.locator(f'.group[data-id="{id}"] .group-head') if id.startswith('G') else d.locator(f'[data-id="{id}"]').first
        el.click(button='right'); time.sleep(.3)
        d.keyboard.press('d'); time.sleep(.3)
        if d.locator('#confirm-ok').is_visible(): d.click('#confirm-ok')
        time.sleep(1)
    delete('l1'); delete('G2')
    check(sw.evaluate(TRASH) == ['G2', 'l1'], f'deleted ones are kept, newest first {sw.evaluate(TRASH)}')
    d.click('#btn-trash'); time.sleep(.5)
    rows = d.locator('#trash-list .trash-row')
    check(rows.count() == 2 and 'W' in rows.nth(1).inner_text() and 'G1' in rows.nth(1).inner_text(), f'listed, with where they were {[rows.nth(i).inner_text() for i in range(rows.count())]}')
    if os.environ.get('SHOT'): d.screenshot(path=os.environ['SHOT'])
    # Restore the link: back in G1 at its place, the dialog closes
    rows.nth(1).locator('.btn').click(); time.sleep(1.5)
    st = [w for w in json.loads(board(sw)) if w['id'] == 'W']
    check([x['id'] for x in st[0]['categories'][0]['groups'][0]['items']] == ['l1', 'l2', 'F'] and not d.evaluate("document.querySelector('#trash').open"),
          'Restore puts the link back where it was, and shows it')
    d.keyboard.press('Control+z'); time.sleep(1.2)
    d.click('#btn-trash'); time.sleep(.5)
    check(d.locator('#trash-list .trash-row').count() == 2, 'undoing the Restore lists it again')
    d.keyboard.press('Escape'); time.sleep(.3)
    # an undone delete leaves the list
    d.keyboard.press('Control+z'); time.sleep(1.2)   # (undoes deleting G2)
    d.click('#btn-trash'); time.sleep(.5)
    names = d.locator('#trash-list .trash-name').all_inner_texts()
    check(names == ['l1'], f'an undone delete leaves the list {names}')
    d.keyboard.press('Escape'); time.sleep(.3)
    # its group gone, a link goes to the Inbox (the first group)
    delete('G1'); time.sleep(.3)
    d.click('#btn-trash'); time.sleep(.5)
    d.locator('#trash-list .trash-row').filter(has_text='l1').locator('.btn').click(); time.sleep(1.5)
    st = [w for w in json.loads(board(sw)) if w['id'] == 'W']
    check(any(x['id'] == 'l1' for x in st[0]['categories'][0]['groups'][0]['items']) and st[0]['categories'][0]['groups'][0]['id'] == 'G2',
          'its group gone, it goes to the first group')
    # delete for good, then empty
    d.click('#btn-trash'); time.sleep(.5)
    n0 = d.locator('#trash-list .trash-row').count()
    d.locator('#trash-list .trash-row').first.locator('.icon-btn').click(); time.sleep(.8)
    check(d.locator('#trash-list .trash-row').count() == n0 - 1, 'one deleted for good')
    d.keyboard.press('Escape'); time.sleep(.3)
    delete('l3'); delete('l1')
    d.click('#btn-trash'); time.sleep(.5)
    d.click('#trash-clear'); time.sleep(.3)
    d.evaluate("window.__o=[]; const b=document.querySelector('#trash-clear'); (function f(){ __o.push(+getComputedStyle(b).opacity); if(__o.length<60) requestAnimationFrame(f); })()")
    d.click('#confirm-ok'); time.sleep(1)
    check(sw.evaluate(TRASH) == [] and d.is_visible('#trash-none'), 'emptied')
    oo = d.evaluate('__o')
    check(not d.is_visible('#trash-clear') and any(0.05 < o < 0.95 for o in oo), f'with nothing left to empty, Empty fades out ({min(oo)}..{max(oo)})')
    d.keyboard.press('Escape'); time.sleep(.3)
    d.click('#btn-trash'); time.sleep(.5)
    check(not d.is_visible('#trash-clear'), 'opened with nothing in it: no Empty button')
    d.keyboard.press('Escape'); time.sleep(.3)
    # past 30 days: gone
    sw.evaluate("chrome.storage.local.set({'tabcat:trash': [{id:'old', node:{id:'x', type:'link', name:'old', url:'about:blank'}, parentId:null, index:0, trail:[], deletedAt: Date.now() - 31*864e5}]})")
    d.click('#btn-trash'); time.sleep(.5)
    check(d.locator('#trash-list .trash-row').count() == 0, 'past 30 days, gone')
    check(not errors, f'no page errors {errors}')
    ctx.close()
done()
