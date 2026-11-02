"""The server's database: one SQLite file in the data folder (copy it to back up)."""
import sqlite3
import threading
import time

SCHEMA = '''
create table if not exists users (
  id integer primary key,
  username text not null unique collate nocase,
  password text not null,          -- scrypt hash (see auth.py)
  admin integer not null default 0,
  disabled integer not null default 0,
  created_at real not null,
  last_seen real
);
create table if not exists sessions (
  token text primary key,          -- (stored hashed: see auth.py)
  user_id integer not null references users(id) on delete cascade,
  created_at real not null,
  expires_at real not null,
  agent text
);
create table if not exists invites (
  code text primary key,
  created_by integer references users(id) on delete set null,
  created_at real not null,
  expires_at real,
  used_by integer references users(id) on delete set null,
  used_at real
);
create table if not exists settings (key text primary key, value text not null);
'''

DEFAULTS = {'signup': 'closed', 'session_days': '30', 'login_tries': '5', 'login_lock_minutes': '10'}  # signup: closed | invite | open


class DB:
    def __init__(self, path):
        path.parent.mkdir(parents=True, exist_ok=True)
        self.path = path
        self.conn = sqlite3.connect(path, check_same_thread=False, isolation_level=None)
        self.conn.row_factory = sqlite3.Row
        self.lock = threading.RLock()
        with self.lock:
            self.conn.execute('pragma foreign_keys = on')
            self.conn.execute('pragma journal_mode = wal')
            self.conn.executescript(SCHEMA)
            # Each account's key for its data in the browser (see the extension's spaceName): random and its own,
            # never another's (ids come round again once the newest account goes: one made after would get its
            # data). Accounts from before keep their id as theirs, their data staying where it is.
            if 'space' not in [r['name'] for r in self.conn.execute('pragma table_info(users)')]:
                self.conn.execute('alter table users add column space text')
                self.conn.execute('update users set space = cast(id as text)')
            # (a profile photo: a small image as a data: URL, and when it was set, for its address to change with it)
            cols = [r['name'] for r in self.conn.execute('pragma table_info(users)')]
            # (each sign-in's address and when it was last used: the account page lists them)
            scols = [r['name'] for r in self.conn.execute('pragma table_info(sessions)')]
            if 'ip' not in scols:
                self.conn.execute('alter table sessions add column ip text')
                self.conn.execute('alter table sessions add column last_seen real')
            if 'totp_secret' not in cols:  # (two-step sign-in, when turned on: see totp.py)
                for col in ('totp_secret text', 'totp_pending text', 'totp_step integer', 'recovery text'):
                    self.conn.execute(f'alter table users add column {col}')
            if 'name' not in cols:  # (a name to go by, beside the username one signs in with; may be empty)
                self.conn.execute('alter table users add column name text')
            if 'avatar' not in cols:
                self.conn.execute('alter table users add column avatar text')
                self.conn.execute('alter table users add column avatar_at real')
            self.conn.executescript('''
              create unique index if not exists users_space on users(space);
              create trigger if not exists users_space_new after insert on users when new.space is null
              begin update users set space = lower(hex(randomblob(12))) where id = new.id; end;
            ''')

    def q(self, sql, *args):
        with self.lock:
            return self.conn.execute(sql, args).fetchall()

    def one(self, sql, *args):
        rows = self.q(sql, *args)
        return rows[0] if rows else None

    def run(self, sql, *args):
        with self.lock:
            cur = self.conn.execute(sql, args)
            return cur.lastrowid

    def setting(self, key):
        row = self.one('select value from settings where key = ?', key)
        return row['value'] if row else DEFAULTS.get(key)

    def set_setting(self, key, value):
        self.run('insert into settings (key, value) values (?, ?) on conflict(key) do update set value = excluded.value', key, str(value))

    def backup_to(self, dest):
        with self.lock:
            target = sqlite3.connect(dest)
            self.conn.backup(target)
            target.close()

    # Move to another file: copied there whole, then used from there; the old file goes
    def move_to(self, dest):
        dest.parent.mkdir(parents=True, exist_ok=True)
        with self.lock:
            target = sqlite3.connect(dest)
            self.conn.backup(target)
            target.close()
            old, self.path = self.path, dest
            self.conn.close()
            self.conn = sqlite3.connect(dest, check_same_thread=False, isolation_level=None)
            self.conn.row_factory = sqlite3.Row
            self.conn.execute('pragma foreign_keys = on')
            self.conn.execute('pragma journal_mode = wal')
            for suffix in ('', '-wal', '-shm'):
                old.with_name(old.name + suffix).unlink(missing_ok=True)

    def purge_sessions(self):
        self.run('delete from sessions where expires_at < ?', time.time())
