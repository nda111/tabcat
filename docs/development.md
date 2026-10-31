# Development

How tabcat is built, for anyone who wants to change it. To install and use it, see the [README](../README.md).

tabcat has two parts, kept on two branches of this repository:

| Branch | Contents | Role |
|---|---|---|
| `main` | browser extension (this branch) | Owns the data (`chrome.storage.local`) and every tab operation. Popup, context menu, shortcuts, auto-suspend. |
| [`pages`](https://github.com/nda111/tabcat/tree/pages) | web dashboard | A static web page (no backend), published at <https://tabcat.ghyeok.com/>. Renders and edits the data through the extension bridge. |

```
web page (allowed origins only)           extension
┌───────────────────────┐ postMessage ┌─────────────┐  port   ┌──────────────────┐
│ js/app.js (pages)     │◀──────────▶│ content.js  │◀──────▶│ background.js    │
│ UI, drag & drop       │             │ (bridge)    │         │ storage + tabs   │
└───────────────────────┘             └─────────────┘         └──────────────────┘
```

## Dashboard origins

Allowed dashboard origins (see `content_scripts[0].matches` and `web_accessible_resources[0].matches` in
`manifest.json`):

- `https://tabcat.ghyeok.com/*` (published dashboard)
- `http://localhost/*`, `http://127.0.0.1/*` (any port, for development)

To host the dashboard elsewhere, add its exact origin to both lists and reload the extension.
Avoid broad wildcards such as `https://*.github.io/*`: any page on a matching origin could talk to the bridge.

## Deployment

GitHub Pages serves the `pages` branch (root) of this repository at the custom domain `tabcat.ghyeok.com`
(`CNAME` file on `pages`; DNS: `CNAME tabcat → nda111.github.io`, HTTPS enforced).
Pushing to `pages` publishes the dashboard.

## Local setup

Recommended local layout: the `pages` branch checked out as a worktree in `web/` (ignored on `main`).

```sh
git clone git@github.com:nda111/tabcat.git && cd tabcat
git worktree add web pages
python3 -m http.server 8080 -d web      # dashboard at http://localhost:8080/
```

Run the browser tests with `python tests/run.py` (see `tests/README.md`).
Commit extension changes from the repository root (`main`) and dashboard changes from `web/` (`pages`).
The extension remembers the last dashboard URL that connected, so a local dashboard opens via the popup too.

## Data model

```
Workspace  (Name*, Symbol, Description)
└─ Category  (Name*)
   └─ Group  (Name*, Symbol, Note [markdown], board column)
      ├─ Link    (URL*, Name*, Icon, Description)
      └─ Folder  (Name*, Symbol)            ← folders nest up to 4 levels; they hold links and folders
```

- Workspace → Category → Group is mandatory; links and folders always live under a group.
- Symbol (optional) is a single emoji, or one capital letter or digit shown as a badge; Note is markdown; everything else is plain text.

## Files

```
manifest.json
background.js     service worker: RPC handlers, bridge ports, context menu, shortcuts, auto-suspend
content.js        bridge between the dashboard page and the background worker
popup.html/css/js toolbar popup
fonts/            Pretendard stylesheet (size-adjusted copy; font files load from jsDelivr)
lib/store.js      data model, tree ops, op application, persistence
lib/actions.js    save / close / suspend tabs
docs/             this file
tests/            browser tests (Playwright)
icons/            logo.svg (the drawing; pages tint it in the accent colour) and the toolbar PNGs in the default accent
```

## Bridge protocol

Page → extension: `{ source: 'tabcat-page', id, cmd, args }`; replies come back as
`{ source: 'tabcat-ext', reply: id, result | error }`, push events as `{ source: 'tabcat-ext', event, data }`
(`ready`, `state`, `settings`, `tabs`, `disconnected`). The bridge only activates after the page sends
`{ source: 'tabcat-page', cmd: 'hello' }`.

Data mutations use `cmd: 'apply'` with a list of ops applied atomically
(`create`, `patch`, `move`, `remove`, `firstGroup`, `firstCategory`, `replace`); `"$n"` in `id`/`parentId`
refers to the result of op *n*. See `applyOp` in `lib/store.js`.

## Releases

Bump `version` in `manifest.json`, commit, then zip the extension files (not `web/`, `tests/` or `docs/`) into
`releases/v<version>.zip` under a `tabcat/` folder (with `LICENSE` and `README.md`), for example with `git archive --prefix=tabcat/`.
Tag the commit `v<version>` and attach the zip to a GitHub release. (`releases/` is ignored: the zips and notes live on GitHub releases only.)

The same version goes to the Chrome Web Store: `python tools/store_zip.py` writes `releases/v<version>-store.zip`
(the manifest at the top, without the localhost pages); upload it in the Developer Dashboard.
Installed from the store, the extension updates itself: its manifest has the store's `update_url`, so `content.js`
tells the dashboard (`updatesItself` in `ready`), which then doesn't look for GitHub releases.
