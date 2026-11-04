# tabcat server with Docker

The image [`nda111/tabcat-server`](https://hub.docker.com/r/nda111/tabcat-server) runs on `linux/amd64` and
`linux/arm64` (a PC, a NAS, a Raspberry Pi, an ARM Mac or server). Everything else about the server, from HTTPS to
its settings, is in the [server guide](README.md).

## Run it

```sh
docker run -d --name tabcat --restart unless-stopped \
  -p 127.0.0.1:8080:8080 -v tabcat-data:/data nda111/tabcat-server:latest
```

Then, **on the same computer**, right-click tabcat's toolbar button, choose **Connect to a server…**, enter
`localhost:8080`, and make the first account (the admin) on the page that opens. From other computers, put HTTPS in
front first: see [HTTPS](README.md#https).

- `-p 127.0.0.1:8080:8080`: the server on this computer only. Keep it so, and let a reverse proxy on the same computer
  take outside connections. (This computer's browser and such a proxy come into the container through Docker's
  network, so the image lets that network (`172.16.0.0/12`) set the server up and believes its `X-Forwarded-For`;
  published to everyone, others could too.)
- `-v tabcat-data:/data`: everything the server keeps (the database, the dashboard's files, `config.toml`) in a
  Docker volume named `tabcat-data`. A new container, or a newer image, keeps it.
- `--restart unless-stopped`: started again after a crash or a reboot.

With Compose, [`compose.yaml`](compose.yaml) does the same: `docker compose up -d` in this folder.

## Keep the data in a folder of your own

To see the files, back them up with the rest of your files, or keep them on another disk, mount a folder of this
computer as `/data` in place of the volume:

```sh
docker run -d --name tabcat --restart unless-stopped \
  -p 127.0.0.1:8080:8080 -v /srv/tabcat:/data nda111/tabcat-server:latest
```

(On Windows: `-v C:\tabcat:/data`; on macOS: a folder under your home, such as `-v ~/tabcat:/data`.)

Or keep only the database there, and the rest in the volume: mount the folder somewhere else and say where the
database goes with `TABCAT_DATABASE`:

```sh
docker run -d --name tabcat --restart unless-stopped \
  -p 127.0.0.1:8080:8080 -v tabcat-data:/data \
  -v /srv/tabcat-db:/db -e TABCAT_DATABASE=/db/tabcat.db nda111/tabcat-server:latest
```

The server runs as the user `tabcat`, **uid 10001**, not root, so on Linux the folder must be theirs, or the server
can't write to it and stops, saying so:

```sh
sudo mkdir -p /srv/tabcat && sudo chown -R 10001:10001 /srv/tabcat
```

(A Docker volume, and a folder of yours on Windows or macOS with Docker Desktop, need nothing of the kind.)

In `compose.yaml`, the same goes in `volumes:` (`- /srv/tabcat:/data`) and, for the database alone, `environment:`
(`TABCAT_DATABASE: /db/tabcat.db`).

## Tags

- `latest`: the newest release.
- `1.0.0` and so on: each release. Pin one to update only when you choose.

## Settings

By environment, with `-e NAME=value` (see [Settings](README.md#settings)): `TABCAT_DATABASE`, `TABCAT_DASHBOARD`,
`TABCAT_SETUP_FROM`, `TABCAT_ADMIN_FROM`, `TABCAT_TRUSTED_PROXIES`. The port inside the container is 8080; publish it
on any port outside (`-p 127.0.0.1:9000:8080`). The rest is on the admin page.

## Health

The image asks the server every 30 seconds whether it answers: `docker ps` shows `healthy` (or `unhealthy`).

## Update

```sh
docker pull nda111/tabcat-server:latest
docker rm -f tabcat
docker run -d --name tabcat --restart unless-stopped -p 127.0.0.1:8080:8080 -v tabcat-data:/data nda111/tabcat-server:latest
```

(With Compose: `docker compose pull && docker compose up -d`.) The data stays; the database is brought up to date as
the new version starts, a copy of it kept first (see [Upgrade](README.md#upgrade)).

## Back up and restore

Download a copy of the database from the admin page. To restore it, with the container stopped and the copy in the
current folder as `tabcat-backup.db`:

```sh
docker run --rm -v tabcat-data:/data -v "$PWD":/backup alpine sh -c \
  'cp /backup/tabcat-backup.db /data/tabcat.db && rm -f /data/tabcat.db-wal /data/tabcat.db-shm && chown -R 10001:10001 /data'
```

then start the container again. (With a folder of your own as `/data`: copy the file there as `tabcat.db`, delete
`tabcat.db-wal` and `tabcat.db-shm` beside it, and on Linux `chown 10001:10001` it.)

## Locked out, or starting over

```sh
docker exec -it tabcat tabcat-server reset-password USERNAME   # a new password
docker exec tabcat tabcat-server make-admin USERNAME           # an admin again
docker exec tabcat tabcat-server reset-2fa USERNAME            # two-step sign-in off
```

To start over: `docker stop tabcat`, then `docker run --rm -it -v tabcat-data:/data nda111/tabcat-server tabcat-server reset-server`
(everything goes: every account, invitation and setting).

## Build it yourself

From a checkout of the repository: `docker build -t tabcat-server server`, or `docker compose up -d --build` in this
folder. For both platforms: `python tools/release.py docker` (see [docs/development.md](../docs/development.md)).
