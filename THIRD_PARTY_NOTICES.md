# Third-party notices

tabcat itself is under the [MIT License](LICENSE). It uses the fonts, libraries and data below, each under its own
license. "Bundled" means a copy is in tabcat's own files; "loaded" means the browser fetches it from the address
given when it's needed, and tabcat ships no copy.

## Fonts

| Font | Used in | How | Copyright | License |
|---|---|---|---|---|
| [Pretendard](https://github.com/orioncactus/pretendard) 1.3.9 (variable, dynamic subset) | Korean text: extension, dashboard, server pages | Its stylesheet bundled (`fonts/pretendard.css`, `web/fonts/pretendard.css`, renamed and scaled); the font files loaded from `cdn.jsdelivr.net` | © 2021 Kil Hyung-jin, with Reserved Font Name Pretendard | [SIL Open Font License 1.1](https://openfontlicense.org/open-font-license-official-text/) |
| [Archivo](https://github.com/Omnibus-Type/Archivo) | Latin text everywhere | Loaded from Google Fonts | © 2020 The Archivo Project Authors | SIL Open Font License 1.1 |
| [Noto Sans JP](https://fonts.google.com/noto/specimen/Noto+Sans+JP), [Noto Sans SC](https://fonts.google.com/noto/specimen/Noto+Sans+SC) | Japanese and Chinese text, where the system has no font of its own | Loaded from Google Fonts | © 2014–2021 Adobe (http://www.adobe.com/), with Reserved Font Name 'Source' | SIL Open Font License 1.1 |

## Libraries and data

| Project | Used for | How | Copyright | License |
|---|---|---|---|---|
| [MathJax](https://www.mathjax.org/) 3.2.2 | Math in group notes (the dashboard) | Loaded from `cdn.jsdelivr.net` when a note has math | © 2009–2023 The MathJax Consortium | [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0) |
| [emoji-picker-element](https://github.com/nolanlawson/emoji-picker-element) 1.29.1 (its database) | Finding emoji by name for symbols (the dashboard) | Loaded from `cdn.jsdelivr.net` on first use | © Nolan Lawson | Apache License 2.0 |
| [emoji-picker-element-data](https://github.com/nolanlawson/emoji-picker-element-data) 1.8.0, built from [Emojibase](https://emojibase.dev/) | The emoji names it searches | Loaded from `cdn.jsdelivr.net` on first use | © Nolan Lawson; Emojibase © Miles Johnson | Apache License 2.0; Emojibase data: MIT |
| [Feather](https://feathericons.com/) | Some of the line icons in the dashboard (`web/js/icons.js`) and the toolbar popup are drawn after Feather's | Bundled (adapted SVG paths) | © 2013–2017 Cole Bemis | MIT (below) |

### The server (tabcat-server)

Installed by pip with tabcat-server (not bundled in its package; a Docker image of it includes them):

| Package | License |
|---|---|
| [FastAPI](https://github.com/fastapi/fastapi) | MIT |
| [Starlette](https://github.com/encode/starlette) (with FastAPI) | BSD 3-Clause |
| [Pydantic](https://github.com/pydantic/pydantic) (with FastAPI) | MIT |
| [Uvicorn](https://github.com/encode/uvicorn) | BSD 3-Clause |
| [Segno](https://github.com/heuer/segno) (the two-step sign-in's QR code) | BSD 3-Clause |

Each package's own dependencies come with their licenses in the installed packages' metadata (`pip show -f`).

## License texts

### MIT License (Feather)

```
The MIT License (MIT)

Copyright (c) 2013-2017 Cole Bemis

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

The SIL Open Font License 1.1 and the Apache License 2.0 are at the links above; tabcat ships none of those fonts'
or libraries' files, only a stylesheet that names Pretendard's (it keeps Pretendard's copyright notice).
