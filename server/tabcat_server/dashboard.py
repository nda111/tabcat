"""The dashboard's files: from a folder given in the config, or (dashboard = 'auto') the latest of the
pages branch on GitHub, as tabcat.ghyeok.com serves it, kept in the data folder and updated from the
admin page."""
import io
import json
import shutil
import urllib.request
import zipfile
from pathlib import Path

ARCHIVE = 'https://codeload.github.com/nda111/tabcat/zip/refs/heads/pages'
VERSION_FILE = '.tabcat-version'


def version(folder: Path):
    try:
        return json.loads((folder / VERSION_FILE).read_text())
    except Exception:
        return None


def present(folder: Path) -> bool:
    return (folder / 'index.html').is_file()


def update(folder: Path) -> dict:
    """Downloads the pages branch and puts it in `folder` in one step (the old files stay until the new
    ones are all there). Returns its version: the commit, from the archive's comment."""
    with urllib.request.urlopen(urllib.request.Request(ARCHIVE, headers={'User-Agent': 'tabcat-server'}), timeout=60) as r:
        data = r.read()
    z = zipfile.ZipFile(io.BytesIO(data))
    commit = z.comment.decode(errors='ignore').strip()[:40] or None
    staging = folder.with_name(folder.name + '.new')
    shutil.rmtree(staging, ignore_errors=True)
    staging.mkdir(parents=True)
    root = z.namelist()[0].split('/')[0] + '/'
    for item in z.infolist():
        name = item.filename[len(root):] if item.filename.startswith(root) else ''
        if not name or item.is_dir() or '..' in Path(name).parts:
            continue
        target = staging / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(z.read(item))
    if not present(staging):
        shutil.rmtree(staging, ignore_errors=True)
        raise RuntimeError('the download has no dashboard in it')
    import time
    info = {'commit': commit, 'updated_at': time.time()}
    (staging / VERSION_FILE).write_text(json.dumps(info))
    old = folder.with_name(folder.name + '.old')
    shutil.rmtree(old, ignore_errors=True)
    if folder.exists():
        folder.rename(old)
    staging.rename(folder)
    shutil.rmtree(old, ignore_errors=True)
    return info
