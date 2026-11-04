"""The server's database: one SQLite file in the data folder (copy it to back up)."""
import re
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
-- workspaces shared between accounts: each its own data, kept in step like an account's (its changes numbered,
-- now and then a whole copy), for its members to see and (owner, editors) change. Asked by mail to join.
create table if not exists shares (
  id text primary key,
  root text not null,              -- (the workspace's id, the same in each member's data)
  created_at real not null,
  name text not null default '',   -- (the workspace's name and symbol as last changed, for mail about it)
  symbol text not null default ''
);
create table if not exists share_members (
  share_id text not null references shares(id) on delete cascade,
  user_id integer not null references users(id) on delete cascade,
  role text not null,              -- owner (one) | manager | editor | viewer
  at real not null,
  primary key (share_id, user_id)
);
create table if not exists share_ops (
  share_id text not null references shares(id) on delete cascade,
  seq integer not null,
  op_id text not null,
  user_id integer,
  device text,
  at real not null,
  body text not null,
  primary key (share_id, seq),
  unique (share_id, op_id)
);
create table if not exists share_snapshots (
  share_id text primary key references shares(id) on delete cascade,
  seq integer not null,
  at real not null,
  body text not null
);
create table if not exists mail (  -- each account's mailbox: asked to join a share, and the answers to its own asking
  id integer primary key,
  to_id integer not null references users(id) on delete cascade,
  from_id integer references users(id) on delete set null,
  from_name text not null default '', -- (who sent it, as they were then: kept after their account goes)
  kind text not null,              -- invite | reply | removed (let go by its owner) | left (someone left the owner's)
  share_id text,                   -- (the share it's about; kept, by name, after it goes)
  ws_name text not null default '',
  ws_symbol text not null default '',
  role text,                       -- (an invite: as what)
  answer text,                     -- (an invite: accepted | declined once answered; a reply: which)
  invite_id integer,               -- (a reply: to which invite)
  at real not null,
  answered_at real,
  deleted real,                    -- (put away by its owner: kept a while, to be undone)
  seen real                        -- (when its owner first had the Mailbox open with it in: read)
);
create index if not exists mail_to on mail(to_id, at);
create index if not exists mail_share on mail(share_id, kind);  -- (a share's invites: asked, taken back, ended with it)
create index if not exists mail_from on mail(from_id, kind);    -- (an account's invites waiting: how many)
create index if not exists share_members_user on share_members(user_id);
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


class TooNew(RuntimeError):
    """The database file is from a newer tabcat-server than this one."""


def _statements(sql):
    """A script's statements one by one (executescript would end the migration's transaction): its comments left
    out, as they may hold a ';' (no string in it does)."""
    return [x.strip() for x in re.sub(r'--[^\n]*', '', sql).split(';') if x.strip()]


def _columns(conn, table):
    return [r['name'] for r in conn.execute(f'pragma table_info({table})')]


def _v1(conn):
    """tabcat-server 1.0.0, the first release: the tables as SCHEMA has them. A file from while it was written
    (before the version was kept) is brought up to it: the columns added along the way, if missing."""
    for stmt in _statements(SCHEMA):
        conn.execute(stmt)
    cols = _columns(conn, 'users')
    # Each account's key for its data in the browser (see the extension's spaceName): random and its own, never
    # another's (ids come round again once the newest account goes). Accounts from before keep their id as theirs.
    if 'space' not in cols:
        conn.execute('alter table users add column space text')
        conn.execute('update users set space = cast(id as text)')
    if 'totp_secret' not in cols:  # (two-step sign-in, when turned on: see totp.py)
        for col in ('totp_secret text', 'totp_pending text', 'totp_step integer', 'recovery text'):
            conn.execute(f'alter table users add column {col}')
    if 'name' not in cols:  # (a name to go by, beside the username one signs in with; may be empty)
        conn.execute('alter table users add column name text')
    if 'avatar' not in cols:  # (a profile photo: a small image as a data: URL, and when it was set)
        conn.execute('alter table users add column avatar text')
        conn.execute('alter table users add column avatar_at real')
    if 'ip' not in _columns(conn, 'sessions'):  # (each sign-in's address and when it was last used)
        conn.execute('alter table sessions add column ip text')
        conn.execute('alter table sessions add column last_seen real')
    if 'tried' not in _columns(conn, 'events'):  # (a sign-in attempt: the username tried, apart from the account)
        conn.execute('alter table events add column tried text')
    dcols = _columns(conn, 'device_tabs')
    if 'label' not in dcols:  # (each browser's tabs, before they could be named or let go)
        conn.execute("alter table device_tabs add column label text not null default ''")
        conn.execute('alter table device_tabs add column forgotten real')
    if 'position' not in dcols:  # (before they could be put in order, or signed out from the list)
        conn.execute('alter table device_tabs add column position integer')
        conn.execute('alter table device_tabs add column session text')
    if 'name' not in _columns(conn, 'shares'):
        conn.execute("alter table shares add column name text not null default ''")
        conn.execute("alter table shares add column symbol text not null default ''")
    if 'seen' not in _columns(conn, 'mail'):  # (before mail was told apart read from not)
        conn.execute('alter table mail add column seen real')
    conn.execute('create unique index if not exists users_space on users(space)')
    conn.execute('create trigger if not exists users_space_new after insert on users when new.space is null '
                 'begin update users set space = lower(hex(randomblob(12))) where id = new.id; end')


def _v2(conn):
    """Indexes for what's looked up often: an account's sign-ins, a sign-in by the short id the device list keeps
    (its hash's first 16 characters), a browser's row by its sign-in or its id, mail put away (cleared out after a
    while), and invitations by who made or used them (let go with the account)."""
    for stmt in ('create index if not exists sessions_user on sessions(user_id)',
                 'create index if not exists sessions_short on sessions(substr(token, 1, 16))',
                 'create index if not exists device_tabs_session on device_tabs(session)',
                 'create index if not exists device_tabs_device on device_tabs(device)',
                 'create index if not exists mail_deleted on mail(deleted) where deleted is not null',
                 'create index if not exists invites_created_by on invites(created_by)',
                 'create index if not exists invites_used_by on invites(used_by)'):
        conn.execute(stmt)


# Each version's step from the one before (index n takes version n to n + 1). Versions:
#   1  tabcat-server 1.0.0
#   2  tabcat-server 1.0.0: indexes (see _v2)
MIGRATIONS = [_v1, _v2]
SCHEMA_VERSION = len(MIGRATIONS)


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
            # (WAL, as SQLite advises for it: a write waits for the disk only at checkpoints, not each time; never
            # corrupt, and a power cut may undo only the last writes. Each request notes when it was last used, so
            # waiting each time had every request take some 20 ms more)
            self.conn.execute('pragma synchronous = normal')
            self.migrate()

    # The database's shape, by number (sqlite's user_version): 0 is a new file, or one made while 1.0.0 was being
    # written (before the number was kept); each step below takes it one further, in a transaction of its own, a copy
    # of the file kept first (<name>.v<n>.bak, beside it). A file from a newer server isn't opened: going back a
    # version would read what it doesn't know. New changes go at the end of MIGRATIONS (never edit one released).
    def migrate(self):
        have = self.conn.execute('pragma user_version').fetchone()[0]
        if have > SCHEMA_VERSION:
            raise TooNew(f'{self.path} is from a newer tabcat-server (database version {have}; this one knows up to '
                         f'{SCHEMA_VERSION}). Update tabcat-server, or use a copy made before.')
        if have == SCHEMA_VERSION:
            return
        if have > 0 or self.conn.execute("select count(*) from sqlite_master where type = 'table'").fetchone()[0]:
            self.backup_to(self.path.with_name(f'{self.path.name}.v{have}.bak'))  # (not for a new, empty file)
        for n in range(have, SCHEMA_VERSION):
            self.conn.execute('begin immediate')
            try:
                MIGRATIONS[n](self.conn)
                self.conn.execute(f'pragma user_version = {n + 1}')
                self.conn.execute('commit')
            except BaseException:
                self.conn.execute('rollback')
                raise

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
            self.conn.execute('pragma synchronous = normal')  # (as when opened: see __init__)
            for suffix in ('', '-wal', '-shm'):
                old.with_name(old.name + suffix).unlink(missing_ok=True)

    def purge_events(self):
        self.run('delete from events where at < ?', time.time() - float(self.setting('log_days') or 90) * 86400)

    def purge_invites(self):
        """Invitations used, or past their end, longer ago than the security record keeps its entries."""
        since = time.time() - float(self.setting('log_days') or 90) * 86400
        self.run('delete from invites where (used_at is not null and used_at < ?) or (expires_at is not null and expires_at < ?)', since, since)

    def purge_sessions(self):
        self.run('delete from sessions where expires_at < ?', time.time())
