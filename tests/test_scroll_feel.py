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
    time.sleep(.5)
    # a tap on empty space (lifted without moving) deselects, as a click does; a hold shows a ring
    # (away from the cards: a tap within a few px of a link is taken for one, as Chrome does with touch)
    d.set_viewport_size({'width': 1700, 'height': 560}); time.sleep(.6)
    x, y = d.evaluate("(()=>{const r=document.querySelector('#board .col[data-col=\"3\"]').getBoundingClientRect(); return [r.left+r.width/2, 420]})()")
    touch('touchStart', x, y); time.sleep(.08); touch('touchEnd', 0, 0); time.sleep(.4)
    check(d.locator('#board .group.selected').count() == 0, 'a tap on empty space deselects')
    d.evaluate("window.__ring = false; new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => { if (n.classList?.contains('touch-ring')) __ring = true; }))).observe(document.body, { childList: true })")
    touch('touchStart', x, y); time.sleep(.6); touch('touchEnd', 0, 0); time.sleep(.4)
    check(d.evaluate('__ring'), 'held, a ring under the finger shows it will draw a box')
    # touch at the bottom: pull up past the end, lift, and before the bounce is over swipe back down: it
    # scrolls up at once; and drawn back within the same touch, it follows the finger and then scrolls
    TOP = "document.querySelector('#board').scrollTop"
    def to_bottom(): d.evaluate("(()=>{const b=document.querySelector('#board'); b.scrollTop=b.scrollHeight-b.clientHeight;})()"); time.sleep(.6)
    x, y = d.evaluate("(()=>{const r=document.querySelector('#board .col[data-col=\"3\"]').getBoundingClientRect(); return [r.left+r.width/2, 300]})()")
    to_bottom(); top0 = d.evaluate(TOP)
    touch('touchStart', x, y)
    for i in range(1, 6): touch('touchMove', x, y - i * 20); time.sleep(.016)
    touch('touchEnd', 0, 0); time.sleep(.05)
    touch('touchStart', x, y)
    for i in range(1, 5): touch('touchMove', x, y + i * 20); time.sleep(.016)
    moved = top0 - d.evaluate(TOP)
    touch('touchEnd', 0, 0); time.sleep(.6)
    check(moved >= 50, f'touch: swiping back during the bounce scrolls up at once, with the finger (80px of swipe: {moved}px)')
    time.sleep(.5); to_bottom(); top0 = d.evaluate(TOP)
    touch('touchStart', x, y)
    for i in range(1, 6): touch('touchMove', x, y - i * 20); time.sleep(.016)
    for i in range(1, 16): touch('touchMove', x, y - 100 + i * 20); time.sleep(.016)
    pulled = d.evaluate("document.querySelector('#board').style.translate")
    touch('touchEnd', 0, 0); time.sleep(.6)
    check(d.evaluate(TOP) < top0 - 60 and not pulled, f'touch: drawn back in the same touch, it comes to rest and scrolls up ({top0} -> {d.evaluate(TOP)}, {pulled!r})')

    # sideways: the board wider than its box (narrow window). No sideways bar; the wheel turned sideways past the
    # left end pulls it and it springs back; a finger moves it diagonally, both ways at once
    d.set_viewport_size({'width': 700, 'height': 560}); time.sleep(.6)
    d.evaluate("(()=>{const b=document.querySelector('#board'); b.scrollTop=200; b.scrollLeft=0;})()"); time.sleep(.3)
    room = d.evaluate("(()=>{const b=document.querySelector('#board'); return b.scrollWidth-b.clientWidth;})()")
    bar = d.evaluate("[...document.querySelectorAll('.sf-thumb.x')].some(t => !t.hidden && t.parentElement.contains(document.querySelector('#board')))")
    check(room > 50 and not bar, f'the board wider than its box: scrolls sideways, no sideways bar ({room}px, bar: {bar})')
    PULLX = "(sel)=>{window.__px=[]; const e=document.querySelector(sel); (function f(){ window.__px.push(parseFloat((e.style.translate||'0 0').split(' ')[0])||0); if(window.__px.length<100) requestAnimationFrame(f); })()}"
    bx, by = d.evaluate("(()=>{const r=document.querySelector('#board').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2];})()")
    d.mouse.move(bx, by); d.evaluate(PULLX, '#board')
    for _ in range(6): cdp0.send('Input.dispatchMouseEvent', {'type': 'mouseWheel', 'x': bx, 'y': by, 'deltaX': -20, 'deltaY': 0}); time.sleep(.016)
    time.sleep(1.6)
    px = d.evaluate('__px')
    check(max(px) > 8 and px[-1] == 0, f'the wheel sideways past the left end pulls the board and it springs back ({max(px)})')
    d.evaluate("(()=>{const b=document.querySelector('#board'); b.scrollTop=150; b.scrollLeft=0;})()"); time.sleep(.3)
    x, y = bx + 60, by + 60
    touch('touchStart', x, y)
    for i in range(1, 9): touch('touchMove', x - i * 12, y - i * 9); time.sleep(.016)
    touch('touchEnd', 0, 0); time.sleep(.2)
    left, top = d.evaluate("(()=>{const b=document.querySelector('#board'); return [b.scrollLeft, b.scrollTop];})()")
    check(left > 40 and top > 150 + 30, f'a finger drawn diagonally: the board goes both ways at once ({left}, {top - 150})')
    time.sleep(1); l2 = d.evaluate("document.querySelector('#board').scrollLeft")
    check(l2 > left, f'and flung, it glides on ({left} -> {l2})')

    check(not errors, f'no page errors {errors}')
    ctx.close()
done()
