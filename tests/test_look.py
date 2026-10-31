# The logo in the accent colour (page, tab icon, symbol), and a folder's guide line three quarters of the way
# across its chevron, with its items just past it.
from harness import *

ws = workspace('Look', [group('Nest', [link('a'), folder('f1', [link('b'), folder('f2', [link('c'), folder('f3', [link('d')], symbol=':tabcat:')], symbol='A')])])])
FAV = """new Promise(res=>{ const i=new Image(); i.onload=()=>{ const c=document.createElement('canvas'); c.width=c.height=64; const g=c.getContext('2d'); g.drawImage(i,0,0); res([...g.getImageData(20,40,1,1).data]) }; i.src=document.querySelector('#favicon').href; })"""
hue = lambda r, g, b: __import__('colorsys').rgb_to_hsv(r / 255, g / 255, b / 255)

serve()
errors = []
with sync_playwright() as p:
    ctx, sw = launch(p)
    d = dashboard(ctx, errors)
    for accent, lo, hi in (('purple', .70, .82), ('green', .33, .45)):
        settings(sw, accent=accent); time.sleep(.3)
        h, s, _ = hue(*d.evaluate(FAV)[:3])
        check(lo < h < hi and s > .2, f'{accent}: the tab icon takes its hue (h {h:.2f})')
    settings(sw, accent='mono'); time.sleep(.3)
    _, s, _ = hue(*d.evaluate(FAV)[:3])
    check(s < .05, f'mono: a grey tab icon (s {s:.2f})')
    check(d.evaluate("getComputedStyle(document.querySelector('#sidebar .logo')).backgroundBlendMode").startswith('luminosity'), 'page logo: tinted by blending')
    # the favicon fades to a new accent over several frames
    d.evaluate("""window.__fav=[]; new MutationObserver(()=>window.__fav.push(performance.now())).observe(document.querySelector('#favicon'),{attributes:true})""")
    d.click('#btn-settings'); time.sleep(.5); d.click('#swatches .swatch[data-accent="blue"]'); time.sleep(.8)
    n = d.evaluate('window.__fav.length')
    check(n >= 5, f'tab icon fades to a new accent ({n} frames)')
    d.keyboard.press('Escape'); time.sleep(.4)

    seed(sw, d, ws)
    d.locator('#board .group .group-head .name').first.dblclick(); time.sleep(.6)
    check(d.locator('dialog[open] .emoji-grid button').first.get_attribute('data-emoji') == ':tabcat:', 'symbol picker: the logo first')
    d.locator('dialog[open] .emoji-grid button').first.click(); time.sleep(.4)
    d.locator('dialog[open] .btn.primary').click(); time.sleep(1)
    check(d.locator('#board .group .node-sym .sym-logo').count() == 1, 'the group shows the logo symbol')
    stored = sw.evaluate("chrome.storage.local.get('tabcat').then(r=>r.tabcat.workspaces.find(w=>w.id==='Look').categories[0].groups[0].symbol)")
    check(stored == ':tabcat:', f'the extension stores it ({stored!r})')

    SYM = "chrome.storage.local.get('tabcat').then(r=>r.tabcat.workspaces.find(w=>w.id==='Look').categories[0].groups[0].symbol)"
    # Enter after picking a symbol saves the editor
    d.locator('#board .group .group-head .name').first.dblclick(); time.sleep(.6)
    pick = d.locator('dialog[open] .emoji-grid button').nth(1)
    em = pick.get_attribute('data-emoji'); pick.click(); time.sleep(.3); d.keyboard.press('Enter'); time.sleep(1)
    check(not d.locator('dialog[open]').count() and sw.evaluate(SYM) == em, f'click a symbol, Enter: saved ({em})')
    # in the search box: Enter picks the first match, a second Enter saves
    d.locator('#board .group .group-head .name').first.dblclick(); time.sleep(.6)
    d.locator('dialog[open] .emoji-search').fill('k'); time.sleep(.5); d.keyboard.press('Enter'); time.sleep(.3)
    check(d.locator('dialog[open]').count() == 1 and d.eval_on_selector('dialog[open] input.sym-box', 'e => e.value') == 'K', 'search, Enter: picks the first match')
    d.keyboard.press('Enter'); time.sleep(1)
    check(not d.locator('dialog[open]').count() and sw.evaluate(SYM) == 'K', 'Enter again: saved')

    geo = d.evaluate("""() => [...document.querySelectorAll('#board .folder')].map(f => { const tw=f.querySelector(':scope>.folder-head>.twisty').getBoundingClientRect();
        const line=f.querySelector(':scope>.items').getBoundingClientRect(); return [f.dataset.id, tw.left + tw.width * .75, line.left + .5]; })""")
    check(len(geo) == 3 and all(abs(at - line) <= 1 for _, at, line in geo), f"a folder's guide line is 3/4 across its chevron {geo}")
    sib = d.evaluate("""() => { const f = document.querySelector('#board .folder'); const l = [...f.parentElement.children].find((x) => x.matches('.link'));
        const icon = (el) => el.querySelector(':scope>:is(.link-row,.folder-head)>:is(img,.sym)').getBoundingClientRect().left; return l ? [icon(f), icon(l)] : null; }""")
    check(sib is None or abs(sib[0] - sib[1]) <= .5, f"a folder's symbol lines up with the links beside it {sib}")
    check(not errors, f'no page errors {errors}')
    ctx.close()
done()
