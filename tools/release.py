# The files a release puts out. The extension and the server are released apart, each tagged with its own version:
#
#   extension-v<version>   (manifest.json)          tabcat-extension-<version>.zip         on GitHub: to install by hand
#                                                   tabcat-extension-<version>-store.zip   to the Chrome Web Store only
#   server-v<version>      (server/pyproject.toml)  tabcat_server-<version>-py3-none-any.whl
#                                                   the Docker image nda111/tabcat-server:<version> and :latest,
#                                                   for linux/amd64 and linux/arm64 (`docker`; TABCAT_IMAGE to name
#                                                   another; --push sends it to Docker Hub, signed in with
#                                                   `docker login`)
#
# The extension's releases are GitHub's "latest" (the README and the install notes link there); the server's are
# published with "Set as the latest release" off. Both update checks find their own by tag (the dashboard: web/js/app.js
# newestExtension; the server: updates.newest_tag). Each release's notes are docs/releases/<tag>.md. Pushing the tag
# runs all of this on GitHub (.github/workflows/release.yml); by hand, it builds into releases/ (not kept in git).
#
# Usage: python tools/release.py [extension|server|docker] [--worktree] [--out DIR] [--push]
#   (from HEAD, as committed; --worktree: the files as they are now, to try it out before committing)
import argparse, io, json, os, shutil, subprocess, sys, tempfile, tomllib, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GIT = shutil.which('git') or '/mnt/c/Program Files/Git/cmd/git.exe'
# (the repository's files the extension doesn't need: the server, the tests and tools, the store listing, the icon's
# source; anything else tracked goes in)
NOT_EXTENSION = ('server/', 'tests/', 'tools/', 'docs/', 'store/', '.github/', 'icons/source/', '.gitattributes', '.gitignore', 'CHANGELOG.md')
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


IMAGE = os.environ.get('TABCAT_IMAGE', 'nda111/tabcat-server')
PLATFORMS = 'linux/amd64,linux/arm64'


def docker_cli() -> str:
    """docker, or Docker Desktop's docker.exe from WSL when the Linux one has no daemon to talk to."""
    for cli in ('docker', 'docker.exe'):
        if shutil.which(cli) and subprocess.run([cli, 'info'], capture_output=True).returncode == 0:
            return cli
    sys.exit('no Docker to build with (is Docker running?)')


def docker(out=None, worktree=False, push=False) -> list:
    """The server's image for both platforms, tagged with its version and latest. Pushed (--push), or else built for
    both (to know they build) and the one for this computer loaded here, to run."""
    version = tomllib.load(open(os.path.join(ROOT, 'server', 'pyproject.toml'), 'rb'))['project']['version']
    if not worktree and git('status', '--porcelain', '--', 'server'):
        sys.exit('server/ has changes not committed: commit them, or try it with --worktree')
    cli, tags = docker_cli(), [f'{IMAGE}:{version}', f'{IMAGE}:latest']
    base = [cli, 'buildx', 'build', '--build-arg', f'VERSION={version}', *sum((['-t', t] for t in tags), [])]
    if push:
        subprocess.run([*base, '--platform', PLATFORMS, '--push', 'server'], cwd=ROOT, check=True)
    else:
        subprocess.run([*base, '--platform', PLATFORMS, 'server'], cwd=ROOT, check=True)
        subprocess.run([*base, '--load', 'server'], cwd=ROOT, check=True)
    return tags


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description="Build a release's files.")
    ap.add_argument('part', nargs='?', choices=['extension', 'server', 'docker'], help='one part only (default: the extension and the server)')
    ap.add_argument('--worktree', action='store_true', help='the files as they are now, not as committed')
    ap.add_argument('--out', default=os.path.join(ROOT, 'releases'))
    ap.add_argument('--push', action='store_true', help='docker: push the image to its registry')
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    for part in [a.part] if a.part else ['extension', 'server']:
        build = {'extension': extension, 'server': server, 'docker': lambda out, wt: docker(out, wt, a.push)}[part]
        for path in build(a.out, a.worktree):
            print(path)
