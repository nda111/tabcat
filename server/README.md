# tabcat server

Your own tabcat server, for your own computers: it hosts the tabcat dashboard at your address, with
accounts (each with its own data) and an admin page. tabcat works without one; this is for when you want it.

Signed in to the same account in several browsers, each keeps the same tabcat: your workspaces (with
everything in them), Recently deleted, and the look (theme and accent). Settings of each computer's own
(auto-suspend, columns…) and the undo history stay with that browser. Changes made offline wait in the
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

## Run it

With Python 3.10 or newer:

```sh
pip install ./server          # from a checkout of the tabcat repository
tabcat-server --port 8080
```

Or with Docker:

```sh
docker build -t tabcat-server server
docker run -d -p 8080:8080 -v tabcat-data:/data tabcat-server
```

Then open it in your browser. The first visit makes the first account, an admin. To use the dashboard
there, right-click tabcat's toolbar button, choose **Connect to a server…**, and enter its address.

Put it behind HTTPS (Caddy, nginx, Tailscale's `serve`…) when other computers reach it: passwords and
your data travel to it.

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

## Back it up

The admin page downloads a copy of the database. Or copy `tabcat.db` from the data folder.

The database is `tabcat.db` in the data folder. To keep it elsewhere (another disk, a synced folder), move it on the
admin page, from the server's own computer (the addresses setup is allowed from); the new place is kept in
`config.toml` as `database`.

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
