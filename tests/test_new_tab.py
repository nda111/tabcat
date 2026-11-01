# A new tab is listed with the open tabs (it was taken for the dashboard, from when tabcat was the new tab
# page, and left out), and dragged onto a group it's saved there like any tab.
import json
from harness import *

serve()
errors = []
with sync_playwright() as p:
    ctx, sw = launch(p)
    d = dashboard(ctx, errors)
    seed(sw, d, workspace('N', [group('G', [link('a')])]))
    sw.evaluate("chrome.tabs.create({ url: 'chrome://newtab/', active: false })"); time.sleep(1.5)
    urls = sw.evaluate("chrome.tabs.query({}).then(ts => ts.map(t => t.url || t.pendingUrl))")
    rows = d.locator('#windows .tab-row')
    listed = [rows.nth(i).get_attribute('data-url') for i in range(rows.count())]
    check(any('newtab' in (u or '') or 'new-tab-page' in (u or '') for u in listed), f'the new tab is listed with the open tabs ({listed}; open: {urls})')
    row = next(i for i in range(rows.count()) if 'new' in (rows.nth(i).get_attribute('data-url') or ''))
    rows.nth(row).drag_to(d.locator('.group[data-id="G"] .group-body')); time.sleep(.5)
    import os
    if os.environ.get('SHOT'): d.screenshot(path=os.environ['SHOT'])
    time.sleep(.7)
    items = [x for x in json.loads(sw.evaluate("chrome.storage.local.get('tabcat').then(r=>JSON.stringify(r.tabcat.workspaces))")) if x['id'] == 'N'][0]['categories'][0]['groups'][0]['items']
    check(len(items) == 2 and any('newtab' in x['url'] for x in items), f'dragged onto a group, it is saved there ({[x.get("url") for x in items]})')
    check(not errors, f'no page errors {errors}')
    ctx.close()
done()
