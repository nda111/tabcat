<p align="center"><img src="icons/icon128.png" width="96" alt=""></p>

<h1 align="center">tabcat</h1>

<p align="center">
Save your tabs into groups and open them again whenever you need.<br>
Tabs you're not using are put to sleep to keep things light.
</p>

<p align="center">
<a href="https://github.com/nda111/tabcat/releases/latest"><b>Download</b></a> ·
<a href="https://tabcat.ghyeok.com/"><b>Dashboard</b></a> ·
<a href="https://github.com/nda111/tabcat/issues">Report a problem</a>
</p>

---

Keep as many tabs open as you like. tabcat saves them as links in groups you arrange on a board,
opens them again in one click, and puts the ones you aren't using to sleep so your browser stays quick.

It works in Chromium-based browsers: Chrome, Edge, Brave, Whale and others.

## Getting started

1. Download the `.zip` from the [latest release](https://github.com/nda111/tabcat/releases/latest) and unzip it.
2. Open `chrome://extensions` (`edge://extensions` in Edge) and turn on **Developer mode**.
3. Click **Load unpacked** and pick the unzipped `tabcat` folder.

The dashboard opens at <https://tabcat.ghyeok.com/> with a short tour. After that, press
<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>X</kbd> (<kbd>⌘</kbd>+<kbd>Shift</kbd>+<kbd>X</kbd> on macOS) to bring it up
any time, and press it again to go back to your tab.

Keep the folder where it is: the browser loads tabcat from it.

### Updating

Download the new release, replace the contents of your `tabcat` folder with it, and press **Reload** on tabcat
in `chrome://extensions`. Your groups and settings stay as they are.

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

**Change your mind.** <kbd>Ctrl</kbd>+<kbd>Z</kbd> undoes deleting, moving, saving and closing duplicates,
in every open dashboard.

**Make it yours.** Light and dark themes, accent colours, and 8 languages
(English, 한국어, 日本語, 简体中文, Deutsch, Español, Français, Português).
Install the dashboard as an app to give it a window of its own.

## Your data

Everything stays in your browser, kept by the extension. There's no account and no server:
the dashboard is a static page that only reads and edits what the extension holds.
You can export it to a file, and import it again, in Settings.

## Questions and problems

Found a bug or have an idea? Tell us in [Issues](https://github.com/nda111/tabcat/issues).
Every shortcut and gesture is in **Help** on the dashboard.

If you'd like to look under the hood or change tabcat, see [docs/development.md](docs/development.md).

## License

tabcat is free and open source under the [MIT License](LICENSE).
The bundled Pretendard font is under the SIL Open Font License 1.1.
