// tabcat extension strings (popup, context menus, default names). The dashboard has its own, larger
// dictionaries; the language setting ('auto' or one of LANGS) is shared through the settings.
//
// A value is a string, or { one, other } chosen by Intl.PluralRules; '{n}' and other '{name}'
// placeholders are filled from the vars passed to t().

export const LANGS = ['en', 'ko', 'ja', 'zh-CN', 'es', 'de', 'fr', 'pt-BR'];

const M = {
  en: {
    menuOpen: 'Go tabcat',
    menuSaveTab: 'Save this tab to tabcat',
    menuSaveLink: 'Save link to tabcat',
    menuSaveWindow: 'Save all tabs in this window',
    menuSuspend: 'Suspend other tabs (free memory)',
    menuDedupe: 'Close duplicate tabs',
    defWorkspace: 'My Workspace', defCategory: 'General', defInbox: 'Inbox',
    defGroup: 'Group', defFolder: 'Folder', defLink: 'Untitled', savedAt: 'Saved {date}',
    name: 'Name', saveTo: 'Save to:', searchTargets: 'Search groups and folders',
    closeAfter: 'Close tab after saving', saveTab: 'Save this tab',
    saveWindow: 'Save window', saveWindowTip: 'Save all tabs of this window as a new group',
    suspend: 'Suspend tabs', suspendTip: 'Unload inactive tabs from memory',
    dedupe: 'Close duplicates', openDashboard: 'Open dashboard',
    cannotSave: 'This page cannot be saved', saved: 'Saved ✔', savingWindow: 'Saving window…',
    windowSaved: 'Window saved as a new group ✔', nothingToSave: 'Nothing to save',
    suspended: { one: 'Suspended {n} tab', other: 'Suspended {n} tabs' },
    closedDupes: { one: 'Closed {n} duplicate', other: 'Closed {n} duplicates' },
    tabCount: { one: '{n} tab', other: '{n} tabs' }, sleeping: '{n} suspended',
    inboxNew: 'Inbox (new)', newGroupNote: 'A new group will be created', noTargets: 'No matching groups or folders',
  },
  ko: {
    menuOpen: 'tabcat 열기',
    menuSaveTab: '이 탭을 tabcat에 저장',
    menuSaveLink: '링크를 tabcat에 저장',
    menuSaveWindow: '이 창의 모든 탭 저장',
    menuSuspend: '다른 탭 일시 중지 (메모리 확보)',
    menuDedupe: '중복 탭 닫기',
    defWorkspace: '내 워크스페이스', defCategory: '일반', defInbox: '받은 탭',
    defGroup: '그룹', defFolder: '폴더', defLink: '제목 없음', savedAt: '{date} 저장',
    name: '이름', saveTo: '저장 위치:', searchTargets: '그룹과 폴더 검색',
    closeAfter: '저장한 뒤 탭 닫기', saveTab: '이 탭 저장',
    saveWindow: '창 저장', saveWindowTip: '이 창의 모든 탭을 새 그룹으로 저장',
    suspend: '탭 일시 중지', suspendTip: '비활성 탭을 메모리에서 내리기',
    dedupe: '중복 닫기', openDashboard: '대시보드 열기',
    cannotSave: '이 페이지는 저장할 수 없습니다', saved: '저장됨 ✔', savingWindow: '창 저장 중…',
    windowSaved: '창을 새 그룹으로 저장했습니다 ✔', nothingToSave: '저장할 탭이 없습니다',
    suspended: '탭 {n}개를 일시 중지했습니다',
    closedDupes: '중복 탭 {n}개를 닫았습니다',
    tabCount: '탭 {n}개', sleeping: '{n}개 일시 중지',
    inboxNew: '받은 탭 (새로 만들기)', newGroupNote: '새 그룹이 만들어집니다', noTargets: '일치하는 그룹이나 폴더가 없습니다',
  },
  ja: {
    menuOpen: 'tabcat を開く',
    menuSaveTab: 'このタブを tabcat に保存',
    menuSaveLink: 'リンクを tabcat に保存',
    menuSaveWindow: 'このウィンドウのタブをすべて保存',
    menuSuspend: 'ほかのタブを休止 (メモリを解放)',
    menuDedupe: '重複したタブを閉じる',
    defWorkspace: 'マイワークスペース', defCategory: '一般', defInbox: '受信トレイ',
    defGroup: 'グループ', defFolder: 'フォルダ', defLink: '無題', savedAt: '{date} に保存',
    name: '名前', saveTo: '保存先:', searchTargets: 'グループとフォルダを検索',
    closeAfter: '保存後にタブを閉じる', saveTab: 'このタブを保存',
    saveWindow: 'ウィンドウを保存', saveWindowTip: 'このウィンドウのタブをすべて新しいグループとして保存',
    suspend: 'タブを休止', suspendTip: '非アクティブなタブをメモリから解放',
    dedupe: '重複を閉じる', openDashboard: 'ダッシュボードを開く',
    cannotSave: 'このページは保存できません', saved: '保存しました ✔', savingWindow: 'ウィンドウを保存中…',
    windowSaved: 'ウィンドウを新しいグループとして保存しました ✔', nothingToSave: '保存するものがありません',
    suspended: '{n} 個のタブを休止しました',
    closedDupes: '{n} 個の重複を閉じました',
    tabCount: 'タブ {n} 個', sleeping: '{n} 個休止中',
    inboxNew: '受信トレイ (新規)', newGroupNote: '新しいグループが作成されます', noTargets: '一致するグループやフォルダはありません',
  },
  'zh-CN': {
    menuOpen: '打开 tabcat',
    menuSaveTab: '将此标签页保存到 tabcat',
    menuSaveLink: '将链接保存到 tabcat',
    menuSaveWindow: '保存此窗口中的所有标签页',
    menuSuspend: '休眠其他标签页 (释放内存)',
    menuDedupe: '关闭重复的标签页',
    defWorkspace: '我的工作区', defCategory: '常规', defInbox: '收件箱',
    defGroup: '分组', defFolder: '文件夹', defLink: '无标题', savedAt: '保存于 {date}',
    name: '名称', saveTo: '保存到:', searchTargets: '搜索分组和文件夹',
    closeAfter: '保存后关闭标签页', saveTab: '保存此标签页',
    saveWindow: '保存窗口', saveWindowTip: '将此窗口的所有标签页保存为新分组',
    suspend: '休眠标签页', suspendTip: '从内存中卸载不活跃的标签页',
    dedupe: '关闭重复项', openDashboard: '打开仪表板',
    cannotSave: '无法保存此页面', saved: '已保存 ✔', savingWindow: '正在保存窗口…',
    windowSaved: '已将窗口保存为新分组 ✔', nothingToSave: '没有可保存的内容',
    suspended: '已休眠 {n} 个标签页',
    closedDupes: '已关闭 {n} 个重复项',
    tabCount: '{n} 个标签页', sleeping: '{n} 个已休眠',
    inboxNew: '收件箱 (新建)', newGroupNote: '将创建一个新分组', noTargets: '没有匹配的分组或文件夹',
  },
  es: {
    menuOpen: 'Ir a tabcat',
    menuSaveTab: 'Guardar esta pestaña en tabcat',
    menuSaveLink: 'Guardar enlace en tabcat',
    menuSaveWindow: 'Guardar todas las pestañas de esta ventana',
    menuSuspend: 'Suspender las demás pestañas (liberar memoria)',
    menuDedupe: 'Cerrar pestañas duplicadas',
    defWorkspace: 'Mi espacio de trabajo', defCategory: 'General', defInbox: 'Bandeja de entrada',
    defGroup: 'Grupo', defFolder: 'Carpeta', defLink: 'Sin título', savedAt: 'Guardado {date}',
    name: 'Nombre', saveTo: 'Guardar en:', searchTargets: 'Buscar grupos y carpetas',
    closeAfter: 'Cerrar la pestaña al guardarla', saveTab: 'Guardar esta pestaña',
    saveWindow: 'Guardar ventana', saveWindowTip: 'Guardar todas las pestañas de esta ventana como un grupo nuevo',
    suspend: 'Suspender pestañas', suspendTip: 'Descargar de la memoria las pestañas inactivas',
    dedupe: 'Cerrar duplicadas', openDashboard: 'Abrir panel',
    cannotSave: 'Esta página no se puede guardar', saved: 'Guardado ✔', savingWindow: 'Guardando ventana…',
    windowSaved: 'Ventana guardada como grupo nuevo ✔', nothingToSave: 'No hay nada que guardar',
    suspended: { one: '{n} pestaña suspendida', other: '{n} pestañas suspendidas' },
    closedDupes: { one: '{n} duplicada cerrada', other: '{n} duplicadas cerradas' },
    tabCount: { one: '{n} pestaña', other: '{n} pestañas' }, sleeping: '{n} suspendidas',
    inboxNew: 'Bandeja de entrada (nueva)', newGroupNote: 'Se creará un grupo nuevo', noTargets: 'Ningún grupo ni carpeta coincide',
  },
  de: {
    menuOpen: 'tabcat öffnen',
    menuSaveTab: 'Diesen Tab in tabcat speichern',
    menuSaveLink: 'Link in tabcat speichern',
    menuSaveWindow: 'Alle Tabs dieses Fensters speichern',
    menuSuspend: 'Andere Tabs pausieren (Speicher freigeben)',
    menuDedupe: 'Doppelte Tabs schließen',
    defWorkspace: 'Mein Arbeitsbereich', defCategory: 'Allgemein', defInbox: 'Eingang',
    defGroup: 'Gruppe', defFolder: 'Ordner', defLink: 'Ohne Titel', savedAt: 'Gespeichert {date}',
    name: 'Name', saveTo: 'Speichern in:', searchTargets: 'Gruppen und Ordner suchen',
    closeAfter: 'Tab nach dem Speichern schließen', saveTab: 'Diesen Tab speichern',
    saveWindow: 'Fenster speichern', saveWindowTip: 'Alle Tabs dieses Fensters als neue Gruppe speichern',
    suspend: 'Tabs pausieren', suspendTip: 'Inaktive Tabs aus dem Speicher entladen',
    dedupe: 'Duplikate schließen', openDashboard: 'Dashboard öffnen',
    cannotSave: 'Diese Seite kann nicht gespeichert werden', saved: 'Gespeichert ✔', savingWindow: 'Fenster wird gespeichert…',
    windowSaved: 'Fenster als neue Gruppe gespeichert ✔', nothingToSave: 'Nichts zu speichern',
    suspended: { one: '{n} Tab pausiert', other: '{n} Tabs pausiert' },
    closedDupes: { one: '{n} Duplikat geschlossen', other: '{n} Duplikate geschlossen' },
    tabCount: { one: '{n} Tab', other: '{n} Tabs' }, sleeping: '{n} pausiert',
    inboxNew: 'Eingang (neu)', newGroupNote: 'Eine neue Gruppe wird erstellt', noTargets: 'Keine passenden Gruppen oder Ordner',
  },
  fr: {
    menuOpen: 'Ouvrir tabcat',
    menuSaveTab: 'Enregistrer cet onglet dans tabcat',
    menuSaveLink: 'Enregistrer le lien dans tabcat',
    menuSaveWindow: 'Enregistrer tous les onglets de cette fenêtre',
    menuSuspend: 'Suspendre les autres onglets (libérer la mémoire)',
    menuDedupe: 'Fermer les onglets en double',
    defWorkspace: 'Mon espace de travail', defCategory: 'Général', defInbox: 'Boîte de réception',
    defGroup: 'Groupe', defFolder: 'Dossier', defLink: 'Sans titre', savedAt: 'Enregistré le {date}',
    name: 'Nom', saveTo: 'Enregistrer dans :', searchTargets: 'Rechercher des groupes et dossiers',
    closeAfter: 'Fermer l’onglet après l’enregistrement', saveTab: 'Enregistrer cet onglet',
    saveWindow: 'Enregistrer la fenêtre', saveWindowTip: 'Enregistrer tous les onglets de cette fenêtre dans un nouveau groupe',
    suspend: 'Suspendre les onglets', suspendTip: 'Décharger de la mémoire les onglets inactifs',
    dedupe: 'Fermer les doublons', openDashboard: 'Ouvrir le tableau de bord',
    cannotSave: 'Impossible d’enregistrer cette page', saved: 'Enregistré ✔', savingWindow: 'Enregistrement de la fenêtre…',
    windowSaved: 'Fenêtre enregistrée dans un nouveau groupe ✔', nothingToSave: 'Rien à enregistrer',
    suspended: { one: '{n} onglet suspendu', other: '{n} onglets suspendus' },
    closedDupes: { one: '{n} doublon fermé', other: '{n} doublons fermés' },
    tabCount: { one: '{n} onglet', other: '{n} onglets' }, sleeping: '{n} suspendus',
    inboxNew: 'Boîte de réception (nouvelle)', newGroupNote: 'Un nouveau groupe sera créé', noTargets: 'Aucun groupe ni dossier correspondant',
  },
  'pt-BR': {
    menuOpen: 'Abrir o tabcat',
    menuSaveTab: 'Salvar esta aba no tabcat',
    menuSaveLink: 'Salvar link no tabcat',
    menuSaveWindow: 'Salvar todas as abas desta janela',
    menuSuspend: 'Suspender as outras abas (liberar memória)',
    menuDedupe: 'Fechar abas duplicadas',
    defWorkspace: 'Meu espaço de trabalho', defCategory: 'Geral', defInbox: 'Caixa de entrada',
    defGroup: 'Grupo', defFolder: 'Pasta', defLink: 'Sem título', savedAt: 'Salvo em {date}',
    name: 'Nome', saveTo: 'Salvar em:', searchTargets: 'Pesquisar grupos e pastas',
    closeAfter: 'Fechar a aba depois de salvar', saveTab: 'Salvar esta aba',
    saveWindow: 'Salvar janela', saveWindowTip: 'Salvar todas as abas desta janela como um novo grupo',
    suspend: 'Suspender abas', suspendTip: 'Descarregar da memória as abas inativas',
    dedupe: 'Fechar duplicadas', openDashboard: 'Abrir painel',
    cannotSave: 'Esta página não pode ser salva', saved: 'Salvo ✔', savingWindow: 'Salvando janela…',
    windowSaved: 'Janela salva como novo grupo ✔', nothingToSave: 'Nada para salvar',
    suspended: { one: '{n} aba suspensa', other: '{n} abas suspensas' },
    closedDupes: { one: '{n} duplicada fechada', other: '{n} duplicadas fechadas' },
    tabCount: { one: '{n} aba', other: '{n} abas' }, sleeping: '{n} suspensas',
    inboxNew: 'Caixa de entrada (nova)', newGroupNote: 'Um novo grupo será criado', noTargets: 'Nenhum grupo ou pasta corresponde',
  },
};

let lang = 'en';

// 'auto' (or anything unknown) follows the browser's UI language
export function resolveLang(setting, ui = globalThis.chrome?.i18n?.getUILanguage?.() || 'en') {
  if (LANGS.includes(setting)) return setting;
  const tag = String(ui).toLowerCase();
  return LANGS.find((l) => l.toLowerCase() === tag)
    || (tag.startsWith('zh') ? 'zh-CN' : tag.startsWith('pt') ? 'pt-BR' : LANGS.find((l) => l === tag.split('-')[0]))
    || 'en';
}

export function setLang(setting) {
  lang = resolveLang(setting);
  return lang;
}

export const getLang = () => lang;

export function t(key, vars = {}) {
  let v = M[lang]?.[key] ?? M.en[key] ?? key;
  if (typeof v === 'object') v = v[new Intl.PluralRules(lang).select(vars.n ?? 0)] ?? v.other;
  return v.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
}
