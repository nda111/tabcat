# Chrome Web Store listing: tabcat

Everything to paste into the Developer Dashboard (https://chrome.google.com/webstore/devconsole).

## Submitting a new version

1. **Package** tab → *Upload new package*: `extension-v<version>-store.zip` (the release workflow's artifact,
   or `python tools/release.py extension` from the release's commit).
2. **Store listing** tab: paste the English description, then each language's under *Localized listings*.
3. **Privacy practices** tab: check the single purpose, every permission's justification (new ones are marked
   *new in 1.1.0*), the host permissions, remote code and data usage as below. Save.
4. **Submit for review** (with *Publish automatically after review* if wanted). The test instructions below go in
   the box the submission asks for them in.
Upload `releases/extension-v<version>-store.zip` (built by `python tools/release.py extension`).
Images are in `en/` (the default listing) and `ko/` (the Korean listing); the other languages use the English ones.

---

## Store listing tab

**Name / summary**: come from the manifest (`tabcat`, and `extDescription` in each `_locales/*/messages.json`).

**Category**: Productivity › Workflow & Planning

**Language**: English (the default). Add the other 7 under "Localized listings" and paste each description below;
for Korean, also upload the screenshots in `ko/`.

**Graphics**
- Store icon: `icons/icon128.png` (already in the zip; upload it again if asked)
- Screenshots (1280×800), in this order:
  1. `1-board.png`: the board
  2. `2-dark.png`: dark theme, open tabs beside the board
  3. `3-search.png`: search
  4. `4-popup.png`: saving a tab from the toolbar
  5. `5-settings.png`: Settings (themes, colours, languages)
- Small promo tile (440×280): `en/promo-small-440x280.png` (one for every language: the store takes a single one)
- Marquee promo tile (1400×560, optional): `en/promo-marquee-1400x560.png`
- Promo video (optional, a YouTube link): upload `en/demo.mp4` (29 s, 1280×800) to YouTube and paste its link

**Official URL**: none (needs a verified domain in Search Console; optional)
**Homepage URL**: https://github.com/nda111/tabcat
**Support URL**: https://github.com/nda111/tabcat/issues

### Description: English

```
Save tabs into groups, and open them again whenever you need. Tabs you're not using sleep, keeping your browser light.

tabcat gives your tabs a board. Open it with Ctrl+Shift+X.

SAVE TABS
• Drag a tab from Open tabs onto a group, or a whole window at once.
• From any page, the toolbar button saves the tab to the group you pick.
• Alt+Shift+S saves the tab, Alt+Shift+A the whole window.

KEEP THEM IN ORDER
• Workspaces (say, work and study), each split into categories.
• Groups are cards on a board. They hold links and folders, up to four levels deep.
• Drag anything anywhere. Give groups a symbol and a colour.
• Notes in Markdown, with checkboxes and maths.

OPEN THEM AGAIN
• One link, or a whole group or folder at once, as tabs or as a tab group.

STAY LIGHT
• Put tabs you aren't looking at to sleep, or let tabcat do it after a few idle minutes.
• Close duplicate tabs in one click.

AND
• Ctrl+F searches links, folders, groups and notes.
• Ctrl+Z undoes adding, editing, deleting, moving and saving, and closing tabs and windows.
• What you delete stays in Recently deleted for 30 days.
• Light and dark themes, accent colours, 8 languages.
• Install the dashboard as an app for a window of its own.

YOUR OWN SERVER (OPTIONAL)
• Run tabcat server on a computer of yours, and connect tabcat to it from the toolbar button's menu.
• Your groups, notes and settings stay the same in every browser signed in to your account, live.
• See the tabs open in your other browsers, and share workspaces with your team.

YOUR DATA STAYS WITH YOU
Without a server, everything is kept in your browser: no account, no analytics, no ads. Connected to your own server, your data goes to that server only, never to us. Export it to a file whenever you like.

tabcat is open source (MIT): https://github.com/nda111/tabcat
```

### Description: 한국어 (ko)

```
탭을 그룹으로 저장해 두고, 필요할 때 다시 열어보세요. 안 쓰는 탭은 재워서 브라우저를 가볍게 지켜드려요.

tabcat은 탭에게 보드를 만들어 줘요. Ctrl+Shift+X로 열 수 있어요.

탭 저장하기
• 열린 탭에서 탭을 그룹으로 끌어다 놓거나, 창 전체를 한 번에 저장해요.
• 어느 페이지에서든 툴바 버튼으로 원하는 그룹에 저장해요.
• Alt+Shift+S는 지금 탭을, Alt+Shift+A는 창 전체를 저장해요.

정리하기
• 업무, 공부처럼 워크스페이스를 나누고, 그 안을 카테고리로 나눠요.
• 그룹은 보드 위의 카드예요. 링크와 폴더를 4단계까지 담을 수 있어요.
• 무엇이든 끌어서 옮기고, 그룹에 기호와 색을 붙여요.
• 메모는 마크다운으로 쓰고, 체크박스와 수식도 넣을 수 있어요.

다시 열기
• 링크 하나, 또는 그룹이나 폴더 전체를 탭이나 탭 그룹으로 한 번에 열어요.

가볍게 지키기
• 보고 있지 않은 탭을 재우거나, 몇 분 동안 안 쓰면 알아서 재우게 할 수 있어요.
• 중복된 탭은 한 번에 닫아요.

그리고
• Ctrl+F로 링크, 폴더, 그룹, 메모를 찾아요.
• Ctrl+Z로 추가, 수정, 삭제, 이동, 저장, 탭과 창 닫기를 되돌려요.
• 삭제한 것은 휴지통에 30일 동안 남아요.
• 밝은 테마와 어두운 테마, 테마 색, 8개 언어를 지원해요.
• 대시보드를 앱으로 설치하면 전용 창에서 열려요.

내 서버 (선택)
• 내 컴퓨터에 tabcat 서버를 실행하고, 툴바 버튼 메뉴에서 연결해요.
• 같은 계정으로 로그인한 모든 브라우저에서 그룹, 메모, 설정이 실시간으로 똑같이 맞춰져요.
• 다른 브라우저에 열린 탭을 보고, 팀과 워크스페이스를 함께 써요.

데이터는 내 브라우저에만
서버 없이 쓰면 모든 것이 브라우저 안에 저장돼요. 계정도, 분석 도구도, 광고도 없어요. 내 서버에 연결하면 데이터는 그 서버로만 가고, 개발자에게는 가지 않아요. 언제든 파일로 내보낼 수 있어요.

tabcat은 오픈 소스(MIT)예요: https://github.com/nda111/tabcat
```

### Description: 日本語 (ja)

```
タブをグループに保存して、必要なときにまた開けます。使っていないタブは休ませて、ブラウザを軽く保ちます。

tabcat はタブのためのボードです。Ctrl+Shift+X で開きます。

タブを保存
• 開いているタブをグループへドラッグ。ウィンドウごとまとめて保存もできます。
• どのページからでも、ツールバーのボタンで選んだグループに保存できます。
• Alt+Shift+S で今のタブを、Alt+Shift+A でウィンドウ全体を保存します。

整理する
• 仕事や勉強などのワークスペースを、さらにカテゴリに分けられます。
• グループはボード上のカード。リンクとフォルダを 4 階層まで入れられます。
• なんでもドラッグで移動。グループには記号と色をつけられます。
• メモは Markdown で。チェックボックスや数式も使えます。

また開く
• リンクひとつでも、グループやフォルダ全体でも、タブやタブグループとして一度に開けます。

軽く保つ
• 見ていないタブを休ませたり、数分使わなかったタブを自動で休ませたりできます。
• 重複したタブはワンクリックで閉じられます。

そのほか
• Ctrl+F でリンク、フォルダ、グループ、メモを検索。
• Ctrl+Z で追加、編集、削除、移動、保存、タブやウィンドウを閉じる操作を元に戻せます。
• 削除したものは「最近削除した項目」に 30 日間残ります。
• ライト / ダークテーマ、アクセントカラー、8 言語に対応。
• ダッシュボードをアプリとしてインストールすると、専用のウィンドウで開きます。

自分のサーバー（任意）
• 自分のパソコンで tabcat サーバーを動かし、ツールバーボタンのメニューから接続できます。
• 同じアカウントでサインインしたすべてのブラウザで、グループ、メモ、設定がリアルタイムに同じになります。
• ほかのブラウザで開いているタブを見たり、チームとワークスペースを共有したりできます。

データはあなたのブラウザに
サーバーなしなら、すべてブラウザの中に保存されます。アカウントも、アクセス解析も、広告もありません。自分のサーバーに接続すると、データはそのサーバーにだけ送られ、開発者には送られません。いつでもファイルに書き出せます。

tabcat はオープンソース (MIT) です: https://github.com/nda111/tabcat
```

### Description: 简体中文 (zh_CN)

```
把标签页保存到分组里，需要时随时再打开。不用的标签页会休眠，让浏览器保持轻快。

tabcat 为你的标签页准备了一块看板。按 Ctrl+Shift+X 打开。

保存标签页
• 把"打开的标签页"里的标签拖到分组上，也可以一次保存整个窗口。
• 在任何页面，点工具栏按钮即可保存到你选的分组。
• Alt+Shift+S 保存当前标签页，Alt+Shift+A 保存整个窗口。

井井有条
• 用工作区区分工作和学习，每个工作区再分成类别。
• 分组是看板上的卡片，可以放链接和文件夹，最多四层。
• 任何东西都能拖动。给分组加上符号和颜色。
• 用 Markdown 写备注，支持复选框和数学公式。

再次打开
• 打开一个链接，或者把整个分组、文件夹一次性打开为标签页或标签组。

保持轻快
• 让暂时不看的标签页休眠，或在闲置几分钟后自动休眠。
• 一键关闭重复的标签页。

还有
• Ctrl+F 搜索链接、文件夹、分组和备注。
• Ctrl+Z 撤销添加、编辑、删除、移动、保存，以及关闭标签页和窗口。
• 删除的内容会在“最近删除”中保留 30 天。
• 浅色和深色主题、强调色、8 种语言。
• 把看板安装为应用，在独立窗口中打开。

你自己的服务器（可选）
• 在你的电脑上运行 tabcat 服务器，从工具栏按钮的菜单连接。
• 登录同一账户的所有浏览器中，分组、备注和设置实时保持一致。
• 查看其他浏览器中打开的标签页，与团队共享工作区。

数据只留在你的浏览器里
不使用服务器时，所有内容都保存在浏览器中：没有账号，没有统计分析，没有广告。连接到你自己的服务器后，数据只会发送到该服务器，绝不会发给我们。随时可以导出为文件。

tabcat 是开源软件 (MIT)：https://github.com/nda111/tabcat
```

### Description: Deutsch (de)

```
Speichere Tabs in Gruppen und öffne sie wieder, wann immer du sie brauchst. Ungenutzte Tabs schlafen, dein Browser bleibt leicht.

tabcat gibt deinen Tabs ein Board. Öffne es mit Strg+Umschalt+X.

TABS SPEICHERN
• Zieh einen Tab aus „Offene Tabs" auf eine Gruppe, oder gleich ein ganzes Fenster.
• Auf jeder Seite speichert die Schaltfläche in der Symbolleiste den Tab in die Gruppe deiner Wahl.
• Alt+Umschalt+S speichert den Tab, Alt+Umschalt+A das ganze Fenster.

ORDNUNG HALTEN
• Arbeitsbereiche (etwa Arbeit und Studium), jeder in Kategorien unterteilt.
• Gruppen sind Karten auf einem Board. Sie enthalten Links und Ordner, bis zu vier Ebenen tief.
• Alles lässt sich verschieben. Gib Gruppen ein Symbol und eine Farbe.
• Notizen in Markdown, mit Checkboxen und Formeln.

WIEDER ÖFFNEN
• Einen Link, oder eine ganze Gruppe bzw. einen Ordner auf einmal, als Tabs oder als Tabgruppe.

LEICHT BLEIBEN
• Lass Tabs schlafen, die du gerade nicht ansiehst, oder lass tabcat das nach ein paar Minuten tun.
• Doppelte Tabs mit einem Klick schließen.

UND
• Strg+F durchsucht Links, Ordner, Gruppen und Notizen.
• Strg+Z macht Hinzufügen, Bearbeiten, Löschen, Verschieben, Speichern und das Schließen von Tabs und Fenstern rückgängig.
• Was du löschst, bleibt 30 Tage unter „Zuletzt gelöscht".
• Helles und dunkles Design, Akzentfarben, 8 Sprachen.
• Installiere das Dashboard als App für ein eigenes Fenster.

DEIN EIGENER SERVER (OPTIONAL)
• Betreibe tabcat server auf einem deiner Computer und verbinde tabcat über das Menü der Symbolleisten-Schaltfläche.
• Gruppen, Notizen und Einstellungen bleiben in jedem Browser mit deinem Konto live gleich.
• Sieh die offenen Tabs deiner anderen Browser und teile Arbeitsbereiche mit deinem Team.

DEINE DATEN BLEIBEN BEI DIR
Ohne Server bleibt alles in deinem Browser: kein Konto, keine Analyse, keine Werbung. Mit deinem eigenen Server gehen deine Daten nur an diesen Server, nie an uns. Exportieren kannst du jederzeit in eine Datei.

tabcat ist Open Source (MIT): https://github.com/nda111/tabcat
```

### Description: Español (es)

```
Guarda pestañas en grupos y vuelve a abrirlas cuando las necesites. Las que no usas se duermen y el navegador va más ligero.

tabcat le da un tablero a tus pestañas. Ábrelo con Ctrl+Mayús+X.

GUARDAR PESTAÑAS
• Arrastra una pestaña desde "Pestañas abiertas" a un grupo, o una ventana entera de una vez.
• Desde cualquier página, el botón de la barra de herramientas guarda la pestaña en el grupo que elijas.
• Alt+Mayús+S guarda la pestaña y Alt+Mayús+A la ventana entera.

TODO EN ORDEN
• Espacios de trabajo (por ejemplo, trabajo y estudios), cada uno dividido en categorías.
• Los grupos son tarjetas en un tablero. Contienen enlaces y carpetas, hasta cuatro niveles.
• Arrastra cualquier cosa a cualquier sitio. Ponles un símbolo y un color a los grupos.
• Notas en Markdown, con casillas y fórmulas.

VOLVER A ABRIR
• Un enlace, o un grupo o carpeta entero de una vez, como pestañas o como grupo de pestañas.

LIGERO
• Duerme las pestañas que no estás mirando, o deja que tabcat lo haga tras unos minutos.
• Cierra pestañas duplicadas con un clic.

Y ADEMÁS
• Ctrl+F busca enlaces, carpetas, grupos y notas.
• Ctrl+Z deshace añadir, editar, borrar, mover y guardar, y cerrar pestañas y ventanas.
• Lo que borras se queda 30 días en Eliminados recientemente.
• Tema claro y oscuro, colores de acento, 8 idiomas.
• Instala el panel como aplicación para tener su propia ventana.

TU PROPIO SERVIDOR (OPCIONAL)
• Ejecuta tabcat server en un equipo tuyo y conéctalo desde el menú del botón de la barra de herramientas.
• Tus grupos, notas y ajustes son los mismos en cada navegador con tu cuenta, al instante.
• Mira las pestañas abiertas en tus otros navegadores y comparte espacios de trabajo con tu equipo.

TUS DATOS SE QUEDAN CONTIGO
Sin servidor, todo se guarda en tu navegador: sin cuenta, sin analíticas, sin anuncios. Conectado a tu propio servidor, tus datos van solo a ese servidor, nunca a nosotros. Puedes exportarlo a un archivo cuando quieras.

tabcat es de código abierto (MIT): https://github.com/nda111/tabcat
```

### Description: Français (fr)

```
Rangez vos onglets dans des groupes et rouvrez-les au besoin. Les onglets inutilisés se mettent en veille, votre navigateur reste léger.

tabcat donne un tableau à vos onglets. Ouvrez-le avec Ctrl+Maj+X.

ENREGISTRER DES ONGLETS
• Faites glisser un onglet depuis « Onglets ouverts » vers un groupe, ou toute une fenêtre d'un coup.
• Depuis n'importe quelle page, le bouton de la barre d'outils enregistre l'onglet dans le groupe choisi.
• Alt+Maj+S enregistre l'onglet, Alt+Maj+A toute la fenêtre.

TOUT BIEN RANGÉ
• Des espaces de travail (le travail, les études…), chacun divisé en catégories.
• Les groupes sont des cartes sur un tableau. Ils contiennent des liens et des dossiers, sur quatre niveaux.
• Tout se déplace par glisser-déposer. Donnez un symbole et une couleur à vos groupes.
• Des notes en Markdown, avec cases à cocher et formules.

ROUVRIR
• Un lien, ou tout un groupe ou dossier d'un coup, en onglets ou en groupe d'onglets.

RESTER LÉGER
• Mettez en veille les onglets que vous ne regardez pas, ou laissez tabcat le faire après quelques minutes.
• Fermez les onglets en double en un clic.

ET AUSSI
• Ctrl+F cherche dans les liens, dossiers, groupes et notes.
• Ctrl+Z annule un ajout, une modification, une suppression, un déplacement, un enregistrement ou la fermeture d'onglets et de fenêtres.
• Ce que vous supprimez reste 30 jours dans Supprimés récemment.
• Thèmes clair et sombre, couleurs d'accent, 8 langues.
• Installez le tableau de bord comme application, dans sa propre fenêtre.

VOTRE PROPRE SERVEUR (FACULTATIF)
• Faites tourner tabcat server sur un de vos ordinateurs et connectez-y tabcat depuis le menu du bouton de la barre d'outils.
• Vos groupes, notes et réglages restent identiques dans chaque navigateur connecté à votre compte, en direct.
• Voyez les onglets ouverts dans vos autres navigateurs et partagez des espaces de travail avec votre équipe.

VOS DONNÉES RESTENT CHEZ VOUS
Sans serveur, tout est conservé dans votre navigateur : pas de compte, pas de statistiques, pas de publicité. Connecté à votre propre serveur, vos données ne vont qu'à ce serveur, jamais chez nous. Exportez-les dans un fichier quand vous voulez.

tabcat est open source (MIT) : https://github.com/nda111/tabcat
```

### Description: Português (pt_BR)

```
Salve abas em grupos e abra de novo quando precisar. As abas que você não usa dormem, e o navegador fica mais leve.

O tabcat dá um quadro para as suas abas. Abra com Ctrl+Shift+X.

SALVAR ABAS
• Arraste uma aba de "Abas abertas" para um grupo, ou uma janela inteira de uma vez.
• Em qualquer página, o botão da barra de ferramentas salva a aba no grupo que você escolher.
• Alt+Shift+S salva a aba, Alt+Shift+A a janela inteira.

TUDO EM ORDEM
• Espaços de trabalho (trabalho e estudos, por exemplo), cada um dividido em categorias.
• Grupos são cartões em um quadro. Eles guardam links e pastas, em até quatro níveis.
• Arraste qualquer coisa para qualquer lugar. Dê um símbolo e uma cor aos grupos.
• Notas em Markdown, com caixas de seleção e fórmulas.

ABRIR DE NOVO
• Um link, ou um grupo ou pasta inteira de uma vez, como abas ou como grupo de abas.

LEVE
• Faça dormir as abas que você não está vendo, ou deixe o tabcat fazer isso depois de alguns minutos.
• Feche abas duplicadas com um clique.

E MAIS
• Ctrl+F busca links, pastas, grupos e notas.
• Ctrl+Z desfaz adicionar, editar, excluir, mover e salvar, e fechar abas e janelas.
• O que você exclui fica 30 dias em Excluídos recentemente.
• Tema claro e escuro, cores de destaque, 8 idiomas.
• Instale o painel como aplicativo para ter uma janela só dele.

SEU PRÓPRIO SERVIDOR (OPCIONAL)
• Rode o tabcat server em um computador seu e conecte o tabcat pelo menu do botão da barra de ferramentas.
• Seus grupos, notas e configurações ficam iguais em todos os navegadores com a sua conta, ao vivo.
• Veja as abas abertas nos seus outros navegadores e compartilhe espaços de trabalho com a sua equipe.

SEUS DADOS FICAM COM VOCÊ
Sem servidor, tudo fica no seu navegador: sem conta, sem análises, sem anúncios. Conectado ao seu próprio servidor, seus dados vão só para esse servidor, nunca para nós. Exporte para um arquivo quando quiser.

O tabcat é código aberto (MIT): https://github.com/nda111/tabcat
```

---

## Privacy practices tab

**Single purpose**

```
tabcat saves the user's tabs into groups on a board, and opens them again when the user wants them; it also puts idle tabs to sleep to keep the browser light. The board (dashboard) is the web page at https://tabcat.ghyeok.com, which talks to the extension to read and change the user's saved tabs and open tabs. Optionally, the user can connect tabcat to a tabcat server they run themselves, which then hosts the dashboard and keeps the user's saved tabs the same across their own browsers.
```

**Permission justifications**

`tabs`
```
To save tabs, tabcat reads the title and URL of the user's open tabs: the current tab when the user saves it from the toolbar or context menu, or a window's tabs when the user saves the window. The dashboard lists open tabs so they can be dragged into groups, and tabcat opens, closes, moves and discards (puts to sleep) tabs when the user asks. Titles and URLs never leave the user's computer.
```

`tabGroups`
```
Groups can be opened as a Chrome tab group with the group's name and colour, and tabcat keeps an opened tab group linked to its group so renaming or recolouring one updates the other.
```

`storage`
```
The user's workspaces, groups, saved links, notes and settings are kept in chrome.storage.local, on the user's computer.
```

`unlimitedStorage`
```
Users save hundreds or thousands of links with notes and icons; without it, chrome.storage.local's 10 MB limit could stop tabcat from saving and lose the user's work.
```

`contextMenus`
```
Adds tabcat's actions to the right-click menu: on a page, save this tab or this window and put other tabs to sleep; on a link, save the link; on the toolbar button, also open the dashboard and close duplicate tabs.
```

`alarms`
```
When the user turns on automatic sleep in Settings, a one-minute alarm checks for tabs that have been idle longer than the chosen time and discards them. The alarm only exists while the setting is on.
```

`favicon`
```
Shows each saved link's and open tab's icon on the dashboard and in the toolbar popup, from Chrome's own favicon cache (chrome-extension://…/_favicon/), without fetching icons from the web.
```

`scripting` (*new in 1.1.0*)
```
Only when the user connects tabcat to a tabcat server of their own (from the toolbar button's menu): tabcat registers its content script for that server's address, so the dashboard the server hosts can talk to the extension as tabcat.ghyeok.com does. Disconnecting unregisters it. No script is injected into any other page, and no code is executed from strings.
```

**Optional host permissions** `http://*/*`, `https://*/*` (*new in 1.1.0*)
```
Optional: not granted on install. When the user connects tabcat to their own tabcat server, tabcat asks Chrome for access to that one server's address only (Chrome shows the prompt), to run its content script there and to send the user's saved tabs to it for sync. The user's server can be at any address of theirs, so the optional permission can't name one in advance. Disconnecting removes the permission again.
```

**Host permissions / content script** (`https://tabcat.ghyeok.com/*`)
```
The content script runs only on tabcat's own dashboard (https://tabcat.ghyeok.com), and on the user's own tabcat server once they connect to it, where it passes messages between the dashboard page and the extension. It runs on no other site and reads no page content.
```

**Remote code**: "No, I am not using remote code."
```
All of the extension's JavaScript is in the package. The dashboard at tabcat.ghyeok.com is a separate web page that exchanges messages with the extension's content script; no code from it runs in the extension.
```

**Data usage**
- What user data do you collect? Without a server, tabcat sends nothing off the user's computer. With a server the
  user runs and connects to themselves, the saved tabs (titles and URLs), the user's open tabs and their settings go
  to that server, never to the developer. Tick **Web history** (tab titles and URLs) and leave everything else
  unticked; sign-in (username and password) is on the server's own web pages, not in the extension.
- Tick all three certifications (not sold, not used for unrelated purposes, not used for creditworthiness).

**Privacy policy URL**: https://tabcat.ghyeok.com/privacy

---

## Distribution tab

- Visibility: Public
- Regions: all

## Test instructions (for the reviewer)

The box takes 500 characters at most (this is 476).

```
No account needed.
1. Install: a welcome page opens; choose "Open the dashboard" (https://tabcat.ghyeok.com).
2. Save a tab with the toolbar button, or drag one from "Open tabs" onto a group.
3. Ctrl+Shift+X opens the dashboard anytime.
Optional: "Connect to a server…" (toolbar right-click menu) needs a tabcat server the user runs (github.com/nda111/tabcat/tree/main/server). Only then does Chrome ask for that one address's permission. Without it, everything works locally.
```
