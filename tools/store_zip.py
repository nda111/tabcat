# The zip to upload to the Chrome Web Store: the release's files from HEAD, with the manifest at the top
# (no tabcat/ folder) and without the localhost pages (only for working on the dashboard locally).
# Usage: python tools/store_zip.py   ->  releases/vX.Y.Z-store.zip
import io, json, os, shutil, subprocess, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FILES = ['manifest.json', 'background.js', 'content.js', 'popup.html', 'popup.css', 'popup.js', 'lib', 'fonts',
         'icons/logo.svg', 'icons/icon16.png', 'icons/icon32.png', 'icons/icon48.png', 'icons/icon128.png',
         '_locales', 'README.md', 'LICENSE']
LOCAL = ('http://localhost/', 'http://127.0.0.1/')

git = shutil.which('git') or '/mnt/c/Program Files/Git/cmd/git.exe'
archive = subprocess.run([git, 'archive', '--format=zip', 'HEAD', *FILES], cwd=ROOT, check=True, capture_output=True).stdout

manifest = json.loads(zipfile.ZipFile(io.BytesIO(archive)).read('manifest.json'))
for entry in manifest.get('content_scripts', []) + manifest.get('web_accessible_resources', []):
    entry['matches'] = [m for m in entry['matches'] if not m.startswith(LOCAL)]

out = os.path.join(ROOT, 'releases', f"v{manifest['version']}-store.zip")
os.makedirs(os.path.dirname(out), exist_ok=True)
with zipfile.ZipFile(io.BytesIO(archive)) as src, zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as dst:
    for item in src.infolist():
        if item.is_dir():
            continue
        data = json.dumps(manifest, indent=2, ensure_ascii=False).encode() + b'\n' if item.filename == 'manifest.json' else src.read(item)
        dst.writestr(item.filename, data)
print(out)
