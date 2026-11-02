"""tabcat-server [run] [--data-dir D] [--host H] [--port P] [--dashboard auto|FOLDER] [--reload]
tabcat-server reset-password USERNAME [--data-dir D]   (asks for the new password; turns the account back on)
tabcat-server make-admin USERNAME [--data-dir D]       (an admin again, and turned on: locked out of the admin page)
tabcat-server reset-2fa USERNAME [--data-dir D]        (two-step sign-in off: the phone and the recovery codes gone)
tabcat-server reset-server [--data-dir D]              (every account, invitation and setting gone: set it up again)"""
import argparse
import getpass
import sys


def main(argv=None):
    ap = argparse.ArgumentParser(prog='tabcat-server', description='Your own tabcat server.')
    ap.add_argument('command', nargs='?', default='run', choices=['run', 'reset-password', 'make-admin', 'reset-2fa', 'reset-server'])
    ap.add_argument('username', nargs='?')
    ap.add_argument('--data-dir')
    ap.add_argument('--host')
    ap.add_argument('--port', type=int)
    ap.add_argument('--dashboard', help="'auto' (from GitHub, the default) or a folder with the dashboard's files")
    ap.add_argument('--setup-from', help='who may make the first account: addresses or networks, comma-separated (default: this computer)')
    ap.add_argument('--admin-from', help='who may use the admin page (default: anywhere)')
    ap.add_argument('--trusted-proxies', help="proxies whose X-Forwarded-For is believed (default: this computer)")
    ap.add_argument('--reload', action='store_true', help='start again when the server\'s code changes (while working on it)')
    a = ap.parse_args(argv)
    from . import config as C
    cfg = C.load(a.data_dir, a.host, a.port, a.dashboard, a.setup_from, a.admin_from, a.trusted_proxies)

    if a.command == 'reset-password':
        from . import auth
        from .db import DB
        db = DB(cfg.db_path)
        if not a.username or not db.one('select 1 from users where username = ?', a.username):
            sys.exit('no such user')
        pw = getpass.getpass('New password: ')
        if not auth.valid_password(pw) or pw != getpass.getpass('Again: '):
            sys.exit('passwords: 8 characters or more, the same twice')
        db.run('update users set password = ?, disabled = 0 where username = ?', auth.hash_password(pw), a.username)
        db.run('delete from sessions where user_id = (select id from users where username = ?)', a.username)
        print('done')
        return

    if a.command == 'make-admin':
        from .db import DB
        db = DB(cfg.db_path)
        if not a.username or not db.one('select 1 from users where username = ?', a.username):
            sys.exit('no such user')
        db.run('update users set admin = 1, disabled = 0 where username = ?', a.username)
        print(f'{a.username} is an admin')
        return

    if a.command == 'reset-2fa':
        from .db import DB
        db = DB(cfg.db_path)
        if not a.username or not db.one('select 1 from users where username = ?', a.username):
            sys.exit('no such user')
        db.run('update users set totp_secret = null, totp_pending = null, totp_step = null, recovery = null where username = ?', a.username)
        print(f'two-step sign-in is off for {a.username}')
        return

    if a.command == 'reset-server':
        if not cfg.db_path.exists():
            sys.exit(f'nothing to reset in {cfg.data_dir}')
        print(f'This deletes every account, its data, the invitations and the settings in {cfg.db_path}.')
        print('Stop the server first. The dashboard and config.toml stay.')
        if input('Type "reset" to go on: ').strip() != 'reset':
            sys.exit('nothing changed')
        for suffix in ('', '-wal', '-shm'):
            cfg.db_path.with_name(cfg.db_path.name + suffix).unlink(missing_ok=True)
        print('done: start the server and open it to make the first account again')
        return

    import uvicorn
    from .app import create_app
    print(f'tabcat-server: data in {cfg.data_dir}, dashboard from {cfg.dashboard}, on http://{cfg.host}:{cfg.port}')
    # (Ctrl+C: open connections, which browsers keep, get 3 seconds to finish, not forever)
    common = dict(host=cfg.host, port=cfg.port, proxy_headers=True, forwarded_allow_ips=list(cfg.trusted_proxies), log_level='warning', timeout_graceful_shutdown=3,
                  limit_concurrency=200, timeout_keep_alive=5)  # (so many connections at once; idle ones closed soon)
    if a.reload:  # (working on the server: it starts again when its code changes)
        import os
        os.environ.update(TABCAT_DATA=str(cfg.data_dir), TABCAT_HOST=cfg.host, TABCAT_PORT=str(cfg.port), TABCAT_DASHBOARD=cfg.dashboard, TABCAT_SETUP_FROM=','.join(cfg.setup_from),
                          TABCAT_ADMIN_FROM=','.join(cfg.admin_from), TABCAT_TRUSTED_PROXIES=','.join(cfg.trusted_proxies))
        uvicorn.run('tabcat_server.app:from_env', factory=True, reload=True, reload_dirs=[os.path.dirname(__file__)], **common)
    else:
        uvicorn.run(create_app(cfg), **common)


if __name__ == '__main__':
    main()
