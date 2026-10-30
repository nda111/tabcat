# Installed fresh: sample links to start from; the dashboard comes up and offers a tour once; the tour
# lights each part in turn and ends saying where to find it again; afterwards it starts from Help.
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
    check(d.is_visible('#tour') and d.inner_text('#tour-count') == '1 of 10', 'the tour starts at step 1 of 10')
    STEP = """(() => { const s = document.querySelector('.tour-spot').getBoundingClientRect(), c = document.querySelector('.tour-card').getBoundingClientRect();
      return { title: document.querySelector('#tour-title').textContent, text: document.querySelector('#tour-text').textContent,
        icons: document.querySelectorAll('#tour-text .tour-icon svg').length, key: document.querySelector('#tour-text .tour-key')?.textContent,
        spot: [Math.round(s.width), Math.round(s.height), Math.round(s.top)], card: c.left >= 0 && c.top >= 0 && c.right <= innerWidth && c.bottom <= innerHeight }; })()"""
    steps = [d.evaluate(STEP)]
    for i in range(9):
        d.click('#tour-next'); time.sleep(.8)
        steps.append(d.evaluate(STEP))
    order = [x['title'] for x in steps]
    check(order == ['Welcome to tabcat.', 'Workspaces', 'Open tabs', 'Categories', 'Groups', 'Search', 'Settings and help', 'Tour', 'Always at hand', "Let's get along."], f'the steps, in order {order}')
    lit = {x['title']: x['spot'][:2] for x in steps}
    unlit = {'Welcome to tabcat.', 'Always at hand', "Let's get along."}
    check(all((v == [0, 0]) == (k in unlit) for k, v in lit.items()), f'each step lights its part (the welcome, shortcut and last: none) {lit}')
    check(all(x['card'] for x in steps), 'the card stays on screen')
    by = {x['title']: x for x in steps}
    check(by['Open tabs']['icons'] == 3 and by['Settings and help']['icons'] == 2 and not any('{icon' in x['text'] for x in steps), 'controls are named with their own icons')
    check(all(x['key'] == 'Space' for x in steps), 'each text ends with the key that steps on')
    check('start this tour again from' in by['Tour']['text'] and by['Tour']['icons'] == 1, 'it says it starts again from Help (with its icon)')
    line = d.evaluate("Math.round(document.querySelector('#sidebar .side-bottom').getBoundingClientRect().top)")
    check(by['Settings and help']['spot'][2] > line, "Settings and help: the buttons lit, not the line above them")
    card = d.evaluate("Math.round(document.querySelector('#board .group').getBoundingClientRect().width) + 12")
    check(by['Groups']['spot'][0] == card, f"Groups: the first card lit, not the whole board ({by['Groups']['spot'][0]} = {card})")
    check(d.inner_text('#tour-next') == 'Done', 'the last step ends with Done')
    d.click('#tour-next'); time.sleep(.3)
    check(not d.is_visible('#tour'), 'Done closes it')
    d.reload(); d.wait_for_selector('.ws-item'); time.sleep(1.2)
    check(d.locator('#confirm[open]').count() == 0, 'not offered again')
    d.click('#btn-help'); time.sleep(.4); d.click('#help-tour'); time.sleep(.4)
    check(d.is_visible('#tour') and d.locator('#help[open]').count() == 0, "Help's Take the tour starts it (Help makes way)")
    d.keyboard.press('ArrowRight'); time.sleep(.3)
    check(d.inner_text('#tour-count') == '2 of 10', '→ steps on')
    d.click('#tour-prev'); time.sleep(.3); d.keyboard.press(' '); time.sleep(.3)  # (focus on Back: Space still goes on)
    check(d.inner_text('#tour-count') == '2 of 10', 'Space steps on, whatever button has focus')
    # with the pointer resting on the card, a redraw of the page (here: a tab opening) leaves it gliding
    box = d.locator('.tour-card').bounding_box(); d.mouse.move(box['x'] + 20, box['y'] + 20)
    sw.evaluate("chrome.tabs.create({url: 'about:blank#redraw', active: false})"); time.sleep(1)
    d.keyboard.press(' ')
    mid = d.evaluate("new Promise(r => setTimeout(() => r(Math.round(document.querySelector('.tour-spot').getBoundingClientRect().width)), 90))")
    time.sleep(.6); end = d.evaluate("Math.round(document.querySelector('.tour-spot').getBoundingClientRect().width)")
    check(mid != end, f'after a redraw under the pointer, the spot still glides ({mid} on the way to {end})')
    d.keyboard.press('Escape'); time.sleep(.3)
    check(not d.is_visible('#tour'), 'Esc ends it')
    check(not errors, f'no page errors {errors}')
    ctx.close()
done()
