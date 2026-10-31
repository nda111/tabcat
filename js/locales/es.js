// Español
const a = (m, f = m) => ({ m, f }); // adjective forms for masculine / feminine nouns

export default {
  'type.workspace': 'Espacio de trabajo', 'type.category': 'Categoría', 'type.group': 'Grupo', 'type.folder': 'Carpeta', 'type.link': 'Enlace',
  'def.category': 'General',
  'name.window': 'Ventana {date}',
  'name.untitled': '(sin título)',
  'noext.title': 'No se encontró la extensión tabcat.',
  'noext.need': 'tabcat funciona junto con una extensión del navegador.',
  'noext.step1.html': 'Abre <a href="chrome://extensions" data-copy>chrome://extensions</a>, activa el <b>Modo de desarrollador</b>, haz clic en <b>Cargar descomprimida</b> e instala la carpeta de la <a href="https://github.com/nda111/tabcat/releases/latest"><span class="gh-mark"></span>extensión tabcat</a>.',
  'noext.step3': 'Recarga esta página.',
  'noext.retry': 'Reintentar',
  'noext.copied': 'Dirección copiada. Pégala en la barra de direcciones de una pestaña nueva.',
  'boot.loading': 'Cargando…',
  'browser.title': 'Este navegador no es compatible.',
  'browser.need': 'tabcat es una extensión de Chrome.\nFunciona en navegadores Chromium de escritorio que pueden instalar extensiones de Chrome, como Chrome, Edge, Brave, Whale, Opera y Vivaldi.\nNo se puede usar en navegadores de móviles o tabletas, Samsung Internet, Firefox, Safari y similares.',
  'browser.open': 'Usa tabcat en un navegador compatible.',
  'noext.old': 'La extensión tabcat ({version}) es más antigua de lo que necesita este panel ({min}): vuelve a cargarla o actualízala.',
  'side.workspaces': 'Espacios de trabajo', 'side.info': 'Información', 'side.help': 'Ayuda', 'side.settings': 'Ajustes',
  'side.install': 'Instalar como app', 'install.hide': 'Ocultar (puedes instalarla desde Ajustes)', 'settings.app': 'App', 'toast.installed': 'tabcat se instaló como app.',
  'help.tour': 'Hacer el recorrido', 'tour.skip': 'Omitir', 'tour.prev': 'Atrás', 'tour.next': 'Siguiente', 'tour.done': 'Listo', 'tour.count': '{i} de {n}',
  'tour.offer.title': '¿Quieres un recorrido rápido por tabcat?', 'tour.offer.text': 'Un minuto, paso a paso, por las partes principales. También puedes empezarlo luego desde Ayuda.', 'tour.offer.ok': 'Hacer el recorrido', 'tour.offer.later': 'Más tarde',
  'tour.welcome.title': 'Hola {logo}', 'tour.welcome.text': 'Guarda pestañas como enlaces en grupos y vuelve a abrirlas cuando las necesites.',
  'tour.workspaces.title': 'Espacios de trabajo', 'tour.workspaces.text': 'Las cajas más grandes. Divide tus cosas, como trabajo y estudio. Arrastra para reordenar.',
  'tour.tabs.title': 'Pestañas abiertas', 'tour.tabs.text': 'Tus ventanas y pestañas abiertas. También puedes {icon:save} guardar una ventana, {icon:suspend} dormir pestañas o {icon:dedupe} ordenar las duplicadas.',
  'tour.categories.title': 'Categorías', 'tour.categories.text': 'Temas dentro de un espacio de trabajo. Cada categoría tiene sus propios grupos.',
  'tour.groups.title': 'Grupos', 'tour.groups.text': 'Tarjetas con enlaces y carpetas. Personalízalas y arrástralas donde quieras.',
  'tour.search.title': 'Buscar', 'tour.search.text': 'Busca enlaces, carpetas, grupos y más desde cualquier sitio. Ctrl+F también lo abre.',
  'tour.install.title': 'Instalar como app', 'tour.install.text': 'Prueba tabcat como app.',
  'tour.more.title': 'Ajustes y ayuda', 'tour.more.text': 'Idioma, tema y colores en {icon:settings} Ajustes; todos los atajos en {icon:help} Ayuda.',
  'tour.tour.title': 'Recorrido', 'tour.tour.text': 'Puedes volver a empezar este recorrido desde {icon:help} Ayuda cuando quieras.',
  'tour.shortcut.title': 'Siempre a mano', 'tour.shortcut.text': 'Pulsa Ctrl+Shift+X para ver el panel cuando quieras. Vuelve a pulsarlo para regresar a tu pestaña.',
  'tour.bye.title': 'Llevémonos bien. 😸', 'tour.bye.text': 'Deja abiertas todas las pestañas que quieras. tabcat te ayuda a mantenerlas en orden.',
  'panel.expandWs': 'Expandir espacios de trabajo', 'panel.collapseWs': 'Contraer espacios de trabajo',
  'panel.expandTabs': 'Expandir pestañas abiertas', 'panel.collapseTabs': 'Contraer pestañas abiertas',
  'tabs.title': 'Pestañas abiertas',
  'tabs.suspendShort': 'Suspender', 'tabs.dedupeShort': 'Duplicadas', 'tabs.dedupeTip': 'Cerrar pestañas duplicadas',
  'win.this': 'Esta ventana', 'win.other': 'La otra ventana', 'win.nth': 'Otra ventana {n}',
  'win.saveThis': 'Guardar esta ventana', 'win.save': 'Guardar ventana', 'win.suspend': 'Suspender pestañas inactivas', 'win.close': 'Cerrar ventana',
  'win.closeThis': '¿Cerrar esta ventana?', 'win.closeOther': '¿Cerrar la otra ventana?', 'win.closeNth': '¿Cerrar la otra ventana {n}?',
  'win.alsoTabs': { one: 'También se cerrará su pestaña.', other: 'También se cerrarán sus {n} pestañas.' },
  'win.alsoDash': 'También se cerrará este panel.',
  'win.alsoBoth': { one: 'También se cerrarán su pestaña y este panel.', other: 'También se cerrarán sus {n} pestañas y este panel.' },
  'tab.suspended': 'Suspendida', 'tab.active': 'Pestaña activa', 'tab.save': 'Guardar pestaña', 'tab.close': 'Cerrar pestaña',
  'count.tabs': { one: '{n} pestaña', other: '{n} pestañas' },
  'count.windows': { one: '{n} ventana', other: '{n} ventanas' },
  'count.suspended': { one: '{n} suspendida', other: '{n} suspendidas' },
  'count.duplicates': { one: '{n} duplicada', other: '{n} duplicadas' },
  'tabs.saveGroup': { one: 'Guardar pestaña en un grupo nuevo', other: 'Guardar {n} pestañas en un grupo nuevo' },
  'tabs.suspend': { one: 'Suspender pestaña', other: 'Suspender {n} pestañas' }, 'tabs.wake': { one: 'Reanudar pestaña', other: 'Reanudar {n} pestañas' }, 'tab.wake': 'Reanudar', 'toast.woken': { one: '{n} pestaña reanudada', other: '{n} pestañas reanudadas' },
  'tabs.close': { one: 'Cerrar pestaña', other: 'Cerrar {n} pestañas' },
  'tabs.moveWindow': 'Mover a una ventana nueva',
  'head.none': 'Sin espacio de trabajo',
  'cols.title': 'Columnas', 'cols.fewer': 'Menos columnas', 'cols.more': 'Más columnas', 'cols.scroll': 'Desplaza para cambiar el número de columnas',
  'board.noWs': 'Aún no hay espacios de trabajo.', 'board.createWs': 'Crear espacio de trabajo',
  'board.noCats': 'Este espacio de trabajo no tiene categorías.', 'board.createCat': 'Crear categoría',
  'note.placeholder': 'Nota en Markdown…  (Ctrl+Enter para guardar)', 'note.clickTip': 'Haz clic para editar la nota',
  'act.expand': 'Expandir', 'act.collapse': 'Contraer', 'act.addLink': 'Añadir enlace', 'act.addFolder': 'Añadir carpeta',
  'act.addSubfolder': 'Añadir subcarpeta', 'act.editNote': 'Editar nota', 'act.openAll': 'Abrir todo', 'act.more': 'Más',
  'act.edit': 'Editar', 'act.editFolder': 'Editar carpeta',
  'menu.openAll': 'Abrir todo ({n})', 'menu.openAllWindow': 'Abrir todo en una ventana nueva', 'menu.delete': 'Eliminar', 'menu.edit': 'Editar…',
  'menu.export': 'Exportar…', 'menu.addWindowTabs': 'Añadir todas las pestañas de esta ventana', 'menu.sortName': 'Ordenar por nombre',
  'menu.dedupe': 'Quitar enlaces duplicados', 'menu.open': 'Abrir', 'menu.openWindow': 'Abrir en una ventana nueva', 'menu.copyUrl': 'Copiar URL',
  'menu.copyUrls': 'Copiar URL', 'menu.clearSel': 'Quitar selección',
  'menu.openLinks': { one: 'Abrir {n} enlace', other: 'Abrir {n} enlaces' },
  'menu.deleteItems': { one: 'Eliminar {n} elemento', other: 'Eliminar {n} elementos' },
  'menu.deleteGroups': { one: 'Eliminar {n} grupo', other: 'Eliminar {n} grupos' },
  'search.aria': 'Buscar (Ctrl+F)', 'search.placeholder': 'Buscar enlaces, grupos, carpetas, notas…',
  'search.links': 'Enlaces · {n}', 'search.containers': 'Espacios de trabajo, grupos y carpetas · {n}', 'search.none': 'Sin resultados.',
  'search.foot': '↑↓ mover · Enter abrir · Ctrl+Enter pestaña en segundo plano · Esc cerrar',
  'common.cancel': 'Cancelar', 'common.save': 'Guardar', 'common.close': 'Cerrar', 'common.ok': 'Aceptar', 'common.undo': 'Deshacer',
  'new.workspace': 'Nuevo espacio de trabajo', 'new.category': 'Nueva categoría', 'new.group': 'Nuevo grupo', 'new.folder': 'Nueva carpeta', 'new.link': 'Nuevo enlace',
  'edit.workspace': 'Editar espacio de trabajo', 'edit.category': 'Editar categoría', 'edit.group': 'Editar grupo', 'edit.folder': 'Editar carpeta', 'edit.link': 'Editar enlace',
  'field.name': 'Nombre', 'field.symbol': 'Símbolo', 'field.description': 'Descripción', 'field.note': 'Nota (Markdown)', 'field.color': 'Color', 'color.none': 'Predeterminado',
  'field.url': 'URL', 'field.icon': 'Icono', 'field.symbolHint': '{label} (emoji, letra o dígito, opcional)',
  'field.ctrlEnter': 'Ctrl+Enter para guardar',
  'icon.placeholder': 'URL de imagen, o sube un archivo. Vacío: favicon del sitio', 'icon.bad': 'No se pudo leer esa imagen.',
  'icon.upload': 'Subir', 'icon.clear': 'Borrar',
  'err.urlRequired': 'La URL es obligatoria.', 'err.urlInvalid': 'La URL no es válida.', 'err.nameRequired': 'El nombre es obligatorio.', 'err.groupClash': 'Ya existe un grupo con este nombre y símbolo.',
  'err.symbol': 'El símbolo debe ser un emoji, una letra o un dígito.',
  'emoji.search': 'Busca un emoji (en inglés), o escribe una letra / dígito', 'emoji.remove': 'Quitar símbolo', 'emoji.letter': 'Letra {c}',
  'emoji.none': 'No se encontraron emojis.', 'emoji.offline': 'No se pudo cargar la lista de emojis (¿sin conexión?). Aún puedes pegar un emoji en la casilla.',
  'del.workspace': '¿Eliminar el espacio de trabajo «{name}»?', 'del.category': '¿Eliminar la categoría «{name}»?', 'del.group': '¿Eliminar el grupo «{name}»?',
  'del.folder': '¿Eliminar la carpeta «{name}»?', 'del.link': '¿Eliminar el enlace «{name}»?',
  'del.links': { one: 'También se eliminará su enlace.', other: 'También se eliminarán sus {n} enlaces.' },
  'del.groups': { one: '¿Eliminar {n} grupo?', other: '¿Eliminar {n} grupos?' },
  'del.groupsLinks': { one: 'También se eliminará su enlace.', other: 'También se eliminarán sus {n} enlaces.' },
  'open.many': '¿Abrir {n} pestañas?', 'open.all': 'Abrir todas',
  'merge.title': '¿Combinar «{from}» con «{into}»?',
  'merge.text': { one: 'Su enlace, carpetas y nota pasan a «{into}» y después se elimina «{from}».', other: 'Sus {n} enlaces, carpetas y nota pasan a «{into}» y después se elimina «{from}».' },
  'merge.ok': 'Combinar',
  'picker.all': 'Seleccionar todo', 'picker.none': 'Ninguno', 'picker.count': '{n} de {total} seleccionados', 'picker.toggle': 'Expandir / contraer',
  'export.title': 'Exportar datos', 'export.ok': 'Exportar', 'import.title': 'Importar desde {file}', 'import.ok': 'Importar',
  'toast.deleted': 'Se eliminó «{name}».',
  'toast.deletedGroups': { one: 'Se eliminó {n} grupo.', other: 'Se eliminaron {n} grupos.' },
  'toast.deletedItems': { one: 'Se eliminó {n} elemento.', other: 'Se eliminaron {n} elementos.' },
  'toast.suspended': { one: '{n} pestaña suspendida', other: '{n} pestañas suspendidas' },
  'toast.closedDupes': { one: 'Se cerró {n} pestaña duplicada.', other: 'Se cerraron {n} pestañas duplicadas.' },
  'toast.extReloaded': 'La extensión de tabcat se reinició. La página se recargará cuando termines de editar.',
  'toast.removedDupes': { one: 'Se quitó {n} enlace duplicado.', other: 'Se quitaron {n} enlaces duplicados.' },
  'toast.copiedUrls': { one: 'Se copió {n} URL.', other: 'Se copiaron {n} URL.' },
  'toast.imported': { one: 'Se importó {n} espacio de trabajo.', other: 'Se importaron {n} espacios de trabajo.' },
  'toast.needCategory': 'Crea primero una categoría.', 'toast.urlCopied': 'URL copiada',
  'toast.windowSaved': 'Ventana guardada como grupo nuevo', 'toast.nothingToSave': 'No hay nada que guardar.',
  'toast.merged': 'Combinado con «{name}»', 'toast.dropFailed': 'No se pudo soltar: {error}',
  'toast.importFailed': 'Error al importar: {error}', 'toast.settingsImported': 'Ajustes importados',
  'err.notJson': 'no es un archivo JSON', 'err.noWorkspaces': 'no se encontraron espacios de trabajo',
  'err.notSettings': 'no es un archivo de ajustes de tabcat', 'err.noSettings': 'no se encontraron ajustes válidos',
  'settings.title': 'Ajustes', 'settings.general': 'General', 'settings.closeOnSave': 'Cerrar las pestañas al guardarlas', 'settings.groupTabs': 'Agrupar pestañas al abrir todo', 'settings.checkUpdates': 'Buscar actualizaciones automáticamente',
  'settings.autoSuspend': 'Suspender automáticamente las pestañas inactivas tras (minutos)', 'settings.off': 'Desactivado', 'settings.columns': 'Columnas del tablero (1–8)',
  'settings.language': 'Idioma', 'settings.langAuto': 'Idioma del navegador',
  'settings.appearance': 'Apariencia', 'settings.theme': 'Tema', 'settings.color': 'Color',
  'theme.auto': 'Sistema', 'theme.light': 'Claro', 'theme.dark': 'Oscuro',
  'accent.red': 'Rojo', 'accent.orange': 'Naranja', 'accent.yellow': 'Amarillo', 'accent.lime': 'Lima', 'accent.green': 'Verde',
  'accent.teal': 'Verde azulado', 'accent.sky': 'Celeste', 'accent.blue': 'Azul', 'accent.purple': 'Morado', 'accent.pink': 'Rosa', 'accent.mono': 'Monocromo',
  'settings.data': 'Datos', 'data.export': 'Exportar datos', 'data.import': 'Importar datos',
  'data.exportSettings': 'Exportar ajustes', 'data.importSettings': 'Importar ajustes', 'data.resetSettings': 'Restablecer ajustes', 'reset.title': '¿Restablecer todos los ajustes?', 'reset.text': 'El idioma, el tema, el color, las columnas y las demás opciones vuelven a sus valores predeterminados. Los espacios de trabajo, grupos y enlaces no se restablecen.', 'reset.ok': 'Restablecer', 'toast.settingsReset': 'Ajustes restablecidos', 'toast.undone': 'Deshecho', 'toast.redone': 'Rehecho',
  'noun.group': 'grupo', 'noun.groupN': '{n} grupos', 'noun.link': 'enlace', 'noun.linkN': '{n} enlaces', 'noun.folder': 'carpeta', 'noun.folderN': '{n} carpetas', 'noun.item': 'elemento', 'noun.itemN': '{n} elementos', 'noun.workspace': 'espacio de trabajo', 'noun.workspaceN': '{n} espacios de trabajo', 'noun.category': 'categoría', 'noun.categoryN': '{n} categorías',
  'undo.delete': 'Eliminación deshecha: {what}', 'redo.delete': 'Eliminación rehecha: {what}', 'undo.move': 'Movimiento deshecho: {what}', 'redo.move': 'Movimiento rehecho: {what}', 'undo.merge': 'Combinación de grupos deshecha', 'redo.merge': 'Combinación de grupos rehecha',
  'undo.closeDupes': 'Cierre de pestañas duplicadas deshecho', 'redo.closeDupes': 'Cierre de pestañas duplicadas rehecho', 'undo.dedupe': 'Eliminación de enlaces duplicados deshecha', 'redo.dedupe': 'Eliminación de enlaces duplicados rehecha',
  'undo.save': { one: 'Guardado de {n} pestaña deshecho', other: 'Guardado de {n} pestañas deshecho' }, 'redo.save': { one: 'Guardado de {n} pestaña rehecho', other: 'Guardado de {n} pestañas rehecho' },
  'data.note': 'Al importar, los elementos elegidos se añaden como espacios de trabajo nuevos; no se sobrescribe nada. Los archivos de ajustes contienen las opciones de arriba.',
  'settings.shortcuts': 'Atajos',
  'settings.keys.html': '<kbd>Ctrl+F</kbd> buscar · <kbd>Alt+Shift+S</kbd> guardar pestaña · <kbd>Alt+Shift+A</kbd> guardar ventana · <kbd>Ctrl+Shift+X</kbd> abrir panel · cámbialos en <a href="chrome://extensions/shortcuts" id="shortcuts-link"><code>chrome://extensions/shortcuts</code></a>',
  'settings.done': 'Listo',
  'help.title': 'Ayuda', 'info.title': 'Información', 'info.extension': 'Extensión', 'info.minimum': 'Extensión requerida', 'info.source': 'Código fuente', 'info.privacy': 'Privacidad', 'info.issues': 'Informar de un problema', 'info.notConnected': 'sin conexión',
  'info.update': 'Ya salió {version}', 'info.getUpdate': 'Descargar', 'info.updateBadge': 'Hay una actualización', 'info.check': 'Buscar actualizaciones', 'info.upToDate': 'Tienes la última versión.', 'info.checkFailed': 'No se pudo comprobar.',
  'help.org.html': `<h4>Cómo se organiza todo</h4>
<p><b>Espacio de trabajo</b> › <b>Categoría</b> › <b>Grupo</b> › <b>Carpeta</b> (hasta 4 niveles) y <b>Enlace</b>.
Elige un espacio de trabajo a la izquierda y una categoría en la barra sobre el tablero; los grupos son las tarjetas del tablero.</p>`,
  'help.saving.html': `<h4>Guardar pestañas</h4>
<ul>
<li>Arrastra una pestaña desde <b>Pestañas abiertas</b> a un grupo, a una carpeta o entre enlaces. Con <kbd>Shift</kbd>+clic o <kbd>Shift</kbd>+arrastrar eliges varias pestañas (de distintas ventanas); arrastra una para llevarlas todas, o haz clic derecho para Guardar / Suspender / Mover a una ventana nueva / Cerrar.</li>
<li>Arrastra la cabecera de una ventana para guardar todas sus pestañas; suéltala en el hueco entre grupos o bajo una columna para crear un grupo nuevo.</li>
<li>Botón de la barra de herramientas: cambia el nombre de la pestaña y elige cualquier grupo o carpeta en <b>Guardar en</b>.</li>
<li>Las pestañas guardadas se cierran si <i>Cerrar las pestañas al guardarlas</i> está activado (Ajustes).</li>
</ul>`,
  'help.board.html': `<h4>El tablero</h4>
<ul>
<li>Los grupos se apilan en columnas; el número de columnas está en la barra de categorías y en Ajustes.</li>
<li>Arrastra un grupo por su cabecera: suéltalo en el borde superior o inferior de una tarjeta, en un hueco o bajo una columna para colocarlo; suéltalo en el centro de otro grupo para combinarlos.</li>
<li>Pasa el puntero por un hueco entre grupos y haz clic en la línea, o pásalo bajo una columna, para añadir ahí un grupo.</li>
<li>Haz clic en una zona vacía de la cabecera de un grupo para contraerlo o expandirlo; haz doble clic en su nombre para editarlo.</li>
</ul>`,
  'help.select.html': `<h4>Seleccionar grupos</h4>
<ul>
<li>Arrastra un recuadro sobre una zona vacía del tablero, o haz <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+clic en una cabecera. <kbd>Shift</kbd> invierte, <kbd>Ctrl</kbd>/<kbd>⌘</kbd> añade.</li>
<li>Mientras haya grupos seleccionados, los clics seleccionan en vez de abrir enlaces. Arrastra uno para moverlos todos; <kbd>Supr</kbd> los elimina; <kbd>Esc</kbd> quita la selección.</li>
<li>Enlaces y carpetas: <kbd>Shift</kbd>+clic para seleccionar; la selección se queda en el grupo del primer elemento. Haz clic derecho en un elemento seleccionado para actuar sobre todos.</li>
<li><kbd>Shift</kbd>+arrastrar un recuadro en cualquier sitio: sobre dos o más grupos, la cabecera de un grupo o la mayor parte de un grupo selecciona grupos; dentro de un grupo selecciona sus enlaces y carpetas.</li>
</ul>`,
  'help.notes.html': `<h4>Notas y símbolos</h4>
<ul>
<li>Las notas de grupo son Markdown con casillas de tareas (<code>[ ]</code>, <code>[x]</code>) y matemáticas: <code>$…$</code> o <code>\\(…\\)</code> en línea, <code>$$…$$</code> o <code>\\[…\\]</code> aparte, y entornos LaTeX como <code>\\begin{align}…\\end{align}</code> o <code>\\begin{pmatrix}…\\end{pmatrix}</code>.</li>
<li>Un símbolo es un emoji, una letra, un dígito o el logo de tabcat; en el editor puedes buscar emojis por su nombre (en inglés).</li>
</ul>`,
  'help.memory.html': `<h4>Memoria</h4>
<ul>
<li><b>Suspender</b> descarga las pestañas inactivas (se recargan al abrirlas); <b>Duplicadas</b> cierra las pestañas repetidas.</li>
<li>La suspensión automática tras N minutos de inactividad está en Ajustes.</li>
</ul>`,
  'help.keys.html': `<h4>Atajos</h4>
<table class="keys">
<tr><td><kbd>Ctrl</kbd>+<kbd>F</kbd></td><td>Buscar</td></tr>
<tr><td><kbd>Ctrl</kbd>+<kbd>Z</kbd> / <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd></td><td>Deshacer / rehacer (borrar, mover, guardar, cerrar duplicadas…)</td></tr>
<tr><td><kbd>?</kbd></td><td>Esta guía</td></tr>
<tr><td><kbd>Supr</kbd> · <kbd>Esc</kbd></td><td>Eliminar / deseleccionar los grupos seleccionados</td></tr>
<tr><td><kbd>Ctrl</kbd>+<kbd>Enter</kbd></td><td>Guardar una nota o el editor</td></tr>
<tr><td>Letra en un menú</td><td>Ejecuta esa entrada del menú contextual / ⋯ (p. ej. <kbd>D</kbd> eliminar, <kbd>E</kbd> editar)</td></tr>
<tr><td><kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd> / <kbd>A</kbd></td><td>Guardar esta pestaña / ventana (en cualquier sitio)</td></tr>
<tr><td><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>X</kbd></td><td>Traer el panel; otra vez para volver (en cualquier sitio)</td></tr>
</table>`,
  'help.data.html': `<h4>Tus datos</h4>
<p>La extensión guarda todo en este navegador, nunca en un servidor. Puedes exportarlo / importarlo (o solo tus ajustes) en Ajustes.</p>`,

  names: {
    order: 'noun-adj',
    adjectives: ['ámbar', a('tranquilo', 'tranquila'), a('dorado', 'dorada'), a('curioso', 'curiosa'), 'veloz', a('sereno', 'serena'),
      a('plateado', 'plateada'), 'ágil', 'alegre', 'suave', 'brillante', a('callado', 'callada'), 'valiente', a('brumoso', 'brumosa'),
      a('soleado', 'soleada'), 'amable'],
    nouns: [['Nutria', 'f'], ['Arce', 'm'], ['Cometa', 'm'], ['Guijarro', 'm'], ['Puerto', 'm'], ['Pradera', 'f'], ['Linterna', 'f'],
      ['Halcón', 'm'], ['Sauce', 'm'], ['Brasa', 'f'], ['Cañón', 'm'], ['Helecho', 'm'], ['Órbita', 'f'], ['Gata', 'f'], ['Galleta', 'f'], ['Brisa', 'f']],
  },
};
