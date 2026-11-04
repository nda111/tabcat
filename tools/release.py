# The files a release puts out. The extension and the server are released apart, each tagged with its own version:
#
#   extension-v<version>   (manifest.json)          tabcat-extension-<version>.zip         on GitHub: to install by hand
#                                                   tabcat-extension-<version>-store.zip   to the Chrome Web Store only
#   server-v<version>      (server/pyproject.toml)  tabcat_server-<version>-py3-none-any.whl
#
# The extension's releases are GitHub's "latest" (the README and the install notes link there); the server's are
# published with "Set as the latest release" off. Both update checks find their own by tag (the dashboard: web/js/app.js
# newestExtension; the server: updates.newest_tag). The notes for each go beside the files: releases/<tag>.md.
#
# Usage: python tools/release.py [extension|server] [--worktree] [--out DIR]
#   (from HEAD, as committed; --worktree: the files as they are now, to try it out before committing)
import argparse, io, json, os, shutil, subprocess, sys, tempfile, tomllib, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GIT = shutil.which('git') or '/mnt/c/Program Files/Git/cmd/git.exe'
# (the repository's files the extension doesn't need: the server, the tests and tools, the store listing, the icon's
# source; anything else tracked goes in)
NOT_EXTENSION = ('server/', 'tests/', 'tools/', 'docs/', 'store/', 'icons/source/', '.gitattributes', '.gitignore', 'CHANGELOG.md')
LOCAL = ('http://localhost/', 'http://127.0.0.1/')  # (pages on this computer: for working on the dashboard, not the store's)


def git(*args) -> bytes:
    return subprocess.run([GIT, *args], cwd=ROOT, check=True, capture_output=True).stdout


def tracked(prefix='', worktree=False) -> dict:
    """The repository's files (under `prefix`), by path: as committed (HEAD), or as they are now."""
    if worktree:
        paths = [p for p in git('ls-files', '-z', '--', prefix or '.').decode().split('\0') if p and os.path.exists(os.path.join(ROOT, p))]
        return {p: open(os.path.join(ROOT, p), 'rb').read() for p in paths}
    archive = zipfile.ZipFile(io.BytesIO(git('archive', '--format=zip', 'HEAD', *([prefix] if prefix else []))))
    return {i.filename: archive.read(i) for i in archive.infolist() if not i.is_dir()}


def write_zip(path, files: dict, prefix=''):
    with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED) as z:
        for name in sorted(files):
            z.writestr(prefix + name, files[name])


def extension(out, worktree=False) -> list:
    files = {p: b for p, b in tracked(worktree=worktree).items() if not p.startswith(NOT_EXTENSION)}
    manifest = json.loads(files['manifest.json'])
    version = manifest['version']
    hand = os.path.join(out, f'tabcat-extension-{version}.zip')
    write_zip(hand, files, prefix='tabcat/')  # (a tabcat/ folder: unzipped, the folder to load)
    for entry in manifest.get('content_scripts', []) + manifest.get('web_accessible_resources', []):
        entry['matches'] = [m for m in entry['matches'] if not m.startswith(LOCAL)]
    store = os.path.join(out, f'tabcat-extension-{version}-store.zip')
    write_zip(store, {**files, 'manifest.json': json.dumps(manifest, indent=2, ensure_ascii=False).encode() + b'\n'})  # (the manifest at the top)
    return [hand, store]


def server(out, worktree=False) -> list:
    src = tempfile.mkdtemp(prefix='tabcat-server-')
    for path, data in tracked('server', worktree).items():
        dest = os.path.join(src, path)
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        open(dest, 'wb').write(data)
    build = tempfile.mkdtemp(prefix='tabcat-build-')
    subprocess.run([sys.executable, '-m', 'pip', 'wheel', '--no-deps', '--quiet', '--disable-pip-version-check', '-w', build, os.path.join(src, 'server')], check=True)
    made = []
    for name in os.listdir(build):
        made.append(shutil.copy(os.path.join(build, name), os.path.join(out, name)))
    shutil.rmtree(src, True); shutil.rmtree(build, True)
    return made


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description="Build a release's files.")
    ap.add_argument('part', nargs='?', choices=['extension', 'server'], help='one part only (default: both)')
    ap.add_argument('--worktree', action='store_true', help='the files as they are now, not as committed')
    ap.add_argument('--out', default=os.path.join(ROOT, 'releases'))
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    for part in [a.part] if a.part else ['extension', 'server']:
        for path in {'extension': extension, 'server': server}[part](a.out, a.worktree):
            print(path)
