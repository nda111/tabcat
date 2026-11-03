# Closing a window or tabs from Open tabs goes into the shared undo history: Ctrl+Z (or the toast's Undo)
# opens them again where they were, a closed window as a new one, with their tab groups as they looked;
# Ctrl+Shift+Z closes them again. Undoing one close takes nothing else with it.
from harness import *

def demo_tabs(sw, mark):
    return sw.evaluate(f"chrome.tabs.query({{}}).then(ts=>ts.filter(t=>(t.url||t.pendingUrl).includes('?{mark}=')).sort((a,b)=>a.index-b.index)"
                       ".map(t=>({url:(t.url||t.pendingUrl).split('?')[1], group:t.groupId, window:t.windowId})))")
def group_look(sw, gid):
    return sw.evaluate(f"chrome.tabGroups.get({gid}).then(g=>[g.title,g.color])")
def close_window(d, n):
    w = d.locator('#windows .win').nth(n)
    count = d.locator('#windows .win').count()
    w.locator('.win-head').hover(); settle(d)
    w.locator('.win-head .icon-btn').last.click(); settle(d)
    d.click('#confirm-ok')
    until(lambda: d.locator('#windows .win').count() == count - 1); settle(d)

serve()
errors = []
with sync_playwright() as p:
    ctx, sw = launch(p)
    d = dashboard(ctx, errors)
    # a window of three tabs, the last two in a blue tab group "Work"
    sw.evaluate("""chrome.windows.create({url: ['about:blank?a=1', 'about:blank?a=2', 'about:blank?a=3'], focused: false}).then(async (w) => {
      const g = await chrome.tabs.group({tabIds: w.tabs.slice(1).map(t => t.id), createProperties: {windowId: w.id}});
      await chrome.tabGroups.update(g, {title: 'Work', color: 'blue'}); })""")
    until(lambda: d.locator('#windows .win').count() == 2); settle(d)
    close_window(d, 1)
    check(demo_tabs(sw, 'a') == [], 'the window closed')
    d.locator('body').click(position={'x': 700, 'y': 400}); d.keyboard.press('Control+z')
    until(lambda: (lambda b: len(b) == 3 and b[1]['group'] > -1 and group_look(sw, b[1]['group']) == ['Work', 'blue'])(demo_tabs(sw, 'a')))
    back = demo_tabs(sw, 'a')
    check([t['url'] for t in back] == ['a=1', 'a=2', 'a=3'] and len({t['window'] for t in back}) == 1, f'Ctrl+Z opens it again, as one window {back}')
    check(back and back[0]['group'] == -1 and back[1]['group'] == back[2]['group'] > -1 and group_look(sw, back[1]['group']) == ['Work', 'blue'],
          'its tab group is back, as it looked')
    d.keyboard.press('Control+Shift+z')
    until(lambda: demo_tabs(sw, 'a') == [])
    check(demo_tabs(sw, 'a') == [], 'Ctrl+Shift+Z closes it again')
    d.keyboard.press('Control+z')
    check(until(lambda: len(demo_tabs(sw, 'a')) == 3), 'and Ctrl+Z brings it back again')

    # two windows closed one after the other: the first one's toast Undo brings back only that one,
    # and Ctrl+Z then the second
    n0 = d.locator('#windows .win').count()
    sw.evaluate("chrome.windows.create({url: ['about:blank?b=1'], focused: false})")
    until(lambda: d.locator('#windows .win').count() == n0 + 1); settle(d)
    n = d.locator('#windows .win').count()
    close_window(d, n - 2)  # (the a= window)
    close_window(d, d.locator('#windows .win').count() - 1)  # (the b= window)
    check(demo_tabs(sw, 'a') == [] and demo_tabs(sw, 'b') == [], 'both closed')
    d.locator('#toast .toast-item button').first.click(); time.sleep(2)
    check(len(demo_tabs(sw, 'a')) == 3 and demo_tabs(sw, 'b') == [], 'the first toast\'s Undo opens only the first window')
    d.keyboard.press('Control+z')
    check(until(lambda: len(demo_tabs(sw, 'b')) == 1), 'Ctrl+Z then opens the second (it was not lost)')

    check(not errors, f'no page errors {errors}')
    ctx.close()
done()
