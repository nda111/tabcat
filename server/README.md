# tabcat server

Your own tabcat server, for your own computers: it hosts the tabcat dashboard at your address, with
accounts (each with its own data) and an admin page. tabcat works without one; this is for when you want it.

Signed in to the same account in several browsers, each keeps the same tabcat: your workspaces (with
everything in them), Recently deleted, and the settings (the look, the language, the columns, auto-suspend…).
What's about that computer alone (the panels, the workspace on screen) and the undo history stay with that browser. Changes made offline wait in the
browser and go once the server can be reached; none are lost. The browser's own tabcat (what
tabcat.ghyeok.com shows) is never sent: an account new to the server starts from a copy of it, and an
account that has data there already brings that data instead.

### How sync works

Each browser sends its changes, each with an id of its own, and the server numbers them in the order they
come (a change sent twice is kept once). Every browser takes the changes in that order and applies them
the same way, so all end up the same; two changes made at once to different things are both kept, and to
the same thing, the later one wins. Now and then a browser sends a whole copy, and older changes are let go
(the last 5000 stay, for browsers a little behind). The API, under `/api/sync/` (signed in; the header
`X-Tabcat-Account` names the account the browser means, and another one signed in is refused):

| | |
|---|---|
| `GET state` | the latest whole copy and the changes after it |
| `GET ops?after=N` | the changes after number N (`more`: there are more; `reload`: too far behind, start from `state`) |
| `POST ops` | `{device, ops: [{id, body}]}`: changes, in order; answers the number each got |
| `PUT snapshot` | `{seq, body}`: a whole copy as of change `seq` (`first`: the account's first, only while there's nothing) |
| `GET events` | server-sent events: `head` (the latest change's number) at once whenever it moves on; an open dashboard listens, and its extension takes the changes |

A change shows in the account's other browsers within a second or so while their dashboard is open (and within a minute otherwise). Bodies up to 8 MB, gzipped or not; answers are gzipped when it's worth it.

## Install

tabcat server works with the tabcat extension 1.1.0 or later. It's released apart from the extension, tagged
`server-v<version>` on [GitHub Releases](https://github.com/nda111/tabcat/releases?q=server-v); what changed is in
[CHANGELOG.md](CHANGELOG.md).

**With pip** (Python 3.10 or newer), in a virtual environment of its own:

```sh
python3 -m venv ~/tabcat-server && cd ~/tabcat-server
bin/pip install https://github.com/nda111/tabcat/releases/download/server-v1.0.0/tabcat_server-1.0.0-py3-none-any.whl
bin/tabcat-server --port 8080
```

(On Windows: `Scripts\pip` and `Scripts\tabcat-server`.) From a checkout of the repository, `pip install ./server`.

**With Docker**: the image [`nda111/tabcat-server`](https://hub.docker.com/r/nda111/tabcat-server) runs on amd64
and arm64 (a Raspberry Pi, an ARM Mac or server):

```sh
docker run -d --name tabcat --restart unless-stopped \
  -p 127.0.0.1:8080:8080 -v tabcat-data:/data nda111/tabcat-server:latest
```

Or with [`compose.yaml`](compose.yaml) from this folder: `docker compose up -d`. To build the image from a checkout instead:
`docker compose up -d --build`, or `docker build -t tabcat-server server`.

- **Tags:** `latest`, and each release's version (`1.0.0`): pin a version to update only when you choose.
- **Data:** everything (the database, the dashboard's files, `config.toml`) is in `/data`. Keep it in a volume, as
  above, or a folder of yours (`-v /srv/tabcat:/data`), owned by uid 10001: the server runs as that user, not root
  (`sudo chown -R 10001:10001 /srv/tabcat`).
- **Health:** the image checks that the server answers every 30 seconds; `docker ps` shows `healthy`.
- **Keep the port this computer's** (`-p 127.0.0.1:...`) and put HTTPS in front for others. From inside the
  container, this computer's browser and a reverse proxy on it come through Docker's network, so the image lets
  that network (`172.16.0.0/12`) set the server up and believes its `X-Forwarded-For`; published to everyone,
  others could too.
- **Settings:** the environment variables in [Settings](#settings) (`-e TABCAT_ADMIN_FROM=...`). Port 8080 inside the
  container; publish it on any port outside.

### First visit

Open it in a browser **on the server's own computer** (<http://localhost:8080>): the first visit makes the first
account, an admin. (Only this computer may, unless `--setup-from` says otherwise: anyone else reaching a new server
would make themselves its admin.) Then, in each browser, right-click tabcat's toolbar button, choose
**Connect to a server…**, enter the server's address and sign in. Invite others from the admin page (`/admin`), or
open sign-up there.

## HTTPS

Passwords and everyone's data travel to the server, so when other computers reach it, put it behind HTTPS. Keep
tabcat-server listening on this computer only (`--host 127.0.0.1`, the default) and let a reverse proxy take the
outside connections:

**Caddy** gets and renews a certificate by itself:

```
tabcat.example.com {
    reverse_proxy 127.0.0.1:8080
}
```

**nginx** (with a certificate from Let's Encrypt's certbot, or your own):

```nginx
server {
    listen 443 ssl;
    server_name tabcat.example.com;
    ssl_certificate     /etc/letsencrypt/live/tabcat.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tabcat.example.com/privkey.pem;
    client_max_body_size 10m;                      # (the largest sync body is 8 MB)

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 1h;                     # (live updates are long-lived streams: /api/live, /api/sync/events)
    }
}
```

- The proxy must set `X-Forwarded-For`: tabcat-server reads each visitor's address from it (for sign-in waits,
  the security record, and who may set it up or use the admin page). It believes it only from
  `--trusted-proxies` (this computer by default); a proxy on another computer goes in that list.
- Live updates are server-sent events; the server already tells nginx not to buffer them (`X-Accel-Buffering: no`).
  Other proxies may need buffering turned off for `/api/live` and `/api/sync/events`.
- **Tailscale:** on a tailnet with HTTPS on, the admin page serves the server at its `https://<machine>.<tailnet>.ts.net`
  address in one switch (`tailscale serve`), with no certificate or proxy to set up.

## Working on it

From the top of a tabcat checkout (with the dashboard's `pages` branch in `web/`, as in docs/development.md),
a virtual environment with the server installed in place (edits to `server/` apply on the next start):

```sh
python -m venv .venv
.venv/Scripts/python -m pip install -e server      # Windows (on macOS / Linux: .venv/bin/python)
```

Then run it with the dashboard from `web/` and its data in `.tabcat-server/` (both kept out of git):

```powershell
.venv\Scripts\tabcat-server --dashboard web --data-dir .tabcat-server --port 8090     # PowerShell
```

```sh
.venv/Scripts/tabcat-server.exe --dashboard web --data-dir .tabcat-server --port 8090  # WSL, with the same Windows venv
```

and open <http://tabcat.localhost:8090> (any `*.localhost` is your computer, and counts as a server for the extension).

## Keep it running

tabcat-server is one process with one database file, so it needs no workers or launcher of its own: what
keeps it up is whatever starts services on your machine. Pick one:

- **Docker** (any OS): `docker compose up -d` in this folder (see `compose.yaml`). It starts again after
  a crash or a reboot.
- **Linux, systemd**: a unit such as

  ```ini
  # /etc/systemd/system/tabcat-server.service
  [Unit]
  Description=tabcat server
  After=network-online.target

  [Service]
  ExecStart=/opt/tabcat/.venv/bin/tabcat-server --data-dir /var/lib/tabcat-server
  Restart=on-failure
  User=tabcat

  [Install]
  WantedBy=multi-user.target
  ```

  then `sudo systemctl enable --now tabcat-server`.
- **Windows**: Task Scheduler, a task "At startup" running `…\.venv\Scripts\tabcat-server.exe` with
  "Restart if the task fails" on; or a service wrapper such as NSSM.

While working on the server, `--reload` starts it again whenever its code changes.

## Settings

Set before it starts, on the command line, in the environment, or in `config.toml` in the data folder:

| Setting | Command line | Environment | Default |
|---|---|---|---|
| Data folder (the database, the dashboard's files) | `--data-dir` | `TABCAT_DATA` | `~/.local/share/tabcat-server` (Windows: `%LOCALAPPDATA%\tabcat-server`) |
| Address to listen on | `--host` | `TABCAT_HOST` | `127.0.0.1` |
| Port | `--port` | `TABCAT_PORT` | `8080` |
| Dashboard | `--dashboard` | `TABCAT_DASHBOARD` | `auto`: the latest from GitHub, as tabcat.ghyeok.com; or a folder with its files |
| Who may make the first account (the admin) | `--setup-from` | `TABCAT_SETUP_FROM` | this computer only (`127.0.0.1/32,::1/128`) |
| Who may use the admin page | `--admin-from` | `TABCAT_ADMIN_FROM` | anywhere (`0.0.0.0/0,::/0`) |
| Proxies whose `X-Forwarded-For` is believed | `--trusted-proxies` | `TABCAT_TRUSTED_PROXIES` | this computer only |

The lists take addresses or networks, comma-separated (`192.168.0.0/16,10.1.2.3`). Behind a proxy on another
computer, add it to the trusted proxies, or every visitor looks like the proxy.

The admin page also keeps a security record: sign-ins and failed attempts (when, from which address, which browser),
changes to accounts and what admins did, kept 90 days unless set otherwise; each account sees its own on its account
page. What anyone keeps in tabcat is never in it.

Everything else (accounts, sign-up and invitations, how long sign-ins last and how many wrong passwords before a wait, signing everyone out, updating the dashboard, backups) is on the admin page, at `/admin`.

## Back it up and restore

Everything the server keeps is one SQLite file, `tabcat.db` in the data folder (or where the admin page moved it:
`database` in `config.toml`). To back it up:

- **Download a copy** from the admin page (a consistent copy, made while it runs), or
- **copy the file** while the server is stopped, with its `tabcat.db-wal` and `tabcat.db-shm` if they're there.

To restore: stop the server, put the copy in place as `tabcat.db`, delete any `tabcat.db-wal` and `tabcat.db-shm`
beside it, and start the server. A copy from an older version is brought up to date as it starts (see below).

With Docker, the file must belong to the server's user (uid 10001), or it can't write to it. With the copy in the
current folder as `tabcat-backup.db`, and the container stopped:

```sh
docker run --rm -v tabcat-data:/data -v "$PWD":/backup alpine sh -c \
  'cp /backup/tabcat-backup.db /data/tabcat.db && rm -f /data/tabcat.db-wal /data/tabcat.db-shm && chown -R 10001:10001 /data'
```

then start the container again.

To keep it elsewhere (another disk, a synced folder), move it on the admin page, from the server's own computer;
the new place is kept in `config.toml` as `database`.

## Upgrade

The admin page says when a newer server release is out.

- **pip:** installed with pip and opened on the server's own computer, the admin page installs it and starts the
  server again in one click. Or by hand: `pip install --upgrade <the new release's .whl address>`, then start it again.
- **Docker:** `docker compose pull && docker compose up -d` (or `docker pull nda111/tabcat-server:latest`, then
  remove the container and run it again with the same volume). Built from a checkout: `git pull`, then
  `docker compose up -d --build`. The data stays in its volume.
- **A checkout** (`pip install -e`): `git pull` and start it again.

The dashboard updates by itself once a day (turn that off on the admin page; then **Update now** there).

On its first start after an upgrade, the server brings its database up to date if the new version changed its
shape. It first keeps a copy beside it, `tabcat.db.v<n>.bak` (`n`, the database version it came from), then makes
each change in a transaction of its own; [docs/database.md](../docs/database.md) has the versions. A database from a
newer server than the one starting isn't opened: the server says so and stops. To go back to an older server, restore
the `.bak` copy made before upgrading (changes since then are lost).

## Known limits

- There's no storage limit per account: anyone with an account can keep as much as they like (each sync body is at
  most 8 MB).
- Behind a reverse proxy, the proxy must send `X-Forwarded-For` and be in `--trusted-proxies` (see [HTTPS](#https)).
  Addresses in that list are taken for proxies, so a visitor coming from one of them (with Docker: from the server's
  own computer, through Docker's network) could give the server another address of their own choosing.
- One server process with one database file: run one copy of it per data folder.

## More

- [docs/api.md](../docs/api.md): the HTTP API, for your own scripts or clients.
- [docs/database.md](../docs/database.md): the database's tables.
- [docs/structure.md](../docs/structure.md): where the server's code is, and the extension's and dashboard's.

## Security record codes

The admin page's security record, and its CSV export, give each entry a code that's the same in every language
(the CSV's *Event code* and *Detail code* columns). Entries are kept as many days as the admin page says (90 by default).

| Code | What happened | Detail code |
|---|---|---|
| `setup` | The server was set up: its first account, an admin | |
| `signup` | An account was made by signing up | `invite`: with an invitation |
| `login_ok` | Signed in | `2fa`: with two-step sign-in |
| `login_fail` | A wrong password (the *Username tried* column says which username) | `unknown`: no account has that username |
| `login_locked` | Too many wrong tries from that address: held off | |
| `login_refused` | A sign-in to a suspended account | `suspended` |
| `twofa_fail` | A wrong two-step sign-in code | |
| `recovery_used` | Signed in with a recovery code | `left:N`: N codes left |
| `password_wrong` | A wrong current password (changing it, turning 2FA off, new recovery codes) | |
| `rate_limited` | That address sent more than 240 API calls in a minute: held off (at most one entry a minute) | `n:N`: N calls turned away since the last entry |
| `logout` | Signed out | |
| `password_changed` | Changed their password | |
| `account_deleted` | Deleted their own account | |
| `twofa_on` / `twofa_off` | Turned two-step sign-in on / off | |
| `recovery_new` | Made new recovery codes | |
| `session_ended` | Signed out of another device from their account page | the device's address and browser |
| `logout_others` | Signed out of all their other devices | |
| `user_added` | An admin added the account (the *By admin* column says who) | `admin`: as an admin |
| `role_changed` | An admin changed the account's role | `admin` / `user`: what it became |
| `suspended` / `unsuspended` | An admin suspended / unsuspended the account | |
| `password_reset` | An admin reset the account's password | |
| `twofa_reset` | An admin turned the account's two-step sign-in off | |
| `user_deleted` | An admin deleted the account | |
| `settings_changed` | An admin changed the server's settings | the settings and their new values |
| `logout_all` | An admin signed everyone else out | |
| `invite_created` / `invite_deleted` | An admin made / deleted an invitation | `days:N`: it lasts N days |
| `db_moved` | An admin moved the database | its new place |
| `server_updated` | An admin updated the server | the version |
| `tailscale_serve` | An admin turned serving at the Tailscale HTTPS address on or off | `on` / `off` |

What anyone keeps in tabcat (links, groups, notes) is never in the record.

## Locked out, or starting over

- **Someone forgot their password:** an admin presses **Reset password** on their row of the admin page and
  passes the new password on. They can change it on their account page.
- **The admin forgot theirs,** or every admin is locked out: on the server's computer, run
  `tabcat-server reset-password USERNAME` (it asks for the new one, and turns the account back on).
  `tabcat-server make-admin USERNAME` makes an account an admin again.
- **Two-step sign-in (2FA) locked out** (the phone and the recovery codes gone): an admin turns it off from the
  admin page (the 2FA mark by the name), or, on the server's computer, `tabcat-server reset-2fa USERNAME`.
- **Start over:** stop the server and run `tabcat-server reset-server`. Every account, invitation and setting
  goes (the dashboard and `config.toml` stay); the next visit makes the first account again.

With Docker, run these in the container: `docker compose exec tabcat tabcat-server reset-password USERNAME`;
to start over, `docker compose stop`, then `docker compose run --rm tabcat tabcat-server reset-server`.
Add `--data-dir` if the server was started with one.
