# Changelog

What changed in each release of tabcat. The full notes, with how to install and update, are on [GitHub Releases](https://github.com/nda111/tabcat/releases).

## 1.1.0

Your own tabcat server: your tabs in step across browsers, shared workspaces, and accounts for everyone you invite.

#### tabcat server

`tabcat-server` hosts the dashboard at an address of your own, behind sign-in. Run it on a computer of yours (pip, Docker, or a service), then choose **Connect to a server** from the toolbar button's menu.

- **Sync**: each account's groups, Recently deleted, look and settings (the default group, the text size) are kept the same in every browser signed in to it, live: a change made in one shows in the others at once. Changes made offline are kept and sent once the server is back. Which cards are open stays each browser's own.
- **Your other browsers' tabs**: the tabs open in your account's other browsers, in the order you put them, each one hidden or shown as you like.
- **Shared workspaces**: invite others to a workspace as a viewer, editor or manager; it stays in step for everyone in it. Invites, removals and leaving come as mail, in a Mailbox with a badge for what's unread.
- **Accounts**: the first visit makes the admin. Sign-up closed, by invitation or open. A name to go by beside the username, a profile photo, several accounts in one browser (up to 5) to switch between.
- **Security**: two-step sign-in (2FA) with recovery codes; the devices you're signed in on, any signed out of in two clicks; waits after wrong passwords; a security record of sign-ins and account changes, for you and for the admin (export as CSV).
- **Admin page**: users (roles, suspend, reset a password), security settings, the database file's place, Tailscale HTTPS, and a newer server release said and installed from there.
- **Pages of its own** in tabcat's look and your language, with error pages that say what went wrong.
- **Safe by default**: the server is set up only from its own computer; changes from other sites are refused; a page on this computer (localhost) links up with the extension only once you allow it, in a window of the extension's own.

#### Extension and dashboard

- **New tabs** are listed with the open tabs, and can be saved.
- **Open tabs** move where you drop them, into or out of tab groups.
- **Default group**: set it in the dashboard; the popup, the right-click menu and the shortcuts save there.
- After an update, open dashboards load again by themselves (not one you're editing in).

The dashboard changes are live already; connecting to a server needs this release.

## 1.0.4

Recently deleted, undoable closing, and scrolling that feels better.

- **Recently deleted**: what you delete stays here for 30 days, at the bottom of the sidebar. Put things back one by one (where they were, or as near as is left), delete them for good, or empty it all.
- **Closing is undoable**: <kbd>Ctrl</kbd>+<kbd>Z</kbd> brings back the tabs or window you closed from the dashboard, in their tab groups.
- **Adding and editing are undoable** too: new groups, links, folders, categories and workspaces, edits and notes.
- **Shortcut check**: if another extension took <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>X</kbd>, the dashboard says so and links to where you can set it.
- **Toolbar popup**: the groups to save to are listed in board order.
- **Scrolling**: lists give a little at their ends and spring back, and a slim scrollbar takes the accent colour under the pointer. With touch, a finger scrolls, a tap clicks, and a finger held still draws a box selection.
- Notices that didn't fit a short window now scroll.

The dashboard changes are live already; Recently deleted, undoable closing and the shortcut check need this release.

## 1.0.3

A small update, before tabcat goes to the Chrome Web Store.

- **Privacy policy opens**: the link in About used to take you back to the dashboard. Now it opens the policy.
- **Privacy policy** in all 8 languages, with a language menu, in your theme and accent colour, at [tabcat.ghyeok.com/privacy](https://tabcat.ghyeok.com/privacy).
- **About** shows when the dashboard was last updated, and asks for extension 1.0.0 or newer.

The dashboard changes are live already; the first one needs this release.

## 1.0.2

A small update, getting tabcat ready for the Chrome Web Store.

- **Chrome Web Store ready**: installed from the store, tabcat updates itself, so the dashboard stops looking for new versions here.
- **Checkbox** in the popup in your accent colour, like everywhere else.
- **Categories**: the underline slides over to the one you pick.
- **New group**: in an empty category, the grey card in the first column steps aside while another column shows its own.
- **Privacy**: what tabcat keeps, and what leaves your browser, at [tabcat.ghyeok.com/privacy](https://tabcat.ghyeok.com/privacy). About links to it.

The dashboard changes are live already; the first two need this release.

## 1.0.1

A small update: tabcat now tells you when there's a new version, and a pinned dashboard keeps its place.

- **Stays first**: pinned, the dashboard stays the window's first tab, even when you pin another tab or drag one in front of it.
- **New versions**: when one is out, a dot appears on **About**, and About links to it. Check any time with **Check for updates** in About, or turn the automatic check off in Settings.
- **Tasks in notes**: write `[ ]` at the start of a line, no `- ` needed. Ticking one animates, and the strike sweeps across the text.
- **Checkboxes** in your accent colour everywhere.
- **Tour**: it says hello now, and the buttons glide from step to step.

The dashboard changes are live already; the first one needs this release.

## 1.0.0

The first release of tabcat 🐱, a tab manager for Chromium-based browsers (Chrome, Edge, Brave, Whale, …).

- **Workspaces, categories and groups**: a board of group cards with links and nested folders, drag and drop for everything.
- **Open tabs panel**: drag a tab or a whole window into a group; open saved links, groups or folders as tabs or tab groups.
- **Light on memory**: close tabs after saving, put inactive tabs to sleep (automatically after a while, if you like), close duplicates.
- **Notes** in markdown with task checkboxes and math; search everything with `Ctrl+F`.
- **Undo and redo** across every open dashboard, including saving from the popup and closing duplicates.
- **Install as an app** for its own window, plus a short tour on first visit.
- Export and import as JSON; light and dark themes with accent colours; 8 languages.
