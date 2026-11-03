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
-- sync (each account's tabcat data, kept here and passed between its browsers): changes in the order they came,
-- each numbered (seq) and applied once (its id); now and then a whole copy (a snapshot) the older changes fold into
create table if not exists sync_ops (
  user_id integer not null references users(id) on delete cascade,
  seq integer not null,
  op_id text not null,
  device text,
  at real not null,
  body text not null,
  primary key (user_id, seq),
  unique (user_id, op_id)
);
create table if not exists sync_snapshots (
  user_id integer primary key references users(id) on delete cascade,
  seq integer not null,
  at real not null,
  body text not null
);
create table if not exists device_tabs (  -- each of an account's browsers: its windows and tabs open, as it last said
  user_id integer not null references users(id) on delete cascade,
  device text not null,            -- (the browser's own id for itself, as sync gives it)
  name text not null default '',   -- (how it calls itself: "Chrome on Windows")
  at real not null,
  body text not null,              -- ({windows: [{focused, tabs: [{url, title, icon, pinned, active, group}], groups: [{id, title, color}]}]})
  label text not null default '',  -- (a name given it by the user, in place of its own)
  forgotten real,                  -- (hidden from the list, when: shown again by hand, or once it signs in again after)
  position integer,                -- (its place in the list, as the user put them; none yet: after those, as they came)
  session text,                    -- (the sign-in it last sent from, as the list of sign-ins knows it: to sign it out)
  primary key (user_id, device)
);
create table if not exists events (  -- the security record (see app.log): sign-ins, changes, an admin's doings
  id integer primary key,
  at real not null,
  user_id integer,                 -- (the account it's about; kept after the account goes, by name)
  username text,
  kind text not null,
  ip text,
  agent text,
  actor text,                      -- (an admin's doing: whose)
  detail text,
  tried text                       -- (signing in: the username typed, which may be no account's)
);
create index if not exists events_at on events(at);
create index if not exists events_user on events(user_id, at);
'''

DEFAULTS = {'signup': 'closed', 'session_days': '30', 'login_tries': '5', 'login_lock_minutes': '10', 'dashboard_auto': '1', 'log_days': '90'}  # signup: closed | invite | open


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
            ecols = [r['name'] for r in self.conn.execute('pragma table_info(events)')]
            if ecols and 'tried' not in ecols:  # (a sign-in attempt: the username tried, apart from the account)
                self.conn.execute('alter table events add column tried text')
            if 'name' not in cols:  # (a name to go by, beside the username one signs in with; may be empty)
                self.conn.execute('alter table users add column name text')
            dcols = [r['name'] for r in self.conn.execute('pragma table_info(device_tabs)')]
            if dcols and 'label' not in dcols:  # (each browser's tabs, before they could be named or let go)
                self.conn.execute("alter table device_tabs add column label text not null default ''")
                self.conn.execute('alter table device_tabs add column forgotten real')
            if dcols and 'position' not in dcols:  # (before they could be put in order, or signed out from the list)
                self.conn.execute('alter table device_tabs add column position integer')
                self.conn.execute('alter table device_tabs add column session text')
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

    def purge_events(self):
        self.run('delete from events where at < ?', time.time() - float(self.setting('log_days') or 90) * 86400)

    def purge_sessions(self):
        self.run('delete from sessions where expires_at < ?', time.time())
