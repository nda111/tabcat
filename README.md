<p align="center"><img src="icons/icon128.png" width="96" alt=""></p>

<h1 align="center">tabcat</h1>

<p align="center">
Save your tabs into groups and open them again whenever you need.<br>
Tabs you're not using are put to sleep to keep things light.
</p>

<p align="center">
<a href="https://chromewebstore.google.com/detail/tabcat/ojkddimicblompbmfelkfocpgmeflaib"><img src="https://img.shields.io/chrome-web-store/v/ojkddimicblompbmfelkfocpgmeflaib?label=Chrome%20Web%20Store&logo=googlechrome&logoColor=white&color=8b5cf6" alt="Chrome Web Store version"></a>
<a href="https://github.com/nda111/tabcat/releases/latest"><img src="https://img.shields.io/github/manifest-json/v/nda111/tabcat?label=GitHub%20release&logo=github&color=8b5cf6" alt="Latest GitHub release of the extension"></a>
<a href="server/README.md"><img src="https://img.shields.io/docker/v/nda111/tabcat-server?sort=semver&label=Server&logo=docker&logoColor=white&color=8b5cf6" alt="tabcat server version"></a>
</p>

<p align="center">
<a href="https://chromewebstore.google.com/detail/tabcat/ojkddimicblompbmfelkfocpgmeflaib"><b>Chrome Web Store</b></a> ·
<a href="https://tabcat.ghyeok.com/"><b>Dashboard</b></a> ·
<a href="https://github.com/nda111/tabcat/issues">Report a problem</a>
</p>

<p align="center"><img src="store/en/demo.gif" width="860" alt="tabcat in use: a tab dragged into a group, a tab saved from the toolbar, a group closed and moved, a search, and the colour and theme changed"></p>

---

Keep as many tabs open as you like. tabcat saves them as links in groups you arrange on a board,
opens them again in one click, and puts the ones you aren't using to sleep so your browser stays quick.

It works in Chromium-based browsers: Chrome, Edge, Brave, Whale and others.

## Getting started

Install tabcat from the [Chrome Web Store](https://chromewebstore.google.com/detail/tabcat/ojkddimicblompbmfelkfocpgmeflaib).
It updates itself from there.

A welcome page shows the ways to use it: the online dashboard, a copy you host yourself, or [your own server](#your-own-server-sync-and-teams).
The dashboard, at <https://tabcat.ghyeok.com/>, starts with a short tour. After that, press
<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>X</kbd> (<kbd>⌘</kbd>+<kbd>Shift</kbd>+<kbd>X</kbd> on macOS) to bring it up
any time, and press it again to go back to your tab.

### Installing by hand

For a browser that can't use the Chrome Web Store, or to try a release before it reaches the store:

1. Download `extension-v<version>.zip` from the [latest release](https://github.com/nda111/tabcat/releases/latest) and unzip it.
2. Open `chrome://extensions` (`edge://extensions` in Edge) and turn on **Developer mode**.
3. Click **Load unpacked** and pick the unzipped `tabcat` folder.

Keep the folder where it is: the browser loads tabcat from it.
When a new version is out, a dot appears on **About** in the dashboard, and About links to it.
Download the new release, replace the contents of your `tabcat` folder with it, and press **Reload** on tabcat
in `chrome://extensions`. Your groups and settings stay as they are.

A hand-installed tabcat and the store's are separate extensions with separate data.
To move over, export your data in **Settings** first, then import it into the other one.

### Hosting the dashboard locally

The dashboard is a static page, and your data stays in the extension wherever the page comes from,
so you can serve it yourself:

```sh
git clone -b pages https://github.com/nda111/tabcat.git tabcat-dashboard
cd tabcat-dashboard
python3 -m http.server 8080
```

Then open <http://localhost:8080/>. tabcat connects to a dashboard on `localhost` or `127.0.0.1` at any port,
and the shortcut and toolbar button open the dashboard you used last. To go back, open
<https://tabcat.ghyeok.com/> once. Run `git pull` to get dashboard updates.

To serve it from another address, add that address to `content_scripts` in `manifest.json` and install tabcat by hand.

## What you can do

**Save tabs.** Drag a tab from *Open tabs* onto a group, or drag a window's header to save every tab in it.
From any page, the toolbar button saves the tab to the group you pick, and
<kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd> / <kbd>A</kbd> saves the tab or the whole window.

**Keep them in order.** Split your work into workspaces, say work and study, and each workspace into categories.
Groups are cards on a board; they hold links and folders, up to four levels deep.
Drag anything anywhere, give groups a symbol and a colour, and write notes in Markdown with checkboxes and math.

**Open them again.** Click a link to open it, or open a whole group or folder at once, as tabs or as a tab group.

**Stay light.** Put tabs you aren't looking at to sleep, or let tabcat do it after a few idle minutes.
Close duplicate tabs in one click, and close tabs as you save them if you like.

**Find anything.** <kbd>Ctrl</kbd>+<kbd>F</kbd> searches links, folders, groups and notes.

**Change your mind.** <kbd>Ctrl</kbd>+<kbd>Z</kbd> undoes adding, editing, deleting, moving, saving and closing tabs and windows,
in every open dashboard; closed tabs come back where they were, tab groups and all.
What you delete stays in **Recently deleted** for 30 days, to put back any time.

**Make it yours.** Light and dark themes, accent colours, and 8 languages
(English, 한국어, 日本語, 简体中文, Deutsch, Español, Français, Português).
Install the dashboard as an app to give it a window of its own.

| | | |
|:-:|:-:|:-:|
| <img src="store/en/2-dark.png" alt="Dark theme, with open tabs beside the board"> | <img src="store/en/3-search.png" alt="Searching links"> | <img src="store/en/4-popup.png" alt="Saving a tab from the toolbar"> |
| Dark theme, open tabs beside the board | Search | Save from the toolbar |

## Your own server: sync and teams

tabcat needs no account and no server. When you want your tabs on every computer, or a board your team works on
together, run **tabcat server** on a computer of yours (a home server, a NAS, a small cloud machine, or your desktop)
and connect the extension to it.

- **The same tabcat in every browser.** Sign in to your account in each browser: groups, notes, Recently deleted,
  the look and the settings stay in step, live. Offline changes wait and go once the server is back; none are lost.
- **Your other computers' tabs.** See what's open in your account's other browsers, and open it here.
- **Shared workspaces.** Invite people on the same server to a workspace as viewers, editors or managers; everyone
  sees each change as it's made. Invitations and news come to a Mailbox.
- **Accounts for your team or family.** Each person has their own account and data; sign-up closed, by invitation
  or open; several accounts in one browser to switch between.
- **Yours to run.** Two-step sign-in, a list of devices signed in, waits after wrong passwords, a security record,
  backups and updates from an admin page. One process and one SQLite file: pip or Docker.

Install it, put it behind HTTPS and keep it backed up: see [server/README.md](server/README.md). Then right-click
tabcat's toolbar button, choose **Connect to a server…** and enter its address. Disconnecting brings back the
browser's own tabcat, as it was.

### Which versions work together

The extension and the server have version numbers of their own (tagged `extension-v…` and `server-v…`). The dashboard
has none: tabcat.ghyeok.com is always the newest, and a server fetches the newest every day.

| Extension | Without a server (tabcat.ghyeok.com, or the dashboard hosted yourself) | tabcat server 1.0.0 |
|---|:-:|:-:|
| 1.1.0 | ✅ | ✅ |
| 1.0.0 – 1.0.4 | ✅ | ❌ (no *Connect to a server*: update the extension) |

## Your data

Without a server, everything stays in your browser, kept by the extension. There's no account:
the dashboard is a static page that only reads and edits what the extension holds.
Connected to a server of your own, your account's data is kept there too, and nowhere else.
You can export it to a file, and import it again, in Settings.
The full [privacy policy](https://tabcat.ghyeok.com/privacy) is on the dashboard's site.

tabcat keeps your data only in your browser, so export a backup from Settings now and then.
tabcat is provided as is, without warranty, as per the [MIT](LICENSE) License.

## Questions and problems

Found a bug or have an idea? Tell us in [Issues](https://github.com/nda111/tabcat/issues).
Every shortcut and gesture is in **Help** on the dashboard.

If you'd like to look under the hood or change tabcat, see [docs/development.md](docs/development.md):
how the code is laid out ([docs/structure.md](docs/structure.md)), the server's API ([docs/api.md](docs/api.md))
and its database ([docs/database.md](docs/database.md)).

## License

tabcat is free and open source under the [MIT License](LICENSE).
The fonts and libraries it uses (Pretendard, Archivo, Noto Sans, MathJax, emoji data, Feather icons, and the server's
Python packages) are under their own licenses: see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
