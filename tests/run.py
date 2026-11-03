# Runs the tests, several at once: `python run.py` (all of them, the server's API tests too), `python run.py sync live`
# (those whose names have any of these in them). In two lanes: the heavy ones (a server of their own and two or three
# browsers: the API tests, and those that start uvicorn), `--heavy 2` at once (2 by default), and the rest beside
# them, `-j 3` at once (3 by default); heavy ones crowding each other were what made tests fail by timing. Each test
# running beside others serves the dashboard on a port of its own (TABCAT_TEST_PORT, see harness.py; the ones with
# servers of their own already have their own ports), its waits roomier (see harness.py). Prints a line a test as it
# ends, and what failed in full. A test failing is run once more, on its own: passing then, it's reported as flaky
# (timing under load), not failed.
import os, subprocess, sys, threading, time
from concurrent.futures import ThreadPoolExecutor, as_completed

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
args = sys.argv[1:]
def opt(flag, default):
    if flag not in args: return default
    i = args.index(flag); v = int(args[i + 1]); del args[i:i + 2]; return v
jobs, heavy_jobs = opt('-j', 3), opt('--heavy', 2)

tests = sorted(f[:-3] for f in os.listdir(HERE) if f.startswith('test_') and f.endswith('.py'))
if args: tests = [t for t in tests if any(a in t for a in args)]
api = not args or any(a in 'test_api' for a in args)
# (the server's own, in its own folder; with the server's Python, if given: TABCAT_SERVER_PYTHON)
API = [os.environ.get('TABCAT_SERVER_PYTHON', sys.executable), os.path.join(ROOT, 'server', 'tests', 'test_api.py')]

ports, plock = iter(range(8800, 8900)), threading.Lock()
def next_port():
    with plock: return next(ports)
# (heavy: a server of its own, two or three browsers)
heavy = lambda name: name == 'api' or 'uvicorn' in open(os.path.join(HERE, f'{name}.py')).read()
def run(name, port=None):
    # (beside others, the fixed pauses half as long again: see harness.py; alone, as written)
    env = {**os.environ, 'TABCAT_TEST_PORT': str(port or next_port()), 'TABCAT_TEST_SLOW': '1' if port else os.environ.get('TABCAT_TEST_SLOW', '1.5')}
    cmd = API if name == 'api' else [sys.executable, f'{name}.py']
    t0 = time.time()
    try: p = subprocess.run(cmd, cwd=HERE if name != 'api' else ROOT, env=env, capture_output=True, text=True, timeout=600)
    except subprocess.TimeoutExpired: return name, False, 'timed out (10 minutes)', time.time() - t0
    out = p.stdout + p.stderr
    return name, p.returncode == 0, out, time.time() - t0

names = (['api'] if api else []) + tests
t0 = time.time()
results = []
# (the heavy ones first in their lane, the longest first, so the lanes end about together)
size = lambda n: os.path.getsize(os.path.join(ROOT, 'server', 'tests', 'test_api.py') if n == 'api' else os.path.join(HERE, f'{n}.py'))
heavies = sorted((n for n in names if heavy(n)), key=size, reverse=True)  # (the bigger, the longer, roughly)
lights = [n for n in names if not heavy(n)]
with ThreadPoolExecutor(max(1, heavy_jobs)) as hp, ThreadPoolExecutor(max(1, jobs)) as lp:
    futures = [hp.submit(run, n) for n in heavies] + [lp.submit(run, n) for n in lights]
    for f in as_completed(futures):
        name, ok, out, took = f.result()
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
