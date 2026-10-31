// The privacy page: the policy in the language picked on the page (?lang=), else the dashboard's language
// setting, else the browser's; switching cross-fades the text while the card springs to its new size, as
// the dashboard's Settings does.
import { LANGS, resolveLang } from './i18n.js';

const UPDATED = new Date(2026, 9, 31);
const A = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;
const SITE = A('https://tabcat.ghyeok.com/', 'tabcat.ghyeok.com');
const PAGES = (t) => A('https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement', t);
const GFONTS = A('https://policies.google.com/privacy', 'Google Fonts');
const JSD = A('https://www.jsdelivr.com/terms/privacy-policy-jsdelivr-net', 'jsDelivr');
const ISSUES = (t) => A('https://github.com/nda111/tabcat/issues', t);

// title, updated ({date}), lead, then [heading, paragraph(s), list?] per section
const TEXT = {
  en: {
    title: 'Privacy', updated: 'Last updated {date}',
    lead: 'Everything you keep in tabcat stays in your browser. There\'s no account, no tabcat server, no analytics and no ads, and nothing is sold or shared.',
    sections: [
      ['What tabcat keeps', 'Your groups, the tabs you save in them (their titles, addresses and icons), your notes and your settings. They\'re kept in the extension\'s own storage, in your browser, on your computer. The dashboard page also remembers a few small things there, like its language and the size of its panels.'],
      ['What tabcat reads', 'To save, show and put to sleep your tabs, tabcat reads the titles and addresses of the tabs you have open. It does this only on your computer, and never sends them anywhere. It doesn\'t read what\'s on the pages.'],
      ['What leaves your browser', `The dashboard is a web page, at ${SITE}, and like any web page it loads some files from the web. None of these requests carry your tabs, notes or anything else you keep in tabcat. As with any website, the services involved see your IP address and your browser:`, [
        `The page itself, from ${PAGES('GitHub Pages')}.`,
        `Fonts, from ${GFONTS} and ${JSD}.`,
        'The emoji list and the maths renderer, from jsDelivr, the first time you use them.',
        'If you installed tabcat from GitHub rather than the Chrome Web Store: up to twice a day, the version number of the latest release, from GitHub. You can turn this off in Settings.',
      ]],
      ['Exporting and removing', 'Exporting from Settings saves a file to your computer, and only there. Removing the extension removes everything it kept. The dashboard page\'s own small things (its language, panel sizes and the emoji list) go when you clear the site\'s data in your browser.'],
      ['Changes', 'If this changes, this page will say so, with a new date above.'],
      ['Questions', `Ask on ${ISSUES('GitHub')}.`],
    ],
  },
  ko: {
    title: '개인정보처리방침', updated: '{date} 업데이트',
    lead: 'tabcat에 담아 두신 모든 것은 브라우저 안에만 있어요. 계정도, tabcat 서버도, 분석 도구도, 광고도 없고, 아무것도 팔거나 넘기지 않아요.',
    sections: [
      ['tabcat이 담아 두는 것', '그룹, 그 안에 저장한 탭(제목, 주소, 아이콘), 메모, 설정이에요. 모두 내 컴퓨터의 브라우저 안, 확장 프로그램 전용 저장 공간에 있어요. 대시보드 페이지도 언어나 패널 크기 같은 작은 것들을 거기에 기억해 둬요.'],
      ['tabcat이 읽는 것', '탭을 저장하고, 보여 주고, 재우기 위해 열려 있는 탭의 제목과 주소를 읽어요. 내 컴퓨터 안에서만 읽고, 어디로도 보내지 않아요. 페이지 내용은 읽지 않아요.'],
      ['브라우저 밖으로 나가는 것', `대시보드는 ${SITE}에 있는 웹페이지라서, 다른 웹페이지처럼 몇 가지 파일을 인터넷에서 불러와요. 이 요청에는 탭, 메모 등 tabcat에 담아 두신 것이 하나도 들어 있지 않아요. 다른 웹사이트와 마찬가지로, 아래 서비스에는 IP 주소와 브라우저 정보가 전달돼요.`, [
        `페이지 자체: ${PAGES('GitHub Pages')}`,
        `글꼴: ${GFONTS}, ${JSD}`,
        '이모지 목록과 수식 표시 도구: 처음 쓸 때 jsDelivr에서',
        'Chrome 웹 스토어가 아니라 GitHub에서 설치하셨다면: 하루 두 번까지 GitHub에서 최신 버전 번호를 확인해요. 설정에서 끌 수 있어요.',
      ]],
      ['내보내기와 지우기', '설정에서 내보내면 내 컴퓨터에 파일로만 저장돼요. 확장 프로그램을 삭제하면 담아 둔 것도 모두 지워져요. 대시보드 페이지가 기억하는 작은 것들(언어, 패널 크기, 이모지 목록)은 브라우저에서 사이트 데이터를 지우면 함께 지워져요.'],
      ['바뀌는 경우', '내용이 바뀌면 이 페이지에 알리고, 위의 날짜도 새로 적을게요.'],
      ['문의', `${ISSUES('GitHub')}에 남겨 주세요.`],
    ],
  },
  ja: {
    title: 'プライバシー', updated: '最終更新: {date}',
    lead: 'tabcat に保存したものは、すべてあなたのブラウザの中にとどまります。アカウントも、tabcat のサーバーも、アクセス解析も、広告もありません。何かを売ったり、共有したりすることもありません。',
    sections: [
      ['tabcat が保存するもの', 'グループ、そこに保存したタブ (タイトル、アドレス、アイコン)、メモ、設定です。これらはあなたのコンピューターのブラウザの中、拡張機能専用の保存領域に置かれます。ダッシュボードのページも、言語やパネルの大きさなどのちょっとした情報をそこに覚えておきます。'],
      ['tabcat が読み取るもの', 'タブを保存し、表示し、休ませるために、開いているタブのタイトルとアドレスを読み取ります。読み取りはあなたのコンピューターの中だけで行い、どこにも送りません。ページの内容は読み取りません。'],
      ['ブラウザの外に出るもの', `ダッシュボードは ${SITE} にあるウェブページなので、ほかのウェブページと同じように、いくつかのファイルをインターネットから読み込みます。これらのリクエストには、タブやメモなど tabcat に保存したものは一切含まれません。ほかのウェブサイトと同じく、次のサービスには IP アドレスとブラウザの情報が伝わります。`, [
        `ページ本体: ${PAGES('GitHub Pages')}`,
        `フォント: ${GFONTS}、${JSD}`,
        '絵文字の一覧と数式の表示: 初めて使うときに jsDelivr から',
        'Chrome ウェブストアではなく GitHub からインストールした場合: 1 日に 2 回まで、最新リリースのバージョン番号を GitHub に確認します。設定でオフにできます。',
      ]],
      ['書き出しと削除', '設定から書き出すと、ファイルはあなたのコンピューターにだけ保存されます。拡張機能を削除すると、保存していたものもすべて消えます。ダッシュボードのページが覚えているちょっとした情報 (言語、パネルの大きさ、絵文字の一覧) は、ブラウザでサイトのデータを消去すると消えます。'],
      ['変更について', '内容が変わるときは、このページでお知らせし、上の日付も新しくします。'],
      ['お問い合わせ', `${ISSUES('GitHub')} でどうぞ。`],
    ],
  },
  'zh-CN': {
    title: '隐私', updated: '最后更新：{date}',
    lead: '你在 tabcat 里保存的一切都只留在你的浏览器中。没有账号，没有 tabcat 服务器，没有统计分析，也没有广告，不会出售或分享任何内容。',
    sections: [
      ['tabcat 保存什么', '你的分组、保存在其中的标签页（标题、地址和图标）、备注和设置。它们保存在你电脑上浏览器里的扩展专用存储空间中。看板页面也会在那里记住一些小东西，比如语言和面板的大小。'],
      ['tabcat 读取什么', '为了保存、显示和休眠标签页，tabcat 会读取你打开的标签页的标题和地址。这只在你的电脑上进行，从不发送到任何地方。它不会读取网页的内容。'],
      ['什么会离开你的浏览器', `看板是位于 ${SITE} 的网页，和其他网页一样，它会从网上加载一些文件。这些请求不包含你的标签页、备注或你在 tabcat 中保存的任何内容。和访问任何网站一样，以下服务会看到你的 IP 地址和浏览器信息：`, [
        `页面本身：来自 ${PAGES('GitHub Pages')}`,
        `字体：来自 ${GFONTS} 和 ${JSD}`,
        '表情符号列表和数学公式渲染：首次使用时来自 jsDelivr',
        '如果你是从 GitHub 而不是 Chrome 应用商店安装的 tabcat：每天最多两次，从 GitHub 获取最新版本号。你可以在设置中关闭。',
      ]],
      ['导出与删除', '在设置中导出时，文件只保存到你的电脑上。删除扩展会删除它保存的所有内容。看板页面自己记住的小东西（语言、面板大小和表情符号列表）会在你清除浏览器中该网站的数据时一并删除。'],
      ['变更', '如果内容有变化，会在本页说明，并更新上方的日期。'],
      ['问题', `请在 ${ISSUES('GitHub')} 上提问。`],
    ],
  },
  es: {
    title: 'Privacidad', updated: 'Última actualización: {date}',
    lead: 'Todo lo que guardas en tabcat se queda en tu navegador. No hay cuenta, ni servidor de tabcat, ni analíticas, ni anuncios, y nada se vende ni se comparte.',
    sections: [
      ['Qué guarda tabcat', 'Tus grupos, las pestañas que guardas en ellos (su título, dirección e icono), tus notas y tus ajustes. Se guardan en el almacenamiento propio de la extensión, en tu navegador, en tu ordenador. La página del panel también recuerda ahí algunas cosas pequeñas, como su idioma y el tamaño de sus paneles.'],
      ['Qué lee tabcat', 'Para guardar, mostrar y dormir tus pestañas, tabcat lee el título y la dirección de las pestañas que tienes abiertas. Lo hace solo en tu ordenador y nunca los envía a ningún sitio. No lee el contenido de las páginas.'],
      ['Qué sale de tu navegador', `El panel es una página web, en ${SITE}, y como cualquier página web carga algunos archivos de internet. Ninguna de esas peticiones lleva tus pestañas, notas ni nada que guardes en tabcat. Como con cualquier sitio web, los servicios implicados ven tu dirección IP y tu navegador:`, [
        `La propia página, desde ${PAGES('GitHub Pages')}.`,
        `Las fuentes, desde ${GFONTS} y ${JSD}.`,
        'La lista de emojis y el visor de fórmulas, desde jsDelivr, la primera vez que los usas.',
        'Si instalaste tabcat desde GitHub y no desde Chrome Web Store: hasta dos veces al día, el número de la última versión, desde GitHub. Puedes desactivarlo en Ajustes.',
      ]],
      ['Exportar y borrar', 'Al exportar desde Ajustes se guarda un archivo en tu ordenador, y solo ahí. Al quitar la extensión se borra todo lo que guardaba. Las cosas pequeñas de la propia página del panel (su idioma, el tamaño de los paneles y la lista de emojis) se borran al eliminar los datos del sitio en tu navegador.'],
      ['Cambios', 'Si esto cambia, esta página lo dirá, con una fecha nueva arriba.'],
      ['Preguntas', `Pregunta en ${ISSUES('GitHub')}.`],
    ],
  },
  de: {
    title: 'Datenschutz', updated: 'Zuletzt aktualisiert am {date}',
    lead: 'Alles, was du in tabcat aufbewahrst, bleibt in deinem Browser. Es gibt kein Konto, keinen tabcat-Server, keine Analyse und keine Werbung, und nichts wird verkauft oder weitergegeben.',
    sections: [
      ['Was tabcat speichert', 'Deine Gruppen, die Tabs, die du darin speicherst (Titel, Adresse und Symbol), deine Notizen und deine Einstellungen. Sie liegen im eigenen Speicher der Erweiterung, in deinem Browser, auf deinem Computer. Die Dashboard-Seite merkt sich dort auch ein paar Kleinigkeiten, etwa ihre Sprache und die Größe ihrer Leisten.'],
      ['Was tabcat liest', 'Um deine Tabs zu speichern, anzuzeigen und schlafen zu legen, liest tabcat Titel und Adressen deiner geöffneten Tabs. Das geschieht nur auf deinem Computer, und nichts davon wird irgendwohin gesendet. Den Inhalt der Seiten liest tabcat nicht.'],
      ['Was deinen Browser verlässt', `Das Dashboard ist eine Webseite unter ${SITE} und lädt wie jede Webseite einige Dateien aus dem Netz. Keine dieser Anfragen enthält deine Tabs, Notizen oder sonst etwas, das du in tabcat aufbewahrst. Wie bei jeder Website sehen die beteiligten Dienste deine IP-Adresse und deinen Browser:`, [
        `Die Seite selbst, von ${PAGES('GitHub Pages')}.`,
        `Schriften, von ${GFONTS} und ${JSD}.`,
        'Die Emoji-Liste und die Formeldarstellung, von jsDelivr, sobald du sie zum ersten Mal nutzt.',
        'Wenn du tabcat von GitHub statt aus dem Chrome Web Store installiert hast: bis zu zweimal am Tag die Versionsnummer der neuesten Version, von GitHub. Das lässt sich in den Einstellungen abschalten.',
      ]],
      ['Exportieren und entfernen', 'Ein Export aus den Einstellungen speichert eine Datei auf deinem Computer, und nur dort. Wenn du die Erweiterung entfernst, ist alles weg, was sie gespeichert hat. Die Kleinigkeiten der Dashboard-Seite (Sprache, Leistengrößen und Emoji-Liste) verschwinden, wenn du die Websitedaten in deinem Browser löschst.'],
      ['Änderungen', 'Ändert sich etwas, steht es auf dieser Seite, mit einem neuen Datum oben.'],
      ['Fragen', `Frag auf ${ISSUES('GitHub')}.`],
    ],
  },
  fr: {
    title: 'Confidentialité', updated: 'Dernière mise à jour : {date}',
    lead: 'Tout ce que vous gardez dans tabcat reste dans votre navigateur. Pas de compte, pas de serveur tabcat, pas de statistiques, pas de publicité, et rien n\'est vendu ni partagé.',
    sections: [
      ['Ce que tabcat conserve', 'Vos groupes, les onglets que vous y enregistrez (leur titre, leur adresse et leur icône), vos notes et vos réglages. Ils sont conservés dans l\'espace de stockage propre à l\'extension, dans votre navigateur, sur votre ordinateur. La page du tableau de bord y retient aussi quelques petites choses, comme sa langue et la taille de ses panneaux.'],
      ['Ce que tabcat lit', 'Pour enregistrer, afficher et mettre en veille vos onglets, tabcat lit le titre et l\'adresse des onglets ouverts. Cela se fait uniquement sur votre ordinateur, et rien n\'est envoyé nulle part. tabcat ne lit pas le contenu des pages.'],
      ['Ce qui quitte votre navigateur', `Le tableau de bord est une page web, à l\'adresse ${SITE}, et comme toute page web il charge quelques fichiers depuis Internet. Aucune de ces requêtes ne contient vos onglets, vos notes ni quoi que ce soit que vous gardez dans tabcat. Comme pour tout site web, les services concernés voient votre adresse IP et votre navigateur :`, [
        `La page elle-même, depuis ${PAGES('GitHub Pages')}.`,
        `Les polices, depuis ${GFONTS} et ${JSD}.`,
        'La liste des emojis et l\'affichage des formules, depuis jsDelivr, la première fois que vous les utilisez.',
        'Si vous avez installé tabcat depuis GitHub plutôt que depuis le Chrome Web Store : jusqu\'à deux fois par jour, le numéro de la dernière version, depuis GitHub. Vous pouvez le désactiver dans les Réglages.',
      ]],
      ['Exporter et supprimer', 'Exporter depuis les Réglages enregistre un fichier sur votre ordinateur, et uniquement là. Supprimer l\'extension efface tout ce qu\'elle conservait. Les petites choses de la page du tableau de bord (sa langue, la taille des panneaux et la liste des emojis) disparaissent quand vous effacez les données du site dans votre navigateur.'],
      ['Modifications', 'Si cela change, cette page l\'indiquera, avec une nouvelle date en haut.'],
      ['Questions', `Posez-les sur ${ISSUES('GitHub')}.`],
    ],
  },
  'pt-BR': {
    title: 'Privacidade', updated: 'Atualizado em {date}',
    lead: 'Tudo o que você guarda no tabcat fica no seu navegador. Não há conta, servidor do tabcat, análises nem anúncios, e nada é vendido ou compartilhado.',
    sections: [
      ['O que o tabcat guarda', 'Seus grupos, as abas que você salva neles (título, endereço e ícone), suas notas e suas configurações. Eles ficam no armazenamento próprio da extensão, no seu navegador, no seu computador. A página do painel também guarda ali algumas coisinhas, como o idioma e o tamanho dos painéis.'],
      ['O que o tabcat lê', 'Para salvar, mostrar e fazer dormir suas abas, o tabcat lê o título e o endereço das abas abertas. Isso acontece só no seu computador, e nada é enviado para lugar nenhum. O tabcat não lê o conteúdo das páginas.'],
      ['O que sai do seu navegador', `O painel é uma página web, em ${SITE}, e como qualquer página web carrega alguns arquivos da internet. Nenhuma dessas solicitações leva suas abas, notas ou qualquer outra coisa que você guarda no tabcat. Como em qualquer site, os serviços envolvidos veem seu endereço IP e seu navegador:`, [
        `A própria página, do ${PAGES('GitHub Pages')}.`,
        `As fontes, do ${GFONTS} e do ${JSD}.`,
        'A lista de emojis e a exibição de fórmulas, do jsDelivr, na primeira vez que você usa.',
        'Se você instalou o tabcat pelo GitHub e não pela Chrome Web Store: até duas vezes por dia, o número da versão mais recente, do GitHub. Dá para desligar nas Configurações.',
      ]],
      ['Exportar e remover', 'Exportar pelas Configurações salva um arquivo no seu computador, e só nele. Remover a extensão apaga tudo o que ela guardava. As coisinhas da própria página do painel (idioma, tamanho dos painéis e lista de emojis) vão embora quando você limpa os dados do site no navegador.'],
      ['Mudanças', 'Se algo mudar, esta página vai dizer, com uma nova data no topo.'],
      ['Dúvidas', `Pergunte no ${ISSUES('GitHub')}.`],
    ],
  },
};

const $ = (s) => document.querySelector(s);
const card = $('#doc'), pick = $('#doc-lang');

function wanted() {
  const asked = new URLSearchParams(location.search).get('lang');
  if (Object.hasOwn(TEXT, asked)) return asked;
  let setting = 'auto';
  try { setting = localStorage.getItem('tabcat:lang') || 'auto'; } catch { /* storage unavailable */ }
  return resolveLang(setting);
}

function render(lang) {
  const t = TEXT[lang];
  document.documentElement.lang = lang;
  document.title = `tabcat · ${t.title}`;
  const date = new Intl.DateTimeFormat(lang, { dateStyle: 'long' }).format(UPDATED);
  card.innerHTML = `<h1>${t.title}</h1><p class="doc-date">${t.updated.replace('{date}', date)}</p><p class="doc-lead">${t.lead}</p>`
    + t.sections.map(([h, p, list]) => `<h2>${h}</h2><p>${p}</p>${list ? `<ul>${list.map((li) => `<li>${li}</li>`).join('')}</ul>` : ''}`).join('');
}

pick.append(...Object.entries(LANGS).map(([code, name]) => new Option(name, code)));
pick.value = wanted();
render(pick.value);
document.documentElement.classList.remove('booting');

// another language: the card springs to its new size while the text cross-fades (see switchLang)
pick.addEventListener('change', () => {
  const lang = pick.value;
  const url = new URL(location.href);
  url.searchParams.set('lang', lang);
  history.replaceState(null, '', url);
  if (!document.startViewTransition) return render(lang);
  const named = [[card, 'settings-frame'], ...[...card.children].map((el) => [el, 'settings-part'])];
  const name = () => named.forEach(([el, cls], i) => { el.style.viewTransitionName = `doc-${i}`; el.style.viewTransitionClass = cls; });
  name();
  const vt = document.startViewTransition(() => {
    render(lang);
    named.splice(1, Infinity, ...[...card.children].map((el) => [el, 'settings-part']));
    name();
  });
  vt.ready.catch(() => {});
  vt.finished.finally(() => named.forEach(([el]) => { el.style.viewTransitionName = ''; el.style.viewTransitionClass = ''; }));
});
