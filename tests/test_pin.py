# Settings > pin the dashboard: one pinned dashboard at the left of every window, and gone when turned off.
from harness import *

serve()
errors = []
with sync_playwright() as p:
    ctx, sw = launch(p)
    d = dashboard(ctx, errors)
    TABS = f"chrome.windows.getAll({{populate:true, windowTypes:['normal']}}).then(ws=>ws.map(w=>w.tabs.map(t=>(t.pinned?'pin:':'')+((t.url||t.pendingUrl).startsWith('{URL}')?'DASH':'other'))))"
    sw.evaluate("chrome.windows.create({url:'about:blank#second'})"); time.sleep(.8)
    d.click('#btn-settings'); time.sleep(.5); d.check('input[name=pinDashboard]'); time.sleep(2)
    wins = sw.evaluate(TABS)
    check(all(w[0] == 'pin:DASH' and sum(t.endswith('DASH') and t.startswith('pin:') for t in w) == 1 for w in wins), f'on: every window starts with one pinned dashboard {wins}')
    check(sum(t.endswith('DASH') for w in wins for t in w) == len(wins), 'the open dashboard became the pinned one (no extra)')
    sw.evaluate("chrome.windows.create({url:'about:blank#third'})"); time.sleep(2.2)
    wins = sw.evaluate(TABS)
    check(wins[-1][0] == 'pin:DASH', f'a new window gets one too {wins[-1]}')
    d.uncheck('input[name=pinDashboard]'); time.sleep(2)
    wins = sw.evaluate(TABS)
    check(not any(t.startswith('pin:') for w in wins for t in w), f'off: none pinned {wins}')
    check(sum(t == 'DASH' for w in wins for t in w) == 1, 'off: the dashboard being shown stays open, unpinned')
    check(not errors, f'no page errors {errors}')
    ctx.close()
done()
