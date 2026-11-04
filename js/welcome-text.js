// The welcome page's text (welcome.html, opened once tabcat is installed), in the dashboard's languages. Each language
// says the same thing; change them together. In a step, {copy} marks where its command goes (see COMMANDS in
// welcome.js), {allow} and {connect} the extension's own words (its Allow button, its toolbar menu's Connect to a
// server), {keys} the shortcut.
export const TEXT = {
  en: {
    title: 'Welcome', hello: 'tabcat is ready',
    lead: 'Save your tabs into groups and open them again whenever you need. Choose how you\'d like to use it; you can change your mind any time.',
    shortcut: 'Press {keys} on any page to bring up your dashboard, and again to go back.',
    recommended: 'Recommended', show: 'How to set it up', hide: 'Hide the steps', copy: 'Copy', copied: 'Copied', privacy: 'Privacy',
    ways: {
      online: {
        title: 'Use the online dashboard', go: 'Open the dashboard',
        text: 'Nothing to set up. The dashboard at tabcat.ghyeok.com only shows what the extension keeps, and everything stays in this browser.',
        tags: ['No setup', 'Data stays in this browser'],
      },
      self: {
        title: 'Host the dashboard yourself', go: 'More in the README',
        text: 'The dashboard is a static page: serve your own copy on this computer, with no account and no server program. Your data still stays in this browser.',
        tags: ['A few commands', 'Data stays in this browser'],
        steps: ['Get the dashboard\'s files {copy}', 'Serve them on this computer {copy}', 'Open http://localhost:8080/ and choose {allow} when tabcat asks. From then on, the shortcut and the toolbar button open this dashboard.'],
      },
      server: {
        title: 'Run your own server', go: 'Server guide',
        text: 'Your tabs on every computer, and boards your team works on together. tabcat server keeps each account\'s data on a computer of yours and keeps every browser in step, live.',
        tags: ['Sync', 'Shared workspaces', 'Accounts'],
        steps: ['Install it on a computer of yours, with Python 3.10 or later (Docker works too: see the guide) {copy}', 'Start it, then open http://localhost:8080 on that computer to make the first account, the admin {copy}', 'In each browser, right-click tabcat\'s toolbar button, choose {connect}, enter the server\'s address and sign in.'],
      },
    },
  },
  ko: {
    title: '환영합니다', hello: 'tabcat이 준비됐어요',
    lead: '탭을 그룹으로 저장해 두고 필요할 때 다시 여세요. 어떻게 쓸지 골라 보세요. 나중에 언제든 바꿀 수 있어요.',
    shortcut: '어느 페이지에서든 {keys}를 누르면 대시보드가 열리고, 한 번 더 누르면 돌아가요.',
    recommended: '추천', show: '설정 방법 보기', hide: '설정 방법 접기', copy: '복사', copied: '복사됨', privacy: '개인정보처리방침',
    ways: {
      online: {
        title: '온라인 대시보드로 쓰기', go: '대시보드 열기',
        text: '설정할 것이 없어요. tabcat.ghyeok.com의 대시보드는 확장 프로그램이 보관한 내용을 보여 줄 뿐이고, 모든 데이터는 이 브라우저에 남아요.',
        tags: ['설정 불필요', '데이터는 이 브라우저에'],
      },
      self: {
        title: '대시보드를 직접 호스팅하기', go: 'README에서 더 보기',
        text: '대시보드는 정적 페이지예요. 계정이나 서버 프로그램 없이 이 컴퓨터에서 내 사본을 띄워 쓸 수 있어요. 데이터는 그대로 이 브라우저에 남아요.',
        tags: ['명령어 몇 줄', '데이터는 이 브라우저에'],
        steps: ['대시보드 파일을 받아요 {copy}', '이 컴퓨터에서 띄워요 {copy}', 'http://localhost:8080/ 을 열고, tabcat이 물으면 {allow}을 눌러요. 그다음부터는 단축키와 툴바 버튼이 이 대시보드를 열어요.'],
      },
      server: {
        title: '내 서버 운영하기', go: '서버 안내',
        text: '모든 컴퓨터에서 같은 탭을, 팀과 함께 쓰는 보드를. tabcat 서버가 내 컴퓨터에 계정별 데이터를 보관하고, 모든 브라우저를 실시간으로 똑같이 맞춰요.',
        tags: ['동기화', '공유 워크스페이스', '계정'],
        steps: ['내 컴퓨터에 설치해요. Python 3.10 이상이 필요해요(Docker도 돼요: 안내 참고) {copy}', '실행한 뒤, 그 컴퓨터에서 http://localhost:8080 을 열어 첫 계정(관리자)을 만들어요 {copy}', '각 브라우저에서 tabcat 툴바 버튼을 오른쪽 클릭해 {connect}를 고르고, 서버 주소를 넣은 뒤 로그인해요.'],
      },
    },
  },
  ja: {
    title: 'ようこそ', hello: 'tabcat の準備ができました',
    lead: 'タブをグループに保存して、必要なときにまた開けます。使い方を選んでください。あとからいつでも変えられます。',
    shortcut: 'どのページでも {keys} を押すとダッシュボードが開き、もう一度押すと戻ります。',
    recommended: 'おすすめ', show: '設定方法を見る', hide: '設定方法を閉じる', copy: 'コピー', copied: 'コピーしました', privacy: 'プライバシー',
    ways: {
      online: {
        title: 'オンラインのダッシュボードを使う', go: 'ダッシュボードを開く',
        text: '設定は不要です。tabcat.ghyeok.com のダッシュボードは拡張機能が保存している内容を表示するだけで、データはすべてこのブラウザに残ります。',
        tags: ['設定不要', 'データはこのブラウザに'],
      },
      self: {
        title: 'ダッシュボードを自分でホストする', go: 'README で詳しく',
        text: 'ダッシュボードは静的なページです。アカウントもサーバープログラムもなしに、このパソコンで自分のコピーを動かせます。データはこれまでどおりこのブラウザに残ります。',
        tags: ['コマンド数行', 'データはこのブラウザに'],
        steps: ['ダッシュボードのファイルを取得します {copy}', 'このパソコンで配信します {copy}', 'http://localhost:8080/ を開き、tabcat に聞かれたら {allow} を選びます。以降はショートカットとツールバーのボタンでこのダッシュボードが開きます。'],
      },
      server: {
        title: '自分のサーバーを動かす', go: 'サーバーのガイド',
        text: 'どのパソコンでも同じタブを、チームで一緒に使うボードを。tabcat サーバーがアカウントごとのデータを自分のパソコンに保存し、すべてのブラウザをリアルタイムで同じ状態に保ちます。',
        tags: ['同期', '共有ワークスペース', 'アカウント'],
        steps: ['自分のパソコンにインストールします。Python 3.10 以降が必要です（Docker も使えます: ガイドを参照） {copy}', '起動して、そのパソコンで http://localhost:8080 を開き、最初のアカウント（管理者）を作ります {copy}', '各ブラウザで tabcat のツールバーボタンを右クリックし、{connect} を選んでサーバーのアドレスを入力し、サインインします。'],
      },
    },
  },
  'zh-CN': {
    title: '欢迎', hello: 'tabcat 已准备就绪',
    lead: '把标签页保存到分组中，需要时随时重新打开。选择你想要的使用方式，之后随时可以更改。',
    shortcut: '在任意页面按 {keys} 打开仪表板，再按一次返回。',
    recommended: '推荐', show: '查看设置步骤', hide: '收起设置步骤', copy: '复制', copied: '已复制', privacy: '隐私',
    ways: {
      online: {
        title: '使用在线仪表板', go: '打开仪表板',
        text: '无需任何设置。tabcat.ghyeok.com 上的仪表板只显示扩展程序保存的内容，所有数据都留在此浏览器中。',
        tags: ['无需设置', '数据留在此浏览器'],
      },
      self: {
        title: '自行托管仪表板', go: '在 README 中了解更多',
        text: '仪表板是一个静态页面：无需账户和服务器程序，就能在这台电脑上运行你自己的副本。数据仍然留在此浏览器中。',
        tags: ['几条命令', '数据留在此浏览器'],
        steps: ['获取仪表板文件 {copy}', '在这台电脑上提供服务 {copy}', '打开 http://localhost:8080/，tabcat 询问时选择{allow}。之后快捷键和工具栏按钮都会打开这个仪表板。'],
      },
      server: {
        title: '运行你自己的服务器', go: '服务器指南',
        text: '在每台电脑上使用相同的标签页，与团队共用看板。tabcat 服务器在你自己的电脑上保存每个账户的数据，并让所有浏览器实时保持一致。',
        tags: ['同步', '共享工作区', '账户'],
        steps: ['在你的电脑上安装，需要 Python 3.10 或更高版本（也可以用 Docker：见指南） {copy}', '启动后，在那台电脑上打开 http://localhost:8080，创建第一个账户（管理员） {copy}', '在每个浏览器中右键点击 tabcat 的工具栏按钮，选择“{connect}”，输入服务器地址并登录。'],
      },
    },
  },
  es: {
    title: 'Bienvenida', hello: 'tabcat está listo',
    lead: 'Guarda tus pestañas en grupos y vuelve a abrirlas cuando las necesites. Elige cómo quieres usarlo; puedes cambiar de opinión cuando quieras.',
    shortcut: 'Pulsa {keys} en cualquier página para abrir tu panel, y otra vez para volver.',
    recommended: 'Recomendado', show: 'Cómo configurarlo', hide: 'Ocultar los pasos', copy: 'Copiar', copied: 'Copiado', privacy: 'Privacidad',
    ways: {
      online: {
        title: 'Usar el panel en línea', go: 'Abrir el panel',
        text: 'No hay nada que configurar. El panel de tabcat.ghyeok.com solo muestra lo que guarda la extensión, y todo se queda en este navegador.',
        tags: ['Sin configuración', 'Los datos se quedan en este navegador'],
      },
      self: {
        title: 'Alojar el panel tú mismo', go: 'Más en el README',
        text: 'El panel es una página estática: sirve tu propia copia en este equipo, sin cuenta ni programa de servidor. Tus datos siguen quedándose en este navegador.',
        tags: ['Unos pocos comandos', 'Los datos se quedan en este navegador'],
        steps: ['Descarga los archivos del panel {copy}', 'Sírvelos en este equipo {copy}', 'Abre http://localhost:8080/ y elige {allow} cuando tabcat lo pregunte. Desde entonces, el atajo y el botón de la barra de herramientas abren este panel.'],
      },
      server: {
        title: 'Tener tu propio servidor', go: 'Guía del servidor',
        text: 'Tus pestañas en todos tus equipos y tableros que tu equipo usa en común. tabcat server guarda los datos de cada cuenta en un equipo tuyo y mantiene todos los navegadores sincronizados, al instante.',
        tags: ['Sincronización', 'Espacios compartidos', 'Cuentas'],
        steps: ['Instálalo en un equipo tuyo, con Python 3.10 o posterior (también con Docker: consulta la guía) {copy}', 'Inícialo y abre http://localhost:8080 en ese equipo para crear la primera cuenta, la de administración {copy}', 'En cada navegador, haz clic derecho en el botón de tabcat de la barra de herramientas, elige {connect}, escribe la dirección del servidor e inicia sesión.'],
      },
    },
  },
  de: {
    title: 'Willkommen', hello: 'tabcat ist bereit',
    lead: 'Speichere deine Tabs in Gruppen und öffne sie wieder, wann immer du sie brauchst. Wähle, wie du es nutzen möchtest; du kannst es jederzeit ändern.',
    shortcut: 'Drücke auf jeder Seite {keys}, um dein Dashboard aufzurufen, und noch einmal, um zurückzukehren.',
    recommended: 'Empfohlen', show: 'So richtest du es ein', hide: 'Schritte ausblenden', copy: 'Kopieren', copied: 'Kopiert', privacy: 'Datenschutz',
    ways: {
      online: {
        title: 'Das Online-Dashboard nutzen', go: 'Dashboard öffnen',
        text: 'Nichts einzurichten. Das Dashboard auf tabcat.ghyeok.com zeigt nur, was die Erweiterung speichert, und alles bleibt in diesem Browser.',
        tags: ['Ohne Einrichtung', 'Daten bleiben in diesem Browser'],
      },
      self: {
        title: 'Das Dashboard selbst hosten', go: 'Mehr in der README',
        text: 'Das Dashboard ist eine statische Seite: Stelle deine eigene Kopie auf diesem Computer bereit, ohne Konto und ohne Serverprogramm. Deine Daten bleiben weiterhin in diesem Browser.',
        tags: ['Ein paar Befehle', 'Daten bleiben in diesem Browser'],
        steps: ['Hol dir die Dateien des Dashboards {copy}', 'Stelle sie auf diesem Computer bereit {copy}', 'Öffne http://localhost:8080/ und wähle {allow}, wenn tabcat fragt. Danach öffnen das Tastenkürzel und der Button in der Symbolleiste dieses Dashboard.'],
      },
      server: {
        title: 'Einen eigenen Server betreiben', go: 'Server-Anleitung',
        text: 'Deine Tabs auf jedem Computer und Boards, an denen dein Team gemeinsam arbeitet. tabcat server speichert die Daten jedes Kontos auf einem deiner Computer und hält alle Browser live auf demselben Stand.',
        tags: ['Synchronisierung', 'Geteilte Arbeitsbereiche', 'Konten'],
        steps: ['Installiere ihn auf einem deiner Computer, mit Python 3.10 oder neuer (Docker geht auch: siehe Anleitung) {copy}', 'Starte ihn und öffne auf diesem Computer http://localhost:8080, um das erste Konto (den Admin) anzulegen {copy}', 'Klicke in jedem Browser mit der rechten Maustaste auf den tabcat-Button in der Symbolleiste, wähle {connect}, gib die Adresse des Servers ein und melde dich an.'],
      },
    },
  },
  fr: {
    title: 'Bienvenue', hello: 'tabcat est prêt',
    lead: 'Enregistrez vos onglets dans des groupes et rouvrez-les quand vous en avez besoin. Choisissez comment l’utiliser ; vous pourrez changer d’avis à tout moment.',
    shortcut: 'Appuyez sur {keys} sur n’importe quelle page pour afficher votre tableau de bord, et à nouveau pour revenir.',
    recommended: 'Recommandé', show: 'Comment le configurer', hide: 'Masquer les étapes', copy: 'Copier', copied: 'Copié', privacy: 'Confidentialité',
    ways: {
      online: {
        title: 'Utiliser le tableau de bord en ligne', go: 'Ouvrir le tableau de bord',
        text: 'Rien à configurer. Le tableau de bord de tabcat.ghyeok.com affiche seulement ce que l’extension conserve, et tout reste dans ce navigateur.',
        tags: ['Aucune configuration', 'Les données restent dans ce navigateur'],
      },
      self: {
        title: 'Héberger le tableau de bord vous-même', go: 'En savoir plus dans le README',
        text: 'Le tableau de bord est une page statique : servez votre propre copie sur cet ordinateur, sans compte ni programme serveur. Vos données restent toujours dans ce navigateur.',
        tags: ['Quelques commandes', 'Les données restent dans ce navigateur'],
        steps: ['Récupérez les fichiers du tableau de bord {copy}', 'Servez-les sur cet ordinateur {copy}', 'Ouvrez http://localhost:8080/ et choisissez {allow} quand tabcat le demande. Ensuite, le raccourci et le bouton de la barre d’outils ouvrent ce tableau de bord.'],
      },
      server: {
        title: 'Faire tourner votre propre serveur', go: 'Guide du serveur',
        text: 'Vos onglets sur tous vos ordinateurs, et des tableaux partagés avec votre équipe. tabcat server conserve les données de chaque compte sur un de vos ordinateurs et garde tous les navigateurs synchronisés, en direct.',
        tags: ['Synchronisation', 'Espaces partagés', 'Comptes'],
        steps: ['Installez-le sur un de vos ordinateurs, avec Python 3.10 ou plus récent (Docker fonctionne aussi : voir le guide) {copy}', 'Lancez-le, puis ouvrez http://localhost:8080 sur cet ordinateur pour créer le premier compte, l’administrateur {copy}', 'Dans chaque navigateur, faites un clic droit sur le bouton tabcat de la barre d’outils, choisissez {connect}, saisissez l’adresse du serveur et connectez-vous.'],
      },
    },
  },
  'pt-BR': {
    title: 'Boas-vindas', hello: 'O tabcat está pronto',
    lead: 'Salve suas abas em grupos e abra-as de novo sempre que precisar. Escolha como quer usar; você pode mudar de ideia quando quiser.',
    shortcut: 'Pressione {keys} em qualquer página para abrir seu painel, e de novo para voltar.',
    recommended: 'Recomendado', show: 'Como configurar', hide: 'Ocultar as etapas', copy: 'Copiar', copied: 'Copiado', privacy: 'Privacidade',
    ways: {
      online: {
        title: 'Usar o painel on-line', go: 'Abrir o painel',
        text: 'Nada para configurar. O painel em tabcat.ghyeok.com só mostra o que a extensão guarda, e tudo fica neste navegador.',
        tags: ['Sem configuração', 'Os dados ficam neste navegador'],
      },
      self: {
        title: 'Hospedar o painel você mesmo', go: 'Mais no README',
        text: 'O painel é uma página estática: sirva sua própria cópia neste computador, sem conta e sem programa de servidor. Seus dados continuam neste navegador.',
        tags: ['Alguns comandos', 'Os dados ficam neste navegador'],
        steps: ['Baixe os arquivos do painel {copy}', 'Sirva-os neste computador {copy}', 'Abra http://localhost:8080/ e escolha {allow} quando o tabcat perguntar. A partir daí, o atalho e o botão da barra de ferramentas abrem este painel.'],
      },
      server: {
        title: 'Ter seu próprio servidor', go: 'Guia do servidor',
        text: 'Suas abas em todos os computadores e quadros que sua equipe usa em conjunto. O tabcat server guarda os dados de cada conta em um computador seu e mantém todos os navegadores iguais, ao vivo.',
        tags: ['Sincronização', 'Espaços compartilhados', 'Contas'],
        steps: ['Instale-o em um computador seu, com Python 3.10 ou mais recente (o Docker também serve: veja o guia) {copy}', 'Inicie-o e abra http://localhost:8080 nesse computador para criar a primeira conta, a de administrador {copy}', 'Em cada navegador, clique com o botão direito no botão do tabcat na barra de ferramentas, escolha {connect}, digite o endereço do servidor e entre.'],
      },
    },
  },
};

// The extension's own words, as it shows them (lib/i18n.js: allowButton, menuConnect)
export const EXTENSION_WORDS = {
  en: { allow: 'Allow', connect: 'Connect to a server…' },
  ko: { allow: '허락', connect: '서버에 연결하기' },
  ja: { allow: '許可', connect: 'サーバーに接続…' },
  'zh-CN': { allow: '允许', connect: '连接到服务器…' },
  es: { allow: 'Permitir', connect: 'Conectar a un servidor…' },
  de: { allow: 'Erlauben', connect: 'Mit einem Server verbinden…' },
  fr: { allow: 'Autoriser', connect: 'Se connecter à un serveur…' },
  'pt-BR': { allow: 'Permitir', connect: 'Conectar a um servidor…' },
};
