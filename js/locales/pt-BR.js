// Português (Brasil)
const a = (m, f = m) => ({ m, f }); // adjective forms for masculine / feminine nouns

export default {
  'type.workspace': 'Espaço de trabalho', 'type.category': 'Categoria', 'type.group': 'Grupo', 'type.folder': 'Pasta', 'type.link': 'Link',
  'def.category': 'Geral',
  'name.window': 'Janela {date}',
  'name.untitled': '(sem título)',
  'noext.title': 'Extensão do tabcat não encontrada.',
  'noext.need': 'O tabcat funciona junto com uma extensão do navegador.',
  'noext.step1.html': 'Abra <a href="chrome://extensions" data-copy>chrome://extensions</a>, ative o <b>Modo do desenvolvedor</b>, clique em <b>Carregar sem compactação</b> e instale a pasta da <a href="https://github.com/nda111/tabcat/releases/latest"><span class="gh-mark"></span>extensão do tabcat</a>.',
  'noext.step3': 'Recarregue esta página.',
  'noext.retry': 'Tentar de novo',
  'noext.copied': 'Endereço copiado. Cole-o na barra de endereços de uma nova aba.',
  'boot.loading': 'Carregando…',
  'browser.title': 'Este navegador não é compatível.',
  'browser.need': 'O tabcat é uma extensão do Chrome.\nEle funciona em navegadores Chromium para computador que podem instalar extensões do Chrome, como Chrome, Edge, Brave, Whale, Opera e Vivaldi.\nNão pode ser usado em navegadores de celular ou tablet, Samsung Internet, Firefox, Safari e outros.',
  'browser.open': 'Use o tabcat em um navegador compatível.',
  'noext.old': 'A extensão tabcat ({version}) é mais antiga do que este painel precisa ({min}): recarregue ou atualize a extensão.',
  'side.workspaces': 'Espaços de trabalho', 'side.info': 'Sobre', 'side.help': 'Ajuda', 'side.settings': 'Configurações',
  'side.install': 'Instalar como app', 'install.hide': 'Ocultar (ainda dá para instalar nas Configurações)', 'settings.app': 'App', 'toast.installed': 'tabcat instalado como app',
  'help.tour': 'Fazer o tour', 'tour.skip': 'Pular', 'tour.prev': 'Voltar', 'tour.next': 'Próximo', 'tour.done': 'Concluir', 'tour.count': '{i} de {n}',
  'tour.offer.title': 'Quer fazer um tour rápido pelo tabcat?', 'tour.offer.text': 'Um minuto, passo a passo, pelas partes principais. Você também pode começar depois pela Ajuda.', 'tour.offer.ok': 'Fazer o tour', 'tour.offer.later': 'Depois',
  'tour.welcome.title': 'Boas-vindas ao tabcat.', 'tour.welcome.text': 'Salve abas como links em grupos e abra de novo quando precisar.',
  'tour.workspaces.title': 'Espaços de trabalho', 'tour.workspaces.text': 'As maiores divisões. Separe suas coisas, como trabalho e estudos. Arraste para reordenar.',
  'tour.tabs.title': 'Abas abertas', 'tour.tabs.text': 'Suas janelas e abas abertas. Você também pode {icon:save} salvar uma janela, {icon:suspend} pôr abas para dormir ou {icon:dedupe} arrumar as duplicadas.',
  'tour.categories.title': 'Categorias', 'tour.categories.text': 'Temas dentro de um espaço de trabalho. Cada categoria tem seus próprios grupos.',
  'tour.groups.title': 'Grupos', 'tour.groups.text': 'Cartões com links e pastas. Personalize do seu jeito e arraste para onde quiser.',
  'tour.search.title': 'Busca', 'tour.search.text': 'Busque links, pastas, grupos e mais, de qualquer lugar. Ctrl+F também abre.',
  'tour.install.title': 'Instalar como app', 'tour.install.text': 'Experimente usar o tabcat como app.',
  'tour.more.title': 'Configurações e ajuda', 'tour.more.text': 'Idioma, tema e cores nas {icon:settings} Configurações; todos os atalhos na {icon:help} Ajuda.',
  'tour.tour.title': 'Tour', 'tour.tour.text': 'Você pode recomeçar este tour pela {icon:help} Ajuda a qualquer momento.',
  'tour.shortcut.title': 'Sempre à mão', 'tour.shortcut.text': 'Aperte Ctrl+Shift+X para ver o painel a qualquer hora. Aperte de novo para voltar à sua aba.',
  'tour.bye.title': 'Vamos nos dar bem. 😸', 'tour.bye.text': 'Deixe quantas abas quiser abertas. O tabcat ajuda a manter tudo em ordem.',
  'panel.expandWs': 'Expandir espaços de trabalho', 'panel.collapseWs': 'Recolher espaços de trabalho',
  'panel.expandTabs': 'Expandir abas abertas', 'panel.collapseTabs': 'Recolher abas abertas',
  'tabs.title': 'Abas abertas',
  'tabs.suspendShort': 'Suspender', 'tabs.dedupeShort': 'Duplicadas', 'tabs.dedupeTip': 'Fechar abas duplicadas',
  'win.this': 'Esta janela', 'win.other': 'A outra janela', 'win.nth': 'Outra janela {n}',
  'win.saveThis': 'Salvar esta janela', 'win.save': 'Salvar janela', 'win.suspend': 'Suspender abas inativas', 'win.close': 'Fechar janela',
  'win.closeThis': 'Fechar esta janela?', 'win.closeOther': 'Fechar a outra janela?', 'win.closeNth': 'Fechar a outra janela {n}?',
  'win.alsoTabs': { one: 'A aba dela também será fechada.', other: 'As {n} abas dela também serão fechadas.' },
  'win.alsoDash': 'Este painel também será fechado.',
  'win.alsoBoth': { one: 'A aba dela e este painel também serão fechados.', other: 'As {n} abas dela e este painel também serão fechados.' },
  'tab.suspended': 'Suspensa', 'tab.active': 'Aba ativa', 'tab.save': 'Salvar aba', 'tab.close': 'Fechar aba',
  'count.tabs': { one: '{n} aba', other: '{n} abas' },
  'count.windows': { one: '{n} janela', other: '{n} janelas' },
  'count.suspended': { one: '{n} suspensa', other: '{n} suspensas' },
  'count.duplicates': { one: '{n} duplicada', other: '{n} duplicadas' },
  'tabs.saveGroup': { one: 'Salvar aba em um novo grupo', other: 'Salvar {n} abas em um novo grupo' },
  'tabs.suspend': { one: 'Suspender aba', other: 'Suspender {n} abas' }, 'tabs.wake': { one: 'Retomar aba', other: 'Retomar {n} abas' }, 'tab.wake': 'Retomar', 'toast.woken': { one: '{n} aba retomada', other: '{n} abas retomadas' },
  'tabs.close': { one: 'Fechar aba', other: 'Fechar {n} abas' },
  'tabs.moveWindow': 'Mover para uma nova janela',
  'head.none': 'Nenhum espaço de trabalho',
  'cols.title': 'Colunas', 'cols.fewer': 'Menos colunas', 'cols.more': 'Mais colunas', 'cols.scroll': 'Role para mudar o número de colunas',
  'board.noWs': 'Ainda não há espaços de trabalho.', 'board.createWs': 'Criar espaço de trabalho',
  'board.noCats': 'Este espaço de trabalho não tem categorias.', 'board.createCat': 'Criar categoria',
  'note.placeholder': 'Nota em Markdown…  (Ctrl+Enter para salvar)', 'note.clickTip': 'Clique para editar a nota',
  'act.expand': 'Expandir', 'act.collapse': 'Recolher', 'act.addLink': 'Adicionar link', 'act.addFolder': 'Adicionar pasta',
  'act.addSubfolder': 'Adicionar subpasta', 'act.editNote': 'Editar nota', 'act.openAll': 'Abrir tudo', 'act.more': 'Mais',
  'act.edit': 'Editar', 'act.editFolder': 'Editar pasta',
  'menu.openAll': 'Abrir tudo ({n})', 'menu.openAllWindow': 'Abrir tudo em uma nova janela', 'menu.delete': 'Excluir', 'menu.edit': 'Editar…',
  'menu.export': 'Exportar…', 'menu.addWindowTabs': 'Adicionar todas as abas desta janela', 'menu.sortName': 'Ordenar por nome',
  'menu.dedupe': 'Remover links duplicados', 'menu.open': 'Abrir', 'menu.openWindow': 'Abrir em uma nova janela', 'menu.copyUrl': 'Copiar URL',
  'menu.copyUrls': 'Copiar URLs', 'menu.clearSel': 'Limpar seleção',
  'menu.openLinks': { one: 'Abrir {n} link', other: 'Abrir {n} links' },
  'menu.deleteItems': { one: 'Excluir {n} item', other: 'Excluir {n} itens' },
  'menu.deleteGroups': { one: 'Excluir {n} grupo', other: 'Excluir {n} grupos' },
  'search.aria': 'Pesquisar (Ctrl+F)', 'search.placeholder': 'Pesquisar links, grupos, pastas, notas…',
  'search.links': 'Links · {n}', 'search.containers': 'Espaços de trabalho, grupos e pastas · {n}', 'search.none': 'Nenhum resultado.',
  'search.foot': '↑↓ mover · Enter abrir · Ctrl+Enter aba em segundo plano · Esc fechar',
  'common.cancel': 'Cancelar', 'common.save': 'Salvar', 'common.close': 'Fechar', 'common.ok': 'OK', 'common.undo': 'Desfazer',
  'new.workspace': 'Novo espaço de trabalho', 'new.category': 'Nova categoria', 'new.group': 'Novo grupo', 'new.folder': 'Nova pasta', 'new.link': 'Novo link',
  'edit.workspace': 'Editar espaço de trabalho', 'edit.category': 'Editar categoria', 'edit.group': 'Editar grupo', 'edit.folder': 'Editar pasta', 'edit.link': 'Editar link',
  'field.name': 'Nome', 'field.symbol': 'Símbolo', 'field.description': 'Descrição', 'field.note': 'Nota (Markdown)', 'field.color': 'Cor', 'color.none': 'Padrão',
  'field.url': 'URL', 'field.icon': 'Ícone', 'field.symbolHint': '{label} (emoji, letra ou dígito, opcional)',
  'field.ctrlEnter': 'Ctrl+Enter para salvar',
  'icon.placeholder': 'URL da imagem, ou envie um arquivo. Vazio: favicon do site', 'icon.bad': 'Não foi possível ler essa imagem.',
  'icon.upload': 'Enviar', 'icon.clear': 'Limpar',
  'err.urlRequired': 'A URL é obrigatória.', 'err.urlInvalid': 'A URL não é válida.', 'err.nameRequired': 'O nome é obrigatório.', 'err.groupClash': 'Já existe um grupo com este nome e símbolo.',
  'err.symbol': 'O símbolo deve ser um emoji, uma letra ou um dígito.',
  'emoji.search': 'Pesquise um emoji (em inglês), ou digite uma letra / dígito', 'emoji.remove': 'Remover símbolo', 'emoji.letter': 'Letra {c}',
  'emoji.none': 'Nenhum emoji encontrado.', 'emoji.offline': 'Não foi possível carregar a lista de emojis (sem conexão?). Você ainda pode colar um emoji na caixa.',
  'del.workspace': 'Excluir o espaço de trabalho “{name}”?', 'del.category': 'Excluir a categoria “{name}”?', 'del.group': 'Excluir o grupo “{name}”?',
  'del.folder': 'Excluir a pasta “{name}”?', 'del.link': 'Excluir o link “{name}”?',
  'del.links': { one: 'O link dele também será excluído.', other: 'Os {n} links dele também serão excluídos.' },
  'del.groups': { one: 'Excluir {n} grupo?', other: 'Excluir {n} grupos?' },
  'del.groupsLinks': { one: 'O link deles também será excluído.', other: 'Os {n} links deles também serão excluídos.' },
  'open.many': 'Abrir {n} abas?', 'open.all': 'Abrir todas',
  'merge.title': 'Mesclar “{from}” em “{into}”?',
  'merge.text': { one: 'O link, as pastas e a nota dele vão para “{into}”, e depois “{from}” é removido.', other: 'Os {n} links, as pastas e a nota dele vão para “{into}”, e depois “{from}” é removido.' },
  'merge.ok': 'Mesclar',
  'picker.all': 'Selecionar tudo', 'picker.none': 'Nenhum', 'picker.count': '{n} de {total} selecionados', 'picker.toggle': 'Expandir / recolher',
  'export.title': 'Exportar dados', 'export.ok': 'Exportar', 'import.title': 'Importar de {file}', 'import.ok': 'Importar',
  'toast.deleted': '“{name}” excluído',
  'toast.deletedGroups': { one: '{n} grupo excluído', other: '{n} grupos excluídos' },
  'toast.deletedItems': { one: '{n} item excluído', other: '{n} itens excluídos' },
  'toast.suspended': { one: '{n} aba suspensa', other: '{n} abas suspensas' },
  'toast.closedDupes': { one: '{n} aba duplicada fechada', other: '{n} abas duplicadas fechadas' },
  'toast.extReloaded': 'A extensão do tabcat foi reiniciada. A página será recarregada quando você terminar de editar.',
  'toast.removedDupes': { one: '{n} link duplicado removido', other: '{n} links duplicados removidos' },
  'toast.copiedUrls': { one: '{n} URL copiada', other: '{n} URLs copiadas' },
  'toast.imported': { one: '{n} espaço de trabalho importado', other: '{n} espaços de trabalho importados' },
  'toast.needCategory': 'Crie uma categoria primeiro.', 'toast.urlCopied': 'URL copiada',
  'toast.windowSaved': 'Janela salva como novo grupo', 'toast.nothingToSave': 'Nada para salvar',
  'toast.merged': 'Mesclado em “{name}”', 'toast.dropFailed': 'Falha ao soltar: {error}',
  'toast.importFailed': 'Falha na importação: {error}', 'toast.settingsImported': 'Configurações importadas',
  'err.notJson': 'não é um arquivo JSON', 'err.noWorkspaces': 'nenhum espaço de trabalho encontrado',
  'err.notSettings': 'não é um arquivo de configurações do tabcat', 'err.noSettings': 'nenhuma configuração válida encontrada',
  'settings.title': 'Configurações', 'settings.general': 'Geral', 'settings.closeOnSave': 'Fechar as abas depois de salvá-las', 'settings.groupTabs': 'Agrupar abas ao abrir tudo', 'settings.checkUpdates': 'Verificar atualizações automaticamente',
  'settings.autoSuspend': 'Suspender automaticamente abas inativas após (minutos)', 'settings.off': 'Desativado', 'settings.columns': 'Colunas do quadro (1–8)',
  'settings.language': 'Idioma', 'settings.langAuto': 'Idioma do navegador',
  'settings.appearance': 'Aparência', 'settings.theme': 'Tema', 'settings.color': 'Cor',
  'theme.auto': 'Sistema', 'theme.light': 'Claro', 'theme.dark': 'Escuro',
  'accent.red': 'Vermelho', 'accent.orange': 'Laranja', 'accent.yellow': 'Amarelo', 'accent.lime': 'Lima', 'accent.green': 'Verde',
  'accent.teal': 'Verde-azulado', 'accent.sky': 'Azul-celeste', 'accent.blue': 'Azul', 'accent.purple': 'Roxo', 'accent.pink': 'Rosa', 'accent.mono': 'Monocromático',
  'settings.data': 'Dados', 'data.export': 'Exportar dados', 'data.import': 'Importar dados',
  'data.exportSettings': 'Exportar configurações', 'data.importSettings': 'Importar configurações', 'data.resetSettings': 'Redefinir configurações', 'reset.title': 'Redefinir todas as configurações?', 'reset.text': 'Idioma, tema, cor, colunas e as demais opções voltam ao padrão. Espaços de trabalho, grupos e links não são redefinidos.', 'reset.ok': 'Redefinir', 'toast.settingsReset': 'Configurações redefinidas', 'toast.undone': 'Desfeito', 'toast.redone': 'Refeito',
  'noun.group': 'grupo', 'noun.groupN': '{n} grupos', 'noun.link': 'link', 'noun.linkN': '{n} links', 'noun.folder': 'pasta', 'noun.folderN': '{n} pastas', 'noun.item': 'item', 'noun.itemN': '{n} itens', 'noun.workspace': 'espaço de trabalho', 'noun.workspaceN': '{n} espaços de trabalho', 'noun.category': 'categoria', 'noun.categoryN': '{n} categorias',
  'undo.delete': 'Exclusão desfeita: {what}', 'redo.delete': 'Exclusão refeita: {what}', 'undo.move': 'Movimentação desfeita: {what}', 'redo.move': 'Movimentação refeita: {what}', 'undo.merge': 'Mesclagem de grupos desfeita', 'redo.merge': 'Mesclagem de grupos refeita',
  'undo.closeDupes': 'Fechamento de abas duplicadas desfeito', 'redo.closeDupes': 'Fechamento de abas duplicadas refeito', 'undo.dedupe': 'Remoção de links duplicados desfeita', 'redo.dedupe': 'Remoção de links duplicados refeita',
  'undo.save': { one: 'Salvamento de {n} aba desfeito', other: 'Salvamento de {n} abas desfeito' }, 'redo.save': { one: 'Salvamento de {n} aba refeito', other: 'Salvamento de {n} abas refeito' },
  'data.note': 'A importação adiciona os itens escolhidos como novos espaços de trabalho; nada é sobrescrito. Os arquivos de configurações guardam as opções acima.',
  'settings.shortcuts': 'Atalhos',
  'settings.keys.html': '<kbd>Ctrl+F</kbd> pesquisar · <kbd>Alt+Shift+S</kbd> salvar aba · <kbd>Alt+Shift+A</kbd> salvar janela · <kbd>Ctrl+Shift+X</kbd> abrir painel · altere em <a href="chrome://extensions/shortcuts" id="shortcuts-link"><code>chrome://extensions/shortcuts</code></a>',
  'settings.done': 'Concluído',
  'help.title': 'Ajuda', 'info.title': 'Sobre', 'info.extension': 'Extensão', 'info.minimum': 'Extensão necessária', 'info.source': 'Código-fonte', 'info.issues': 'Relatar um problema', 'info.notConnected': 'não conectada',
  'info.update': 'Saiu a {version}', 'info.getUpdate': 'Baixar', 'info.updateBadge': 'Atualização disponível', 'info.check': 'Verificar atualizações', 'info.upToDate': 'Já está atualizado.', 'info.checkFailed': 'Não deu para verificar.',
  'help.org.html': `<h4>Como tudo se organiza</h4>
<p><b>Espaço de trabalho</b> › <b>Categoria</b> › <b>Grupo</b> › <b>Pasta</b> (até 4 níveis) e <b>Link</b>.
Escolha um espaço de trabalho à esquerda e uma categoria na barra acima do quadro; os grupos são os cartões do quadro.</p>`,
  'help.saving.html': `<h4>Salvar abas</h4>
<ul>
<li>Arraste uma aba de <b>Abas abertas</b> para um grupo, uma pasta ou entre links. Use <kbd>Shift</kbd>+clique ou <kbd>Shift</kbd>+arrastar para escolher várias abas (de várias janelas); arraste uma para levar todas, ou clique com o botão direito para Salvar / Suspender / Mover para uma nova janela / Fechar.</li>
<li>Arraste o cabeçalho de uma janela para salvar todas as abas dela; solte no espaço entre grupos ou abaixo de uma coluna para criar um novo grupo.</li>
<li>Botão da barra de ferramentas: renomeie a aba e escolha qualquer grupo ou pasta em <b>Salvar em</b>.</li>
<li>As abas salvas são fechadas quando <i>Fechar as abas depois de salvá-las</i> está ativado (Configurações).</li>
</ul>`,
  'help.board.html': `<h4>O quadro</h4>
<ul>
<li>Os grupos se empilham em colunas; o número de colunas fica na barra de categorias e nas Configurações.</li>
<li>Arraste um grupo pelo cabeçalho: solte na borda de cima ou de baixo de um cartão, num espaço ou abaixo de uma coluna para posicioná-lo; solte no meio de outro grupo para mesclar os dois.</li>
<li>Passe o ponteiro sobre o espaço entre grupos e clique na linha, ou passe abaixo de uma coluna, para adicionar um grupo ali.</li>
<li>Clique numa área vazia do cabeçalho de um grupo para recolhê-lo ou expandi-lo; clique duas vezes no nome para editá-lo.</li>
</ul>`,
  'help.select.html': `<h4>Selecionar grupos</h4>
<ul>
<li>Arraste uma caixa sobre uma área vazia do quadro, ou use <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+clique num cabeçalho. <kbd>Shift</kbd> inverte, <kbd>Ctrl</kbd>/<kbd>⌘</kbd> adiciona.</li>
<li>Enquanto houver grupos selecionados, os cliques selecionam em vez de abrir links. Arraste um para mover todos; <kbd>Delete</kbd> exclui; <kbd>Esc</kbd> limpa a seleção.</li>
<li>Links e pastas: <kbd>Shift</kbd>+clique para selecionar; a seleção fica no grupo do primeiro item. Clique com o botão direito num item selecionado para agir sobre todos.</li>
<li><kbd>Shift</kbd>+arrastar uma caixa em qualquer lugar: sobre dois ou mais grupos, o cabeçalho ou a maior parte de um grupo, seleciona grupos; dentro de um grupo, seleciona os links e pastas dele.</li>
</ul>`,
  'help.notes.html': `<h4>Notas e símbolos</h4>
<ul>
<li>As notas de grupo são Markdown com caixas de tarefa (<code>[ ]</code>, <code>[x]</code>) e matemática: <code>$…$</code> ou <code>\\(…\\)</code> no texto, <code>$$…$$</code> ou <code>\\[…\\]</code> em linha própria, e ambientes LaTeX como <code>\\begin{align}…\\end{align}</code> ou <code>\\begin{pmatrix}…\\end{pmatrix}</code>.</li>
<li>Um símbolo é um emoji, uma letra, um dígito ou o logo do tabcat; no editor, pesquise emojis pelo nome (em inglês).</li>
</ul>`,
  'help.memory.html': `<h4>Memória</h4>
<ul>
<li><b>Suspender</b> descarrega as abas inativas (elas recarregam ao serem abertas); <b>Duplicadas</b> fecha as abas repetidas.</li>
<li>A suspensão automática após N minutos sem uso fica nas Configurações.</li>
</ul>`,
  'help.keys.html': `<h4>Atalhos</h4>
<table class="keys">
<tr><td><kbd>Ctrl</kbd>+<kbd>F</kbd></td><td>Pesquisar</td></tr>
<tr><td><kbd>Ctrl</kbd>+<kbd>Z</kbd> / <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd></td><td>Desfazer / refazer (excluir, mover, salvar, fechar duplicadas…)</td></tr>
<tr><td><kbd>?</kbd></td><td>Este guia</td></tr>
<tr><td><kbd>Delete</kbd> · <kbd>Esc</kbd></td><td>Excluir / desmarcar os grupos selecionados</td></tr>
<tr><td><kbd>Ctrl</kbd>+<kbd>Enter</kbd></td><td>Salvar uma nota ou o editor</td></tr>
<tr><td>Letra num menu</td><td>Executa essa entrada do menu de contexto / ⋯ (ex.: <kbd>D</kbd> excluir, <kbd>E</kbd> editar)</td></tr>
<tr><td><kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd> / <kbd>A</kbd></td><td>Salvar esta aba / janela (em qualquer lugar)</td></tr>
<tr><td><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>X</kbd></td><td>Trazer o painel; de novo para voltar (em qualquer lugar)</td></tr>
</table>`,
  'help.data.html': `<h4>Seus dados</h4>
<p>A extensão guarda tudo neste navegador, nunca num servidor. Exporte / importe tudo (ou só as configurações) nas Configurações.</p>`,

  names: {
    order: 'noun-adj',
    adjectives: [a('tranquilo', 'tranquila'), a('dourado', 'dourada'), a('curioso', 'curiosa'), 'veloz', a('sereno', 'serena'),
      a('prateado', 'prateada'), 'ágil', 'alegre', 'suave', 'brilhante', a('calmo', 'calma'), 'valente', a('nebuloso', 'nebulosa'),
      'gentil', a('ensolarado', 'ensolarada'), a('sortudo', 'sortuda')],
    nouns: [['Lontra', 'f'], ['Cometa', 'm'], ['Seixo', 'm'], ['Porto', 'm'], ['Campina', 'f'], ['Lanterna', 'f'], ['Falcão', 'm'],
      ['Salgueiro', 'm'], ['Brasa', 'f'], ['Cânion', 'm'], ['Samambaia', 'f'], ['Órbita', 'f'], ['Gata', 'f'], ['Biscoito', 'm'], ['Brisa', 'f'], ['Bolota', 'f']],
  },
};
