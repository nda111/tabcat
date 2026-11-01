# Settings' language field: a new choice slides in where the old one was, from below when it's further
# down the list (the old one going up), from above when it's further up; then the field shows it itself.
from harness import *

REC = "window.__s=[]; (function f(){ const b=document.querySelector('.select-slide'); if (b) __s.push([...b.children].map(c=>[Math.round(new DOMMatrix(getComputedStyle(c).transform).m42), c.textContent])); if(__s.length<12) requestAnimationFrame(f); })()"
serve()
errors = []
with sync_playwright() as p:
    ctx, sw = launch(p)
    d = dashboard(ctx, errors)
    d.click('#btn-settings'); time.sleep(.6)
    for v, sign, name in [('ko', 1, '한국어'), ('en', -1, 'English')]:
        d.evaluate(REC); d.select_option('#language', v); time.sleep(.5)
        first = d.evaluate('__s')[0]
        (oy, ot), (ny, nt) = first
        check(ny * sign > 10 and oy == 0 and nt == name, f'{v}: the new one comes from {"below" if sign > 0 else "above"} ({first})')
        time.sleep(.8)
        check(d.locator('.select-slide').count() == 0 and d.evaluate("!document.querySelector('#language').classList.contains('sliding')"), f'{v}: then the field shows it itself')
    check(not errors, f'no page errors {errors}')
    ctx.close()
done()
