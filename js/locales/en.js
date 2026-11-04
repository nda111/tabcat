// English: the source text, and the fallback for any key another language lacks.
export default {
  // the names of things
  'type.workspace': 'Workspace', 'type.category': 'Category', 'type.group': 'Group', 'type.folder': 'Folder', 'type.link': 'Link',
  'def.category': 'General',
  'name.window': 'Window {date}',
  'name.untitled': '(untitled)',

  // page: no extension
  'noext.title': 'tabcat extension not found.',
  'noext.need': 'tabcat works together with a browser extension.',
  'noext.store.html': 'Install <a href="https://chromewebstore.google.com/detail/tabcat/ojkddimicblompbmfelkfocpgmeflaib" target="_blank" rel="noopener">tabcat from the Chrome Web Store</a>.',
  'noext.manual.html': 'Or install it by hand. Open <a href="chrome://extensions" data-copy>chrome://extensions</a>, turn on <b>Developer mode</b>, then click <b>Load unpacked</b> and install the <a href="https://github.com/nda111/tabcat/releases/latest"><span class="gh-mark"></span>tabcat extension</a> folder.',
  'noext.step3': 'Reload this page.',
  'noext.retry': 'Retry', 'elsewhere.title': 'tabcat is connected to your server.', 'elsewhere.text': 'Your tabcat is on {server} now. To use it here instead, disconnect from the server in the menu of tabcat’s toolbar button.', 'elsewhere.open': 'Open {host}', 'noext.connect': 'Right-click tabcat’s toolbar button and connect to the server.', 'noext.serverTitle': 'Not connected to your tabcat server.', 'settings.account': 'Account', 'account.manage': 'Your account', 'account.admin': 'Server admin', 'account.signOut': 'Sign out', 'account.roleAdmin': 'Admin', 'account.roleUser': 'User', 'account.switch': 'Switch account', 'account.signOutOf': 'Sign out of {name}', 'account.add': 'Add another account', 'account.full': 'Up to {n} accounts. Sign out of one to add another.', 'account.switchFailed': 'Couldn’t switch accounts.', 'account.expiredSwitched': 'Your sign-in to the account in use ended: you’re now {name}.',
  'noext.copied': 'Address copied. Paste it into a new tab’s address bar.',
  'boot.loading': 'Loading…',
  'browser.title': 'This browser isn’t supported.',
  'browser.need': 'tabcat is a Chrome extension.\nIt works in desktop Chromium browsers that can install Chrome extensions, such as Chrome, Edge, Brave, Whale, Opera and Vivaldi.\nIt can’t be used in phone or tablet browsers, Samsung Internet, Firefox, Safari and the like.',
  'browser.open': 'Please use tabcat in a supported browser.',
  'noext.old': 'The tabcat extension ({version}) is older than this dashboard needs ({min}): reload or update it.',

  // side panels
  'side.workspaces': 'Workspaces', 'side.info': 'About', 'side.help': 'Help', 'side.settings': 'Settings',
  'side.install': 'Install app', 'install.hide': 'Hide (Settings can show it again)', 'settings.installSide': 'Show in sidebar', 'settings.app': 'App', 'toast.installed': 'Installed tabcat as an app',
  'help.sample': 'Add sample workspaces', 'help.tour': 'Take the tour', 'tour.skip': 'Skip', 'tour.prev': 'Back', 'tour.next': 'Next', 'tour.done': 'Done', 'tour.count': '{i} of {n}',
  'tour.offer.title': 'Take a quick tour of tabcat?', 'tour.offer.text': 'A minute, step by step, through the main parts. You can also start it later from Help.', 'tour.offer.ok': 'Take the tour', 'tour.offer.later': 'Later',
  'tour.welcome.title': 'Hello {logo}', 'tour.welcome.text': 'Save tabs as links in groups, and open them again whenever you need them.',
  'tour.workspaces.title': 'Workspaces', 'tour.workspaces.text': 'The biggest boxes. Split your work up, say work and study. Drag to reorder.',
  'tour.tabs.title': 'Open tabs', 'tour.tabs.text': 'Your open windows and tabs. {icon:save} Save a window, {icon:suspend} put tabs to sleep or {icon:dedupe} tidy up duplicates.',
  'tour.categories.title': 'Categories', 'tour.categories.text': 'Topics inside a workspace. Each category holds its own groups.',
  'tour.groups.title': 'Groups', 'tour.groups.text': 'Cards holding links and folders. Make them your own and drag them where you like.',
  'tour.search.title': 'Search', 'tour.search.text': 'Search links, folders, groups and more, from anywhere. Ctrl+F opens it.',
  'tour.install.title': 'Install app', 'tour.install.text': 'Try tabcat as an app.',
  'tour.more.title': 'Settings and help', 'tour.more.text': 'Language, theme and colours in {icon:settings} Settings; every shortcut in {icon:help} Help.',
  'tour.tour.title': 'Tour', 'tour.tour.text': 'You can start this tour again from {icon:help} Help at any time.',
  'tour.shortcut.title': 'Always at hand', 'tour.shortcut.text': 'Press Ctrl+Shift+X to see the dashboard any time. Press it again to go back to your tab.',
  'tour.bye.title': 'Let\'s get along. 😸', 'tour.bye.text': 'Keep as many tabs open as you like. tabcat will help you keep them tidy.',
  'panel.expandWs': 'Expand workspaces', 'panel.collapseWs': 'Collapse workspaces',
  'panel.expandTabs': 'Expand open tabs', 'panel.collapseTabs': 'Collapse open tabs',
  'tabs.title': 'Open tabs',
  'tabs.suspendShort': 'Suspend', 'tabs.dedupeShort': 'Dedupe', 'tabs.dedupeTip': 'Close duplicate tabs',
  'time.justNow': 'just now', 'menu.setDefault': 'Make it the default group', 'menu.unsetDefault': 'Stop it being the default group', 'settings.fontSize': 'Text size', 'settings.fontSample': 'This is how text will look.', 'settings.fs0': 'Smallest', 'settings.fs1': 'Small', 'settings.fs2': 'Normal', 'settings.fs3': 'Large', 'settings.fs4': 'Largest', 'settings.saving': 'Saving', 'settings.tabsGroup': 'Tabs', 'settings.defaultGroup': 'Default group', 'settings.defaultGroupNone': 'The last one used', 'toast.defaultGroup': '“{name}” is the default group now: the toolbar and right-click menus save there', 'toast.defaultGroupOff': 'No default group: saving goes to the last one used', 'remote.title': 'On your other devices', 'remote.device': 'Another device', 'remote.rename': 'Rename', 'remote.hide': 'Hide', 'remote.signOut': 'Sign out', 'remote.signOutTitle': 'Sign out', 'remote.signOutText': 'Signs out on {name}.', 'remote.signOutFailed': 'Couldn’t sign out there. Try again.', 'remote.signedOut': 'Signed out on {name}', 'remote.list': 'List', 'remote.listNote': 'Drag a handle to put them in order; untick one to hide it.', 'remote.reorder': 'Drag to reorder', 'toast.renamedDevice': 'Renamed the device “{name}”', 'undo.renameDevice': 'Undid renaming the device', 'redo.renameDevice': 'Redid renaming the device', 'remote.window': 'Window {n}',
  'win.this': 'This window', 'win.other': 'The other window', 'win.nth': 'Other window {n}',
  'win.saveThis': 'Save this window', 'win.save': 'Save window', 'win.suspend': 'Suspend other tabs', 'win.close': 'Close window',
  'win.closeThis': 'Close this window?', 'win.closeOther': 'Close the other window?', 'win.closeNth': 'Close other window {n}?',
  'win.alsoTabs': { one: 'This also closes its {n} tab.', other: 'This also closes its {n} tabs.' },
  'win.alsoDash': 'This also closes this dashboard.',
  'win.alsoBoth': { one: 'This also closes its {n} tab and this dashboard.', other: 'This also closes its {n} tabs and this dashboard.' },
  'tab.suspended': 'Suspended', 'tab.active': 'Active tab', 'tab.save': 'Save tab', 'tab.close': 'Close tab',
  'count.tabs': { one: '{n} tab', other: '{n} tabs' },
  'count.windows': { one: '{n} window', other: '{n} windows' },
  'count.suspended': '{n} suspended',
  'count.duplicates': { one: '{n} duplicate', other: '{n} duplicates' },
  'tabs.saveGroup': { one: 'Save tab to a new group', other: 'Save {n} tabs to a new group' },
  'tabs.suspend': { one: 'Suspend tab', other: 'Suspend {n} tabs' }, 'tabs.wake': { one: 'Resume tab', other: 'Resume {n} tabs' }, 'tab.wake': 'Resume', 'toast.woken': { one: 'Resumed {n} tab', other: 'Resumed {n} tabs' },
  'tabs.close': { one: 'Close tab', other: 'Close {n} tabs' },
  'tabs.moveWindow': 'Move to a new window',

  // board
  'head.none': 'No workspace',
  'cols.title': 'Columns', 'cols.fewer': 'Fewer columns', 'cols.more': 'More columns', 'cols.scroll': 'Scroll to change the column count',
  'board.noWs': 'No workspace yet.', 'board.createWs': 'Create workspace',
  'board.noCats': 'This workspace has no categories.', 'board.createCat': 'Create category',
  'note.placeholder': 'Markdown note…  (Ctrl+Enter to save)', 'note.clickTip': 'Click to edit note',
  'act.expand': 'Expand', 'act.collapse': 'Collapse', 'act.addLink': 'Add link', 'act.addFolder': 'Add folder',
  'act.addSubfolder': 'Add subfolder', 'act.editNote': 'Edit note', 'act.openAll': 'Open all', 'act.more': 'More',
  'act.edit': 'Edit', 'act.editFolder': 'Edit folder',

  // menus
  'menu.openAll': 'Open all ({n})', 'menu.openAllWindow': 'Open all in new window', 'menu.delete': 'Delete', 'menu.edit': 'Edit…',
  'menu.export': 'Export…', 'menu.addWindowTabs': 'Add all tabs of this window', 'menu.sortName': 'Sort by name',
  'menu.dedupe': 'Remove duplicate links', 'menu.open': 'Open', 'menu.openWindow': 'Open in new window', 'menu.copyUrl': 'Copy URL',
  'menu.copyUrls': 'Copy URLs', 'menu.clearSel': 'Clear selection',
  'menu.openLinks': { one: 'Open {n} link', other: 'Open {n} links' },
  'menu.deleteItems': { one: 'Delete {n} item', other: 'Delete {n} items' },
  'menu.deleteGroups': { one: 'Delete {n} group', other: 'Delete {n} groups' },

  // search
  'search.aria': 'Search (Ctrl+F)', 'search.placeholder': 'Search links, groups, folders, notes…',
  'search.links': 'Links · {n}', 'search.containers': 'Workspaces, groups & folders · {n}', 'search.none': 'No results.',
  'search.foot': '↑↓ move · Enter open · Ctrl+Enter background tab · Esc close',

  // dialogs
  'common.cancel': 'Cancel', 'common.save': 'Save', 'common.close': 'Close', 'common.ok': 'OK', 'common.undo': 'Undo',
  'new.workspace': 'New workspace', 'new.category': 'New category', 'new.group': 'New group', 'new.folder': 'New folder', 'new.link': 'New link',
  'edit.workspace': 'Edit workspace', 'edit.category': 'Edit category', 'edit.group': 'Edit group', 'edit.folder': 'Edit folder', 'edit.link': 'Edit link',
  'field.name': 'Name', 'field.symbol': 'Symbol', 'field.description': 'Description', 'field.note': 'Note (markdown)', 'field.color': 'Color', 'color.none': 'Default',
  'field.url': 'URL', 'field.icon': 'Icon', 'field.symbolHint': '{label} (emoji, letter or digit, optional)',
  'field.ctrlEnter': 'Ctrl+Enter to save',
  'icon.placeholder': 'Image URL, or upload a file. Empty: site favicon', 'icon.bad': 'Could not read that image.',
  'icon.upload': 'Upload', 'icon.clear': 'Clear',
  'err.urlRequired': 'URL is required.', 'err.urlInvalid': 'URL is not valid.', 'err.nameRequired': 'Name is required.', 'err.groupClash': 'A group with this name and symbol already exists.',
  'err.symbol': 'Symbol must be one emoji, letter or digit.',
  'emoji.search': 'Search emoji, or type a letter / digit', 'emoji.remove': 'Remove symbol', 'emoji.letter': 'Letter {c}',
  'emoji.none': 'No emoji found.', 'emoji.offline': 'Could not load the emoji list (offline?). You can still paste an emoji into the box.',
  'del.workspace': 'Delete workspace “{name}”?', 'del.category': 'Delete category “{name}”?', 'del.group': 'Delete group “{name}”?',
  'del.folder': 'Delete folder “{name}”?', 'del.link': 'Delete link “{name}”?',
  'del.links': { one: 'Its {n} link will be deleted too.', other: 'Its {n} links will be deleted too.' },
  'del.groups': { one: 'Delete {n} group?', other: 'Delete {n} groups?' },
  'del.groupsLinks': { one: 'Their {n} link will be deleted too.', other: 'Their {n} links will be deleted too.' },
  'open.many': 'Open {n} tabs?', 'open.all': 'Open all',
  'merge.title': 'Merge “{from}” into “{into}”?',
  'merge.text': { one: 'Its {n} link, folders and note move to “{into}”, then “{from}” is removed.', other: 'Its {n} links, folders and note move to “{into}”, then “{from}” is removed.' },
  'merge.ok': 'Merge',
  'picker.all': 'Select all', 'picker.none': 'None', 'picker.count': '{n} of {total} selected', 'picker.toggle': 'Expand / collapse',
  'export.title': 'Export data', 'export.ok': 'Export', 'import.title': 'Import from {file}', 'import.ok': 'Import',

  // toasts
  'toast.deleted': 'Deleted “{name}”',
  'toast.deletedGroups': { one: 'Deleted {n} group', other: 'Deleted {n} groups' },
  'toast.deletedItems': { one: 'Deleted {n} item', other: 'Deleted {n} items' },
  'toast.suspended': { one: 'Suspended {n} tab', other: 'Suspended {n} tabs' },
  'toast.closedDupes': { one: 'Closed {n} duplicate tab', other: 'Closed {n} duplicate tabs' },
  'toast.extReloaded': 'The tabcat extension restarted. The page reloads once you finish editing.',
  'toast.removedDupes': { one: 'Removed {n} duplicate link', other: 'Removed {n} duplicate links' },
  'toast.copiedUrls': { one: 'Copied {n} URL', other: 'Copied {n} URLs' },
  'toast.imported': { one: 'Imported {n} workspace', other: 'Imported {n} workspaces' },
  'toast.needCategory': 'Create a category first.', 'toast.urlCopied': 'URL copied',
  'toast.windowSaved': 'Window saved as a new group', 'toast.nothingToSave': 'Nothing to save',
  'toast.merged': 'Merged into “{name}”', 'toast.dropFailed': 'Drop failed: {error}',
  'toast.importFailed': 'Import failed: {error}', 'toast.settingsImported': 'Settings imported',
  'err.notJson': 'not a JSON file', 'err.noWorkspaces': 'no workspaces found',
  'err.notSettings': 'not a tabcat settings file', 'err.noSettings': 'no valid settings found',

  // settings
  'settings.title': 'Settings', 'settings.general': 'General', 'settings.closeOnSave': 'Close tabs after saving them', 'settings.groupTabs': 'Group tabs when opening all', 'settings.checkUpdates': 'Check for updates automatically',
  'settings.autoSuspend': 'Auto-suspend unused tabs after (minutes)', 'settings.off': 'Off', 'settings.columns': 'Board columns (1–8)',
  'settings.language': 'Language', 'settings.langAuto': 'Browser default',
  'settings.appearance': 'Appearance', 'settings.theme': 'Theme', 'settings.color': 'Color',
  'theme.auto': 'System', 'theme.light': 'Light', 'theme.dark': 'Dark',
  'accent.red': 'Red', 'accent.orange': 'Orange', 'accent.yellow': 'Yellow', 'accent.lime': 'Lime', 'accent.green': 'Green',
  'accent.teal': 'Teal', 'accent.sky': 'Sky', 'accent.blue': 'Blue', 'accent.purple': 'Purple', 'accent.pink': 'Pink', 'accent.mono': 'Mono',
  'settings.data': 'Data', 'data.export': 'Export data', 'data.import': 'Import data',
  'data.exportSettings': 'Export settings', 'data.importSettings': 'Import settings', 'data.resetSettings': 'Reset settings', 'reset.title': 'Reset all settings?', 'reset.text': 'Language, theme, colour, columns and the other options go back to their defaults. Workspaces, groups and links are not reset.', 'reset.ok': 'Reset', 'toast.settingsReset': 'Settings reset to their defaults', 'toast.undone': 'Undone', 'toast.redone': 'Redone',
  'noun.group': 'the group', 'noun.groupN': '{n} groups', 'noun.link': 'the link', 'noun.linkN': '{n} links', 'noun.folder': 'the folder', 'noun.folderN': '{n} folders', 'noun.item': 'the item', 'noun.itemN': '{n} items', 'noun.workspace': 'the workspace', 'noun.workspaceN': '{n} workspaces', 'noun.category': 'the category', 'noun.categoryN': '{n} categories',
  'undo.add': 'Undid adding {what}', 'redo.add': 'Redid adding {what}', 'undo.edit': 'Undid editing {what}', 'redo.edit': 'Redid editing {what}', 'undo.delete': 'Undid deleting {what}', 'redo.delete': 'Redid deleting {what}', 'undo.move': 'Undid moving {what}', 'redo.move': 'Redid moving {what}', 'undo.merge': 'Undid merging the groups', 'redo.merge': 'Redid merging the groups',
  'undo.sample': 'Undid adding the sample workspaces', 'redo.sample': 'Redid adding the sample workspaces', 'toast.sampleAdded': 'Sample workspaces added', 'toast.windowClosed': { one: 'Closed a window with {n} tab', other: 'Closed a window with {n} tabs' }, 'toast.tabsClosed': { one: 'Closed {n} tab', other: 'Closed {n} tabs' }, 'undo.import': { one: 'Undid importing {n} workspace', other: 'Undid importing {n} workspaces' }, 'redo.import': { one: 'Redid importing {n} workspace', other: 'Redid importing {n} workspaces' }, 'undo.closeDupes': 'Undid closing duplicate tabs', 'redo.closeDupes': 'Redid closing duplicate tabs', 'undo.closeTabs': { one: 'Opened {n} closed tab again', other: 'Opened {n} closed tabs again' }, 'redo.closeTabs': { one: 'Closed {n} tab again', other: 'Closed {n} tabs again' }, 'undo.closeWindow': 'Opened the closed window again', 'redo.closeWindow': 'Closed the window again', 'shortcut.missing': 'Ctrl+Shift+X isn’t set to bring up the dashboard: another extension may have it.', 'shortcut.set': 'Set shortcut', 'side.trash': 'Recently deleted', 'trash.title': 'Recently deleted', 'trash.note': 'Deleted items stay here for 30 days.', 'trash.none': 'Nothing deleted in the last 30 days.', 'trash.clear': 'Empty', 'trash.restore': 'Restore', 'trash.forget': 'Delete for good', 'trash.clearTitle': 'Empty Recently deleted?', 'trash.clearText': { one: '{n} item will be deleted for good. This can’t be undone.', other: '{n} items will be deleted for good. This can’t be undone.' }, 'trash.links': { one: '{n} link', other: '{n} links' }, 'toast.restored': 'Restored {name}', 'undo.restore': 'Undid restoring {what}', 'redo.restore': 'Restored {what} again', 'undo.dedupe': 'Undid removing duplicate links', 'redo.dedupe': 'Redid removing duplicate links',
  'undo.save': { one: 'Undid saving {n} tab', other: 'Undid saving {n} tabs' }, 'redo.save': { one: 'Redid saving {n} tab', other: 'Redid saving {n} tabs' },
  'data.note': 'Import adds the selected items as new workspaces; nothing is overwritten. Settings files hold the options above.',
  'settings.shortcuts': 'Shortcuts',
  'settings.keys.html': '<kbd>Ctrl+F</kbd> search · <kbd>Alt+Shift+S</kbd> save tab · <kbd>Alt+Shift+A</kbd> save window · <kbd>Ctrl+Shift+X</kbd> open dashboard · change at <a href="chrome://extensions/shortcuts" id="shortcuts-link"><code>chrome://extensions/shortcuts</code></a>',
  'settings.done': 'Done',

  // help
  'help.title': 'Help', 'info.title': 'About', 'info.extension': 'Extension', 'info.minimum': 'Required extension', 'info.dashboard': 'Dashboard', 'info.dashboardDate': 'Updated {date}', 'info.source': 'Source code', 'info.privacy': 'Privacy', 'info.issues': 'Report a problem', 'info.notConnected': 'not connected',
  'info.update': '{version} is out', 'info.getUpdate': 'Download', 'info.updateBadge': 'Update available', 'info.check': 'Check for updates', 'info.upToDate': 'You\'re up to date.', 'info.checkFailed': 'Couldn\'t check.',
  'help.org.html': `<h4>How things are organized</h4>
<p><b>Workspace</b> › <b>Category</b> › <b>Group</b> › <b>Folder</b> (up to 4 levels) and <b>Link</b>.
Pick a workspace on the left and a category in the bar above the board; groups are the cards on the board.</p>`,
  'help.saving.html': `<h4>Saving tabs</h4>
<ul>
<li>Drag a tab from <b>Open tabs</b> onto a group, a folder or between links. <kbd>Shift</kbd>-click or <kbd>Shift</kbd>-drag to pick several tabs (across windows), then drag one to bring them all, or right-click for Save / Suspend / Move to a new window / Close.</li>
<li>Drag a window's header to save every tab in it; drop on the gap between groups or below a column to make a new group.</li>
<li>Toolbar button: rename the tab and pick any group or folder under <b>Save to</b>.</li>
<li>Saved tabs close when <i>Close tabs after saving</i> is on (Settings).</li>
</ul>`,
  'help.board.html': `<h4>The board</h4>
<ul>
<li>Groups stack in columns; the number of columns is in the category bar and in Settings.</li>
<li>Drag a group by its header: drop on a card's top or bottom edge, a gap, or the space below a column to place it; drop on the middle of another group to merge them.</li>
<li>Hover a gap between groups and click the line, or hover below a column, to add a group there.</li>
<li>Click empty space in a group's header to collapse or expand it; double-click its name to edit.</li>
</ul>`,
  'help.select.html': `<h4>Selecting groups</h4>
<ul>
<li>Drag a box over empty board space, or <kbd>Ctrl</kbd>/<kbd>⌘</kbd>-click a header. <kbd>Shift</kbd> inverts, <kbd>Ctrl</kbd>/<kbd>⌘</kbd> adds.</li>
<li>While groups are selected, clicks select instead of opening links. Drag one to move them all; <kbd>Delete</kbd> removes them; <kbd>Esc</kbd> clears.</li>
<li>Links and folders: <kbd>Shift</kbd>-click to select; selection stays within the first item's group. Right-click a selected item for actions on all of them.</li>
<li><kbd>Shift</kbd>-drag a box anywhere: over two or more groups, a group's header or most of a group it selects groups; within one group it selects that group's links and folders.</li>
</ul>`,
  'help.notes.html': `<h4>Notes and symbols</h4>
<ul>
<li>Group notes are Markdown with task checkboxes (<code>[ ]</code>, <code>[x]</code>) and math: <code>$…$</code> or <code>\\(…\\)</code> inline, <code>$$…$$</code> or <code>\\[…\\]</code> on its own, and LaTeX environments such as <code>\\begin{align}…\\end{align}</code> or <code>\\begin{pmatrix}…\\end{pmatrix}</code>.</li>
<li>A symbol is one emoji, letter or digit, or the tabcat logo; search emoji by name (in English) in the editor.</li>
</ul>`,
  'help.memory.html': `<h4>Memory</h4>
<ul>
<li><b>Suspend</b> unloads the other tabs you aren’t looking at (they load again when opened or <b>resumed</b>); <b>Dedupe</b> closes duplicate tabs.</li>
<li>Auto-suspend after N idle minutes is in Settings.</li>
</ul>`,
  'help.keys.html': `<h4>Shortcuts</h4>
<table class="keys">
<tr><td><kbd>Ctrl</kbd>+<kbd>F</kbd></td><td>Search</td></tr>
<tr><td><kbd>Ctrl</kbd>+<kbd>Z</kbd> / <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd></td><td>Undo / redo (deleting, moving, saving, closing duplicates…)</td></tr>
<tr><td><kbd>?</kbd></td><td>This guide</td></tr>
<tr><td><kbd>Delete</kbd> · <kbd>Esc</kbd></td><td>Delete / clear selected groups</td></tr>
<tr><td><kbd>Ctrl</kbd>+<kbd>Enter</kbd></td><td>Save a note or the editor</td></tr>
<tr><td>Letter in a menu</td><td>Run that entry of a right-click / ⋯ menu (e.g. <kbd>D</kbd> delete, <kbd>E</kbd> edit)</td></tr>
<tr><td><kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd> / <kbd>A</kbd></td><td>Save this tab / window (anywhere)</td></tr>
<tr><td><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>X</kbd></td><td>Bring up the dashboard; again to go back (anywhere)</td></tr>
</table>`,
  'help.data.html': `<h4>Your data</h4>
<p>Everything is stored in this browser by the extension, never on a server. Export / import it (or just your settings) in Settings.</p>`,
  'side.mail': 'Mailbox', 'mail.title': 'Mailbox', 'mail.selectAll': 'Select all', 'mail.select': 'Select', 'mail.deleteN': 'Delete ({n})', 'mail.delete': 'Delete', 'mail.answerFirst': 'Can be deleted once answered', 'mail.none': 'No mail.', 'mail.invite': '{name} shared the workspace {ws}', 'mail.accepted': '{name} accepted your invite to {ws}', 'mail.declined': '{name} declined your invite to {ws}', 'mail.accept': 'Accept', 'mail.decline': 'Decline', 'mail.didAccept': 'Accepted', 'mail.didDecline': 'Declined', 'mail.badge': { one: '{n} invite to answer', other: '{n} invites to answer' }, 'mail.gone': 'That shared workspace no longer exists.', 'mail.answered': 'You’ve already answered this invite.', 'mail.failed': 'Couldn’t reach the server. Please try again.', 'toast.mailDeleted': { one: 'Deleted the message', other: 'Deleted {n} messages' }, 'noun.mail': 'the message', 'noun.mailN': '{n} messages', 'role.owner': 'Owner', 'role.editor': 'Editor', 'role.manager': 'Manager', 'share.demoteTitle': 'As {role}, you won’t be able to change members’ roles any more.', 'share.demoteOk': 'Change', 'share.chipInvited': 'Invited', 'role.viewer': 'Viewer', 'share.canEdit': 'Editor', 'share.chipManager': 'Manager', 'share.viewing': 'View only', 'share.readOnly': 'Viewers can’t edit the workspace.', 'share.menu': 'Share', 'share.tip': 'Share', 'share.removeAll': 'Remove everyone', 'share.removeAllTitle': 'Remove everyone from this workspace?', 'share.removeAllText': 'Only you will stay. Everyone removed is told by mail.', 'mail.removed': 'You were removed from {name}/{ws}.', 'mail.left': '{name} left {ws}.', 'mail.clear': 'Delete all', 'mail.clearTitle': 'Delete all mail?', 'mail.prev': 'Previous', 'mail.next': 'Next', 'side.shared': 'Shared with you', 'side.sharedLabel': 'Shared', 'share.share': 'Share', 'share.manage': 'Manage sharing', 'share.title': 'Share {ws}', 'share.me': '(you)', 'share.invited': 'Invited · {role}', 'share.cancelInvite': 'Cancel invite', 'share.username': 'Username', 'share.invite': 'Invite', 'share.roleOf': 'Role of {name}', 'share.role': 'Role', 'share.makeOwner': 'Make owner…', 'share.ownerTitle': 'Make {name} the owner?', 'share.ownerText': 'Handing on ownership makes you a manager.', 'share.ownerOk': 'Make owner', 'share.remove': 'Remove', 'share.removeTitle': 'Remove {name}?', 'share.removeText': 'They won’t see this workspace anymore.', 'share.deleteAll': 'Delete for everyone', 'share.deleteTitle': 'Delete “{ws}” for everyone?', 'share.deleteText': 'It’s also gone for everyone you shared it with, and they’re told by mail. Your workspace moves to Recently deleted.', 'share.leave': 'Leave workspace', 'share.leaveTitle': 'Leave “{ws}”?', 'share.leaveText': 'You can’t open this workspace again until you’re invited again.', 'share.leaveOk': 'Leave', 'share.note': 'Invite someone by their username to use this workspace together.', 'share.errNoUser': 'This account doesn’t exist or was deleted.', 'share.errSelf': 'That’s you.', 'share.errMember': 'They’re already in it.', 'share.errAsked': 'They’ve already been invited.', 'share.errFailed': 'Couldn’t send the invite. Please try again.', 'share.failed': 'Couldn’t change it. Please try again.', 'toast.shareDeleted': 'Deleted “{name}” for everyone', 'toast.shareLeft': 'Left “{name}”',

  // suggested names for new workspaces, categories, groups and folders
  names: {
    adjectives: ['Amber', 'Brisk', 'Calm', 'Cosy', 'Curious', 'Gentle', 'Golden', 'Hazy', 'Lucky', 'Mellow',
      'Misty', 'Nimble', 'Quiet', 'Rapid', 'Sunny', 'Swift', 'Tidy', 'Velvet', 'Witty', 'Bright', 'Silver', 'Cobalt', 'Coral', 'Jade'],
    nouns: ['Otter', 'Maple', 'Comet', 'Pebble', 'Harbor', 'Meadow', 'Lantern', 'Falcon', 'Willow', 'Ember',
      'Canyon', 'Fern', 'Orbit', 'Tabby', 'Whisker', 'Biscuit', 'Breeze', 'Cedar', 'Glacier', 'Puffin', 'Acorn', 'Harvest', 'Nebula', 'Lagoon'],
  },
};
