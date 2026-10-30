# Installed fresh: sample links to start from; the dashboard comes up and offers a tour once; the tour
# lights each part in turn; afterwards it starts from the sidebar.
from harness import *

serve()
errors = []
with sync_playwright() as p:
    ctx, sw = launch(p, fresh=True)
    for _ in range(40):
        first = sw.evaluate("chrome.tabs.query({}).then(ts=>ts.filter(t=>t.pinned).map(t=>[t.index,(t.url||t.pendingUrl)]))")
        if first: break
        time.sleep(.1)
    check(len(first) == 1 and first[0][0] == 0 and 'tabcat.ghyeok.com' in first[0][1], f'installed: the dashboard opens, pinned first {first}')
    d = dashboard(ctx, errors); time.sleep(1.2)
    sample = sw.evaluate("""chrome.storage.local.get('tabcat').then(r => { const g = r.tabcat.workspaces[0].categories[0].groups;
      const f = g[1].items.find(i => i.type === 'folder'); return [g.map(x => x.name), g[1].items.filter(i => i.type === 'link').map(l => l.name), f.name, f.items.find(i => i.type === 'folder')?.name]; })""")
    check(sample == [['Inbox', 'Start here'], ['Google', 'YouTube', 'GitHub'], 'Sample folder', 'Folder in a folder'], f'sample group to start from: sites and a folder in a folder {sample}')
    check(d.locator('#confirm[open]').count() == 1 and d.inner_text('#confirm-cancel') == 'Later', 'the first time, it offers a tour (Later / Take the tour)')
    d.click('#confirm-ok'); time.sleep(.6)
    check(d.is_visible('#tour') and d.inner_text('#tour-count') == '1 of 8', 'the tour starts at step 1 of 8')
    lit = {}
    for i in range(7):
        d.click('#tour-next'); time.sleep(.8)
        title, w, h = d.evaluate("""(() => { const s = document.querySelector('.tour-spot').getBoundingClientRect(); return [document.querySelector('#tour-title').textContent, Math.round(s.width), Math.round(s.height)]; })()""")
        lit[title] = (w, h)
    shown = {k: v for k, v in lit.items() if k != 'Always at hand'}
    check(len(lit) == 7 and all(w > 0 and h > 0 for w, h in shown.values()) and lit.get('Always at hand') == (0, 0), f'each step lights its part (the shortcut step: none) {lit}')
    card = d.evaluate("(() => { const r = document.querySelector('.tour-card').getBoundingClientRect(); return [r.left >= 0, r.top >= 0, r.right <= innerWidth, r.bottom <= innerHeight]; })()")
    check(all(card), 'the card stays on screen')
    icons = d.evaluate("document.querySelectorAll('#tour-text .tour-icon svg').length")
    check(icons == 3 and '{icon' not in d.inner_text('#tour-text'), f'controls are named with their own icons ({icons})')
    check('Space' in d.inner_text('#tour-keys'), 'the card says Space steps on')
    check(d.inner_text('#tour-next') == 'Done', 'the last step ends with Done')
    d.click('#tour-next'); time.sleep(.3)
    check(not d.is_visible('#tour'), 'Done closes it')
    d.reload(); d.wait_for_selector('.ws-item'); time.sleep(1.2)
    check(d.locator('#confirm[open]').count() == 0, 'not offered again')
    d.click('#btn-tour'); time.sleep(.4)
    check(d.is_visible('#tour'), "the sidebar's Tour starts it")
    d.keyboard.press('ArrowRight'); time.sleep(.3)
    check(d.inner_text('#tour-count') == '2 of 8', '→ steps on')
    d.click('#tour-prev'); time.sleep(.3); d.keyboard.press(' '); time.sleep(.3)  # (focus on Back: Space still goes on)
    check(d.inner_text('#tour-count') == '2 of 8', 'Space steps on, whatever button has focus')
    d.keyboard.press('Escape'); time.sleep(.3)
    check(not d.is_visible('#tour'), 'Esc ends it')
    check(not errors, f'no page errors {errors}')
    ctx.close()
done()
