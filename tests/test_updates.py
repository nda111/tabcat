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
    check(not errors, f'no page errors {errors}')
    ctx.close()
done()
