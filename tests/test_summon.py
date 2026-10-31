# The dashboard comes to you: going to its address (or the popup's "Open dashboard") brings the one
# dashboard into the current window as its first, pinned tab; the tab that went there goes back. Pinned,
# it stays the first tab.
from harness import *

TABS = f"chrome.windows.getAll({{populate:true, windowTypes:['normal']}}).then(ws=>ws.map(w=>w.tabs.map(t=>(t.pinned?'pin:':'')+((t.url||t.pendingUrl).startsWith('{URL}')?'DASH':(t.url||t.pendingUrl).split('?').pop())+(t.active?'*':''))))"
PAGE = 'http://127.0.0.1:8765/page?'  # (a page elsewhere: not the dashboard's address; data: pages can't be gone back to)
def GO(name):  # typing the address in that tab (a navigation like the address bar's: one to go back from)
    pg = next(pg for pg in ctx.pages if pg.url.endswith(name))
    pg.goto(URL, wait_until='commit')
dashes = lambda wins: sum(t.endswith('DASH') or t.endswith('DASH*') for w in wins for t in w)

serve()
errors = []
with sync_playwright() as p:
    ctx, sw = launch(p)
    settings(sw, dashboardUrl=URL)
    sw.evaluate(f"chrome.windows.create({{url:['{PAGE}a1','{PAGE}a2']}})"); time.sleep(.6)
    sw.evaluate(f"chrome.windows.create({{url:['{PAGE}b1']}})"); time.sleep(.6)
    # a page goes to the address, no dashboard yet: one opens pinned first; the page goes back
    GO('?a2'); time.sleep(2)
    w = sw.evaluate(TABS)
    check(w[1] == ['pin:DASH*', 'a1', 'a2'] and dashes(w) == 1, f'a page goes there: the dashboard opens pinned first, the page is back {w[1]}')
    d = next(pg for pg in ctx.pages if pg.url.startswith(URL)); d.wait_for_selector('.ws-item', timeout=15000); d.evaluate('window.__mark = 1')
    # in another window, a page goes there: the dashboard moves over (no reload); the page goes back
    GO('?b1'); time.sleep(2)
    w = sw.evaluate(TABS)
    check(w[2] == ['pin:DASH*', 'b1'] and dashes(w) == 1, f'from another window: the dashboard moves over {w}')
    check(d.evaluate('window.__mark === 1'), 'moved, not reloaded')
    # a new tab goes there: the dashboard comes to its window, the new tab closes
    fresh = ctx.new_page()  # (about:blank: a new tab)
    win = sw.evaluate("chrome.tabs.query({}).then(ts=>ts.filter(t=>t.url==='about:blank').map(t=>t.windowId))")[-1]
    try: fresh.goto(URL, wait_until='commit')
    except Exception: pass  # (it closes meanwhile)
    time.sleep(2)
    here = sw.evaluate(f"chrome.tabs.query({{windowId:{win}}}).then(ts=>ts.map(t=>(t.pinned?'pin:':'')+((t.url||t.pendingUrl).startsWith('{URL}')?'DASH':t.url)))")
    w = sw.evaluate(TABS)
    check(here[0] == 'pin:DASH' and 'about:blank' not in here[1:] and dashes(w) == 1, f'a new tab goes there: the dashboard comes, the new tab closes {here}')
    # the popup's Open dashboard, from the other window
    sw.evaluate("chrome.tabs.query({}).then(ts=>{ const b = ts.find(t=>(t.url||'').endsWith('?b1')); return chrome.tabs.update(b.id,{active:true}).then(()=>chrome.windows.update(b.windowId,{focused:true})); })"); time.sleep(.4)
    pp = ctx.new_page(); pp.goto(sw.url.replace('background.js', 'popup.html')); time.sleep(.5)
    pp.evaluate("chrome.runtime.sendMessage({ cmd: 'openDashboard' })"); time.sleep(1.5)
    w = sw.evaluate(TABS)
    check(dashes(w) == 1 and any(win[0] == 'pin:DASH*' for win in w), f"the popup's Open dashboard brings the same one {w}")
    # pinned, it stays first: another tab pinned after it, or dragged in ahead of it
    DW = f"chrome.tabs.query({{}}).then(ts=>ts.find(t=>(t.url||'').startsWith('{URL}')).windowId)"
    win = sw.evaluate(DW)
    other = sw.evaluate(f"chrome.tabs.create({{windowId:{win}, url:'{PAGE}c1', active:false}}).then(t=>t.id)"); time.sleep(.4)
    sw.evaluate(f"chrome.tabs.update({other}, {{pinned:true}})"); time.sleep(.6)
    first = lambda: sw.evaluate(f"chrome.tabs.query({{windowId:{win}}}).then(ts=>ts.map(t=>(t.url||t.pendingUrl).startsWith('{URL}')?'DASH':(t.url||t.pendingUrl).split('?').pop()).slice(0,2))")
    check(first() == ['DASH', 'c1'], f'another tab pinned: the dashboard is still first {first()}')
    sw.evaluate(f"chrome.tabs.move({other}, {{index:0}})"); time.sleep(.8)
    check(first() == ['DASH', 'c1'], f'a pinned tab moved ahead of it: the dashboard goes back in front {first()}')
    # another page beside the dashboard (the privacy policy): opens where it is, like any page
    pg = next(pg for pg in ctx.pages if pg.url.endswith('?b1'))
    pg.goto(URL + 'privacy.html', wait_until='commit'); time.sleep(2)
    check(pg.url == URL + 'privacy.html' and not pg.is_closed(), f'the privacy page opens in its tab ({pg.url})')
    check(sw.evaluate(f"chrome.tabs.query({{}}).then(ts=>ts.filter(t=>(t.url||'').startsWith('{URL}privacy')).map(t=>t.pinned))") == [False], 'not taken for the dashboard')
    check(not errors, f'no page errors {errors}')
    ctx.close()
done()
