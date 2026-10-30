# The toolbar popup: tidying buttons say how many tabs they would touch (off at none), their results
# can be undone, saving a window can be undone (links out, tabs back), and the dashboard line shows
# its shortcut.
from harness import *

PAGE = 'http://127.0.0.1:8765/page?'
serve()
errors = []
with sync_playwright() as p:
    ctx, sw = launch(p)
    settings(sw, dashboardUrl=URL)
    sw.evaluate(f"chrome.windows.create({{url:['{PAGE}a','{PAGE}a','{PAGE}b']}}).then(w=>self.__w=w.id)"); time.sleep(1)
    # the popup, as a page in that window (it acts on its own window)
    had = set(sw.evaluate("chrome.tabs.query({}).then(ts=>ts.map(t=>t.id))"))
    pp = ctx.new_page(); pp.on('pageerror', lambda e: errors.append(str(e)))
    tab = next(t for t in sw.evaluate("chrome.tabs.query({}).then(ts=>ts.map(t=>t.id))") if t not in had)
    # (pinned: as a tab, Save window would take the popup page itself too; the real popup isn't a tab)
    sw.evaluate(f"chrome.tabs.move({tab},{{windowId:self.__w,index:-1}}).then(()=>chrome.tabs.update({tab},{{active:true,pinned:true}}))"); time.sleep(.4)
    pp.goto(sw.url.replace('background.js', 'popup.html')); time.sleep(1)
    count = lambda id: (pp.inner_text(f'#{id}-n'), pp.is_disabled(f'#{id}'))
    check(count('dedupe') == ('1', False), f'Close duplicates says 1 {count("dedupe")}')
    check(count('suspend')[0] == '3', f'Suspend says 3 (the inactive pages) {count("suspend")}')
    check(pp.inner_text('#open-key') == 'Ctrl+Shift+X', f"the dashboard line shows the shortcut ({pp.inner_text('#open-key')!r})")
    WIN = "chrome.tabs.query({windowId:self.__w}).then(ts=>ts.map(t=>(t.url||t.pendingUrl).split('?').pop()).filter(u=>u.length===1).sort().join(''))"
    pp.click('#dedupe'); time.sleep(.8)
    check(sw.evaluate(WIN) == 'ab' and count('dedupe') == ('', True), 'closed the duplicate; the button is off now')
    check(pp.is_visible('#msg-undo'), 'its result offers Undo')
    pp.click('#msg-undo'); time.sleep(1.2)
    check(sw.evaluate(WIN) == 'aab' and count('dedupe')[0] == '1', 'Undo opens it again')
    groups = lambda: sw.evaluate("chrome.storage.local.get('tabcat').then(r=>JSON.stringify(r.tabcat).match(/\"type\":\"group\"/g).length)")
    g0 = groups()
    pp.click('#save-window'); time.sleep(1.5)
    check(sw.evaluate(WIN) == '' and groups() == g0 + 1, 'Save window: a new group, the tabs closed (as set)')
    pp.click('#msg-undo'); time.sleep(1.5)
    check(sw.evaluate(WIN) == 'aab' and groups() == g0, 'Undo: the group goes, the tabs come back')
    pp.click('#open'); time.sleep(1.5)
    first = sw.evaluate(f"chrome.tabs.query({{windowId:self.__w}}).then(ts=>[(ts[0].url||ts[0].pendingUrl).startsWith('{URL}'), ts[0].pinned])")
    check(first == [True, True], f'the dashboard line brings the dashboard here, pinned first {first}')
    check(not errors, f'no page errors {errors}')
    ctx.close()
done()
