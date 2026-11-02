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

    def purge_sessions(self):
        self.run('delete from sessions where expires_at < ?', time.time())
