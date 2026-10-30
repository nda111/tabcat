// Français
const a = (m, f = m) => ({ m, f }); // adjective forms for masculine / feminine nouns

export default {
  'type.workspace': 'Espace de travail', 'type.category': 'Catégorie', 'type.group': 'Groupe', 'type.folder': 'Dossier', 'type.link': 'Lien',
  'def.category': 'Général',
  'name.window': 'Fenêtre {date}',
  'name.untitled': '(sans titre)',

  'noext.title': 'Extension tabcat introuvable',
  'noext.need': 'Ce tableau de bord nécessite l’extension de navigateur tabcat.',
  'noext.step1.html': 'Ouvrez <code>chrome://extensions</code>, activez le <b>Mode développeur</b>, cliquez sur <b>Charger l’extension non empaquetée</b> et choisissez une copie du <a href="https://github.com/nda111/tabcat">dépôt tabcat</a> (branche <code>main</code>).',
  'noext.step2.html': 'Vérifiez que l’origine de cette page (<code id="no-ext-origin"></code>) figure dans <code>content_scripts.matches</code> et <code>web_accessible_resources.matches</code> du fichier <code>manifest.json</code> de l’extension.',
  'noext.step3': 'Rechargez cette page.',
  'noext.retry': 'Réessayer',
  'noext.old': 'L’extension tabcat ({version}) est plus ancienne que ce qu’exige ce tableau de bord ({min}) : rechargez-la ou mettez-la à jour.',

  'side.workspaces': 'Espaces de travail', 'side.help': 'Aide', 'side.settings': 'Paramètres',
  'panel.expandWs': 'Déplier les espaces de travail', 'panel.collapseWs': 'Replier les espaces de travail',
  'panel.expandTabs': 'Déplier les onglets ouverts', 'panel.collapseTabs': 'Replier les onglets ouverts',
  'tabs.title': 'Onglets ouverts',
  'tabs.suspendShort': 'Suspendre', 'tabs.dedupeShort': 'Doublons', 'tabs.dedupeTip': 'Fermer les onglets en double',
  'win.this': 'Cette fenêtre', 'win.other': 'L’autre fenêtre', 'win.nth': 'Autre fenêtre {n}',
  'win.saveThis': 'Enregistrer cette fenêtre', 'win.save': 'Enregistrer la fenêtre', 'win.suspend': 'Suspendre les onglets inactifs', 'win.close': 'Fermer la fenêtre',
  'win.closeThis': 'Fermer cette fenêtre ?', 'win.closeOther': 'Fermer l’autre fenêtre ?', 'win.closeNth': 'Fermer l’autre fenêtre {n} ?',
  'win.alsoTabs': { one: 'Son onglet sera aussi fermé.', other: 'Ses {n} onglets seront aussi fermés.' },
  'win.alsoDash': 'Ce tableau de bord sera aussi fermé.',
  'win.alsoBoth': { one: 'Son onglet et ce tableau de bord seront aussi fermés.', other: 'Ses {n} onglets et ce tableau de bord seront aussi fermés.' },
  'tab.suspended': 'Suspendu', 'tab.active': 'Onglet actif', 'tab.save': 'Enregistrer l’onglet', 'tab.close': 'Fermer l’onglet',
  'count.tabs': { one: '{n} onglet', other: '{n} onglets' },
  'count.windows': { one: '{n} fenêtre', other: '{n} fenêtres' },
  'count.suspended': { one: '{n} suspendu', other: '{n} suspendus' },
  'count.duplicates': { one: '{n} doublon', other: '{n} doublons' },
  'tabs.saveGroup': { one: 'Enregistrer l’onglet dans un nouveau groupe', other: 'Enregistrer {n} onglets dans un nouveau groupe' },
  'tabs.suspend': { one: 'Suspendre l’onglet', other: 'Suspendre {n} onglets' },
  'tabs.close': { one: 'Fermer l’onglet', other: 'Fermer {n} onglets' },
  'tabs.moveWindow': 'Déplacer vers une nouvelle fenêtre',

  'head.none': 'Aucun espace de travail',
  'cols.title': 'Colonnes', 'cols.fewer': 'Moins de colonnes', 'cols.more': 'Plus de colonnes', 'cols.scroll': 'Faites défiler pour changer le nombre de colonnes',
  'board.noWs': 'Aucun espace de travail pour l’instant.', 'board.createWs': 'Créer un espace de travail',
  'board.noCats': 'Cet espace de travail n’a aucune catégorie.', 'board.createCat': 'Créer une catégorie',
  'note.placeholder': 'Note en Markdown…  (Ctrl+Entrée pour enregistrer)', 'note.clickTip': 'Cliquez pour modifier la note',
  'act.expand': 'Déplier', 'act.collapse': 'Replier', 'act.addLink': 'Ajouter un lien', 'act.addFolder': 'Ajouter un dossier',
  'act.addSubfolder': 'Ajouter un sous-dossier', 'act.editNote': 'Modifier la note', 'act.openAll': 'Tout ouvrir', 'act.more': 'Plus',
  'act.edit': 'Modifier', 'act.editFolder': 'Modifier le dossier',

  'menu.openAll': 'Tout ouvrir ({n})', 'menu.openAllWindow': 'Tout ouvrir dans une nouvelle fenêtre', 'menu.delete': 'Supprimer', 'menu.edit': 'Modifier…',
  'menu.export': 'Exporter…', 'menu.addWindowTabs': 'Ajouter tous les onglets de cette fenêtre', 'menu.sortName': 'Trier les liens par nom',
  'menu.dedupe': 'Supprimer les liens en double', 'menu.open': 'Ouvrir', 'menu.openWindow': 'Ouvrir dans une nouvelle fenêtre', 'menu.copyUrl': 'Copier l’URL',
  'menu.copyUrls': 'Copier les URL', 'menu.clearSel': 'Désélectionner',
  'menu.openLinks': { one: 'Ouvrir {n} lien', other: 'Ouvrir {n} liens' },
  'menu.deleteItems': { one: 'Supprimer {n} élément', other: 'Supprimer {n} éléments' },
  'menu.deleteGroups': { one: 'Supprimer {n} groupe', other: 'Supprimer {n} groupes' },

  'search.aria': 'Rechercher (Ctrl+F)', 'search.placeholder': 'Rechercher liens, groupes, dossiers, notes…',
  'search.links': 'Liens · {n}', 'search.containers': 'Espaces de travail, groupes et dossiers · {n}', 'search.none': 'Aucun résultat.',
  'search.foot': '↑↓ se déplacer · Entrée ouvrir · Ctrl+Entrée onglet en arrière-plan · Échap fermer',

  'common.cancel': 'Annuler', 'common.save': 'Enregistrer', 'common.close': 'Fermer', 'common.ok': 'OK', 'common.undo': 'Annuler',
  'new.workspace': 'Nouvel espace de travail', 'new.category': 'Nouvelle catégorie', 'new.group': 'Nouveau groupe', 'new.folder': 'Nouveau dossier', 'new.link': 'Nouveau lien',
  'edit.workspace': 'Modifier l’espace de travail', 'edit.category': 'Modifier la catégorie', 'edit.group': 'Modifier le groupe', 'edit.folder': 'Modifier le dossier', 'edit.link': 'Modifier le lien',
  'field.name': 'Nom', 'field.symbol': 'Symbole', 'field.description': 'Description', 'field.note': 'Note (Markdown)', 'field.color': 'Couleur', 'color.none': 'Par défaut',
  'field.url': 'URL', 'field.icon': 'Icône', 'field.symbolHint': '{label} (emoji, lettre ou chiffre, facultatif)',
  'field.ctrlEnter': 'Ctrl+Entrée pour enregistrer',
  'icon.placeholder': 'URL d’une image, ou importez un fichier. Vide : favicon du site', 'icon.bad': 'Impossible de lire cette image.',
  'icon.upload': 'Importer', 'icon.clear': 'Effacer',
  'err.urlRequired': 'L’URL est obligatoire.', 'err.urlInvalid': 'L’URL n’est pas valide.', 'err.nameRequired': 'Le nom est obligatoire.',
  'err.symbol': 'Le symbole doit être un emoji, une lettre ou un chiffre.',
  'emoji.search': 'Rechercher un emoji (en anglais), ou taper une lettre / un chiffre', 'emoji.remove': 'Retirer le symbole', 'emoji.letter': 'Lettre {c}',
  'emoji.none': 'Aucun emoji trouvé.', 'emoji.offline': 'Impossible de charger la liste des emojis (hors ligne ?). Vous pouvez quand même coller un emoji dans la case.',
  'del.workspace': 'Supprimer l’espace de travail « {name} » ?', 'del.category': 'Supprimer la catégorie « {name} » ?', 'del.group': 'Supprimer le groupe « {name} » ?',
  'del.folder': 'Supprimer le dossier « {name} » ?', 'del.link': 'Supprimer le lien « {name} » ?',
  'del.links': { one: 'Son lien sera aussi supprimé.', other: 'Ses {n} liens seront aussi supprimés.' },
  'del.groups': { one: 'Supprimer {n} groupe ?', other: 'Supprimer {n} groupes ?' },
  'del.groupsLinks': { one: 'Leur lien sera aussi supprimé.', other: 'Leurs {n} liens seront aussi supprimés.' },
  'open.many': 'Ouvrir {n} onglets ?', 'open.all': 'Tout ouvrir',
  'merge.title': 'Fusionner « {from} » dans « {into} » ?',
  'merge.text': { one: 'Son lien, ses dossiers et sa note passent dans « {into} », puis « {from} » est supprimé.', other: 'Ses {n} liens, ses dossiers et sa note passent dans « {into} », puis « {from} » est supprimé.' },
  'merge.ok': 'Fusionner',
  'picker.all': 'Tout sélectionner', 'picker.none': 'Aucun', 'picker.count': '{n} sur {total} sélectionnés', 'picker.toggle': 'Déplier / replier',
  'export.title': 'Exporter les données', 'export.ok': 'Exporter', 'import.title': 'Importer depuis {file}', 'import.ok': 'Importer',

  'toast.deleted': '« {name} » supprimé',
  'toast.deletedGroups': { one: '{n} groupe supprimé', other: '{n} groupes supprimés' },
  'toast.deletedItems': { one: '{n} élément supprimé', other: '{n} éléments supprimés' },
  'toast.suspended': { one: '{n} onglet suspendu', other: '{n} onglets suspendus' },
  'toast.closedDupes': { one: '{n} onglet en double fermé', other: '{n} onglets en double fermés' },
  'toast.removedDupes': { one: '{n} lien en double supprimé', other: '{n} liens en double supprimés' },
  'toast.copiedUrls': { one: '{n} URL copiée', other: '{n} URL copiées' },
  'toast.imported': { one: '{n} espace de travail importé', other: '{n} espaces de travail importés' },
  'toast.needCategory': 'Créez d’abord une catégorie', 'toast.urlCopied': 'URL copiée',
  'toast.windowSaved': 'Fenêtre enregistrée dans un nouveau groupe', 'toast.nothingToSave': 'Rien à enregistrer',
  'toast.merged': 'Fusionné dans « {name} »', 'toast.dropFailed': 'Échec du dépôt : {error}',
  'toast.importFailed': 'Échec de l’import : {error}', 'toast.settingsImported': 'Paramètres importés',
  'err.notJson': 'ce n’est pas un fichier JSON', 'err.noWorkspaces': 'aucun espace de travail trouvé',
  'err.notSettings': 'ce n’est pas un fichier de paramètres tabcat', 'err.noSettings': 'aucun paramètre valide trouvé',

  'settings.title': 'Paramètres', 'settings.general': 'Général', 'settings.closeOnSave': 'Fermer les onglets après leur enregistrement', 'settings.groupTabs': 'Grouper les onglets en ouvrant tout',
  'settings.autoSuspend': 'Suspendre automatiquement les onglets inactifs après (minutes, 0 = jamais)', 'settings.columns': 'Colonnes du tableau (1–7)',
  'settings.language': 'Langue', 'settings.langAuto': 'Langue du navigateur',
  'settings.appearance': 'Apparence', 'settings.theme': 'Thème', 'settings.color': 'Couleur',
  'theme.auto': 'Système', 'theme.light': 'Clair', 'theme.dark': 'Sombre',
  'accent.red': 'Rouge', 'accent.orange': 'Orange', 'accent.yellow': 'Jaune', 'accent.lime': 'Citron vert', 'accent.green': 'Vert',
  'accent.teal': 'Sarcelle', 'accent.sky': 'Bleu ciel', 'accent.blue': 'Bleu', 'accent.purple': 'Violet', 'accent.pink': 'Rose',
  'settings.data': 'Données', 'data.export': 'Exporter les données…', 'data.import': 'Importer des données…',
  'data.exportSettings': 'Exporter les paramètres', 'data.importSettings': 'Importer des paramètres',
  'data.note': 'L’import ajoute les éléments choisis comme nouveaux espaces de travail ; rien n’est écrasé. Les fichiers de paramètres contiennent les options ci-dessus (pas l’adresse du tableau de bord).',
  'settings.shortcuts': 'Raccourcis',
  'settings.keys.html': '<kbd>Ctrl+F</kbd> rechercher · <kbd>Alt+Shift+S</kbd> enregistrer l’onglet · <kbd>Alt+Shift+A</kbd> enregistrer la fenêtre · <kbd>Alt+Shift+D</kbd> ouvrir le tableau de bord · à modifier dans <a href="chrome://extensions/shortcuts" id="shortcuts-link"><code>chrome://extensions/shortcuts</code></a>',
  'settings.done': 'Terminé',

  'help.title': 'Utiliser tabcat',
  'help.org.html': `<h4>Organisation</h4>
<p><b>Espace de travail</b> › <b>Catégorie</b> › <b>Groupe</b> › <b>Dossier</b> (jusqu’à 4 niveaux) et <b>Lien</b>.
Choisissez un espace de travail à gauche et une catégorie dans la barre au-dessus du tableau ; les groupes sont les cartes du tableau.</p>`,
  'help.saving.html': `<h4>Enregistrer des onglets</h4>
<ul>
<li>Faites glisser un onglet depuis <b>Onglets ouverts</b> vers un groupe, un dossier ou entre des liens. <kbd>Shift</kbd>+clic ou <kbd>Shift</kbd>+glisser pour choisir plusieurs onglets (même dans plusieurs fenêtres), puis faites-en glisser un pour tous les emporter, ou faites un clic droit pour Enregistrer / Suspendre / Déplacer vers une nouvelle fenêtre / Fermer.</li>
<li>Faites glisser l’en-tête d’une fenêtre pour enregistrer tous ses onglets ; déposez-le entre deux groupes ou sous une colonne pour créer un nouveau groupe.</li>
<li>Bouton de la barre d’outils : renommez l’onglet et choisissez un groupe ou un dossier dans <b>Enregistrer dans</b>.</li>
<li>Les onglets enregistrés se ferment si <i>Fermer les onglets après leur enregistrement</i> est activé (Paramètres).</li>
</ul>`,
  'help.board.html': `<h4>Le tableau</h4>
<ul>
<li>Les groupes s’empilent en colonnes ; le nombre de colonnes se règle dans la barre des catégories et dans les Paramètres.</li>
<li>Faites glisser un groupe par son en-tête : déposez-le sur le bord haut ou bas d’une carte, dans un espace ou sous une colonne pour le placer ; déposez-le au milieu d’un autre groupe pour les fusionner.</li>
<li>Survolez l’espace entre deux groupes et cliquez sur la ligne, ou survolez le bas d’une colonne, pour y ajouter un groupe.</li>
<li>Cliquez sur une zone vide de l’en-tête d’un groupe pour le replier ou le déplier ; double-cliquez sur son nom pour le modifier.</li>
</ul>`,
  'help.select.html': `<h4>Sélectionner des groupes</h4>
<ul>
<li>Tracez un cadre sur une zone vide du tableau, ou <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+clic sur un en-tête. <kbd>Shift</kbd> inverse, <kbd>Ctrl</kbd>/<kbd>⌘</kbd> ajoute.</li>
<li>Tant que des groupes sont sélectionnés, un clic sélectionne au lieu d’ouvrir les liens. Faites-en glisser un pour tous les déplacer ; <kbd>Suppr</kbd> les supprime ; <kbd>Échap</kbd> désélectionne.</li>
<li>Liens et dossiers : <kbd>Shift</kbd>+clic pour sélectionner ; la sélection reste dans le groupe du premier élément. Un clic droit sur un élément sélectionné propose des actions pour tous.</li>
<li><kbd>Shift</kbd>+glisser un cadre n’importe où : sur deux groupes ou plus, un en-tête ou la majeure partie d’un groupe, il sélectionne des groupes ; à l’intérieur d’un groupe, il sélectionne ses liens et dossiers.</li>
</ul>`,
  'help.notes.html': `<h4>Notes et symboles</h4>
<ul>
<li>Les notes de groupe sont en Markdown, avec cases à cocher et formules : <code>$…$</code> ou <code>\\(…\\)</code> dans le texte, <code>$$…$$</code> ou <code>\\[…\\]</code> sur une ligne à part, et des environnements LaTeX comme <code>\\begin{align}…\\end{align}</code> ou <code>\\begin{pmatrix}…\\end{pmatrix}</code>.</li>
<li>Un symbole est un emoji, une lettre ou un chiffre ; dans l’éditeur, cherchez les emojis par leur nom (en anglais).</li>
</ul>`,
  'help.memory.html': `<h4>Mémoire</h4>
<ul>
<li><b>Suspendre</b> décharge les onglets inactifs (ils se rechargent à l’ouverture) ; <b>Doublons</b> ferme les onglets en double.</li>
<li>La suspension automatique après N minutes d’inactivité se règle dans les Paramètres.</li>
</ul>`,
  'help.keys.html': `<h4>Raccourcis</h4>
<table class="keys">
<tr><td><kbd>Ctrl</kbd>+<kbd>F</kbd></td><td>Rechercher</td></tr>
<tr><td><kbd>?</kbd></td><td>Ce guide</td></tr>
<tr><td><kbd>Suppr</kbd> · <kbd>Échap</kbd></td><td>Supprimer / désélectionner les groupes sélectionnés</td></tr>
<tr><td><kbd>Ctrl</kbd>+<kbd>Entrée</kbd></td><td>Enregistrer une note ou l’éditeur</td></tr>
<tr><td>Lettre dans un menu</td><td>Exécute cette entrée du menu clic droit / ⋯ (p. ex. <kbd>D</kbd> supprimer, <kbd>E</kbd> modifier)</td></tr>
<tr><td><kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd> / <kbd>A</kbd></td><td>Enregistrer cet onglet / cette fenêtre (partout)</td></tr>
<tr><td><kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>D</kbd></td><td>Ouvrir le tableau de bord (partout)</td></tr>
</table>`,
  'help.data.html': `<h4>Vos données</h4>
<p>Tout est stocké dans ce navigateur par l’extension, jamais sur un serveur. Exportez-les / importez-les (ou seulement vos paramètres) dans les Paramètres.</p>`,

  names: {
    order: 'noun-adj',
    adjectives: ['tranquille', a('doré', 'dorée'), a('curieux', 'curieuse'), 'rapide', a('serein', 'sereine'), a('argenté', 'argentée'),
      'agile', a('joyeux', 'joyeuse'), a('doux', 'douce'), a('brillant', 'brillante'), 'calme', a('vaillant', 'vaillante'),
      a('brumeux', 'brumeuse'), a('ambré', 'ambrée'), a('ensoleillé', 'ensoleillée'), a('discret', 'discrète')],
    nouns: [['Loutre', 'f'], ['Érable', 'm'], ['Comète', 'f'], ['Galet', 'm'], ['Port', 'm'], ['Prairie', 'f'], ['Lanterne', 'f'], ['Faucon', 'm'],
      ['Saule', 'm'], ['Braise', 'f'], ['Canyon', 'm'], ['Fougère', 'f'], ['Orbite', 'f'], ['Matou', 'm'], ['Biscuit', 'm'], ['Brise', 'f']],
  },
};
