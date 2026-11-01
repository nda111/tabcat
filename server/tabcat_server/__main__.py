"""tabcat-server [run] [--data-dir D] [--host H] [--port P] [--dashboard auto|FOLDER]
tabcat-server reset-password USERNAME [--data-dir D]   (asks for the new password)"""
import argparse
import getpass
import sys


def main(argv=None):
    ap = argparse.ArgumentParser(prog='tabcat-server', description='Your own tabcat server.')
    ap.add_argument('command', nargs='?', default='run', choices=['run', 'reset-password'])
    ap.add_argument('username', nargs='?')
    ap.add_argument('--data-dir')
    ap.add_argument('--host')
    ap.add_argument('--port', type=int)
    ap.add_argument('--dashboard', help="'auto' (from GitHub, the default) or a folder with the dashboard's files")
    a = ap.parse_args(argv)
    from . import config as C
    cfg = C.load(a.data_dir, a.host, a.port, a.dashboard)

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

    import uvicorn
    from .app import create_app
    print(f'tabcat-server: data in {cfg.data_dir}, dashboard from {cfg.dashboard}, on http://{cfg.host}:{cfg.port}')
    uvicorn.run(create_app(cfg), host=cfg.host, port=cfg.port, proxy_headers=True, forwarded_allow_ips='*', log_level='warning')


if __name__ == '__main__':
    main()
