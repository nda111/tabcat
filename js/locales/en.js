// English: the source text, and the fallback for any key another language lacks.
export default {
  // the names of things
  'type.workspace': 'Workspace', 'type.category': 'Category', 'type.group': 'Group', 'type.folder': 'Folder', 'type.link': 'Link',
  'def.category': 'General',
  'name.window': 'Window {date}',
  'name.untitled': '(untitled)',

  // page: no extension
  'noext.title': 'tabcat extension not detected',
  'noext.need': 'This dashboard needs the tabcat browser extension.',
  'noext.step1.html': 'Open <code>chrome://extensions</code>, enable <b>Developer mode</b>, click <b>Load unpacked</b> and pick a checkout of the <a href="https://github.com/nda111/tabcat">tabcat repository</a> (<code>main</code> branch).',
  'noext.step2.html': 'Make sure this page\'s origin (<code id="no-ext-origin"></code>) is listed in <code>content_scripts.matches</code> and <code>web_accessible_resources.matches</code> of the extension\'s <code>manifest.json</code>.',
  'noext.step3': 'Reload this page.',
  'noext.retry': 'Retry',
  'browser.title': 'tabcat needs a Chromium-based browser',
  'browser.need': 'tabcat runs as an extension for Chromium-based browsers such as Chrome, Edge, Brave, Whale, Opera and Vivaldi, so it can’t work in this browser.',
  'browser.open': 'Open this address in a Chromium-based browser:',
  'noext.old': 'The tabcat extension ({version}) is older than this dashboard needs ({min}): reload or update it.',

  // side panels
  'side.workspaces': 'Workspaces', 'side.info': 'About', 'side.help': 'Help', 'side.settings': 'Settings',
  'panel.expandWs': 'Expand workspaces', 'panel.collapseWs': 'Collapse workspaces',
  'panel.expandTabs': 'Expand open tabs', 'panel.collapseTabs': 'Collapse open tabs',
  'tabs.title': 'Open tabs',
  'tabs.suspendShort': 'Suspend', 'tabs.dedupeShort': 'Dedupe', 'tabs.dedupeTip': 'Close duplicate tabs',
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
  'settings.title': 'Settings', 'settings.general': 'General', 'settings.closeOnSave': 'Close tabs after saving them', 'settings.groupTabs': 'Group tabs when opening all',
  'settings.autoSuspend': 'Auto-suspend unused tabs after (minutes)', 'settings.off': 'Off', 'settings.columns': 'Board columns (1–7)',
  'settings.language': 'Language', 'settings.langAuto': 'Browser default',
  'settings.appearance': 'Appearance', 'settings.theme': 'Theme', 'settings.color': 'Color',
  'theme.auto': 'System', 'theme.light': 'Light', 'theme.dark': 'Dark',
  'accent.red': 'Red', 'accent.orange': 'Orange', 'accent.yellow': 'Yellow', 'accent.lime': 'Lime', 'accent.green': 'Green',
  'accent.teal': 'Teal', 'accent.sky': 'Sky', 'accent.blue': 'Blue', 'accent.purple': 'Purple', 'accent.pink': 'Pink',
  'settings.data': 'Data', 'data.export': 'Export data…', 'data.import': 'Import data…',
  'data.exportSettings': 'Export settings', 'data.importSettings': 'Import settings', 'data.resetSettings': 'Reset settings', 'reset.title': 'Reset all settings?', 'reset.text': 'Language, theme, colour, columns and the other options go back to their defaults. Workspaces, groups and links are not reset.', 'reset.ok': 'Reset', 'toast.settingsReset': 'Settings reset to their defaults', 'toast.undone': 'Undone', 'toast.redone': 'Redone',
  'noun.group': 'the group', 'noun.groupN': '{n} groups', 'noun.link': 'the link', 'noun.linkN': '{n} links', 'noun.folder': 'the folder', 'noun.folderN': '{n} folders', 'noun.item': 'the item', 'noun.itemN': '{n} items', 'noun.workspace': 'the workspace', 'noun.workspaceN': '{n} workspaces', 'noun.category': 'the category', 'noun.categoryN': '{n} categories',
  'undo.delete': 'Undid deleting {what}', 'redo.delete': 'Redid deleting {what}', 'undo.move': 'Undid moving {what}', 'redo.move': 'Redid moving {what}', 'undo.merge': 'Undid merging the groups', 'redo.merge': 'Redid merging the groups',
  'data.note': 'Import adds the selected items as new workspaces; nothing is overwritten. Settings files hold the options above.',
  'settings.shortcuts': 'Shortcuts',
  'settings.keys.html': '<kbd>Ctrl+F</kbd> search · <kbd>Alt+Shift+S</kbd> save tab · <kbd>Alt+Shift+A</kbd> save window · <kbd>Alt+Shift+D</kbd> open dashboard · change at <a href="chrome://extensions/shortcuts" id="shortcuts-link"><code>chrome://extensions/shortcuts</code></a>',
  'settings.done': 'Done',

  // help
  'help.title': 'Help', 'info.title': 'About', 'info.extension': 'Extension', 'info.minimum': 'Required extension', 'info.source': 'Source code', 'info.issues': 'Report a problem', 'info.notConnected': 'not connected',
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
<li>Group notes are Markdown with task checkboxes and math: <code>$…$</code> or <code>\\(…\\)</code> inline, <code>$$…$$</code> or <code>\\[…\\]</code> on its own, and LaTeX environments such as <code>\\begin{align}…\\end{align}</code> or <code>\\begin{pmatrix}…\\end{pmatrix}</code>.</li>
<li>A symbol is one emoji, letter or digit; search emoji by name (in English) in the editor.</li>
</ul>`,
  'help.memory.html': `<h4>Memory</h4>
<ul>
<li><b>Suspend</b> unloads the other tabs you aren’t looking at (they load again when opened or <b>resumed</b>); <b>Dedupe</b> closes duplicate tabs.</li>
<li>Auto-suspend after N idle minutes is in Settings.</li>
</ul>`,
  'help.keys.html': `<h4>Shortcuts</h4>
<table class="keys">
<tr><td><kbd>Ctrl</kbd>+<kbd>F</kbd></td><td>Search</td></tr>
<tr><td><kbd>Ctrl</kbd>+<kbd>Z</kbd> / <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd></td><td>Undo / redo a delete or move</td></tr>
<tr><td><kbd>?</kbd></td><td>This guide</td></tr>
<tr><td><kbd>Delete</kbd> · <kbd>Esc</kbd></td><td>Delete / clear selected groups</td></tr>
<tr><td><kbd>Ctrl</kbd>+<kbd>Enter</kbd></td><td>Save a note or the editor</td></tr>
<tr><td>Letter in a menu</td><td>Run that entry of a right-click / ⋯ menu (e.g. <kbd>D</kbd> delete, <kbd>E</kbd> edit)</td></tr>
<tr><td><kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd> / <kbd>A</kbd></td><td>Save this tab / window (anywhere)</td></tr>
<tr><td><kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>D</kbd></td><td>Open the dashboard (anywhere)</td></tr>
</table>`,
  'help.data.html': `<h4>Your data</h4>
<p>Everything is stored in this browser by the extension, never on a server. Export / import it (or just your settings) in Settings.</p>`,

  // suggested names for new workspaces, categories, groups and folders
  names: {
    adjectives: ['Amber', 'Brisk', 'Calm', 'Cosy', 'Curious', 'Gentle', 'Golden', 'Hazy', 'Lucky', 'Mellow',
      'Misty', 'Nimble', 'Quiet', 'Rapid', 'Sunny', 'Swift', 'Tidy', 'Velvet', 'Witty', 'Bright', 'Silver', 'Cobalt', 'Coral', 'Jade'],
    nouns: ['Otter', 'Maple', 'Comet', 'Pebble', 'Harbor', 'Meadow', 'Lantern', 'Falcon', 'Willow', 'Ember',
      'Canyon', 'Fern', 'Orbit', 'Tabby', 'Whisker', 'Biscuit', 'Breeze', 'Cedar', 'Glacier', 'Puffin', 'Acorn', 'Harvest', 'Nebula', 'Lagoon'],
  },
};
