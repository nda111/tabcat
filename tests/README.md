# Browser tests

End-to-end checks in Chromium with the extension loaded: the dashboard (the `pages` worktree in `web/`,
or `TABCAT_WEB`) is served on :8765 and each test starts a fresh profile.

```sh
pip install playwright && python -m playwright install chromium
python tests/run.py              # all of them
python tests/test_tab_groups.py  # one
```

| Test | Covers |
|---|---|
| `test_boot.py` | start-up: blank → spinner → board, the extension / browser notices |
| `test_board.py` | collapse, select, delete, notes, category switches, search, language |
| `test_tab_groups.py` | "Open all" as a tab group: title, colour, symbol, rename sync, setting |
| `test_summon.py` | the dashboard comes to the current window: its address, the popup |
| `test_app.py` | the dashboard as an installable app: manifest, install offers; the default shortcut |
| `test_look.py` | the logo in the accent colour, the logo symbol, symbol picking with Enter, folder indent |
| `test_history.py` | one undo / redo history across open dashboards |
| `test_compat.py` | the features the extension reports; it keeps what a newer dashboard sends |
