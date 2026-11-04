<!-- The Docker Hub repository's overview (hub.docker.com/r/nda111/tabcat-server): paste it there with each release.
     Short description (100 characters at most):
     Your own tabcat server: your tabs in step across browsers, shared workspaces, accounts. -->

# tabcat server

Your own server for [tabcat](https://github.com/nda111/tabcat), the tab manager for Chromium-based browsers: the
tabcat dashboard at an address of your own, behind sign-in. Each account's groups, notes and settings stay the same in
every browser signed in to it, live; workspaces can be shared with others on the server; an admin page runs it all.

## Run it

```sh
docker run -d --name tabcat --restart unless-stopped \
  -p 127.0.0.1:8080:8080 -v tabcat-data:/data nda111/tabcat-server:latest
```

Then open <http://localhost:8080> **on the same computer** to make the first account (the admin), and in each
browser choose **Connect to a server…** from tabcat's toolbar menu. Put it behind HTTPS (Caddy, nginx, Tailscale)
before other computers reach it: see the [server guide](https://github.com/nda111/tabcat/tree/main/server#readme).

With Compose: [`compose.yaml`](https://github.com/nda111/tabcat/blob/main/server/compose.yaml). To keep the data, or the
database alone, in a folder of your own: [DOCKER.md](https://github.com/nda111/tabcat/blob/main/server/DOCKER.md).

## Tags

- `latest`: the newest release.
- `1.0.0` and so on: each release, for when you'd rather update by hand.

Both for `linux/amd64` and `linux/arm64`.

## In the image

- Everything the server keeps is in **`/data`** (a volume): the SQLite database, the dashboard's files and
  `config.toml`. A new image keeps it; the database is brought up to date on start, a copy kept first.
- It runs as the user **`tabcat` (uid 10001)**, not root. A folder of yours as `/data` must be theirs:
  `chown -R 10001:10001 <folder>`.
- A **health check** asks the server every 30 seconds (`docker ps`: `healthy`).
- **Publish the port on this computer only** (`-p 127.0.0.1:...`): this computer's browser and a proxy on it reach
  the server through Docker's network, which the image lets set it up and whose `X-Forwarded-For` it believes.
- Port **8080**. Settings by environment: `TABCAT_SETUP_FROM`, `TABCAT_ADMIN_FROM`, `TABCAT_TRUSTED_PROXIES`,
  `TABCAT_DASHBOARD` (see the [guide](https://github.com/nda111/tabcat/tree/main/server#settings)).

## Update

```sh
docker pull nda111/tabcat-server:latest
docker rm -f tabcat
docker run -d --name tabcat --restart unless-stopped -p 127.0.0.1:8080:8080 -v tabcat-data:/data nda111/tabcat-server:latest
```

(With Compose: `docker compose pull && docker compose up -d`.)

## Back up and restore

Download a copy from the admin page. To restore it, with the container stopped and the copy in the current folder as
`tabcat-backup.db` (the file must belong to uid 10001):

```sh
docker run --rm -v tabcat-data:/data -v "$PWD":/backup alpine sh -c \
  'cp /backup/tabcat-backup.db /data/tabcat.db && rm -f /data/tabcat.db-wal /data/tabcat.db-shm && chown -R 10001:10001 /data'
```

## Locked out

`docker exec -it tabcat tabcat-server reset-password USERNAME`; more in the
[guide](https://github.com/nda111/tabcat/tree/main/server#locked-out-or-starting-over).

Source and license (MIT): <https://github.com/nda111/tabcat>
