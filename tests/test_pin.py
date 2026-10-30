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
    # Chrome can't lock a tab: unpinning it, or putting another pinned tab ahead of it, is undone
    WIN0 = "chrome.windows.getAll({windowTypes:['normal']}).then(ws=>ws[0].id)"
    DASH0 = f"(async()=>{{ const w = await {WIN0}; return (await chrome.tabs.query({{windowId: w}})).find(t=>(t.url||t.pendingUrl).startsWith('{URL}')) }})()"
    sw.evaluate(f"{DASH0}.then(t=>chrome.tabs.update(t.id,{{pinned:false}}))"); time.sleep(1)
    t = sw.evaluate(DASH0)
    check(t['pinned'] and t['index'] == 0, f"unpinned by hand: pinned again, first ({t['pinned']}, {t['index']})")
    sw.evaluate(f"(async()=>{{ const w = await {WIN0}; const o = (await chrome.tabs.query({{windowId: w}})).find(t=>!(t.url||t.pendingUrl).startsWith('{URL}')); await chrome.tabs.update(o.id,{{pinned:true}}); await chrome.tabs.move(o.id,{{index:0}}); }})()"); time.sleep(1)
    t = sw.evaluate(DASH0)
    check(t['pinned'] and t['index'] == 0, f"another pinned tab put ahead of it: first again (index {t['index']})")
    sw.evaluate(f"(async()=>{{ const w = await {WIN0}; for (const o of await chrome.tabs.query({{windowId: w, pinned: true}})) if (!(o.url||o.pendingUrl).startsWith('{URL}')) await chrome.tabs.update(o.id,{{pinned:false}}); }})()"); time.sleep(.5)
    # a window left with only its pinned dashboard closes, unless the dashboard is what you were looking at
    NEWWIN = "(async()=>{ const w = await chrome.windows.create({url:'about:blank#solo'}); self.__w = w.id; self.__t = w.tabs[0].id; })()"
    ALIVE = "chrome.windows.getAll().then(ws=>ws.some(w=>w.id===self.__w))"
    sw.evaluate(NEWWIN); time.sleep(2.2)
    sw.evaluate("chrome.tabs.remove(self.__t)"); time.sleep(1)
    check(not sw.evaluate(ALIVE), 'closing the tab you were on, leaving only the dashboard: the window closes')
    sw.evaluate(NEWWIN); time.sleep(2.2)
    sw.evaluate(f"chrome.tabs.query({{windowId:self.__w}}).then(ts=>chrome.tabs.update(ts.find(t=>(t.url||t.pendingUrl).startsWith('{URL}')).id,{{active:true}}))"); time.sleep(.5)
    sw.evaluate("chrome.tabs.remove(self.__t)"); time.sleep(1)
    check(sw.evaluate(ALIVE), 'closing the last tab while on the dashboard: the window stays')
    sw.evaluate("chrome.windows.remove(self.__w)"); time.sleep(.5)
    sw.evaluate(NEWWIN); time.sleep(2.2)
    sw.evaluate("(async()=>{ const o = await chrome.windows.create({url:'about:blank#other'}); self.__o = o.id; await chrome.tabs.move(self.__t, {windowId: o.id, index: -1}); })()"); time.sleep(1.2)
    check(not sw.evaluate(ALIVE), 'dragging the last tab to another window: the window it left closes')
    sw.evaluate("chrome.windows.remove(self.__o)"); time.sleep(.5)
    d.uncheck('input[name=pinDashboard]'); time.sleep(2)
    wins = sw.evaluate(TABS)
    check(not any(t.startswith('pin:') for w in wins for t in w), f'off: none pinned {wins}')
    check(sum(t == 'DASH' for w in wins for t in w) == 1, 'off: the dashboard being shown stays open, unpinned')
    check(not errors, f'no page errors {errors}')
    ctx.close()
done()
