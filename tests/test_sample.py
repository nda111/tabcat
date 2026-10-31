# Help > Add sample workspaces: a work board, a study board and a trip in the page's language, beside
# what is there, shown at once; one Undo takes them away.
from harness import *

WS = "chrome.storage.local.get('tabcat').then(r=>r.tabcat.workspaces.map(w=>[w.name, w.categories.length, w.categories.reduce((n,c)=>n+c.groups.length,0)]))"
serve()
errors = []
with sync_playwright() as p:
    ctx, sw = launch(p)
    d = dashboard(ctx, errors)
    before = sw.evaluate(WS)
    settings(sw, language='ko'); time.sleep(1)
    d.click('#btn-help'); time.sleep(.5)
    d.click('#help-sample'); time.sleep(1.5)
    added = sw.evaluate(WS)[len(before):]
    check([w[0] for w in added] == ['업무', '공부', '리스본 여행'] and [w[1:] for w in added] == [[3, 11], [1, 3], [1, 5]], f'three sample workspaces, in Korean {added}')
    check(sw.evaluate(WS)[:len(before)] == before, 'what was there stays')
    check(d.evaluate("document.querySelector('#ws-head h1').textContent").endswith('업무') and d.locator('#board .group').count() == 9, 'the first one is shown')
    check('금요일 마감' in d.inner_text('#board'), 'notes in Korean too')
    d.locator('#toast .toast-item button').last.click(); time.sleep(1.5)
    check(sw.evaluate(WS) == before, 'Undo takes them away')
    check(not errors, f'no page errors {errors}')
    ctx.close()
done()
