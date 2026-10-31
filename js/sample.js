// Sample workspaces (Help > Add sample workspaces): a work board, a study board and a trip, in the
// dashboard's language, for trying tabcat out. Each link's icon is an emoji (nothing is fetched to draw it).

// English text -> its translations ([ko, ja, zh-CN, es, de, fr, pt-BR]); names of sites stay as they are
const LANGS = ['ko', 'ja', 'zh-CN', 'es', 'de', 'fr', 'pt-BR'];
const TR = {
  'Work': ['업무', '仕事', '工作', 'Trabajo', 'Arbeit', 'Travail', 'Trabalho'],
  'Day job': ['회사 일', '本業', '本职工作', 'El trabajo', 'Der Job', 'Le boulot', 'O trabalho'],
  'Study': ['공부', '勉強', '学习', 'Estudios', 'Studium', 'Études', 'Estudos'],
  'Lisbon trip': ['리스본 여행', 'リスボン旅行', '里斯本之旅', 'Viaje a Lisboa', 'Lissabon-Reise', 'Voyage à Lisbonne', 'Viagem a Lisboa'],
  'May 12–19': ['5월 12–19일', '5月12日〜19日', '5月12日–19日', '12–19 de mayo', '12.–19. Mai', '12–19 mai', '12–19 de maio'],
  'Project Atlas': ['아틀라스 프로젝트', 'プロジェクト Atlas', 'Atlas 项目', 'Proyecto Atlas', 'Projekt Atlas', 'Projet Atlas', 'Projeto Atlas'],
  'Hiring': ['채용', '採用', '招聘', 'Contratación', 'Recruiting', 'Recrutement', 'Contratação'],
  'Admin': ['행정', '事務', '行政', 'Administración', 'Verwaltung', 'Administratif', 'Administrativo'],
  'Machine learning': ['머신러닝', '機械学習', '机器学习', 'Aprendizaje automático', 'Maschinelles Lernen', 'Apprentissage automatique', 'Aprendizado de máquina'],
  'Plans': ['계획', '計画', '计划', 'Planes', 'Pläne', 'Projets', 'Planos'],
  'Design': ['디자인', 'デザイン', '设计', 'Diseño', 'Design', 'Design', 'Design'],
  'Sprint 14': ['스프린트 14', 'スプリント 14', '冲刺 14', 'Sprint 14', 'Sprint 14', 'Sprint 14', 'Sprint 14'],
  'Frontend': ['프론트엔드', 'フロントエンド', '前端', 'Frontend', 'Frontend', 'Frontend', 'Frontend'],
  'Backend': ['백엔드', 'バックエンド', '后端', 'Backend', 'Backend', 'Backend', 'Backend'],
  'Tooling': ['도구', 'ツール', '工具', 'Herramientas', 'Werkzeuge', 'Outils', 'Ferramentas'],
  'Research': ['리서치', 'リサーチ', '调研', 'Investigación', 'Recherche', 'Recherche', 'Pesquisa'],
  'Meetings': ['회의', 'ミーティング', '会议', 'Reuniones', 'Meetings', 'Réunions', 'Reuniões'],
  'Analytics': ['분석', '分析', '数据分析', 'Analítica', 'Analyse', 'Statistiques', 'Análises'],
  'Reading later': ['나중에 읽기', 'あとで読む', '稍后阅读', 'Para leer', 'Später lesen', 'À lire', 'Ler depois'],
  'Inbox': ['받은편지함', '受信箱', '收件箱', 'Bandeja de entrada', 'Posteingang', 'Boîte de réception', 'Caixa de entrada'],
  'Candidates': ['지원자', '候補者', '候选人', 'Candidatos', 'Bewerbungen', 'Candidats', 'Candidatos'],
  'Expenses': ['경비', '経費', '报销', 'Gastos', 'Ausgaben', 'Notes de frais', 'Despesas'],
  'Courses': ['강의', '講座', '课程', 'Cursos', 'Kurse', 'Cours', 'Cursos'],
  'Papers': ['논문', '論文', '论文', 'Artículos', 'Paper', 'Articles', 'Artigos'],
  'Tools': ['도구', 'ツール', '工具', 'Herramientas', 'Werkzeuge', 'Outils', 'Ferramentas'],
  'Getting there': ['가는 길', '行き方', '交通', 'Cómo llegar', 'Anreise', 'Y aller', 'Como chegar'],
  'Stay': ['숙소', '宿泊', '住宿', 'Alojamiento', 'Unterkunft', 'Hébergement', 'Hospedagem'],
  'Eat': ['맛집', 'グルメ', '美食', 'Comer', 'Essen', 'Manger', 'Comer'],
  'See': ['구경', '観光', '景点', 'Ver', 'Sehenswertes', 'À voir', 'Passeios'],
  'Getting around': ['이동', '移動', '市内交通', 'Moverse', 'Unterwegs', 'Se déplacer', 'Locomoção'],
  'Pull requests': ['풀 리퀘스트', 'プルリクエスト', '拉取请求', 'Pull requests', 'Pull Requests', 'Pull requests', 'Pull requests'],
  'Calendar': ['캘린더', 'カレンダー', '日历', 'Calendario', 'Kalender', 'Agenda', 'Agenda'],
  'Weekly notes — Notion': ['주간 회의록 — Notion', '週次メモ — Notion', '周会记录 — Notion', 'Notas semanales — Notion', 'Wochennotizen — Notion', 'Notes de la semaine — Notion', 'Notas semanais — Notion'],
  'Board — Linear': ['보드 — Linear', 'ボード — Linear', '看板 — Linear', 'Tablero — Linear', 'Board — Linear', 'Tableau — Linear', 'Quadro — Linear'],
  'Coolors palettes': ['Coolors 팔레트', 'Coolors パレット', 'Coolors 配色', 'Paletas de Coolors', 'Coolors-Paletten', 'Palettes Coolors', 'Paletas do Coolors'],
  'Dribbble shots': ['Dribbble 레퍼런스', 'Dribbble の作品', 'Dribbble 作品', 'Inspiración en Dribbble', 'Dribbble-Shots', 'Inspirations Dribbble', 'Inspirações no Dribbble'],
  'TypeScript handbook': ['TypeScript 핸드북', 'TypeScript ハンドブック', 'TypeScript 手册', 'Manual de TypeScript', 'TypeScript-Handbuch', 'Manuel TypeScript', 'Manual do TypeScript'],
  'Postgres docs': ['Postgres 문서', 'Postgres ドキュメント', 'Postgres 文档', 'Documentación de Postgres', 'Postgres-Doku', 'Doc Postgres', 'Documentação do Postgres'],
  'Cloudflare dashboard': ['Cloudflare 대시보드', 'Cloudflare ダッシュボード', 'Cloudflare 控制台', 'Panel de Cloudflare', 'Cloudflare-Dashboard', 'Tableau de bord Cloudflare', 'Painel da Cloudflare'],
  'Sentry issues': ['Sentry 이슈', 'Sentry のイシュー', 'Sentry 问题', 'Errores en Sentry', 'Sentry-Issues', 'Erreurs Sentry', 'Erros no Sentry'],
  'Flights — Google': ['항공권 — Google', '航空券 — Google', '机票 — Google', 'Vuelos — Google', 'Flüge — Google', 'Vols — Google', 'Voos — Google'],
  'Lisbon airport': ['리스본 공항', 'リスボン空港', '里斯本机场', 'Aeropuerto de Lisboa', 'Flughafen Lissabon', 'Aéroport de Lisbonne', 'Aeroporto de Lisboa'],
  'Airbnb — Alfama flat': ['Airbnb — 알파마 숙소', 'Airbnb — アルファマのアパート', 'Airbnb — 阿尔法玛公寓', 'Airbnb — piso en Alfama', 'Airbnb — Wohnung in der Alfama', "Airbnb — appart' à Alfama", 'Airbnb — apê em Alfama'],
  'Belém Tower': ['벨렝 탑', 'ベレンの塔', '贝伦塔', 'Torre de Belém', 'Turm von Belém', 'Tour de Belém', 'Torre de Belém'],
  'Sintra day trip': ['신트라 당일치기', 'シントラ日帰り旅行', '辛特拉一日游', 'Excursión a Sintra', 'Tagesausflug nach Sintra', 'Excursion à Sintra', 'Bate-volta a Sintra'],
  'Gulbenkian Museum': ['굴벤키안 미술관', 'グルベンキアン美術館', '古尔本基安博物馆', 'Museo Gulbenkian', 'Gulbenkian-Museum', 'Musée Gulbenkian', 'Museu Gulbenkian'],
  'Carris trams': ['카리스 트램', 'カリス路面電車', 'Carris 电车', 'Tranvías de Carris', 'Carris-Straßenbahnen', 'Trams Carris', 'Bondes da Carris'],
  'Metro de Lisboa': ['리스본 지하철', 'リスボン地下鉄', '里斯本地铁', 'Metro de Lisboa', 'Metro de Lisboa', 'Metro de Lisboa', 'Metrô de Lisboa'],
  // notes
  '**Due Friday**\n\n[x] Ship the onboarding flow\n[x] Fix the login redirect\n[ ] Review PR #212\n[ ] Write the release notes': [
    '**금요일 마감**\n\n[x] 온보딩 화면 배포\n[x] 로그인 리다이렉트 수정\n[ ] PR #212 리뷰\n[ ] 릴리스 노트 쓰기',
    '**金曜締め切り**\n\n[x] オンボーディングを公開\n[x] ログイン後のリダイレクトを修正\n[ ] PR #212 をレビュー\n[ ] リリースノートを書く',
    '**周五截止**\n\n[x] 上线新手引导\n[x] 修复登录跳转\n[ ] 审查 PR #212\n[ ] 撰写发布说明',
    '**Para el viernes**\n\n[x] Publicar el onboarding\n[x] Arreglar la redirección del login\n[ ] Revisar el PR #212\n[ ] Escribir las notas de versión',
    '**Fällig am Freitag**\n\n[x] Onboarding ausliefern\n[x] Login-Weiterleitung reparieren\n[ ] PR #212 reviewen\n[ ] Release Notes schreiben',
    '**Pour vendredi**\n\n[x] Livrer l’onboarding\n[x] Corriger la redirection après connexion\n[ ] Relire la PR #212\n[ ] Rédiger les notes de version',
    '**Para sexta**\n\n[x] Lançar o onboarding\n[x] Corrigir o redirecionamento do login\n[ ] Revisar o PR #212\n[ ] Escrever as notas da versão'],
  'Standup at **10:00**, retro on Thursdays.': [
    '스탠드업 **10:00**, 회고는 목요일.', 'スタンドアップは **10:00**、振り返りは木曜日。', '站会 **10:00**，周四复盘。',
    'Daily a las **10:00**, retro los jueves.', 'Standup um **10:00**, Retro donnerstags.', 'Point quotidien à **10 h**, rétro le jeudi.', 'Daily às **10:00**, retrô às quintas.'],
  'Notation: $\\mathcal{L}(\\theta) = -\\sum_i \\log p_\\theta(y_i \\mid x_i)$': [
    '표기: $\\mathcal{L}(\\theta) = -\\sum_i \\log p_\\theta(y_i \\mid x_i)$', '記法: $\\mathcal{L}(\\theta) = -\\sum_i \\log p_\\theta(y_i \\mid x_i)$',
    '记号：$\\mathcal{L}(\\theta) = -\\sum_i \\log p_\\theta(y_i \\mid x_i)$', 'Notación: $\\mathcal{L}(\\theta) = -\\sum_i \\log p_\\theta(y_i \\mid x_i)$',
    'Notation: $\\mathcal{L}(\\theta) = -\\sum_i \\log p_\\theta(y_i \\mid x_i)$', 'Notation : $\\mathcal{L}(\\theta) = -\\sum_i \\log p_\\theta(y_i \\mid x_i)$',
    'Notação: $\\mathcal{L}(\\theta) = -\\sum_i \\log p_\\theta(y_i \\mid x_i)$'],
  '[x] Book flights\n[x] Passport valid until 2029\n[ ] Travel insurance': [
    '[x] 항공권 예약\n[x] 여권 2029년까지 유효\n[ ] 여행자 보험', '[x] 航空券を予約\n[x] パスポートは2029年まで有効\n[ ] 旅行保険',
    '[x] 订机票\n[x] 护照有效期至 2029 年\n[ ] 旅行保险', '[x] Reservar los vuelos\n[x] Pasaporte válido hasta 2029\n[ ] Seguro de viaje',
    '[x] Flüge buchen\n[x] Pass gültig bis 2029\n[ ] Reiseversicherung', '[x] Réserver les vols\n[x] Passeport valable jusqu’en 2029\n[ ] Assurance voyage',
    '[x] Reservar os voos\n[x] Passaporte válido até 2029\n[ ] Seguro viagem'],
};

// a link's icon: an emoji, drawn as a little picture (by the system's emoji font: nothing is fetched)
const emoji = (e) => 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><text x="16" y="26" font-size="27" text-anchor="middle">${e}</text></svg>`);
const L = (name, url, e) => ({ type: 'link', name, url, icon: emoji(e), description: '' });
const F = (name, items, symbol = '') => ({ type: 'folder', name, symbol, collapsed: false, items });
const G = (name, column, items, { symbol = '', color = '', note = '' } = {}) => ({ type: 'group', name, column, symbol, color, note, collapsed: false, items });
const C = (name, groups) => ({ type: 'category', name, groups });
const W = (name, symbol, categories, description = '') => ({ type: 'workspace', name, symbol, description, categories });

const BOARD = () => [
  W('Work', '💼', [
    C('Project Atlas', [
      G('Design', 0, [L('Atlas — Figma', 'https://www.figma.com/', '✏️'), L('Material Design 3', 'https://m3.material.io/', '🧩'),
        L('Coolors palettes', 'https://coolors.co/', '🌈'), L('Dribbble shots', 'https://dribbble.com/', '🏀')], { symbol: '🎨', color: 'purple' }),
      G('Sprint 14', 0, [L('Board — Linear', 'https://linear.app/', '📋'), L('Pull requests', 'https://github.com/pulls', '🔀')],
        { color: 'orange', note: '**Due Friday**\n\n[x] Ship the onboarding flow\n[x] Fix the login redirect\n[ ] Review PR #212\n[ ] Write the release notes' }),
      G('Frontend', 1, [L('React', 'https://react.dev/', '⚛️'), L('MDN Web Docs', 'https://developer.mozilla.org/', '📘'),
        F('Tooling', [L('Vite', 'https://vite.dev/', '⚡'), L('TypeScript handbook', 'https://www.typescriptlang.org/docs/', '📗'), L('Can I use', 'https://caniuse.com/', '✅')], '🛠️'),
        L('web.dev', 'https://web.dev/', '🌐')], { symbol: '⚛️', color: 'blue' }),
      G('Backend', 1, [L('Postgres docs', 'https://www.postgresql.org/docs/', '🐘'), L('Redis', 'https://redis.io/docs/', '🧱'),
        L('Cloudflare dashboard', 'https://dash.cloudflare.com/', '☁️')], { symbol: 'B', color: 'cyan' }),
      G('Research', 2, [L('Nielsen Norman Group', 'https://www.nngroup.com/articles/', '🧠'), L('Smashing Magazine', 'https://www.smashingmagazine.com/', '📰'),
        L('A List Apart', 'https://alistapart.com/', '📐'), L('CSS-Tricks', 'https://css-tricks.com/', '🪄'), L('Hacker News', 'https://news.ycombinator.com/', '🗞️')], { symbol: '🔬', color: 'green' }),
      G('Meetings', 2, [L('Calendar', 'https://calendar.google.com/', '🗓️'), L('Meet', 'https://meet.google.com/', '🎥'), L('Weekly notes — Notion', 'https://www.notion.so/', '📝')],
        { symbol: '📅', color: 'yellow', note: 'Standup at **10:00**, retro on Thursdays.' }),
      G('Analytics', 3, [L('Search Console', 'https://search.google.com/search-console', '🔍'), L('Plausible', 'https://plausible.io/', '📊'),
        L('Sentry issues', 'https://sentry.io/', '🐛')], { symbol: '📈', color: 'pink' }),
      G('Reading later', 3, [L('Refactoring UI', 'https://www.refactoringui.com/', '🖌️'), L('The Pragmatic Engineer', 'https://newsletter.pragmaticengineer.com/', '📨'),
        L('Lobsters', 'https://lobste.rs/', '🦞'), L('Stratechery', 'https://stratechery.com/', '♟️')], { symbol: '📖' }),
      G('Inbox', 3, [L('Gmail', 'https://mail.google.com/', '📧'), L('Slack', 'https://app.slack.com/', '💬'), L('Google Drive', 'https://drive.google.com/', '🗂️')], { symbol: '✉️', color: 'red' }),
    ]),
    C('Hiring', [G('Candidates', 0, [L('Greenhouse', 'https://www.greenhouse.io/', '🌱')])]),
    C('Admin', [G('Expenses', 0, [L('Expensify', 'https://www.expensify.com/', '🧾')])]),
  ], 'Day job'),
  W('Study', '📚', [C('Machine learning', [
    G('Courses', 0, [L('fast.ai', 'https://course.fast.ai/', '🚀'), L('CS229', 'https://cs229.stanford.edu/', '🏫'), L('Coursera', 'https://www.coursera.org/', '🖥️')], { symbol: '🎓', color: 'blue' }),
    G('Papers', 1, [L('arXiv cs.LG', 'https://arxiv.org/list/cs.LG/recent', '📑'), L('Papers with Code', 'https://paperswithcode.com/', '💻'), L('Distill', 'https://distill.pub/', '💧')],
      { symbol: '📄', color: 'purple', note: 'Notation: $\\mathcal{L}(\\theta) = -\\sum_i \\log p_\\theta(y_i \\mid x_i)$' }),
    G('Tools', 2, [L('Colab', 'https://colab.research.google.com/', '📓'), L('Hugging Face', 'https://huggingface.co/', '🤗'), L('Kaggle', 'https://www.kaggle.com/', '🏆')], { symbol: '🧪', color: 'green' }),
  ])]),
  W('Lisbon trip', '✈️', [C('Plans', [
    G('Getting there', 0, [L('Flights — Google', 'https://www.google.com/travel/flights', '🎫'), L('TAP Air Portugal', 'https://www.flytap.com/', '🛩️'), L('Lisbon airport', 'https://www.aeroportolisboa.pt/', '🛄')],
      { symbol: '🛫', color: 'blue', note: '[x] Book flights\n[x] Passport valid until 2029\n[ ] Travel insurance' }),
    G('Stay', 1, [L('Airbnb — Alfama flat', 'https://www.airbnb.com/', '🛏️'), L('Booking.com', 'https://www.booking.com/', '🏨')], { symbol: '🏠', color: 'orange' }),
    G('Eat', 2, [L('Time Out Market', 'https://www.timeoutmarket.com/', '🥘'), L('Pastéis de Belém', 'https://pasteisdebelem.pt/', '🥮'), L('The Fork', 'https://www.thefork.com/', '🍴')], { symbol: '🍽️', color: 'red' }),
    G('See', 1, [L('Belém Tower', 'https://www.visitlisboa.com/', '🗼'), L('Sintra day trip', 'https://www.parquesdesintra.pt/', '🏰'), L('Gulbenkian Museum', 'https://gulbenkian.pt/', '🖼️')], { symbol: '🏛️', color: 'green' }),
    G('Getting around', 0, [L('Carris trams', 'https://www.carris.pt/', '🚃'), L('Metro de Lisboa', 'https://www.metrolisboa.pt/', '🚇'), L('Bolt', 'https://bolt.eu/', '🚕')], { symbol: '🚋', color: 'yellow' }),
  ])], 'May 12–19'),
];

// The sample workspaces (no ids: the extension gives them fresh ones), their text in `lang`.
export function sampleWorkspaces(lang) {
  const i = LANGS.indexOf(lang);
  const tr = (s) => (i >= 0 && TR[s]?.[i]) || s;
  const walk = (n) => {
    for (const k of ['name', 'description', 'note']) if (typeof n[k] === 'string') n[k] = tr(n[k]);
    for (const k of ['categories', 'groups', 'items']) n[k]?.forEach(walk);
    return n;
  };
  return BOARD().map(walk);
}
