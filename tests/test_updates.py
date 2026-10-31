# Updates: the dashboard looks up the latest GitHub release (here a stand-in) and, when it's newer than the
# extension, puts a dot on About and a line with a link in About; not when it's the same, or turned off.
from harness import *

RELEASE = {'tag_name': 'v9.9.9', 'html_url': 'https://github.com/nda111/tabcat/releases/tag/v9.9.9'}
asked = []
def github(route):
    asked.append(route.request.url)
    route.fulfill(json=RELEASE, headers={'Access-Control-Allow-Origin': '*'})
dot = lambda d: d.evaluate("!document.querySelector('#btn-info .update-dot').hidden")

serve()
errors = []
with sync_playwright() as p:
    ctx, sw = launch(p)
    ctx.route('https://api.github.com/**', github)
    d = dashboard(ctx, errors); time.sleep(1)
    check(len(asked) == 1 and dot(d), f'a newer release: a dot on About ({len(asked)} asked)')
    d.click('#btn-info'); time.sleep(.4)
    line = d.evaluate("[!document.querySelector('#info-update').hidden, document.querySelector('#info-update-text').textContent, document.querySelector('#info-update-get').href]")
    check(line[0] and 'v9.9.9' in line[1] and line[2] == RELEASE['html_url'], f'About says so, with a link to it {line}')
    d.keyboard.press('Escape'); time.sleep(.3)
    # looked up a moment ago: not again on reloading
    d.reload(); d.wait_for_selector('.ws-item'); time.sleep(1)
    check(len(asked) == 1 and dot(d), f'remembered: not asked again on reload ({len(asked)} asked)')
    # turned off in Settings: no dot
    d.click('#btn-settings'); time.sleep(.3)
    d.click('#settings-form [name=checkUpdates]'); time.sleep(.8)
    check(not dot(d), 'turned off: no dot')
    check(sw.evaluate("chrome.storage.local.get('tabcat:settings').then(r=>r['tabcat:settings'].checkUpdates)") is False, 'the setting is kept by the extension')
    d.click('#settings-form [name=checkUpdates]'); time.sleep(.8)
    check(dot(d), 'on again: the dot is back')
    d.keyboard.press('Escape'); time.sleep(.3)
    # the same version as the extension: nothing
    version = sw.evaluate("chrome.runtime.getManifest().version")
    RELEASE['tag_name'] = 'v' + version
    d.evaluate("localStorage.removeItem('tabcat:latest')")
    d.reload(); d.wait_for_selector('.ws-item'); time.sleep(1)
    check(not dot(d), f'the latest release is the one installed ({version}): no dot')
    # About's Check for updates: asks now, whatever was remembered
    n = len(asked)
    d.click('#btn-info'); time.sleep(.4)
    d.click('#info-check'); time.sleep(.8)
    state = lambda: d.evaluate("[document.querySelector('#info-check').hidden, document.querySelector('#info-status').textContent, document.querySelector('#info-update').hidden]")
    check(len(asked) == n + 1 and state()[0] and state()[1] and state()[2], f'checked by hand, up to date: says so {state()}')
    RELEASE['tag_name'] = 'v9.9.10'
    d.keyboard.press('Escape'); time.sleep(.3)
    d.click('#btn-info'); time.sleep(.4)
    check(not state()[0] and not state()[1], f'opened again: the button is back {state()}')
    d.click('#info-check'); time.sleep(.8)
    check(not state()[2] and 'v9.9.10' in d.inner_text('#info-update') and dot(d), f'checked by hand, newer: About shows it, and the dot {state()}')
    d.keyboard.press('Escape'); time.sleep(.3)
    # with the setting off, checking by hand still answers
    d.evaluate("localStorage.removeItem('tabcat:latest')")
    settings(sw, checkUpdates=False); d.reload(); d.wait_for_selector('.ws-item'); time.sleep(1)
    n = len(asked)
    check(not dot(d), 'off: not looked up on loading')
    d.click('#btn-info'); time.sleep(.4); d.click('#info-check'); time.sleep(.8)
    check(len(asked) == n + 1 and not state()[2], f'off, checked by hand: answers {state()}')
    d.keyboard.press('Escape'); time.sleep(.3)
    # GitHub unreachable: says it couldn't, and offers the button again
    ctx.unroute('https://api.github.com/**')
    ctx.route('https://api.github.com/**', lambda r: r.abort())
    d.evaluate("localStorage.removeItem('tabcat:latest')")
    settings(sw, checkUpdates=True); d.reload(); d.wait_for_selector('.ws-item'); time.sleep(1)
    d.click('#btn-info'); time.sleep(.4); d.click('#info-check'); time.sleep(.8)
    failed = state()
    time.sleep(3.2)
    check(failed[0] and failed[1] and failed[2] and not state()[0], f"unreachable: says so, then the button is back {failed} {state()}")
    check(not errors, f'no page errors {errors}')
    ctx.close()
done()
