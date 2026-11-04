# Updates: the dashboard looks up the latest GitHub release (here a stand-in) and, when it's newer than the
# extension, puts a dot on About and a line with a link in About; not when it's the same, or turned off.
from harness import *

RELEASE = {'tag_name': 'v9.9.9', 'html_url': 'https://github.com/nda111/tabcat/releases/tag/v9.9.9'}
asked = []
# (the server's releases come from the same repository: never taken for the extension's, however new)
OTHERS = [{'tag_name': 'server-v99.0.0', 'html_url': 'https://github.com/nda111/tabcat/releases/tag/server-v99.0.0'},
          {'tag_name': 'extension-v99.0.0', 'draft': True, 'html_url': 'x'}, {'tag_name': 'v1.0.0', 'html_url': 'old'}]
def github(route):
    asked.append(route.request.url)
    route.fulfill(json=OTHERS[:1] + [RELEASE] + OTHERS[1:], headers={'Access-Control-Allow-Origin': '*'})
dot = lambda d: d.evaluate("!document.querySelector('#btn-info .update-dot').hidden")

serve()
errors = []
with sync_playwright() as p:
    ctx, sw = launch(p)
    ctx.route('https://api.github.com/**', github)
    d = dashboard(ctx, errors); until(lambda: len(asked) == 1 and dot(d))
    check(len(asked) == 1 and dot(d), f'a newer release: a dot on About ({len(asked)} asked)')
    d.click('#btn-info'); settle(d)
    line = d.evaluate("[!document.querySelector('#info-update').hidden, document.querySelector('#info-update-text').textContent, document.querySelector('#info-update-get').href]")
    check(line[0] and 'v9.9.9' in line[1] and line[2] == RELEASE['html_url'], f'About says so, with a link to it {line}')
    d.keyboard.press('Escape'); settle(d)
    # looked up a moment ago: not again on reloading
    d.reload(); d.wait_for_selector('.ws-item'); time.sleep(1)
    check(len(asked) == 1 and dot(d), f'remembered: not asked again on reload ({len(asked)} asked)')
    # turned off in Settings: no dot
    d.click('#btn-settings'); settle(d)
    d.click('#settings-form [name=checkUpdates]'); until(lambda: not dot(d) and sw.evaluate("chrome.storage.local.get('tabcat:settings').then(r=>r['tabcat:settings'].checkUpdates)") is False)
    check(not dot(d), 'turned off: no dot')
    check(sw.evaluate("chrome.storage.local.get('tabcat:settings').then(r=>r['tabcat:settings'].checkUpdates)") is False, 'the setting is kept by the extension')
    d.click('#settings-form [name=checkUpdates]'); until(lambda: dot(d))
    check(dot(d), 'on again: the dot is back')
    d.keyboard.press('Escape'); settle(d)
    # the same version as the extension: nothing
    version = sw.evaluate("chrome.runtime.getManifest().version")
    RELEASE['tag_name'] = 'v' + version
    d.evaluate("localStorage.removeItem('tabcat:latest')")
    d.reload(); d.wait_for_selector('.ws-item'); time.sleep(1)
    check(not dot(d), f'the latest release is the one installed ({version}): no dot')
    # About's Check for updates: a spinner while it asks (now, whatever was remembered), then the answer
    # in the button's place; About keeps its height
    aged = lambda: d.evaluate("localStorage.setItem('tabcat:latest', JSON.stringify({...JSON.parse(localStorage.getItem('tabcat:latest')), checkedAt: Date.now() - 2*60*1000}))")
    aged(); d.reload(); d.wait_for_selector('.ws-item'); time.sleep(1)
    n = len(asked)
    state = lambda: d.evaluate("[document.querySelector('#info-check').hidden, document.querySelector('#info-status').textContent, document.querySelector('#info-update').hidden]")
    height = lambda: d.evaluate("document.querySelector('#info').getBoundingClientRect().height")
    d.click('#btn-info'); settle(d)
    h0 = height()
    d.click('#info-check'); until(lambda: d.evaluate("!document.querySelector('#info-checking').hidden"))
    check(d.evaluate("!document.querySelector('#info-checking').hidden"), 'checking: a spinner beside the button')
    until(lambda: len(asked) == n + 1 and state()[0] and state()[1] and state()[2]); settle(d)
    check(len(asked) == n + 1 and state()[0] and state()[1] and state()[2], f'checked by hand, up to date: says so {state()}')
    check(abs(height() - h0) < .5, f'About keeps its height {h0} {height()}')
    d.keyboard.press('Escape'); settle(d)
    d.click('#btn-info'); until(lambda: not state()[0] and not state()[1])
    check(not state()[0] and not state()[1], f'opened again: the button is back {state()}')
    d.click('#info-check'); time.sleep(.8)
    check(len(asked) == n + 1 and state()[1], f'again within a minute: the answer it just had, not asked again {state()}')
    d.keyboard.press('Escape'); settle(d)
    RELEASE['tag_name'] = 'extension-v9.9.10'  # (tagged as from 1.1.0 on)
    aged(); d.reload(); d.wait_for_selector('.ws-item'); time.sleep(1)
    d.evaluate("localStorage.setItem('tabcat:latest', JSON.stringify({version: '%s', url: 'x', checkedAt: Date.now() - 2*60*1000}))" % version)
    d.reload(); d.wait_for_selector('.ws-item'); time.sleep(1)
    d.click('#btn-info'); settle(d)
    h0 = height()
    d.click('#info-check'); until(lambda: not state()[2] and 'v9.9.10' in d.inner_text('#info-update') and dot(d)); settle(d)
    check(not state()[2] and 'v9.9.10' in d.inner_text('#info-update') and dot(d), f'checked by hand, newer: About shows it, and the dot {state()}')
    check(abs(height() - h0) < .5, f'still the same height {h0} {height()}')
    d.keyboard.press('Escape'); settle(d)
    # with the setting off, checking by hand still answers
    d.evaluate("localStorage.removeItem('tabcat:latest')")
    settings(sw, checkUpdates=False); d.reload(); d.wait_for_selector('.ws-item'); time.sleep(1)
    n = len(asked)
    check(not dot(d), 'off: not looked up on loading')
    d.click('#btn-info'); settle(d); d.click('#info-check'); until(lambda: len(asked) == n + 1 and not state()[2])
    check(len(asked) == n + 1 and not state()[2], f'off, checked by hand: answers {state()}')
    d.keyboard.press('Escape'); settle(d)
    # GitHub unreachable: says it couldn't, and offers the button again
    ctx.unroute('https://api.github.com/**')
    ctx.route('https://api.github.com/**', lambda r: r.abort())
    d.evaluate("localStorage.removeItem('tabcat:latest')")
    settings(sw, checkUpdates=True); d.reload(); d.wait_for_selector('.ws-item'); time.sleep(1)
    d.click('#btn-info'); settle(d); d.click('#info-check'); until(lambda: state()[0] and state()[1] and state()[2])
    failed = state()
    time.sleep(3.2)
    check(failed[0] and failed[1] and failed[2] and not state()[0], f"unreachable: says so, then the button is back {failed} {state()}")
    ctx.close()
    # installed from the Chrome Web Store (the manifest has the store's update_url): the browser keeps it
    # up to date, so the dashboard doesn't look, and offers neither the setting nor the button
    asked.clear(); RELEASE['tag_name'] = 'v9.9.9'
    ctx, sw = launch(p, manifest={'update_url': 'http://127.0.0.1:9/updates.xml'})
    ctx.route('https://api.github.com/**', github)
    d = dashboard(ctx, errors); time.sleep(1)
    check(not asked and not dot(d), f'from the store: not looked up, no dot ({len(asked)} asked)')
    d.click('#btn-info'); settle(d)
    check(d.evaluate("document.querySelector('#info-check').hidden && document.querySelector('#info-update').hidden"), 'from the store: About offers no check')
    d.keyboard.press('Escape'); settle(d)
    d.click('#btn-settings'); time.sleep(.3)
    check(not d.is_visible('#settings-form [name=checkUpdates]'), 'from the store: no update setting')
    check(not errors, f'no page errors {errors}')
    ctx.close()
done()
