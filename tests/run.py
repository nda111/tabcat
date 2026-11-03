# Runs the tests, several at once: `python run.py` (all of them, the server's API tests too), `python run.py sync live`
# (those whose names have any of these in them), `-j 6` (how many at once; 4 by default). Each test running beside
# others serves the dashboard on a port of its own (TABCAT_TEST_PORT, see harness.py); the ones with servers of their
# own already have their own ports. Prints a line a test, and what failed in full. A test failing is run once more, on
# its own: passing then, it's reported as flaky (timing under load), not failed.
import os, subprocess, sys, time
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
args = sys.argv[1:]
jobs = 4
if '-j' in args:
    i = args.index('-j'); jobs = int(args[i + 1]); del args[i:i + 2]

tests = sorted(f[:-3] for f in os.listdir(HERE) if f.startswith('test_') and f.endswith('.py'))
if args: tests = [t for t in tests if any(a in t for a in args)]
api = not args or any(a in 'test_api' for a in args)
# (the server's own, in its own folder; with the server's Python, if given: TABCAT_SERVER_PYTHON)
API = [os.environ.get('TABCAT_SERVER_PYTHON', sys.executable), os.path.join(ROOT, 'server', 'tests', 'test_api.py')]

ports = iter(range(8800, 8900))
def run(name, port=None):
    env = {**os.environ, 'TABCAT_TEST_PORT': str(port or next(ports))}
    cmd = API if name == 'api' else [sys.executable, f'{name}.py']
    t0 = time.time()
    try: p = subprocess.run(cmd, cwd=HERE if name != 'api' else ROOT, env=env, capture_output=True, text=True, timeout=600)
    except subprocess.TimeoutExpired: return name, False, 'timed out (10 minutes)', time.time() - t0
    out = p.stdout + p.stderr
    return name, p.returncode == 0, out, time.time() - t0

names = (['api'] if api else []) + tests
t0 = time.time()
with ThreadPoolExecutor(jobs) as pool:
    results = []
    for name, ok, out, took in pool.map(run, names):
        print(f"{'ok  ' if ok else 'FAIL'} {name} ({took:.0f}s)", flush=True)
        results.append((name, ok, out))

failed, flaky = [], []
for name, ok, out in results:
    if ok: continue
    _, ok2, out2, _ = run(name, 8765)  # (once more, alone)
    (flaky if ok2 else failed).append((name, out if ok2 else out2))
for name, out in flaky:
    print(f'\nflaky: {name} (failed beside others, passed alone):', *[l for l in out.splitlines() if l.startswith('FAIL')], sep='\n  ')
for name, out in failed:
    lines = [l for l in out.splitlines() if not l.startswith('PASS')]
    print(f'\n== {name} failed:', *lines[-40:], sep='\n')
print(f"\n{len(names) - len(failed)}/{len(names)} passed{f', {len(flaky)} flaky' if flaky else ''} in {time.time() - t0:.0f}s")
sys.exit(1 if failed else 0)
