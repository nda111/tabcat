# Code structure

A map of tabcat's code files, for anyone about to change the code. For how the parts fit together and how to run
them, see [development.md](development.md).

```
tabcat/                      main branch: the extension (Chromium MV3)
  manifest.json
  background.js              service worker: data, tabs, RPC, sync with a server
  content.js                 bridge: dashboard page <-> background.js
  popup.* / connect.* / allow.*  the extension's own small pages
  lib/                       modules shared by the worker and the pages
  _locales/  fonts/  icons/
  web/                       pages branch (git worktree): the web dashboard, tabcat.ghyeok.com
    index.html  app.css  js/  js/locales/  privacy.*  welcome.*  404.html
  server/                    tabcat-server (FastAPI + SQLite), released apart
    tabcat_server/           the package
      pages/                 the server's own pages (sign-in, setup, account, admin, error)
    tests/test_api.py
  tests/                     browser tests (Playwright), run.py, harness.py
  tools/release.py           builds the release files
  store/                     Chrome Web Store listing
  docs/
```

## Extension (repository root, `main`)

The extension owns the data (`chrome.storage.local`) and every tab operation. Pages talk to the service worker
two ways: the extension's own pages (popup, connect, allow) by `chrome.runtime.sendMessage`, the dashboard through
`content.js` and a long-lived port.

| File | What it does |
|---|---|
| `manifest.json` | MV3 manifest: the service worker (`background.js`, a module), the popup, permissions (`tabs`, `storage`, `contextMenus`, `alarms`, `favicon`, `tabGroups`, `scripting`...), the four commands (open popup, open dashboard, save tab, save window), `content.js` on the allowed dashboard origins, `_favicon/*` exposed to those origins, and optional host permissions (asked for when connecting to a server). |
| `background.js` | The service worker; imports `lib/store.js`, `lib/actions.js`, `lib/i18n.js`, `lib/sync.js`. Sections: setup (toolbar icon tinted in the accent, context menus, `init`, auto-suspend alarm); Recently deleted (`withTrash`, `addToTrash`, `putBack`; kept 30 days); the dashboard tab (`openDashboard`, `toggleDashboard`, keeping it the first pinned tab); context menu and shortcuts; tab groups linked to groups/folders (`syncTabGroups`, `relinkTabGroup`); the shared undo/redo history (`withHistory`, `historyHandlers`: `remember`, `rememberAct`, `undo`, `redo`); the RPC `handlers` map (`getState`, `getSettings`, `saveSettings`, `apply`, `saveTabs`, `saveWindow`, `getTabs`, `openUrls`, `moveTabs`, `favicons`, `wakeTabs`, `getTrash`, `restoreTrash`, `closeWindow`, `getShortcuts`, `syncNow`, `syncStatus`, `shareWorkspace`, `leaveShare`, `deleteShare`, `deviceId`, ...) dispatched by `handle()`; the user's own server (`connectServer`, `disconnectServer`, `linkServer` registering `content.js` there, `switchSpace`, `ensureAccount`, `serverGate`, `originAllowed`/`askToAllow`/`allowOrigin` for localhost pages); sync (`syncOnce`, `syncTxn`, `syncApi`, `syncShares`, `syncShare`); the bridge ports (`chrome.runtime.onConnect`, `broadcast`, `chrome.storage.onChanged`); sending this browser's open tabs to the server (`sendTabs`). |
| `content.js` | Content script on dashboard pages: relays `{source: 'tabcat-page'}` messages from the page to a `tabcat-bridge` port, and replies and events back by `postMessage`. Activates only after the page's `hello`; answers with `ready` (version, `FEATURES` list, `updatesItself`, favicon mode, server). Handles `probe` and `sync` from the server's own pages without opening a port; reconnects after the worker restarts or the bfcache; tells the worker when a dialog is open (`editing`). |
| `popup.html`, `popup.css`, `popup.js` | Toolbar popup: save this tab (with a group picker) or the window, close duplicates, suspend, open the dashboard, undo the last change; counts of what each button would touch; asks `serverStatus` and shows sign-in/set-up when a connected server needs it. Sends every action to `background.js` (`chrome.runtime.sendMessage`). `popup.css` is also the base style of `connect.html` and `allow.html`. |
| `popup-look.js` | Classic script in the popup's head: applies the last theme/accent (kept in `localStorage` by `popup.js`) before the first paint. |
| `connect.html`, `connect.css`, `connect.js` | "Connect to a server" window: takes an address, asks `chrome.permissions.request` for that host (from the click), checks `/manifest.webmanifest` says `tabcat`, then sends `connectServer` to `background.js`. `connect.css` also styles `allow.html`. |
| `connect-look.js` | Classic script in the head of `connect.html` and `allow.html`: theme/accent from the window's query string, before the first paint. |
| `allow.html`, `allow.js` | "Let this page use tabcat?" window, opened by `askToAllow` for a `localhost` / `127.0.0.1` page; Allow sends `allowOrigin` to `background.js`. |
| `lib/store.js` | Data model and persistence: node factories (`makeWorkspace`, `makeGroup`, `makeLink`...), `DEFAULT_SETTINGS`, tree helpers (`locate`, `walk`, `children`, `moveNode`, `insertNode`, `removeNode`, `ensureGroup`, folder depth), `normalize`, `applyOp`/`applyOps` (the bridge's `apply` ops), `load`/`save`/`update` (serialized read-modify-write of `chrome.storage.local['tabcat']`), `loadSettings`/`saveSettings` (`tabcat:settings`), `faviconFor`, accent colours. Used by the worker and the popup/connect/allow pages. |
| `lib/actions.js` | Tab operations: `saveTabs`, `saveWindow`, `closeTabsSafely` (never closes the last tab of a window), `duplicateTabs`/`closeDuplicates`, `reopenTabs`, `suspendTabs`, `tabInfos`; the dashboard address (`setDashboardUrl`, `isDashboard`, `isNewTab`). Writes through `S.update`. |
| `lib/sync.js` | Sync's pure logic, no I/O: `docOf` (tree + trash + synced settings `LOOK`), `diff` (two docs to ops: `add`, `move`, `set`, `del`, `trash+`, `trash-`, `look`), `apply`, `body`/`opsOf` (the op envelope), `packed` (gzip of a request body), `join`/`split`/`stub` (shared workspaces in and out of the account's doc), `keepLocal`. |
| `lib/i18n.js` | The extension's strings (popup, menus, connect/allow windows, default names) in 8 languages; `t`, `setLang`, `getLang`, `resolveLang`, `LANGS`. |
| `lib/page.js` | Shared setup of the extension's small pages: `localizePage` (`data-i18n*` attributes), `applyLook`, `fitWindow` (a popup window sized to its content). |
| `lib/scroll-feel.js` | `scrollFeel(el, opts)`: overscroll give, bounce, and a drawn scrollbar. Same file as `web/js/scroll-feel.js`; used by the popup. |
| `_locales/*/messages.json` | Chrome's own strings: the extension description and the command names (`__MSG_*__` in the manifest). 8 languages. |
| `fonts/pretendard.css` | Pretendard (Korean) stylesheet, size-adjusted; the font files load from jsDelivr. |
| `icons/` | `logo.svg` (the drawing), toolbar PNGs (`icon16`...`icon128`), `source/icon.af` (the drawing's source file). |

## Web dashboard (`web/`, the `pages` branch)

A static page with no backend; all data comes from the extension through `content.js`. Served by GitHub Pages at
tabcat.ghyeok.com, by `python -m http.server` locally, or by tabcat-server.

| File | What it does |
|---|---|
| `index.html` | The dashboard page: its dialogs and panels as markup; loads `js/boot.js` (classic) then `js/app.js` (module). |
| `app.css` | All of the dashboard's styles (also used by `privacy.html`, `welcome.html` and `404.html`). |
| `js/app.js` | The dashboard (one module). Sections: utilities; rendering (sidebar, categories, board columns, group and folder cards, search results, the open tabs panel with other devices' tabs); mutations (edit dialogs, notes, add/delete/move, undo/redo through the extension's history); group and item selection; drag & drop (links, tabs, groups, workspaces, columns); settings, import/export; wiring (bridge events `ready`, `state`, `settings`, `tabs`, `trash`, `disconnected`; start-up `start(ext)`; update check `newestExtension`; tour). On a tabcat server also: Account dialog, account switching, shares, mailbox, and `listenForChanges` (imports the server's `/_server/live.js`). Calls the extension only through `bridge.js`. |
| `js/boot.js` | Runs before the page draws: last theme/accent from `localStorage`, page hidden until `app.js` is ready, keeps `beforeinstallprompt`. |
| `js/bridge.js` | Page side of the bridge protocol: `connect` (sends `hello`, waits for `ready`), `call(cmd, args)` (promise per request id), `apply(...ops)`, `on(event, fn)`, `info` (what the extension reported). |
| `js/tree.js` | Read-only tree helpers mirroring `lib/store.js` (`locate`, `walk`, `children`, folder depth, `collectLinks`, symbol helpers). |
| `js/i18n.js` | Dashboard strings: `LANGS`, `setLang` (loads `locales/<lang>.js` on demand, English as fallback), `t`, `translateDom`, `randomName`. |
| `js/locales/*.js` | One dictionary per language (`en.js` is the source of keys). |
| `js/markdown.js` | Safe markdown subset for group notes (`renderMarkdown`, `toggleTask`, `escapeHtml`); marks TeX for `math.js`. |
| `js/math.js` | Loads MathJax from jsDelivr on first use; `typesetMath`, `mathReady`. |
| `js/emoji.js` | Emoji search for the symbol picker, from emoji-picker-element's database on jsDelivr (`searchEmoji`, `favoriteEmoji`, `recordEmoji`). |
| `js/icons.js` | Inline SVG stroke icons (`icon`, `iconSvg`, `hydrateIcons`). |
| `js/hangul.js` | Korean search by jamo (`letters`, `matchLetters`, `hasLetters`, `findLetters`); the server's `hangul.py` does the same. |
| `js/sample.js` | `sampleWorkspaces(lang)`: Help > Add sample workspaces, translated. |
| `js/scroll-feel.js` | Same as `lib/scroll-feel.js`. |
| `privacy.html`, `privacy.css`, `js/privacy.js`, `js/privacy-text.js` | The privacy policy page; `privacy-text.js` holds the text in every language, `privacy.js` picks the language and renders it. |
| `welcome.html`, `welcome.css`, `js/welcome.js`, `js/welcome-text.js` | The welcome page (`/welcome`), which the extension opens once installed (`WELCOME` in `background.js`): the three ways to use tabcat (the online dashboard, a copy served on this computer, a server of one's own) as cards whose steps fold open, with commands to copy. `welcome-text.js` holds the text in every language; `welcome.js` holds the commands (`COMMANDS`, with the server release's wheel address `SERVER_WHEEL`) and renders it. |
| `404.html`, `js/notfound.js`, `js/look.js` | GitHub Pages' not-found page; `look.js` applies the last look before paint, `notfound.js` translates it. |
| `manifest.webmanifest` | Web app manifest (installable dashboard). `connect.js` checks its `name` to recognise a tabcat server. |
| `fonts/pretendard.css`, `icons/` | As in the extension; `icons/app-*.png` for the web app manifest. |
| `CNAME`, `.nojekyll`, `README.md` | GitHub Pages' custom domain, no Jekyll processing, and a short readme. |

## Server (`server/`)

`tabcat-server`: hosts the dashboard for the user's own computers, with accounts, sync between an account's
browsers, shared workspaces, and an admin page. Python package `tabcat_server/`, FastAPI on uvicorn, one SQLite file.

| File | What it does |
|---|---|
| `tabcat_server/__init__.py` | `__version__` (the server's own version). |
| `tabcat_server/__main__.py` | `main()`, the `tabcat-server` command: `run` (default; uvicorn with `create_app(config)`, or `--reload` through `app.from_env`), and `reset-password`, `make-admin`, `reset-2fa`, `reset-server`, which work on the database directly. |
| `tabcat_server/config.py` | `Config` and `load()`: data folder, host, port, dashboard source, setup/admin address ranges, trusted proxies, from `config.toml`, the command line and `TABCAT_*` variables; `save_setting`. |
| `tabcat_server/app.py` | `create_app(config)`: everything served. Middleware `guard` (cross-site writes refused, body size limits, per-address rate limit, security headers) and `live` (notifies listeners after API writes); helpers `user_of`/`need_user`/`need_admin`, `log` (security record), `body` (JSON parsing). Routes: server pages (`/login`, `/setup`, `/account`, `/admin`, `/_server/{name}`); sign-in API (`/api/setup`, `/api/login`, `/api/login/code`, `/api/signup`, `/api/logout`, `/api/accounts*`); `/api/me*` (password, 2FA, name, avatar, sessions, events); `/api/admin/*` (users, settings, invites, info, database move, server update, Tailscale, events, dashboard update, backup); live events (`/api/live`, also `/api/sync/events`, SSE: `head`, `me`, `admin`, `tabs`, `mail`, `shares`); sync (`/api/sync/state`, `/api/sync/ops` GET/POST, `/api/sync/snapshot`, `/api/sync/tabs*`); shares (`/api/sync/shares*`, `/api/shares*`); user search; mailbox (`/api/mail*`); the dashboard's files (`/{path}`, `index.html` only signed in); error pages (`error.html`) for page requests, JSON for the API. |
| `tabcat_server/db.py` | `DB`: the SQLite connection (WAL, one `RLock`), `q`/`one`/`run`, settings, `backup_to`, `move_to`, purges; `SCHEMA` (users, sessions, invites, settings, sync_ops, sync_snapshots, device_tabs, shares, share_members, share_ops, share_snapshots, mail, events) and numbered `MIGRATIONS` run by `migrate()` (`user_version`, a `.v<n>.bak` copy first; `TooNew` for a newer file). |
| `tabcat_server/auth.py` | Passwords (scrypt: `hash_password`, `check_password`), sessions (random token in the `tabcat_session` cookie, its hash in the database: `new_session`, `session_user`, `end_session`), username/password rules, `Throttle` (sign-in attempts). |
| `tabcat_server/totp.py` | Two-step sign-in: TOTP secrets and codes (`new_secret`, `check`, `uri`, `qr_svg`), recovery codes. |
| `tabcat_server/hangul.py` | Korean search by jamo for user search (`letters`, `score`), as `web/js/hangul.js`. |
| `tabcat_server/dashboard.py` | The dashboard's files: `update()` downloads the `pages` branch zip from GitHub into the data folder, `present`, `version`. |
| `tabcat_server/updates.py` | Update checks: the dashboard's latest commit and the server's newest `server-v*` release (`newest_tag`, `latest_release`, `newer`), `upgrade` (pip installs), `restart`, and `keep_up` (daily background thread). |
| `tabcat_server/tailscale.py` | Admin page's Tailscale panel: `status`, `serve(on)` (`tailscale serve`), through the `tailscale` CLI. |
| `tabcat_server/dialogs.py` | `save_file()`: the OS's own save dialog on the server's computer (admin: moving the database). |
| `tabcat_server/pages/pages.js` | Shared by the server's pages: language (`t`, with `strings.js`), `api()` calls, DOM and animation helpers, event-record formatting, `connected()` (asks `content.js` with `probe` whether the extension is linked to this server), `modal`, and `live()` (uses `live.js`; on `head` posts `sync` to `content.js`). |
| `tabcat_server/pages/live.js` | `liveStream(fn)`: one `/api/live` EventSource shared by all of the server's open pages in a browser (leader chosen by Web Locks, or `localStorage` on plain http); also imported by the dashboard. |
| `tabcat_server/pages/strings.js` | `STRINGS`: the server pages' text in 8 languages. |
| `tabcat_server/pages/pages.css`, `look.js` | The pages' styles; `look.js` applies the dashboard's last look before paint. |
| `tabcat_server/pages/login.html`, `login.js` | Sign in (with the 2FA step), or sign up with an invitation / open sign-up. |
| `tabcat_server/pages/setup.html`, `setup.js` | The first account (an admin) on a new server. |
| `tabcat_server/pages/account.html`, `account.js` | The account page: name, photo, password, 2FA, sessions and devices, the account's security record, delete account. |
| `tabcat_server/pages/admin.html`, `admin.js` | The admin page: users, sign-up and invitations, security settings and record, the database, server and dashboard updates, Tailscale. |
| `tabcat_server/pages/setup-elsewhere.html`, `admin-elsewhere.html`, `elsewhere.js` | Shown instead of setup/admin to an address outside `setup_from`/`admin_from`. |
| `tabcat_server/pages/error.html`, `error.js` | Error page (`{{code}}` filled in by `error_page` in `app.py`). |
| `tabcat_server/pages/nodashboard.html` | Shown when the dashboard's files are missing (not downloaded yet). |
| `pyproject.toml` | Package metadata, dependencies (fastapi, uvicorn, segno), the `tabcat-server` script, `pages/*` as package data. |
| `Dockerfile`, `compose.yaml` | Container image (data in `/data`) and a compose file publishing it on 127.0.0.1:8080. |
| `README.md`, `CHANGELOG.md` | The server's readme (install, sync API) and changelog. |
| `tests/test_api.py` | API tests without a browser (FastAPI `TestClient`): setup, sign-in, accounts, sign-up modes, invites, admin limits, sync, shares. |

## Tests (`tests/`)

End-to-end tests in Chromium with the extension loaded (Playwright), each a script that prints PASS/FAIL and exits
non-zero on failure. See `tests/README.md`.

| File | What it does |
|---|---|
| `harness.py` | Shared setup: serves `web/` on `TABCAT_TEST_PORT` (8765 by default), copies the extension (optionally with a changed manifest), launches Chromium with a fresh profile (`launch`), opens dashboards, seeds data and settings through the service worker (`seed`, `settings`, `workspace`, `group`), `check`/`done`, `until`/`settle`; stretches waits by `TABCAT_TEST_WAIT` / `TABCAT_TEST_SLOW`. |
| `run.py` | Runner: `python tests/run.py [name parts...] [-j N] [--heavy N]`. Runs every `test_*.py` (or those matching), plus `server/tests/test_api.py`, in two lanes: heavy tests (the API tests and those that start uvicorn) `--heavy` at a time, the rest `-j` at a time, each on its own port. A failure is rerun alone on 8765; passing then, it is reported as flaky. |
| `README.md` | How to install and run them; a table of what some tests cover. |

What the tests cover, by file:

| Group | Files |
|---|---|
| Dashboard board and editing | `test_board`, `test_render`, `test_category_bar`, `test_live_edit_workspace`, `test_look`, `test_font_size`, `test_language_field`, `test_scroll_feel`, `test_toast`, `test_sample`, `test_default_group`, `test_site_icons` |
| Undo history and Recently deleted | `test_history`, `test_add_edit_history`, `test_close_history`, `test_data_view`, `test_trash` |
| Tabs and tab groups | `test_tab_groups`, `test_move_tabs`, `test_new_tab`, `test_summon` |
| Start-up, app, extension integration | `test_boot`, `test_tour`, `test_app`, `test_install`, `test_shortcuts`, `test_popup`, `test_compat`, `test_update_reload`, `test_updates`, `test_upgrade` (from the real 1.0.4), `test_locales`, `test_allow`, `test_connect_window`, `test_release` |
| The user's own server (start uvicorn: heavy) | `test_server`, `test_server_app`, `test_sync`, `test_sync_ui`, `test_device_tabs`, `test_shares`, `test_mailbox`, `test_accounts_switch`, `test_twofa`, `test_live_pages`, `test_live_shared` |

## Other files

| File | What it does |
|---|---|
| `tools/release.py` | `python tools/release.py [extension\|server] [--worktree] [--out DIR]`: builds `tabcat-extension-<v>.zip`, `-store.zip` (manifest without the localhost origins) or the server wheel into `releases/`, from `HEAD` or the working tree. |
| `store/listing.md`, `store/en/`, `store/ko/` | Chrome Web Store listing text, screenshots, promo tiles and the demo video. |
| `docs/development.md`, `docs/structure.md` | Developer docs. |
| `README.md`, `CHANGELOG.md`, `LICENSE` | The project readme, the extension's changelog, the licence. |
| `.gitattributes`, `.gitignore` | LF line endings; `web/`, `releases/` and caches ignored. |

## Flows

### A dashboard edit

1. `web/js/app.js` calls `B.apply(...ops)` (`js/bridge.js`), which posts `{source: 'tabcat-page', id, cmd: 'apply', args}`.
2. `content.js` forwards it on its `tabcat-bridge` port.
3. `background.js`'s `onConnect` listener checks the origin (`originAllowed`; when connected to a server, only that
   server's dashboard, with `ensureAccount`), then `handle()` runs `handlers.apply`: `S.update` applies the ops with
   `S.applyOps` and saves to `chrome.storage.local`; removes marked `trash` go to Recently deleted. The reply goes back
   on the port.
4. `chrome.storage.onChanged` in `background.js` then `broadcast('state', ...)` to every open dashboard port (and
   `syncTabGroups`, and `syncSoon` when connected to a server); each dashboard re-renders on `B.on('state')`.
   Undo entries are recorded separately by the dashboard (`remember`), kept by `historyHandlers`.

### Saving tabs from the popup

`popup.js` sends `saveTabs` / `saveWindow` with `chrome.runtime.sendMessage` (the popup may close at once, so the
worker does the work). `background.js`'s `saveTabs` checks `serverGate` (a connected server needing sign-in blocks
saving), records the change in the undo history, and calls `A.saveTabs` in `lib/actions.js`, which writes links into
the chosen (or default) group through `S.update` and closes the tabs with `closeTabsSafely`. The storage change is
broadcast to open dashboards as above. The context menu and the `save-tab` / `save-window` commands take the same path.

### Connecting to a server

1. The toolbar button's context menu opens `connect.html`. `connect.js` requests host permission for the address
   (`chrome.permissions.request`, `https://host/*` and `http://host/*`), checks `/manifest.webmanifest`, and sends
   `connectServer` (accepted only from the extension's own pages: `SERVER_CMDS`).
2. `connectServer` in `background.js` registers `content.js` for that host (`linkServer`,
   `chrome.scripting.registerContentScripts`), switches the data space (`switchSpace`: the current data, trash, tab group
   links and sync state are stored under the old space's name; the server's are taken out), saves `server` and
   `dashboardUrl`, rebuilds menus and opens the server's dashboard.
3. Once signed in, `ensureAccount` asks `/api/me` and switches again to the account's own space
   (`<server>|<account key>`). `disconnectServer` reverses all this and gives the permission back; `checkServer` does
   it if the permission was removed in Chrome.
4. Local pages (`localhost`, `127.0.0.1`) other than a connected server get no answers until allowed in `allow.html`.

### Sync with a server

- Trigger: any change to the tree, trash or synced settings (`storage.onChanged`), a dashboard opening, `syncNow`
  from a page, the `sync` alarm, or coming back online.
- `syncOnce` in `background.js`: `syncTxn` diffs the doc (`Y.docOf`) against the stored `shadow` with `Y.diff` and
  queues the ops in `pending` (kept in storage, so offline changes are not lost). Unsent ones go to
  `POST /api/sync/ops` with ids; the server numbers them (`sync_ops`, deduplicated by id) and replies with `acked`
  seqs. Then `GET /api/sync/ops?after=seq` returns everyone's changes in order, applied to `base` with `Y.apply`;
  acknowledged own changes leave `pending`. `reload` from the server, or a server behind the browser, restarts from
  `GET /api/sync/state`. Every 200 changes the browser `PUT`s a `snapshot`.
- `syncApi` sends `X-Tabcat-Account`; the server's `sync_user` refuses with 409 if another account is signed in.
- Shared workspaces: `syncShares`/`syncShare` do the same per share against `/api/sync/shares/{sid}/*`, joined into
  the account's doc as stubs (`Y.join`/`Y.split`).
- Other browsers: after `sync_push` the server `notify`s `head` on the account's live stream (`/api/live`, SSE).
  The server's pages (`pages.js` `live()`) post `sync` to `content.js`, and the dashboard (`listenForChanges`) calls
  `syncNow` through the bridge; the extension in that browser then runs `syncOnce`.
- Open tabs: `sendTabs` `PUT`s this browser's windows to `/api/sync/tabs`; others get a `tabs` event and read
  `GET /api/sync/tabs` for the open tabs panel.

### The server request path

1. uvicorn (`__main__.py`) runs the app from `create_app(config)`; GZip middleware wraps everything.
2. `guard` middleware, for `/api/`: refuses writes with `Sec-Fetch-Site` cross-site or same-site (unless from an
   extension origin), bad or too large `Content-Length`, and more than the per-minute limit per address; adds
   `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`.
3. The handler: `user_of` reads the session cookie through `auth.session_user` (token hash looked up in `sessions`);
   `need_user` / `need_admin` (admin also by address range) raise 401/403; `body()` parses JSON within limits.
   Sign-in uses `auth.Throttle` and `totp`. Data goes through `db.DB` with parameters, under `db.lock` for writes;
   security-relevant actions go to `events` through `log`.
4. `live` middleware: after a non-sync write, `notify` sends `me` to the accounts touched and `admin` to admins over
   their SSE queues.
5. Errors: `HTTPException` and unhandled exceptions become `error.html` for page requests, JSON for the API.
   Non-API paths serve the dashboard folder (`dashboard.py`), `index.html` only when signed in (else `/login`, or
   `/setup` with no accounts).
