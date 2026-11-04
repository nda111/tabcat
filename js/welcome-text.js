// The welcome page's text (welcome.html, opened once tabcat is installed), in the dashboard's languages. Each language
// says the same thing; change them together. `lead` is its sentences, each kept whole on a line where it fits. In a
// step, {copy} marks where its command goes (COMMANDS in welcome.js); {dashboard}, {tabcat}, {docker}, {dockerSite} and
// {shortcuts} are links (worded by `links`); {allow}, {connect} and {command} the extension's own words (EXTENSION_WORDS); {keys} the
// shortcut and {shortcuts} the browser's page to set it.
export const TEXT = {
  en: {
    title: 'Welcome', hello: 'tabcat is ready',
    lead: ['Save your tabs into groups and open them again whenever you need.', 'Choose how you\'d like to use it.', 'You can change your mind any time.'],
    shortcut: 'Set up your {shortcuts}.',
    recommended: 'Recommended', show: 'How to set it up', hide: 'Hide the steps', copy: 'Copy', copied: 'Copied', privacy: 'Privacy',
    links: { dashboard: 'the dashboard', tabcat: 'tabcat', docker: 'Docker setup guide', dockerSite: 'Docker', shortcuts: 'tabcat shortcuts' },
    ways: {
      online: {
        title: 'Use the online dashboard', go: 'Open the dashboard',
        text: 'Try it with no setup. The dashboard at tabcat.ghyeok.com works without a server, and your data stays on your computer.',
        tags: ['Easy to use', 'Always up to date', 'Just for you'],
      },
      self: {
        title: 'Host the dashboard yourself', go: 'More in the README',
        text: 'Use a dashboard of your own on this computer, with no account and no server. Your data stays on your computer.',
        tags: ['Works offline', 'Needs Python', 'Just for you'],
        steps: ['Download the dashboard\'s files {copy}', 'Start the dashboard on this computer {copy}', 'Open {dashboard} and choose {allow} when tabcat asks.'],
      },
      server: {
        title: 'Run your own server', go: 'Server guide',
        text: 'The same tabs on every computer, and workspaces your team shares. Host a tabcat server for your team yourself.',
        tags: ['Sync', 'Shared workspaces', 'Teamwork', 'Needs Python'],
        tabs: { computer: 'This computer', docker: 'Docker' },
        steps: ['Install it on your computer. It needs Python 3.10 or later. {copy}', 'Start the server, then on that computer right-click tabcat\'s toolbar button and choose {connect}. {copy}', 'On that computer, open {tabcat} and make the admin account.', 'Then sign in from anywhere.'],
        dockerSteps: ['Install {dockerSite} on your computer.', 'See the {docker}.'],
      },
    },
  },
  ko: {
    title: '환영합니다', hello: 'tabcat이 준비됐어요',
    lead: ['탭을 그룹으로 저장해 두고 필요할 때 다시 여세요.', '어떻게 쓸지 골라 보세요.', '나중에 언제든 바꿀 수 있어요.'],
    shortcut: '{shortcuts}를 설정해보세요.',
    recommended: '추천', show: '설정 방법 보기', hide: '설정 방법 접기', copy: '복사', copied: '복사됨', privacy: '개인정보처리방침',
    links: { dashboard: '대시보드', tabcat: 'tabcat', docker: 'Docker 설정', dockerSite: 'Docker', shortcuts: 'tabcat 단축키' },
    ways: {
      online: {
        title: '온라인 대시보드 사용하기', go: '대시보드 열기',
        text: '설정 없이 사용해보세요. tabcat.ghyeok.com의 대시보드는 서버 없이 사용할 수 있어요. 데이터는 컴퓨터 안에만 저장돼요.',
        tags: ['쉬운 사용', '항상 최신 버전', '혼자 사용'],
      },
      self: {
        title: '대시보드를 직접 호스팅하기', go: 'README에서 더 보기',
        text: '계정이나 서버 없이 이 컴퓨터에서 나만의 대시보드를 사용할 수 있어요. 데이터는 컴퓨터 안에만 저장돼요.',
        tags: ['오프라인 가능', 'Python 필요', '혼자 사용'],
        steps: ['대시보드 파일을 다운로드 받아요. {copy}', '이 컴퓨터에서 대시보드를 시작해요. {copy}', '{dashboard}를 열고, tabcat이 물으면 {allow}을 눌러요.'],
      },
      server: {
        title: '내 서버 운영하기', go: '서버 안내',
        text: '모든 컴퓨터에서 같은 탭을, 팀과 함께 쓰는 워크스페이스. 우리 팀을 위한 tabcat 서버를 직접 호스팅해요.',
        tags: ['동기화', '공유 워크스페이스', '팀 단위 협업', 'Python 필요'],
        tabs: { computer: '내 컴퓨터', docker: 'Docker' },
        steps: ['내 컴퓨터에 설치해요. Python 3.10 이상이 필요해요. {copy}', '서버를 시작하고, 그 컴퓨터에서 tabcat 툴바 버튼을 오른쪽 클릭해 서버에 연결해요. {copy}', '그 컴퓨터에서 {tabcat}을 열어 관리자 계정을 만들어요.', '어디서든 로그인할 수 있어요.'],
        dockerSteps: ['컴퓨터에 {dockerSite}를 설치해요.', '{docker}을 참고해주세요.'],
      },
    },
  },
  ja: {
    title: 'ようこそ', hello: 'tabcat の準備ができました',
    lead: ['タブをグループに保存して、必要なときにまた開けます。', '使い方を選んでください。', 'あとからいつでも変えられます。'],
    shortcut: '{shortcuts}を設定してみてください。',
    recommended: 'おすすめ', show: '設定方法を見る', hide: '設定方法を閉じる', copy: 'コピー', copied: 'コピーしました', privacy: 'プライバシー',
    links: { dashboard: 'ダッシュボード', tabcat: 'tabcat', docker: 'Docker の設定', dockerSite: 'Docker', shortcuts: 'tabcat のショートカット' },
    ways: {
      online: {
        title: 'オンラインのダッシュボードを使う', go: 'ダッシュボードを開く',
        text: '設定なしで使ってみてください。tabcat.ghyeok.com のダッシュボードはサーバーなしで使えます。データはパソコンの中だけに保存されます。',
        tags: ['かんたん', 'いつも最新', 'ひとりで使う'],
      },
      self: {
        title: 'ダッシュボードを自分でホストする', go: 'README で詳しく',
        text: 'アカウントもサーバーもなしに、このパソコンで自分だけのダッシュボードを使えます。データはパソコンの中だけに保存されます。',
        tags: ['オフラインで使える', 'Python が必要', 'ひとりで使う'],
        steps: ['ダッシュボードのファイルをダウンロード {copy}', 'このパソコンでダッシュボードを起動します。 {copy}', '{dashboard}を開き、tabcat に聞かれたら {allow} を選びます。'],
      },
      server: {
        title: '自分のサーバーを動かす', go: 'サーバーのガイド',
        text: 'どのパソコンでも同じタブを、チームで共有するワークスペースを。チームのための tabcat サーバーを自分でホストします。',
        tags: ['同期', '共有ワークスペース', 'チームで協力', 'Python が必要'],
        tabs: { computer: '自分のパソコン', docker: 'Docker' },
        steps: ['自分のパソコンにインストールします。Python 3.10 以降が必要です。 {copy}', 'サーバーを起動し、そのパソコンで tabcat のツールバーボタンを右クリックして {connect} を選びます。 {copy}', 'そのパソコンで {tabcat} を開き、管理者アカウントを作ります。', 'あとはどこからでもサインインできます。'],
        dockerSteps: ['パソコンに {dockerSite} をインストールします。', '{docker}をご覧ください。'],
      },
    },
  },
  'zh-CN': {
    title: '欢迎', hello: 'tabcat 已准备就绪',
    lead: ['把标签页保存到分组中，需要时随时重新打开。', '选择你想要的使用方式。', '之后随时可以更改。'],
    shortcut: '设置{shortcuts}吧。',
    recommended: '推荐', show: '查看设置步骤', hide: '收起设置步骤', copy: '复制', copied: '已复制', privacy: '隐私',
    links: { dashboard: '仪表板', tabcat: 'tabcat', docker: 'Docker 设置指南', dockerSite: 'Docker', shortcuts: 'tabcat 快捷键' },
    ways: {
      online: {
        title: '使用在线仪表板', go: '打开仪表板',
        text: '无需设置即可试用。tabcat.ghyeok.com 上的仪表板无需服务器即可使用，数据只保存在你的电脑中。',
        tags: ['简单易用', '始终是最新版本', '个人使用'],
      },
      self: {
        title: '自行托管仪表板', go: '在 README 中了解更多',
        text: '无需账户和服务器，就能在这台电脑上使用你自己的仪表板。数据只保存在你的电脑中。',
        tags: ['可离线使用', '需要 Python', '个人使用'],
        steps: ['下载仪表板文件 {copy}', '在这台电脑上启动仪表板。 {copy}', '打开{dashboard}，tabcat 询问时选择{allow}。'],
      },
      server: {
        title: '运行你自己的服务器', go: '服务器指南',
        text: '在每台电脑上使用相同的标签页，与团队共享工作区。为你的团队自行托管 tabcat 服务器。',
        tags: ['同步', '共享工作区', '团队协作', '需要 Python'],
        tabs: { computer: '我的电脑', docker: 'Docker' },
        steps: ['在你的电脑上安装，需要 Python 3.10 或更高版本。 {copy}', '启动服务器，然后在那台电脑上右键点击 tabcat 的工具栏按钮，选择“{connect}”。 {copy}', '在那台电脑上打开 {tabcat}，创建管理员账户。', '之后可以在任何地方登录。'],
        dockerSteps: ['在电脑上安装 {dockerSite}。', '请参阅{docker}。'],
      },
    },
  },
  es: {
    title: 'Bienvenida', hello: 'tabcat está listo',
    lead: ['Guarda tus pestañas en grupos y vuelve a abrirlas cuando las necesites.', 'Elige cómo quieres usarlo.', 'Puedes cambiar de opinión cuando quieras.'],
    shortcut: 'Configura los {shortcuts}.',
    recommended: 'Recomendado', show: 'Cómo configurarlo', hide: 'Ocultar los pasos', copy: 'Copiar', copied: 'Copiado', privacy: 'Privacidad',
    links: { dashboard: 'el panel', tabcat: 'tabcat', docker: 'guía de Docker', dockerSite: 'Docker', shortcuts: 'atajos de tabcat' },
    ways: {
      online: {
        title: 'Usar el panel en línea', go: 'Abrir el panel',
        text: 'Pruébalo sin configurar nada. El panel de tabcat.ghyeok.com funciona sin servidor, y tus datos se quedan en tu equipo.',
        tags: ['Fácil de usar', 'Siempre al día', 'Para ti solo'],
      },
      self: {
        title: 'Alojar el panel tú mismo', go: 'Más en el README',
        text: 'Usa tu propio panel en este equipo, sin cuenta ni servidor. Tus datos se quedan en tu equipo.',
        tags: ['Funciona sin conexión', 'Requiere Python', 'Para ti solo'],
        steps: ['Descarga los archivos del panel {copy}', 'Inicia el panel en este equipo. {copy}', 'Abre {dashboard} y elige {allow} cuando tabcat lo pregunte.'],
      },
      server: {
        title: 'Tener tu propio servidor', go: 'Guía del servidor',
        text: 'Las mismas pestañas en todos tus equipos y espacios de trabajo que comparte tu equipo. Aloja tú mismo un servidor de tabcat para tu equipo.',
        tags: ['Sincronización', 'Espacios compartidos', 'Trabajo en equipo', 'Requiere Python'],
        tabs: { computer: 'Mi equipo', docker: 'Docker' },
        steps: ['Instálalo en tu equipo. Requiere Python 3.10 o posterior. {copy}', 'Inicia el servidor y, en ese equipo, haz clic derecho en el botón de tabcat de la barra de herramientas y elige {connect}. {copy}', 'En ese equipo, abre {tabcat} y crea la cuenta de administración.', 'Después, inicia sesión desde donde quieras.'],
        dockerSteps: ['Instala {dockerSite} en tu equipo.', 'Consulta la {docker}.'],
      },
    },
  },
  de: {
    title: 'Willkommen', hello: 'tabcat ist bereit',
    lead: ['Speichere deine Tabs in Gruppen und öffne sie wieder, wann immer du sie brauchst.', 'Wähle, wie du es nutzen möchtest.', 'Du kannst es jederzeit ändern.'],
    shortcut: 'Richte die {shortcuts} ein.',
    recommended: 'Empfohlen', show: 'So richtest du es ein', hide: 'Schritte ausblenden', copy: 'Kopieren', copied: 'Kopiert', privacy: 'Datenschutz',
    links: { dashboard: 'das Dashboard', tabcat: 'tabcat', docker: 'Docker-Anleitung', dockerSite: 'Docker', shortcuts: 'tabcat-Tastenkürzel' },
    ways: {
      online: {
        title: 'Das Online-Dashboard nutzen', go: 'Dashboard öffnen',
        text: 'Probier es ohne Einrichtung aus. Das Dashboard auf tabcat.ghyeok.com funktioniert ohne Server, und deine Daten bleiben auf deinem Computer.',
        tags: ['Einfach', 'Immer aktuell', 'Nur für dich'],
      },
      self: {
        title: 'Das Dashboard selbst hosten', go: 'Mehr in der README',
        text: 'Nutze dein eigenes Dashboard auf diesem Computer, ohne Konto und ohne Server. Deine Daten bleiben auf deinem Computer.',
        tags: ['Auch offline', 'Braucht Python', 'Nur für dich'],
        steps: ['Lade die Dateien des Dashboards herunter {copy}', 'Starte das Dashboard auf diesem Computer. {copy}', 'Öffne {dashboard} und wähle {allow}, wenn tabcat fragt.'],
      },
      server: {
        title: 'Einen eigenen Server betreiben', go: 'Server-Anleitung',
        text: 'Dieselben Tabs auf jedem Computer und Arbeitsbereiche, die dein Team teilt. Hoste selbst einen tabcat-Server für dein Team.',
        tags: ['Synchronisierung', 'Geteilte Arbeitsbereiche', 'Teamarbeit', 'Braucht Python'],
        tabs: { computer: 'Mein Computer', docker: 'Docker' },
        steps: ['Installiere ihn auf deinem Computer. Er braucht Python 3.10 oder neuer. {copy}', 'Starte den Server, klicke dann auf diesem Computer mit der rechten Maustaste auf den tabcat-Button in der Symbolleiste und wähle {connect}. {copy}', 'Öffne auf diesem Computer {tabcat} und lege das Admin-Konto an.', 'Danach meldest du dich von überall an.'],
        dockerSteps: ['Installiere {dockerSite} auf deinem Computer.', 'Siehe die {docker}.'],
      },
    },
  },
  fr: {
    title: 'Bienvenue', hello: 'tabcat est prêt',
    lead: ['Enregistrez vos onglets dans des groupes et rouvrez-les quand vous en avez besoin.', 'Choisissez comment l’utiliser.', 'Vous pourrez changer d’avis à tout moment.'],
    shortcut: 'Configurez les {shortcuts}.',
    recommended: 'Recommandé', show: 'Comment le configurer', hide: 'Masquer les étapes', copy: 'Copier', copied: 'Copié', privacy: 'Confidentialité',
    links: { dashboard: 'le tableau de bord', tabcat: 'tabcat', docker: 'guide Docker', dockerSite: 'Docker', shortcuts: 'raccourcis tabcat' },
    ways: {
      online: {
        title: 'Utiliser le tableau de bord en ligne', go: 'Ouvrir le tableau de bord',
        text: 'Essayez-le sans rien configurer. Le tableau de bord de tabcat.ghyeok.com fonctionne sans serveur, et vos données restent sur votre ordinateur.',
        tags: ['Facile à utiliser', 'Toujours à jour', 'Pour vous seul'],
      },
      self: {
        title: 'Héberger le tableau de bord vous-même', go: 'En savoir plus dans le README',
        text: 'Utilisez votre propre tableau de bord sur cet ordinateur, sans compte ni serveur. Vos données restent sur votre ordinateur.',
        tags: ['Fonctionne hors ligne', 'Python requis', 'Pour vous seul'],
        steps: ['Téléchargez les fichiers du tableau de bord {copy}', 'Lancez le tableau de bord sur cet ordinateur. {copy}', 'Ouvrez {dashboard} et choisissez {allow} quand tabcat le demande.'],
      },
      server: {
        title: 'Faire tourner votre propre serveur', go: 'Guide du serveur',
        text: 'Les mêmes onglets sur tous vos ordinateurs, et des espaces de travail partagés avec votre équipe. Hébergez vous-même un serveur tabcat pour votre équipe.',
        tags: ['Synchronisation', 'Espaces partagés', 'Travail en équipe', 'Python requis'],
        tabs: { computer: 'Mon ordinateur', docker: 'Docker' },
        steps: ['Installez-le sur votre ordinateur. Il faut Python 3.10 ou plus récent. {copy}', 'Lancez le serveur, puis sur cet ordinateur, faites un clic droit sur le bouton tabcat de la barre d’outils et choisissez {connect}. {copy}', 'Sur cet ordinateur, ouvrez {tabcat} et créez le compte administrateur.', 'Ensuite, connectez-vous depuis n’importe où.'],
        dockerSteps: ['Installez {dockerSite} sur votre ordinateur.', 'Consultez le {docker}.'],
      },
    },
  },
  'pt-BR': {
    title: 'Boas-vindas', hello: 'O tabcat está pronto',
    lead: ['Salve suas abas em grupos e abra-as de novo sempre que precisar.', 'Escolha como quer usar.', 'Você pode mudar de ideia quando quiser.'],
    shortcut: 'Configure os {shortcuts}.',
    recommended: 'Recomendado', show: 'Como configurar', hide: 'Ocultar as etapas', copy: 'Copiar', copied: 'Copiado', privacy: 'Privacidade',
    links: { dashboard: 'o painel', tabcat: 'o tabcat', docker: 'guia do Docker', dockerSite: 'Docker', shortcuts: 'atalhos do tabcat' },
    ways: {
      online: {
        title: 'Usar o painel on-line', go: 'Abrir o painel',
        text: 'Experimente sem configurar nada. O painel em tabcat.ghyeok.com funciona sem servidor, e seus dados ficam no seu computador.',
        tags: ['Fácil de usar', 'Sempre atualizado', 'Só para você'],
      },
      self: {
        title: 'Hospedar o painel você mesmo', go: 'Mais no README',
        text: 'Use seu próprio painel neste computador, sem conta e sem servidor. Seus dados ficam no seu computador.',
        tags: ['Funciona off-line', 'Requer Python', 'Só para você'],
        steps: ['Baixe os arquivos do painel {copy}', 'Inicie o painel neste computador. {copy}', 'Abra {dashboard} e escolha {allow} quando o tabcat perguntar.'],
      },
      server: {
        title: 'Ter seu próprio servidor', go: 'Guia do servidor',
        text: 'As mesmas abas em todos os computadores e espaços de trabalho que sua equipe compartilha. Hospede você mesmo um servidor tabcat para sua equipe.',
        tags: ['Sincronização', 'Espaços compartilhados', 'Trabalho em equipe', 'Requer Python'],
        tabs: { computer: 'Meu computador', docker: 'Docker' },
        steps: ['Instale-o no seu computador. Requer Python 3.10 ou mais recente. {copy}', 'Inicie o servidor e, nesse computador, clique com o botão direito no botão do tabcat na barra de ferramentas e escolha {connect}. {copy}', 'Nesse computador, abra {tabcat} e crie a conta de administrador.', 'Depois, entre de onde quiser.'],
        dockerSteps: ['Instale o {dockerSite} no seu computador.', 'Veja o {docker}.'],
      },
    },
  },
};

// The extension's own words, as it shows them (lib/i18n.js: allowButton, menuConnect; _locales: cmdDashboard)
export const EXTENSION_WORDS = {
  en: { allow: 'Allow', connect: 'Connect to a server…', command: 'Open tabcat dashboard' },
  ko: { allow: '허락', connect: '서버에 연결하기', command: 'tabcat 대시보드 열기' },
  ja: { allow: '許可', connect: 'サーバーに接続…', command: 'tabcat のダッシュボードを開く' },
  'zh-CN': { allow: '允许', connect: '连接到服务器…', command: '打开 tabcat 仪表板' },
  es: { allow: 'Permitir', connect: 'Conectar a un servidor…', command: 'Abrir el panel de tabcat' },
  de: { allow: 'Erlauben', connect: 'Mit einem Server verbinden…', command: 'tabcat-Dashboard öffnen' },
  fr: { allow: 'Autoriser', connect: 'Se connecter à un serveur…', command: 'Ouvrir le tableau de bord tabcat' },
  'pt-BR': { allow: 'Permitir', connect: 'Conectar a um servidor…', command: 'Abrir o painel do tabcat' },
};
