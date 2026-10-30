# Runs every test_*.py here, one after another (each serves on :8765); exits non-zero if any failed.
import glob, os, subprocess, sys

here = os.path.dirname(os.path.abspath(__file__))
failed = []
for f in sorted(glob.glob(os.path.join(here, 'test_*.py'))):
    name = os.path.basename(f)
    print(f'== {name}', flush=True)
    if subprocess.run([sys.executable, f], cwd=here).returncode: failed.append(name)
print('\nfailed: ' + ', '.join(failed) if failed else '\nall tests passed')
sys.exit(1 if failed else 0)
