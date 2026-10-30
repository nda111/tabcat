// Deutsch
const a = (stem) => ({ m: `${stem}er`, f: `${stem}e`, n: `${stem}es` }); // strong adjective endings (no article)

export default {
  'type.workspace': 'Arbeitsbereich', 'type.category': 'Kategorie', 'type.group': 'Gruppe', 'type.folder': 'Ordner', 'type.link': 'Link',
  'def.category': 'Allgemein',
  'name.window': 'Fenster {date}',
  'name.untitled': '(ohne Titel)',

  'noext.title': 'tabcat-Erweiterung nicht gefunden',
  'noext.need': 'Dieses Dashboard braucht die Browsererweiterung tabcat.',
  'noext.step1.html': 'Öffne <code>chrome://extensions</code>, aktiviere den <b>Entwicklermodus</b>, klicke auf <b>Entpackte Erweiterung laden</b> und wähle eine Kopie des <a href="https://github.com/nda111/tabcat">tabcat-Repositorys</a> (Branch <code>main</code>).',
  'noext.step2.html': 'Prüfe, dass der Ursprung dieser Seite (<code id="no-ext-origin"></code>) in <code>content_scripts.matches</code> und <code>web_accessible_resources.matches</code> der <code>manifest.json</code> der Erweiterung steht.',
  'noext.step3': 'Lade diese Seite neu.',
  'noext.retry': 'Erneut versuchen',
  'noext.old': 'Die tabcat-Erweiterung ({version}) ist älter, als dieses Dashboard braucht ({min}): Lade sie neu oder aktualisiere sie.',

  'side.workspaces': 'Arbeitsbereiche', 'side.info': 'Info', 'side.help': 'Hilfe', 'side.settings': 'Einstellungen',
  'panel.expandWs': 'Arbeitsbereiche ausklappen', 'panel.collapseWs': 'Arbeitsbereiche einklappen',
  'panel.expandTabs': 'Offene Tabs ausklappen', 'panel.collapseTabs': 'Offene Tabs einklappen',
  'tabs.title': 'Offene Tabs',
  'tabs.suspendShort': 'Pausieren', 'tabs.dedupeShort': 'Duplikate', 'tabs.dedupeTip': 'Doppelte Tabs schließen',
  'win.this': 'Dieses Fenster', 'win.other': 'Das andere Fenster', 'win.nth': 'Anderes Fenster {n}',
  'win.saveThis': 'Dieses Fenster speichern', 'win.save': 'Fenster speichern', 'win.suspend': 'Inaktive Tabs pausieren', 'win.close': 'Fenster schließen',
  'win.closeThis': 'Dieses Fenster schließen?', 'win.closeOther': 'Das andere Fenster schließen?', 'win.closeNth': 'Anderes Fenster {n} schließen?',
  'win.alsoTabs': { one: 'Dabei wird auch sein Tab geschlossen.', other: 'Dabei werden auch seine {n} Tabs geschlossen.' },
  'win.alsoDash': 'Dabei wird auch dieses Dashboard geschlossen.',
  'win.alsoBoth': { one: 'Dabei werden auch sein Tab und dieses Dashboard geschlossen.', other: 'Dabei werden auch seine {n} Tabs und dieses Dashboard geschlossen.' },
  'tab.suspended': 'Pausiert', 'tab.active': 'Aktiver Tab', 'tab.save': 'Tab speichern', 'tab.close': 'Tab schließen',
  'count.tabs': { one: '{n} Tab', other: '{n} Tabs' },
  'count.windows': { one: '{n} Fenster', other: '{n} Fenster' },
  'count.suspended': '{n} pausiert',
  'count.duplicates': { one: '{n} Duplikat', other: '{n} Duplikate' },
  'tabs.saveGroup': { one: 'Tab in neuer Gruppe speichern', other: '{n} Tabs in neuer Gruppe speichern' },
  'tabs.suspend': { one: 'Tab pausieren', other: '{n} Tabs pausieren' },
  'tabs.close': { one: 'Tab schließen', other: '{n} Tabs schließen' },
  'tabs.moveWindow': 'In neues Fenster verschieben',

  'head.none': 'Kein Arbeitsbereich',
  'cols.title': 'Spalten', 'cols.fewer': 'Weniger Spalten', 'cols.more': 'Mehr Spalten', 'cols.scroll': 'Scrollen, um die Spaltenzahl zu ändern',
  'board.noWs': 'Noch kein Arbeitsbereich.', 'board.createWs': 'Arbeitsbereich erstellen',
  'board.noCats': 'Dieser Arbeitsbereich hat keine Kategorien.', 'board.createCat': 'Kategorie erstellen',
  'note.placeholder': 'Markdown-Notiz…  (Strg+Enter zum Speichern)', 'note.clickTip': 'Klicken, um die Notiz zu bearbeiten',
  'act.expand': 'Ausklappen', 'act.collapse': 'Einklappen', 'act.addLink': 'Link hinzufügen', 'act.addFolder': 'Ordner hinzufügen',
  'act.addSubfolder': 'Unterordner hinzufügen', 'act.editNote': 'Notiz bearbeiten', 'act.openAll': 'Alle öffnen', 'act.more': 'Mehr',
  'act.edit': 'Bearbeiten', 'act.editFolder': 'Ordner bearbeiten',

  'menu.openAll': 'Alle öffnen ({n})', 'menu.openAllWindow': 'Alle in neuem Fenster öffnen', 'menu.delete': 'Löschen', 'menu.edit': 'Bearbeiten…',
  'menu.export': 'Exportieren…', 'menu.addWindowTabs': 'Alle Tabs dieses Fensters hinzufügen', 'menu.sortName': 'Links nach Name sortieren',
  'menu.dedupe': 'Doppelte Links entfernen', 'menu.open': 'Öffnen', 'menu.openWindow': 'In neuem Fenster öffnen', 'menu.copyUrl': 'URL kopieren',
  'menu.copyUrls': 'URLs kopieren', 'menu.clearSel': 'Auswahl aufheben',
  'menu.openLinks': { one: '{n} Link öffnen', other: '{n} Links öffnen' },
  'menu.deleteItems': { one: '{n} Element löschen', other: '{n} Elemente löschen' },
  'menu.deleteGroups': { one: '{n} Gruppe löschen', other: '{n} Gruppen löschen' },

  'search.aria': 'Suchen (Strg+F)', 'search.placeholder': 'Links, Gruppen, Ordner, Notizen suchen…',
  'search.links': 'Links · {n}', 'search.containers': 'Arbeitsbereiche, Gruppen und Ordner · {n}', 'search.none': 'Keine Ergebnisse.',
  'search.foot': '↑↓ bewegen · Enter öffnen · Strg+Enter Hintergrund-Tab · Esc schließen',

  'common.cancel': 'Abbrechen', 'common.save': 'Speichern', 'common.close': 'Schließen', 'common.ok': 'OK', 'common.undo': 'Rückgängig',
  'new.workspace': 'Neuer Arbeitsbereich', 'new.category': 'Neue Kategorie', 'new.group': 'Neue Gruppe', 'new.folder': 'Neuer Ordner', 'new.link': 'Neuer Link',
  'edit.workspace': 'Arbeitsbereich bearbeiten', 'edit.category': 'Kategorie bearbeiten', 'edit.group': 'Gruppe bearbeiten', 'edit.folder': 'Ordner bearbeiten', 'edit.link': 'Link bearbeiten',
  'field.name': 'Name', 'field.symbol': 'Symbol', 'field.description': 'Beschreibung', 'field.note': 'Notiz (Markdown)', 'field.color': 'Farbe', 'color.none': 'Standard',
  'field.url': 'URL', 'field.icon': 'Symbolbild', 'field.symbolHint': '{label} (Emoji, Buchstabe oder Ziffer, optional)',
  'field.ctrlEnter': 'Strg+Enter zum Speichern',
  'icon.placeholder': 'Bild-URL oder Datei hochladen. Leer: Favicon der Website', 'icon.bad': 'Das Bild konnte nicht gelesen werden.',
  'icon.upload': 'Hochladen', 'icon.clear': 'Leeren',
  'err.urlRequired': 'Die URL ist erforderlich.', 'err.urlInvalid': 'Die URL ist ungültig.', 'err.nameRequired': 'Der Name ist erforderlich.', 'err.groupClash': 'Es gibt schon eine Gruppe mit diesem Namen und Symbol.',
  'err.symbol': 'Das Symbol muss ein Emoji, ein Buchstabe oder eine Ziffer sein.',
  'emoji.search': 'Emoji suchen (auf Englisch) oder Buchstaben / Ziffer eingeben', 'emoji.remove': 'Symbol entfernen', 'emoji.letter': 'Buchstabe {c}',
  'emoji.none': 'Keine Emojis gefunden.', 'emoji.offline': 'Die Emoji-Liste konnte nicht geladen werden (offline?). Du kannst trotzdem ein Emoji in das Feld einfügen.',
  'del.workspace': 'Arbeitsbereich „{name}“ löschen?', 'del.category': 'Kategorie „{name}“ löschen?', 'del.group': 'Gruppe „{name}“ löschen?',
  'del.folder': 'Ordner „{name}“ löschen?', 'del.link': 'Link „{name}“ löschen?',
  'del.links': { one: 'Sein Link wird ebenfalls gelöscht.', other: 'Seine {n} Links werden ebenfalls gelöscht.' },
  'del.groups': { one: '{n} Gruppe löschen?', other: '{n} Gruppen löschen?' },
  'del.groupsLinks': { one: 'Ihr Link wird ebenfalls gelöscht.', other: 'Ihre {n} Links werden ebenfalls gelöscht.' },
  'open.many': '{n} Tabs öffnen?', 'open.all': 'Alle öffnen',
  'merge.title': '„{from}“ mit „{into}“ zusammenführen?',
  'merge.text': { one: 'Sein Link, Ordner und Notiz wandern nach „{into}“, danach wird „{from}“ entfernt.', other: 'Seine {n} Links, Ordner und Notiz wandern nach „{into}“, danach wird „{from}“ entfernt.' },
  'merge.ok': 'Zusammenführen',
  'picker.all': 'Alle auswählen', 'picker.none': 'Keine', 'picker.count': '{n} von {total} ausgewählt', 'picker.toggle': 'Aus- / einklappen',
  'export.title': 'Daten exportieren', 'export.ok': 'Exportieren', 'import.title': 'Aus {file} importieren', 'import.ok': 'Importieren',

  'toast.deleted': '„{name}“ gelöscht',
  'toast.deletedGroups': { one: '{n} Gruppe gelöscht', other: '{n} Gruppen gelöscht' },
  'toast.deletedItems': { one: '{n} Element gelöscht', other: '{n} Elemente gelöscht' },
  'toast.suspended': { one: '{n} Tab pausiert', other: '{n} Tabs pausiert' },
  'toast.closedDupes': { one: '{n} doppelter Tab geschlossen', other: '{n} doppelte Tabs geschlossen' },
  'toast.removedDupes': { one: '{n} doppelter Link entfernt', other: '{n} doppelte Links entfernt' },
  'toast.copiedUrls': { one: '{n} URL kopiert', other: '{n} URLs kopiert' },
  'toast.imported': { one: '{n} Arbeitsbereich importiert', other: '{n} Arbeitsbereiche importiert' },
  'toast.needCategory': 'Erstelle zuerst eine Kategorie', 'toast.urlCopied': 'URL kopiert',
  'toast.windowSaved': 'Fenster als neue Gruppe gespeichert', 'toast.nothingToSave': 'Nichts zu speichern',
  'toast.merged': 'Mit „{name}“ zusammengeführt', 'toast.dropFailed': 'Ablegen fehlgeschlagen: {error}',
  'toast.importFailed': 'Import fehlgeschlagen: {error}', 'toast.settingsImported': 'Einstellungen importiert',
  'err.notJson': 'keine JSON-Datei', 'err.noWorkspaces': 'keine Arbeitsbereiche gefunden',
  'err.notSettings': 'keine tabcat-Einstellungsdatei', 'err.noSettings': 'keine gültigen Einstellungen gefunden',

  'settings.title': 'Einstellungen', 'settings.general': 'Allgemein', 'settings.closeOnSave': 'Tabs nach dem Speichern schließen', 'settings.groupTabs': 'Tabs beim Öffnen aller gruppieren',
  'settings.autoSuspend': 'Inaktive Tabs automatisch pausieren nach (Minuten, 0 = aus)', 'settings.columns': 'Spalten im Board (1–7)',
  'settings.language': 'Sprache', 'settings.langAuto': 'Browsersprache',
  'settings.appearance': 'Darstellung', 'settings.theme': 'Design', 'settings.color': 'Farbe',
  'theme.auto': 'System', 'theme.light': 'Hell', 'theme.dark': 'Dunkel',
  'accent.red': 'Rot', 'accent.orange': 'Orange', 'accent.yellow': 'Gelb', 'accent.lime': 'Limette', 'accent.green': 'Grün',
  'accent.teal': 'Petrol', 'accent.sky': 'Himmelblau', 'accent.blue': 'Blau', 'accent.purple': 'Lila', 'accent.pink': 'Pink',
  'settings.data': 'Daten', 'data.export': 'Daten exportieren…', 'data.import': 'Daten importieren…',
  'data.exportSettings': 'Einstellungen exportieren', 'data.importSettings': 'Einstellungen importieren', 'data.resetSettings': 'Einstellungen zurücksetzen', 'reset.title': 'Alle Einstellungen zurücksetzen?', 'reset.text': 'Sprache, Design, Farbe, Spalten und die übrigen Optionen werden auf die Standardwerte gesetzt. Arbeitsbereiche, Gruppen und Links werden nicht zurückgesetzt.', 'reset.ok': 'Zurücksetzen', 'toast.settingsReset': 'Einstellungen zurückgesetzt',
  'data.note': 'Beim Import kommen die gewählten Elemente als neue Arbeitsbereiche hinzu; nichts wird überschrieben. Einstellungsdateien enthalten die Optionen oben (nicht die Dashboard-Adresse).',
  'settings.shortcuts': 'Tastenkürzel',
  'settings.keys.html': '<kbd>Strg+F</kbd> suchen · <kbd>Alt+Shift+S</kbd> Tab speichern · <kbd>Alt+Shift+A</kbd> Fenster speichern · <kbd>Alt+Shift+D</kbd> Dashboard öffnen · ändern unter <a href="chrome://extensions/shortcuts" id="shortcuts-link"><code>chrome://extensions/shortcuts</code></a>',
  'settings.done': 'Fertig',

  'help.title': 'Hilfe', 'info.title': 'Info', 'info.extension': 'Erweiterung', 'info.minimum': 'Benötigte Erweiterung', 'info.dashboard': 'Dashboard', 'info.source': 'Quellcode', 'info.issues': 'Problem melden', 'info.notConnected': 'nicht verbunden',
  'help.org.html': `<h4>Wie alles geordnet ist</h4>
<p><b>Arbeitsbereich</b> › <b>Kategorie</b> › <b>Gruppe</b> › <b>Ordner</b> (bis zu 4 Ebenen) und <b>Link</b>.
Wähle links einen Arbeitsbereich und in der Leiste über dem Board eine Kategorie; die Karten auf dem Board sind die Gruppen.</p>`,
  'help.saving.html': `<h4>Tabs speichern</h4>
<ul>
<li>Ziehe einen Tab aus <b>Offene Tabs</b> auf eine Gruppe, einen Ordner oder zwischen Links. Mit <kbd>Shift</kbd>-Klick oder <kbd>Shift</kbd>-Ziehen wählst du mehrere Tabs (auch fensterübergreifend); ziehe einen davon, um alle mitzunehmen, oder klicke rechts für Speichern / Pausieren / In neues Fenster verschieben / Schließen.</li>
<li>Ziehe die Kopfzeile eines Fensters, um alle seine Tabs zu speichern; lege sie in die Lücke zwischen Gruppen oder unter eine Spalte, um eine neue Gruppe anzulegen.</li>
<li>Symbolleisten-Schaltfläche: Benenne den Tab um und wähle unter <b>Speichern in</b> eine Gruppe oder einen Ordner.</li>
<li>Gespeicherte Tabs werden geschlossen, wenn <i>Tabs nach dem Speichern schließen</i> aktiv ist (Einstellungen).</li>
</ul>`,
  'help.board.html': `<h4>Das Board</h4>
<ul>
<li>Gruppen stapeln sich in Spalten; die Spaltenzahl stellst du in der Kategorieleiste und in den Einstellungen ein.</li>
<li>Ziehe eine Gruppe an ihrer Kopfzeile: Lege sie auf die obere oder untere Kante einer Karte, in eine Lücke oder unter eine Spalte, um sie dort zu platzieren; lege sie mitten auf eine andere Gruppe, um beide zusammenzuführen.</li>
<li>Fahre über eine Lücke zwischen Gruppen und klicke auf die Linie, oder fahre unter eine Spalte, um dort eine Gruppe hinzuzufügen.</li>
<li>Klicke auf eine freie Stelle der Kopfzeile, um eine Gruppe ein- oder auszuklappen; doppelklicke auf ihren Namen, um ihn zu bearbeiten.</li>
</ul>`,
  'help.select.html': `<h4>Gruppen auswählen</h4>
<ul>
<li>Ziehe einen Rahmen über eine freie Stelle des Boards, oder <kbd>Strg</kbd>/<kbd>⌘</kbd>-klicke auf eine Kopfzeile. <kbd>Shift</kbd> kehrt um, <kbd>Strg</kbd>/<kbd>⌘</kbd> fügt hinzu.</li>
<li>Solange Gruppen ausgewählt sind, wählen Klicks aus, statt Links zu öffnen. Ziehe eine, um alle zu verschieben; <kbd>Entf</kbd> löscht sie; <kbd>Esc</kbd> hebt die Auswahl auf.</li>
<li>Links und Ordner: <kbd>Shift</kbd>-Klick wählt aus; die Auswahl bleibt in der Gruppe des ersten Elements. Ein Rechtsklick auf ein ausgewähltes Element bietet Aktionen für alle.</li>
<li><kbd>Shift</kbd>-Ziehen eines Rahmens überall: Über zwei oder mehr Gruppen, eine Kopfzeile oder den Großteil einer Gruppe wählt er Gruppen; innerhalb einer Gruppe wählt er deren Links und Ordner.</li>
</ul>`,
  'help.notes.html': `<h4>Notizen und Symbole</h4>
<ul>
<li>Gruppennotizen sind Markdown mit Aufgaben-Kontrollkästchen und Mathematik: <code>$…$</code> oder <code>\\(…\\)</code> im Text, <code>$$…$$</code> oder <code>\\[…\\]</code> abgesetzt, und LaTeX-Umgebungen wie <code>\\begin{align}…\\end{align}</code> oder <code>\\begin{pmatrix}…\\end{pmatrix}</code>.</li>
<li>Ein Symbol ist ein Emoji, ein Buchstabe oder eine Ziffer; im Editor suchst du Emojis nach ihrem (englischen) Namen.</li>
</ul>`,
  'help.memory.html': `<h4>Arbeitsspeicher</h4>
<ul>
<li><b>Pausieren</b> entlädt inaktive Tabs (beim Öffnen laden sie neu); <b>Duplikate</b> schließt doppelte Tabs.</li>
<li>Automatisches Pausieren nach N Minuten Leerlauf findest du in den Einstellungen.</li>
</ul>`,
  'help.keys.html': `<h4>Tastenkürzel</h4>
<table class="keys">
<tr><td><kbd>Strg</kbd>+<kbd>F</kbd></td><td>Suchen</td></tr>
<tr><td><kbd>?</kbd></td><td>Diese Anleitung</td></tr>
<tr><td><kbd>Entf</kbd> · <kbd>Esc</kbd></td><td>Ausgewählte Gruppen löschen / Auswahl aufheben</td></tr>
<tr><td><kbd>Strg</kbd>+<kbd>Enter</kbd></td><td>Notiz oder Editor speichern</td></tr>
<tr><td>Buchstabe im Menü</td><td>Führt diesen Eintrag des Rechtsklick- / ⋯-Menüs aus (z. B. <kbd>D</kbd> löschen, <kbd>E</kbd> bearbeiten)</td></tr>
<tr><td><kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd> / <kbd>A</kbd></td><td>Diesen Tab / dieses Fenster speichern (überall)</td></tr>
<tr><td><kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>D</kbd></td><td>Dashboard öffnen (überall)</td></tr>
</table>`,
  'help.data.html': `<h4>Deine Daten</h4>
<p>Die Erweiterung speichert alles in diesem Browser, nie auf einem Server. Exportieren / importieren kannst du sie (oder nur deine Einstellungen) in den Einstellungen.</p>`,

  names: {
    adjectives: [a('Still'), a('Golden'), a('Neugierig'), a('Flink'), a('Sanft'), a('Silbern'), a('Sonnig'), a('Heiter'),
      a('Klug'), a('Leis'), a('Munter'), a('Neblig'), a('Glücklich'), a('Kühn'), a('Ruhig'), a('Warm')],
    nouns: [['Otter', 'm'], ['Ahorn', 'm'], ['Komet', 'm'], ['Kiesel', 'm'], ['Hafen', 'm'], ['Wiese', 'f'], ['Laterne', 'f'], ['Falke', 'm'],
      ['Weide', 'f'], ['Glut', 'f'], ['Schlucht', 'f'], ['Farn', 'm'], ['Kätzchen', 'n'], ['Keks', 'm'], ['Brise', 'f'], ['Eichhörnchen', 'n']],
  },
};
