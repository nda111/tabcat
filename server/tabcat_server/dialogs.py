"""The operating system's own file dialogs, shown on the server's computer (for the admin there: moving the
database). Windows: its Save dialog (through PowerShell; from WSL too, the path turned into WSL's); macOS:
AppleScript's; Linux: zenity or kdialog, else Tk. None of them (a server with no screen, Docker): None."""
import os
import platform
import shutil
import subprocess
import threading
from pathlib import Path

_one = threading.Lock()  # (one dialog at a time)
WAIT = 600  # seconds the dialog may stay open

_PS = r'''
Add-Type -AssemblyName System.Windows.Forms
$owner = New-Object System.Windows.Forms.Form -Property @{ TopMost = $true; ShowInTaskbar = $false; WindowState = 'Minimized' }
$d = New-Object System.Windows.Forms.SaveFileDialog
$d.Title = $env:TABCAT_TITLE
$d.Filter = 'SQLite (*.db)|*.db|All files (*.*)|*.*'
$d.FileName = $env:TABCAT_NAME
if ($env:TABCAT_DIR) { $d.InitialDirectory = $env:TABCAT_DIR }
$d.OverwritePrompt = $false
if ($d.ShowDialog($owner) -eq 'OK') { [Console]::OutputEncoding = [Text.Encoding]::UTF8; Write-Output $d.FileName }
'''


def _wsl() -> bool:
    return 'microsoft' in platform.release().lower() and bool(shutil.which('powershell.exe'))


def _run(cmd, env=None) -> str | None:
    r = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', timeout=WAIT, env={**os.environ, **(env or {})})
    out = r.stdout.strip()
    return out or None


def save_file(title: str, start: Path) -> str | None | bool:
    """A path chosen to save to (it may not exist yet); None: cancelled; False: no dialog on this computer."""
    if os.environ.get('TABCAT_NO_DIALOG'):  # (tests, and servers that shouldn't show one)
        return False
    if not _one.acquire(blocking=False):
        return None
    try:
        folder, name = str(start.parent), start.name
        if os.name == 'nt' or _wsl():
            ps = 'powershell.exe' if _wsl() else 'powershell'
            if _wsl():
                folder = _run(['wslpath', '-w', folder]) or ''
            # (WSLENV carries the variables over to Windows)
            env = {'TABCAT_TITLE': title, 'TABCAT_NAME': name, 'TABCAT_DIR': folder, 'WSLENV': 'TABCAT_TITLE:TABCAT_NAME:TABCAT_DIR'}
            got = _run([ps, '-NoProfile', '-STA', '-NonInteractive', '-Command', _PS], env)
            if got and _wsl():
                got = _run(['wslpath', '-u', got])
            return got
        if platform.system() == 'Darwin':
            script = f'POSIX path of (choose file name with prompt {title!r} default name {name!r} default location (POSIX file {folder!r}))'
            return _run(['osascript', '-e', script.replace("'", '"')])
        if os.environ.get('DISPLAY') or os.environ.get('WAYLAND_DISPLAY'):
            if shutil.which('zenity'):
                return _run(['zenity', '--file-selection', '--save', f'--title={title}', f'--filename={start}'])
            if shutil.which('kdialog'):
                return _run(['kdialog', '--title', title, '--getsavefilename', str(start)])
            try:
                import tkinter
                from tkinter import filedialog
                root = tkinter.Tk()
                root.withdraw()
                root.attributes('-topmost', True)
                got = filedialog.asksaveasfilename(title=title, initialdir=folder, initialfile=name, confirmoverwrite=False, parent=root)
                root.destroy()
                return got or None
            except Exception:
                return False
        return False
    except (OSError, subprocess.SubprocessError):
        return False
    finally:
        _one.release()
