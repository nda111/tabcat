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
    check(20 < max(pp) <= 110 and pp[-1] == 0 and d.evaluate("document.querySelector('#board').style.clipPath") == '', f'the wheel past the top pulls the board (at most 110px) and it springs back ({max(pp)})')
    d.evaluate(PULL, '#board'); d.mouse.wheel(0, 300); time.sleep(.25); d.mouse.wheel(0, 400); time.sleep(1.6)
    pp = d.evaluate('__p')
    check(min(pp) < -8 and pp[-1] == 0, f'a turn of the wheel past the bottom bounces off it ({min(pp)})')
    # a trackpad swipe whose momentum runs into the end: it bounces there at once and is back at rest while
    # the momentum is still coming (not held pulled until it stops)
    cdp0 = ctx.new_cdp_session(d)
    d.evaluate("(()=>{const b=document.querySelector('#board'); b.scrollTop=b.scrollHeight-b.clientHeight-300;})()"); time.sleep(.3)
    d.evaluate(PULL, '#board')
    deltas = [35] * 6 + [35 * 0.95 ** i for i in range(45)]
    for x in deltas: cdp0.send('Input.dispatchMouseEvent', {'type': 'mouseWheel', 'x': 600, 'y': 300, 'deltaX': 0, 'deltaY': x})
    pp = d.evaluate('__p')
    check(min(pp) < -5 and abs(pp[-1]) <= 1, f'trackpad momentum into the end bounces and settles while it still comes ({min(pp)}, {pp[-1]})')
    time.sleep(.5)
    # momentum that starts a moment after the finger lifts, stronger: still one bounce, not two
    def bounces(pp):
        n, out = 0, False
        for x in pp:
            if x < -3 and not out: n, out = n + 1, True
            elif x >= -1: out = False
        return n
    wheel = lambda dy: cdp0.send('Input.dispatchMouseEvent', {'type': 'mouseWheel', 'x': 600, 'y': 300, 'deltaX': 0, 'deltaY': dy})
    d.evaluate("(()=>{const b=document.querySelector('#board'); b.scrollTop=b.scrollHeight-b.clientHeight-200;})()"); time.sleep(.5)
    d.evaluate(PULL, '#board')
    for x in [30] * 12: wheel(x)
    time.sleep(.2)
    for x in [50 * 0.94 ** i for i in range(50)]: wheel(x)
    time.sleep(1)
    pp = d.evaluate('__p')
    check(bounces(pp) == 1 and pp[-1] == 0, f'momentum after a pause bounces once, not twice ({bounces(pp)})')
    # after a quiet moment, pushing at the end pulls again
    time.sleep(.5)
    for x in [4] * 15: wheel(x)
    check(d.evaluate("parseFloat((document.querySelector('#board').style.translate||'0 0').split(' ')[1])||0") < -5, 'after a quiet moment, pushing at the end pulls again')
    time.sleep(1)
    # bouncing at the bottom, the thumb stays down there (springing back overshoots; it doesn't leap up)
    THUMB = "window.__t=[]; const t=document.querySelector('#main > .sf-thumb.y'); (function f(){ __t.push(t.getBoundingClientRect().top); if(__t.length<80) requestAnimationFrame(f); })()"
    d.evaluate("(()=>{const b=document.querySelector('#board'); b.scrollTop=b.scrollHeight-b.clientHeight;})()"); time.sleep(.5)
    d.evaluate(THUMB); d.mouse.wheel(0, 100); time.sleep(1.5)
    tt = d.evaluate('__t')
    check(min(tt) > max(tt) - 60, f'bouncing at the bottom, the thumb stays at the bottom ({min(tt)}..{max(tt)})')
    d.evaluate("document.querySelector('#board').scrollTop = 0"); time.sleep(.5)
    d.evaluate(THUMB); d.mouse.wheel(0, -100); time.sleep(1.5)
    tt = d.evaluate('__t')
    check(max(tt) < min(tt) + 60, f'and at the top, at the top ({min(tt)}..{max(tt)})')
    time.sleep(.5)
    # at the bottom, scrolling down (a bounce) then straight back up goes up at once, mouse or trackpad
    for name, down, up in [('mouse', [100], [-100, -100]), ('trackpad', [30] * 8, [-20] * 10)]:
        d.evaluate("(()=>{const b=document.querySelector('#board'); b.scrollTop=b.scrollHeight-b.clientHeight;})()"); time.sleep(.6)
        top0 = d.evaluate("document.querySelector('#board').scrollTop")
        for x in down: wheel(x)
        time.sleep(.05)
        for x in up: wheel(x)
        time.sleep(.4)
        top1 = d.evaluate("document.querySelector('#board').scrollTop")
        check(top1 < top0 - 100, f'{name}: down at the bottom, then up, scrolls up straight away ({top0} -> {top1})')
        time.sleep(.8)
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
