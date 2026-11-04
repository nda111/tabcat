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

Every file's job, and how a change travels between them: [structure.md](structure.md). The server's API: [api.md](api.md); its database: [database.md](database.md).

## Bridge protocol

Page → extension: `{ source: 'tabcat-page', id, cmd, args }`; replies come back as
`{ source: 'tabcat-ext', reply: id, result | error }`, push events as `{ source: 'tabcat-ext', event, data }`
(`ready`, `state`, `settings`, `tabs`, `disconnected`). The bridge only activates after the page sends
`{ source: 'tabcat-page', cmd: 'hello' }`.

Data mutations use `cmd: 'apply'` with a list of ops applied atomically
(`create`, `patch`, `move`, `remove`, `firstGroup`, `firstCategory`, `replace`); `"$n"` in `id`/`parentId`
refers to the result of op *n*. See `applyOp` in `lib/store.js`.

## Releases

The extension and the server are released apart from this one repository, each with its own version and tags:

| Part | Version in | Tag | Files (`python tools/release.py [extension\|server]`) |
|---|---|---|---|
| Extension | `manifest.json` | `extension-v<version>` (before 1.1.0: `v<version>`) | `extension-v<version>.zip` (a `tabcat/` folder, to install by hand), `extension-v<version>-store.zip` (for the Chrome Web Store only) |
| Server | `server/pyproject.toml` and `server/tabcat_server/__init__.py` | `server-v<version>` | `tabcat_server-<version>-py3-none-any.whl`; the Docker image (`python tools/release.py docker --push`) |

1. Bump the version (and, for a server release, point `SERVER_WHEEL` in `web/js/welcome.js` and the install line in
   `server/README.md` at the new wheel), add the changes to `CHANGELOG.md` (extension) or `server/CHANGELOG.md`
   (server), write the release's notes as `docs/releases/<tag>.md`, and add the version to the compatibility
   tables (README.md, *Which versions work together*, and server/README.md, *Install*). Commit, and merge into `main`.
2. Deploy the dashboard first if the release needs it (`pages`): the extension opens its welcome page, and a server
   takes the dashboard from there.
3. Tag the commit and push the tag (`git tag extension-v1.2.0 && git push origin extension-v1.2.0`). GitHub Actions
   ([`.github/workflows/release.yml`](../.github/workflows/release.yml)) does the rest:
   - checks the tag against the code's version and that the notes are there;
   - runs the server's API tests, `test_release` and `test_locales` (against the `pages` branch's dashboard);
   - **extension**: builds both zips, makes the GitHub release (the **latest**) with the zip to install by hand and the
     notes, and keeps the store's zip as the run's artifact, to upload to the Chrome Web Store by hand;
   - **server**: builds the wheel and the image, pushes the image to Docker Hub (`<version>` and `latest`, amd64 and
     arm64), makes the GitHub release (**not** the latest) with the wheel, and updates Docker Hub's overview from
     `server/DOCKERHUB.md`.
4. To try it without publishing: Actions → Release → Run workflow, with the tag (already pushed) and `publish`
   unticked: it builds and tests only. (Run by hand only once the workflow is on `main`.)

By hand instead: `python tools/release.py <part>` builds the files from `HEAD` into `releases/` (ignored by git;
`--worktree` to try it with uncommitted changes), and `gh release create` publishes them. The extension's zips hold
every tracked file but the server, tests, tools, docs, store listing and icon source; `tests/test_release.py` checks
they hold all the extension refers to and load.

The update checks find their own part's newest release by its tag, among the newest 50: the dashboard looks for the
extension's (`newestExtension` in `web/js/app.js`), the server for its own (`updates.newest_tag`), so a release of one
never tells the other's users to update. The dashboard has no releases: the `pages` branch is deployed as it's pushed,
and a server takes it up once a day.

### Docker Hub

The server's image is `nda111/tabcat-server` (`TABCAT_IMAGE` to name another), for `linux/amd64` and `linux/arm64`,
tagged with the release's version and `latest`. Once, to set it up: make the repository on Docker Hub (public), make
an access token (Account settings → Personal access tokens, **Read, Write, Delete**: Delete is what updating the
overview needs) and keep it as the GitHub repository's secrets `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN`. (Another
image name: the repository variable `DOCKERHUB_IMAGE`.) The workflow fills in the overview from `server/DOCKERHUB.md`. To release by hand: `docker login`, then
`python tools/release.py docker --push` (Docker with buildx; Docker Desktop has both platforms). Without `--push` it
builds both, to check, and loads this computer's into Docker to try.

The extension's store zip goes to the Chrome Web Store's Developer Dashboard (the manifest at the top, without the
localhost pages).
The listing's text and images are in `store/` (`listing.md`, and screenshots / promo tiles in `en/` and `ko/`).
Installed from the store, the extension updates itself: its manifest has the store's `update_url`, so `content.js`
tells the dashboard (`updatesItself` in `ready`), which then doesn't look for GitHub releases.
