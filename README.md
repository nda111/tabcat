# tabcat 🐱

A tab manager for Chromium-based browsers (Chrome, Edge, Brave, Whale, …), inspired by tabExtend.
Tabs are summarized as **files** (icon · url · name), saved into a hierarchy and closed or suspended to save memory.

tabcat has two parts, kept on two branches of this repository:

| Branch | Contents | Role |
|---|---|---|
| `main` | browser extension (this branch) | Owns the data (`chrome.storage.local`) and every tab operation. Popup, context menu, shortcuts, auto-suspend. |
| [`gh-pages`](../../tree/gh-pages) | web dashboard | A static web page (no backend) served by GitHub Pages at <https://ghyeok.com/tabcat/> (the account's custom domain for `nda111.github.io`). Renders and edits the data through the extension bridge. |

```
web page (allowed origins only)           extension
┌───────────────────────┐ postMessage ┌─────────────┐  port   ┌──────────────────┐
│ js/app.js (gh-pages)  │◀──────────▶│ content.js  │◀──────▶│ background.js    │
│ UI, drag & drop       │             │ (bridge)    │         │ storage + tabs   │
└───────────────────────┘             └─────────────┘         └──────────────────┘
```

## Setup

1. **Load the extension**: open `chrome://extensions`, enable *Developer mode*, click *Load unpacked*,
   and select the root of a `main` checkout.
2. **Open the dashboard**: <https://ghyeok.com/tabcat/>, the popup's *Open dashboard* button, or `Alt+Shift+D`.

Allowed dashboard origins (see `content_scripts[0].matches` and `web_accessible_resources[0].matches` in
`manifest.json`):

- `https://ghyeok.com/tabcat/*`
- `http://localhost/*`, `http://127.0.0.1/*` (any port, for local development)

To host the dashboard elsewhere, add its exact origin to both lists and reload the extension.
Avoid broad wildcards such as `https://*.github.io/*`: any page on a matching origin could talk to the bridge.

## Development

Recommended local layout: the `gh-pages` branch checked out as a worktree in `web/` (ignored on `main`).

```sh
git clone git@github.com:nda111/tabcat.git && cd tabcat
git worktree add web gh-pages
python3 -m http.server 8080 -d web      # dashboard at http://localhost:8080/
```

Commit extension changes from the repository root (`main`) and dashboard changes from `web/` (`gh-pages`).
The extension remembers the last dashboard URL that connected, so a local dashboard opens via the popup too.

## Data model

```
Workspace  (Name*, Symbol, Description)
└─ Category  (Name*)
   └─ Group  (Name*, Symbol, Note [markdown])
      ├─ Link    (URL*, Name*, Icon, Description)
      └─ Folder  (Name*, Symbol)            ← folders nest; they hold links and folders
```

- Workspace → Category → Group is mandatory; links and folders always live under a group.
- Symbol is a single emoji (optional); Note is markdown; everything else is plain text.

## Features

| Area | Features |
|---|---|
| Dashboard | Workspace sidebar · category tabs · board of group cards · open-tabs panel |
| Drag & drop | Open tab → exact position in a group/folder · window header → save whole window · drop on empty board → new group · move/reorder links and folders, nest folders · reorder groups, drop on a category tab or workspace to move · reorder categories and workspaces · saved link → open-tabs panel opens it · drag a URL from the address bar or another page |
| Memory | Close tabs after saving (setting) · save & close a window · suspend (discard) inactive tabs · auto-suspend after N minutes · close duplicate tabs |
| Organizing | Markdown notes with clickable task checkboxes · collapse · sort by name · remove duplicate links · context menus · undo delete |
| Opening | Click: new tab · Ctrl/middle click: background · Shift: new window · open a whole group/folder |
| Search | `/` or `Ctrl+K`, searches links, groups, folders and notes; Enter opens the first hit |
| Popup | Rename the current tab and save it to any group · save window · suspend · close duplicates · open dashboard |
| Shortcuts | `Alt+Shift+C` popup · `Alt+Shift+D` dashboard · `Alt+Shift+S` save tab · `Alt+Shift+A` save window |
| Data | JSON export / import (merge) · light / dark / system theme |

## Files

```
manifest.json
background.js     service worker: RPC handlers, bridge ports, context menu, shortcuts, auto-suspend
content.js        bridge between the dashboard page and the background worker
popup.html/css/js toolbar popup
lib/store.js      data model, tree ops, op application, persistence
lib/actions.js    save / close / suspend tabs
icons/
```

## Bridge protocol

Page → extension: `{ source: 'tabcat-page', id, cmd, args }`; replies come back as
`{ source: 'tabcat-ext', reply: id, result | error }`, push events as `{ source: 'tabcat-ext', event, data }`
(`ready`, `state`, `settings`, `tabs`, `disconnected`). The bridge only activates after the page sends
`{ source: 'tabcat-page', cmd: 'hello' }`.

Data mutations use `cmd: 'apply'` with a list of ops applied atomically
(`create`, `patch`, `move`, `remove`, `firstGroup`, `firstCategory`, `replace`); `"$n"` in `id`/`parentId`
refers to the result of op *n*. See `applyOp` in `lib/store.js`.
