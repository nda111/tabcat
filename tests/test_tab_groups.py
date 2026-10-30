# "Open all" opens a group / folder as a Chrome tab group titled and coloured like it, kept in sync.
from harness import *

ws = workspace('TG', [
    group('Reading', [link('a1'), link('a2'), folder('Papers', [link('p1'), link('p2')])], color='cyan', symbol='📚'),
    group('Logo', [link('b1')], column=1, color='purple', symbol=':tabcat:'),
    group('Letter', [link('c1')], column=2, symbol='A'),
])
GROUPS = """async () => { const out=[]; for (const g of await chrome.tabGroups.query({})) { const tabs = await chrome.tabs.query({ groupId: g.id }); out.push([g.title, g.color, tabs.map(t => (t.pendingUrl||t.url).split('#')[1]).join(',')]); } return out; }"""
RESET = """async () => { for (const t of await chrome.tabs.query({})) if ((t.pendingUrl||t.url||'').startsWith('about:blank#')) await chrome.tabs.remove(t.id); }"""
OPEN_ALL = '#board .group[data-id="{}"] .node-tools button:nth-of-type(4)'

serve()
errors = []
with sync_playwright() as p:
    ctx, sw = launch(p)
    d = dashboard(ctx, errors)
    seed(sw, d, ws)
    def opened(fn):
        sw.evaluate(RESET); time.sleep(.3); fn(); time.sleep(1.2)
        return sw.evaluate(GROUPS)
    g = opened(lambda: d.click(OPEN_ALL.format('Reading')))
    check(g == [['📚 Reading', 'cyan', 'a1,a2,p1,p2']], f'group: one tab group, emoji symbol first, its colour {g}')
    g = opened(lambda: (d.hover('#board [data-id=Papers] .folder-head'), d.click('#board [data-id=Papers] .folder-head .head-actions button:nth-of-type(4)')))
    check(g == [['Papers', 'cyan', 'p1,p2']], f"folder: its own tab group in its group's colour {g}")
    g = opened(lambda: d.click(OPEN_ALL.format('Logo')))
    check(g == [['🐱 Logo', 'purple', 'b1']], f'logo symbol: a cat in the title {g}')
    sw.evaluate("chrome.storage.local.get('tabcat').then(r=>{const s=r.tabcat; s.workspaces.find(w=>w.id==='TG').categories[0].groups[1].name='Renamed'; return chrome.storage.local.set({tabcat:s})})"); time.sleep(1.2)
    g = sw.evaluate(GROUPS)
    check(g == [['🐱 Renamed', 'purple', 'b1']], f'a rename reaches the open tab group {g}')
    g = opened(lambda: d.click(OPEN_ALL.format('Letter')))
    check(g == [['Letter', 'grey', 'c1']], f'letter symbol: left out of the title {g}')
    settings(sw, groupTabs=False)
    g = opened(lambda: d.click(OPEN_ALL.format('Reading')))
    check(g == [], f'setting off: no tab group {g}')
    check(not errors, f'no page errors {errors}')
    ctx.close()
done()
