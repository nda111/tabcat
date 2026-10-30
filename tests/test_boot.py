# What the page shows while it starts: nothing for a moment, then a spinner, then the board or a notice.
from harness import *

# per frame: what a viewer sees
REC = """window.__s=[]; const t0=performance.now(); const f=()=>{ if(!document.body){requestAnimationFrame(f);return;}
  const b=document.documentElement.classList.contains('booting'), bo=document.querySelector('#boot'), op=bo ? +getComputedStyle(bo).opacity : 0;
  const nb=document.querySelector('#no-browser'), ne=document.querySelector('#no-ext');
  const v = b ? (op>0.01 ? 'spinner' : 'blank') : (nb && !nb.hidden) ? 'no-browser' : (ne && !ne.hidden) ? 'no-ext' : 'board';
  const last=window.__s[window.__s.length-1]; if(!last || last[1]!==v) window.__s.push([Math.round(performance.now()-t0), v]);
  if(performance.now()-t0<2500) requestAnimationFrame(f); }; requestAnimationFrame(f);"""
seen = lambda pg: [v for _, v in pg.evaluate('window.__s')]
FIREFOX = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0",
           "Object.defineProperty(Navigator.prototype,'userAgentData',{get:()=>undefined}); delete window.chrome;")
SAMSUNG = ("Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36",
           "Object.defineProperty(Navigator.prototype,'userAgentData',{get:()=>({brands:[{brand:'Samsung Internet',version:'25'},{brand:'Chromium',version:'121'}],mobile:true,platform:'Android'})});")

serve()
with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    c = b.new_context(locale='ko-KR')
    c.grant_permissions(['clipboard-read', 'clipboard-write'], origin=URL.rstrip('/'))
    pg = c.new_page(); pg.add_init_script(REC); pg.goto(URL); time.sleep(2.6)
    s = seen(pg)
    check(s[:1] == ['blank'] and s[-1] == 'no-ext' and 'board' not in s, f'no extension: blank, then the notice, never the board {s}')
    check('spinner' in s, 'no extension: the spinner shows while waiting')
    check(pg.inner_text('#no-ext h2') == 'tabcat 확장 프로그램을 찾을 수 없습니다.', 'the notice is in the page language')
    pg.click('#no-ext a[data-copy]'); time.sleep(.4)
    check(pg.evaluate('navigator.clipboard.readText()') == 'chrome://extensions', 'chrome:// link copies its address')
    for label, (ua, init) in (('firefox', FIREFOX), ('samsung phone', SAMSUNG)):
        pg = b.new_page(locale='ko-KR', user_agent=ua); pg.add_init_script(init + REC); pg.goto(URL); time.sleep(1.2)
        s = seen(pg)
        check(s[-1] == 'no-browser' and 'board' not in s and 'no-ext' not in s, f'{label}: the browser notice at once {s}')
    b.close()

    ctx, sw = launch(p, locale='ko-KR')
    pg = ctx.new_page(); pg.add_init_script(REC); pg.goto(URL); time.sleep(2.6)
    s = seen(pg)
    check(s[-1] == 'board' and 'no-ext' not in s, f'with the extension: the board, no notice {s}')
    ctx.close()
done()
