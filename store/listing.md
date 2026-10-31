# Chrome Web Store listing: tabcat

Everything to paste into the Developer Dashboard (https://chrome.google.com/webstore/devconsole).
Upload `releases/v<version>-store.zip` (built by `python tools/store_zip.py`).
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
• Ctrl+Z undoes deleting, moving, saving and closing duplicates.
• Light and dark themes, accent colours, 8 languages.
• Install the dashboard as an app for a window of its own.

YOUR DATA STAYS WITH YOU
Everything is kept in your browser. No account, no tabcat server, no analytics, no ads. Export it to a file whenever you like.

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
• Ctrl+Z로 삭제, 이동, 저장, 중복 닫기를 되돌려요.
• 밝은 테마와 어두운 테마, 테마 색, 8개 언어를 지원해요.
• 대시보드를 앱으로 설치하면 전용 창에서 열려요.

데이터는 내 브라우저에만
모든 것이 브라우저 안에 저장돼요. 계정도, tabcat 서버도, 분석 도구도, 광고도 없어요. 언제든 파일로 내보낼 수 있어요.

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
• Ctrl+Z で削除、移動、保存、重複タブを閉じる操作を元に戻せます。
• ライト / ダークテーマ、アクセントカラー、8 言語に対応。
• ダッシュボードをアプリとしてインストールすると、専用のウィンドウで開きます。

データはあなたのブラウザに
すべてブラウザの中に保存されます。アカウントも、tabcat のサーバーも、アクセス解析も、広告もありません。いつでもファイルに書き出せます。

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
• Ctrl+Z 撤销删除、移动、保存和关闭重复标签页。
• 浅色和深色主题、强调色、8 种语言。
• 把看板安装为应用，在独立窗口中打开。

数据只留在你的浏览器里
所有内容都保存在浏览器中。没有账号，没有 tabcat 服务器，没有统计分析，没有广告。随时可以导出为文件。

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
• Strg+Z macht Löschen, Verschieben, Speichern und das Schließen doppelter Tabs rückgängig.
• Helles und dunkles Design, Akzentfarben, 8 Sprachen.
• Installiere das Dashboard als App für ein eigenes Fenster.

DEINE DATEN BLEIBEN BEI DIR
Alles bleibt in deinem Browser. Kein Konto, kein tabcat-Server, keine Analyse, keine Werbung. Exportieren kannst du jederzeit in eine Datei.

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
• Ctrl+Z deshace borrar, mover, guardar y cerrar duplicadas.
• Tema claro y oscuro, colores de acento, 8 idiomas.
• Instala el panel como aplicación para tener su propia ventana.

TUS DATOS SE QUEDAN CONTIGO
Todo se guarda en tu navegador. Sin cuenta, sin servidor de tabcat, sin analíticas, sin anuncios. Puedes exportarlo a un archivo cuando quieras.

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
• Ctrl+Z annule une suppression, un déplacement, un enregistrement ou la fermeture des doublons.
• Thèmes clair et sombre, couleurs d'accent, 8 langues.
• Installez le tableau de bord comme application, dans sa propre fenêtre.

VOS DONNÉES RESTENT CHEZ VOUS
Tout est conservé dans votre navigateur. Pas de compte, pas de serveur tabcat, pas de statistiques, pas de publicité. Exportez-les dans un fichier quand vous voulez.

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
• Ctrl+Z desfaz excluir, mover, salvar e fechar duplicadas.
• Tema claro e escuro, cores de destaque, 8 idiomas.
• Instale o painel como aplicativo para ter uma janela só dele.

SEUS DADOS FICAM COM VOCÊ
Tudo fica no seu navegador. Sem conta, sem servidor do tabcat, sem análises, sem anúncios. Exporte para um arquivo quando quiser.

O tabcat é código aberto (MIT): https://github.com/nda111/tabcat
```

---

## Privacy practices tab

**Single purpose**

```
tabcat saves the user's tabs into groups on a board, and opens them again when the user wants them; it also puts idle tabs to sleep to keep the browser light. The board (dashboard) is the web page at https://tabcat.ghyeok.com, which talks to the extension to read and change the user's saved tabs and open tabs.
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

**Host permissions / content script** (`https://tabcat.ghyeok.com/*`)
```
The content script runs only on tabcat's own dashboard (https://tabcat.ghyeok.com), where it passes messages between the dashboard page and the extension. It runs on no other site and reads no page content.
```

**Remote code**: "No, I am not using remote code."
```
All of the extension's JavaScript is in the package. The dashboard at tabcat.ghyeok.com is a separate web page that exchanges messages with the extension's content script; no code from it runs in the extension.
```

**Data usage**
- What user data do you collect? tabcat sends nothing off the user's computer. Chrome's definition of
  "collect" includes data an extension only handles locally, so the cautious choice is to tick
  **Web history** (tab titles and URLs the user saves) and leave everything else unticked.
- Tick all three certifications (not sold, not used for unrelated purposes, not used for creditworthiness).

**Privacy policy URL**: https://tabcat.ghyeok.com/privacy

---

## Distribution tab

- Visibility: Public
- Regions: all

## Test instructions (for the reviewer)

```
No account or login is needed.
1. Install the extension: it opens the dashboard at https://tabcat.ghyeok.com.
2. Open a few web pages, then press the toolbar button and "Save this tab", or drag a tab from "Open tabs" on the dashboard onto a group.
3. Ctrl+Shift+X opens the dashboard at any time.
```
