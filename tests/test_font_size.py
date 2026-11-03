# Text size (Settings > Appearance): five steps on a slider. Dragged, the line below takes each step's size as it's
# passed; let go, the thumb springs to its step and the page's text takes the size (kept, for the account too);
# the arrow keys step it. Symbols keep their size.
import os
from harness import *

serve()
errors = []
with sync_playwright() as p:
    ctx, sw = launch(p)
    d = dashboard(ctx, errors, size=(1300, 1000))
    seed(sw, d, workspace('W', [group('G', [link('a')], symbol='🐱')]))
    body = lambda: float(d.evaluate("getComputedStyle(document.body).fontSize")[:-2])
    sym = lambda: d.evaluate("getComputedStyle(document.querySelector('#board .node-sym .sym, #board .node-sym')).fontSize")
    base, sym0 = body(), sym()
    d.click('#btn-settings'); d.wait_for_selector('#settings[open]'); settle(d)
    check(d.get_attribute('#fs-slider', 'aria-valuenow') == '2' and abs(base - 13) < .01, f'to begin with: the middle step, the page as designed ({base}px)')
    track = d.locator('#fs-slider .fs-track').bounding_box()
    sample = lambda: float(d.evaluate("getComputedStyle(document.querySelector('#fs-sample')).fontSize")[:-2])
    y = track['y'] + track['height'] / 2
    d.mouse.move(track['x'] + track['width'] / 2, y); d.mouse.down()
    d.mouse.move(track['x'] + track['width'] * .97, y, steps=8); settle(d)
    check(d.get_attribute('#fs-slider', 'aria-valuenow') == '4' and sample() > 15 and abs(body() - base) < .01, f'dragged to the end: the line below at the largest, the page not yet ({sample()}px, page {body()}px)')
    d.evaluate("window.__vt = false; window.__dlgFaded = false; (function f() { const p = document.getAnimations().map(a => a.effect?.pseudoElement || ''); if (p.some(x => /fs-live/.test(x))) window.__dlgFaded = true; if (p.some(x => /view-transition/.test(x))) window.__vt = true; else requestAnimationFrame(f); })()")
    d.mouse.up()
    check(until(lambda: d.evaluate('window.__vt'), timeout=2), 'let go: the page fades over to the new size')
    slides = d.evaluate("document.getAnimations().some(a => a.transitionProperty === 'left' && a.effect?.target?.classList?.contains('fs-thumb'))")
    check(slides and not d.evaluate('window.__dlgFaded'), 'the dialog not faded: live, its thumb sliding on to its step')
    settle(d)
    check(until(lambda: abs(body() - 13 * 1.2) < .05), f'and gets there ({body()}px)')
    check(until(lambda: sw.evaluate("chrome.storage.local.get('tabcat:settings').then(r => r['tabcat:settings'].fontScale)") == 4), 'and keeps it')
    check(sym() == sym0, f'a symbol keeps its size ({sym0} -> {sym()})')
    at = d.evaluate("getComputedStyle(document.querySelector('#fs-slider')).getPropertyValue('--at').trim()")
    check(at == '1', f'the thumb sprung to its step ({at})')
    # between two steps, dragged: drawn a little toward the nearer one
    track = d.locator('#fs-slider .fs-track').bounding_box(); y = track['y'] + track['height'] / 2  # (moved, the text bigger)
    d.mouse.move(track['x'] + track['width'] * .9, y); d.mouse.down()
    d.mouse.move(track['x'] + track['width'] * .6, y, steps=6)
    at = float(d.evaluate("getComputedStyle(document.querySelector('#fs-slider')).getPropertyValue('--at')"))
    check(.5 < at < .59, f'dragged between two steps: drawn toward the nearer one (at .6, shown at {at:.3f})')
    d.mouse.up(); settle(d)
    # pressed on the track (between steps): the thumb glides to the pointer, drawn toward the nearer step; let go,
    # it glides on to that step
    thumbx = lambda: d.evaluate("(t => t.getBoundingClientRect().left + t.offsetWidth / 2)(document.querySelector('.fs-thumb'))")
    track = d.locator('#fs-slider .fs-track').bounding_box(); y = track['y'] + track['height'] / 2  # (moved again)
    d.mouse.move(track['x'] + track['width'] * .3, y); d.mouse.down(); time.sleep(.08)
    on_way = thumbx(); settle(d); pressed = thumbx()
    goal = track['x'] + track['width'] * .25
    check(on_way > pressed + 5 and goal < pressed < track['x'] + track['width'] * .3, f'pressed: the thumb glides to the pointer, drawn toward the step ({on_way:.0f} -> {pressed:.0f}, step at {goal:.0f})')
    d.mouse.up(); time.sleep(.05)
    check(thumbx() > goal + 1, f'let go: it glides on to the step ({thumbx():.0f} on the way to {goal:.0f})')
    settle(d)
    check(abs(thumbx() - goal) < 1.5, f'and gets there ({thumbx():.0f})')
    d.focus('#fs-slider'); d.keyboard.press('Home')
    check(until(lambda: abs(body() - 13 * .85) < .05) and d.get_attribute('#fs-slider', 'aria-valuenow') == '0', f'Home: the smallest ({body()}px)')
    d.keyboard.press('ArrowRight'); d.keyboard.press('ArrowRight')
    check(until(lambda: abs(body() - 13) < .05), f'two steps right: as designed again ({body()}px)')
    # the dialogs' text too
    d.keyboard.press('End'); settle(d); d.keyboard.press('Escape'); settle(d)
    d.click('#btn-info'); d.wait_for_selector('#info[open]'); settle(d)
    dt = d.evaluate("parseFloat(getComputedStyle(document.querySelector('#info dt')).fontSize)")
    d.keyboard.press('Escape'); settle(d)
    d.click('#btn-settings'); d.wait_for_selector('#settings[open]'); settle(d)
    d.focus('#fs-slider'); d.keyboard.press('Home'); settle(d); d.keyboard.press('Escape'); settle(d)
    d.click('#btn-info'); d.wait_for_selector('#info[open]'); settle(d)
    dt2 = d.evaluate("parseFloat(getComputedStyle(document.querySelector('#info dt')).fontSize)")
    check(dt > dt2 * 1.3, f"the dialogs' text takes it too (About, largest {dt}px, smallest {dt2}px)")
    d.keyboard.press('Escape'); settle(d)
    d.click('#btn-settings'); d.wait_for_selector('#settings[open]'); settle(d); d.focus('#fs-slider')
    if os.environ.get('SHOT'):
        d.keyboard.press('ArrowRight'); settle(d); time.sleep(.5)
        d.locator('#settings fieldset').nth(1).screenshot(path=os.environ['SHOT'])
    check(not errors, f'no page errors {errors}')
    ctx.close()
done()
