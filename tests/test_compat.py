# Dashboard / extension versions: the extension says what it can do, and keeps what a newer dashboard
# sends (an unknown symbol, colour, column or field) instead of refusing or dropping it.
from harness import *

ws = workspace('Compat', [group('Box', [link('x')])])
# a bridge call as the dashboard makes it (see web/js/bridge.js)
CALL = """([cmd, args]) => new Promise((res) => { const id = 1e6 + Math.random();
  const on = (e) => { const m = e.data; if (m?.source === 'tabcat-ext' && m.reply === id) { removeEventListener('message', on); res(m.error ? { error: m.error } : { result: m.result }); } };
  addEventListener('message', on); postMessage({ source: 'tabcat-page', id, cmd, args }, location.origin); })"""
STORED = "chrome.storage.local.get('tabcat').then(r=>r.tabcat.workspaces.find(w=>w.id==='Compat').categories[0].groups[0])"

serve()
errors = []
with sync_playwright() as p:
    ctx, sw = launch(p)
    d = ctx.new_page()
    d.add_init_script("addEventListener('message', (e) => { if (e.data?.source === 'tabcat-ext' && e.data.event === 'ready') window.__ready = e.data.data; })")
    d.on('pageerror', lambda e: errors.append(str(e)))
    d.goto(URL); d.wait_for_selector('.ws-item', timeout=15000)
    ready = d.evaluate('window.__ready')
    check(isinstance(ready.get('features'), list) and {'wakeTabs', 'logoSymbol', 'looseData'} <= set(ready['features']), f"'ready' lists the extension's features {ready.get('features')}")
    seed(sw, d, ws)
    r = d.evaluate(CALL, ['apply', [{'op': 'patch', 'id': 'Box', 'fields': {'symbol': ':future:', 'color': 'grey', 'column': 12, 'badge': 'new', 'weight': 3, 'nested': {'no': 1}}}]])
    g = sw.evaluate(STORED)
    check('error' not in r, f'a patch with values this extension does not know is not refused {r}')
    check(g['symbol'] == ':future:' and g['color'] == 'grey' and g['column'] == 12, f"unknown symbol, colour, column kept ({g['symbol']}, {g['color']}, {g['column']})")
    check(g.get('badge') == 'new' and g.get('weight') == 3, 'unknown plain fields kept')
    check('nested' not in g and g['id'] == 'Box' and g['type'] == 'group', 'objects and structural fields are not taken from a patch')
    r = d.evaluate(CALL, ['apply', [{'op': 'patch', 'id': 'Box', 'fields': {'symbol': 'x' * 40, 'color': 'Not a colour!'}}]])
    g = sw.evaluate(STORED)
    check(g['symbol'] == '' and g['color'] == '', f'but nothing unsafe: an overlong symbol, a non-name colour ({g["symbol"]!r}, {g["color"]!r})')
    # a drawn symbol it doesn't know stays out of a tab group's title
    d.evaluate(CALL, ['apply', [{'op': 'patch', 'id': 'Box', 'fields': {'symbol': ':future:', 'color': 'cyan'}}]]); time.sleep(.6)
    d.click('#board .group[data-id="Box"] .node-tools button:nth-of-type(4)'); time.sleep(1.2)
    titles = sw.evaluate("chrome.tabGroups.query({}).then(gs=>gs.map(g=>g.title))")
    check(titles == ['Box'], f'an unknown :code: symbol is left out of the tab group title {titles}')
    check(not errors, f'no page errors {errors}')
    ctx.close()
done()
