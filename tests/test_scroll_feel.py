# Scrolling: past an end the wheel pulls the board a little and it springs back; a slim scrollbar shows
# over it, taking the accent colour under the pointer, and can be dragged. Touch: a finger on the empty
# board scrolls it; held still a moment first, it draws a box selection.
import json
from harness import *

PULL = "(sel)=>{window.__p=[]; const e=document.querySelector(sel); (function f(){ window.__p.push(parseFloat((e.style.translate||'0 0').split(' ')[1])||0); if(window.__p.length<100) requestAnimationFrame(f); })()}"
serve()
errors = []
with sync_playwright() as p:
    ctx, sw = launch(p, ignore_default_args=['--hide-scrollbars'])
    d = dashboard(ctx, errors, size=(1100, 560))
    seed(sw, d, workspace('S', [group(f'G{i}', [link(f'l{i}{j}') for j in range(6)], column=i % 3) for i in range(9)]))
    d.mouse.move(600, 300); time.sleep(.3)
    d.evaluate(PULL, '#board'); d.mouse.wheel(0, -100); d.mouse.wheel(0, -100); time.sleep(1.8)
    pp = d.evaluate('__p')
    check(20 < max(pp) <= 80 and pp[-1] == 0 and d.evaluate("document.querySelector('#board').style.clipPath") == '', f'the wheel past the top pulls the board (at most 80px) and it springs back ({max(pp)})')
    d.evaluate(PULL, '#board'); d.mouse.wheel(0, 300); time.sleep(.25); d.mouse.wheel(0, 400); time.sleep(1.6)
    pp = d.evaluate('__p')
    check(min(pp) < -8 and pp[-1] == 0, f'a turn of the wheel past the bottom bounces off it ({min(pp)})')
    th = d.locator('#main > .sf-thumb.y')
    check(th.evaluate("e=>e.classList.contains('show')") and d.evaluate("getComputedStyle(document.querySelector('#board')).scrollbarWidth") == 'none',
          "a slim scrollbar shows over the board in place of the browser's")
    b = th.bounding_box(); d.mouse.move(b['x'] + 6, b['y'] + b['height'] / 2); time.sleep(.4)
    accent = d.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--accent')")
    check(th.evaluate("e=>getComputedStyle(e,'::before').width") == '6px', 'under the pointer it widens')
    d.mouse.down(); d.mouse.move(b['x'] + 6, b['y'] - 300, steps=5); d.mouse.up(); time.sleep(.3)
    check(d.evaluate("document.querySelector('#board').scrollTop") == 0, 'dragging it scrolls the board')

    # touch: a quick swipe on the empty board scrolls, selects nothing; held, it selects
    cdp = ctx.new_cdp_session(d)
    cdp.send('Emulation.setTouchEmulationEnabled', {'enabled': True, 'maxTouchPoints': 1})
    d.evaluate("document.querySelector('#board').scrollTop = 0"); time.sleep(.3)
    gap = d.evaluate("(()=>{const r=document.querySelector('#board .col[data-col=\"1\"] .group').getBoundingClientRect(); return [r.right+4, r.top+60]})()")
    def touch(kind, x, y): cdp.send('Input.dispatchTouchEvent', {'type': kind, 'touchPoints': [] if kind == 'touchEnd' else [{'x': x, 'y': y}]})
    x, y = gap
    touch('touchStart', x, y)
    for i in range(1, 8): touch('touchMove', x, y - i * 15); time.sleep(.016)
    touch('touchEnd', 0, 0); time.sleep(.6)
    check(d.locator('#board .group.selected').count() == 0 and not d.evaluate("document.body.classList.contains('selecting')"), 'a quick swipe selects nothing')
    check(d.evaluate("document.querySelector('#board').scrollTop") > 20, f"it scrolls the board ({d.evaluate('document.querySelector(\"#board\").scrollTop')})")
    d.evaluate("document.querySelector('#board').scrollTop = 0"); time.sleep(.3)
    x, y = d.evaluate("(()=>{const r=document.querySelector('#board .col[data-col=\"0\"] .group').getBoundingClientRect(); return [r.left+40, r.bottom+7]})()")
    touch('touchStart', x, y); time.sleep(.7)
    for i in range(1, 10): touch('touchMove', x + i * 40, y + i * 15); time.sleep(.02)
    sel = d.locator('#board .group.selected').count()
    touch('touchEnd', 0, 0); time.sleep(.4)
    check(sel > 0, f'held still first, a finger draws a box selection ({sel})')
    check(not errors, f'no page errors {errors}')
    ctx.close()
done()
