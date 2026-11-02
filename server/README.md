# tabcat server

Your own tabcat server, for your own computers: it hosts the tabcat dashboard at your address, with
accounts (each with its own data) and an admin page. tabcat works without one; this is for when you want it.

It hosts the dashboard only. Syncing your data between computers comes next.

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

Everything else (accounts, sign-up and invitations, how long sign-ins last and how many wrong passwords before a wait, signing everyone out, updating the dashboard, backups) is on the admin page, at `/admin`.

## Back it up

The admin page downloads a copy of the database. Or copy `tabcat.db` from the data folder.

## Locked out, or starting over

- **Someone forgot their password:** an admin presses **Reset password** on their row of the admin page and
  passes the new password on. They can change it on their account page.
- **The admin forgot theirs,** or every admin is locked out: on the server's computer, run
  `tabcat-server reset-password USERNAME` (it asks for the new one, and turns the account back on).
  `tabcat-server make-admin USERNAME` makes an account an admin again.
- **Start over:** stop the server and run `tabcat-server reset-server`. Every account, invitation and setting
  goes (the dashboard and `config.toml` stay); the next visit makes the first account again.

With Docker, run these in the container: `docker compose exec tabcat tabcat-server reset-password USERNAME`;
to start over, `docker compose stop`, then `docker compose run --rm tabcat tabcat-server reset-server`.
Add `--data-dir` if the server was started with one.
