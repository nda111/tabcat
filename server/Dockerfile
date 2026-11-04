# tabcat server, as an image: docker build -t tabcat-server server
#   docker run -d -p 127.0.0.1:8080:8080 -v tabcat-data:/data tabcat-server
# Published for amd64 and arm64 (python tools/release.py docker --push). Everything it keeps (the database, the
# dashboard's files, config.toml) is in /data, a volume of its own: a new image keeps it. It runs as an ordinary user
# (tabcat, uid 10001), never root, and says whether it answers (docker ps: healthy).
FROM python:3.12-slim

ARG VERSION=dev
LABEL org.opencontainers.image.title="tabcat server" \
      org.opencontainers.image.description="Your own tabcat server: the tabcat dashboard with accounts, sync and shared workspaces" \
      org.opencontainers.image.source="https://github.com/nda111/tabcat" \
      org.opencontainers.image.documentation="https://github.com/nda111/tabcat/tree/main/server#readme" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.version="$VERSION"

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1 PIP_ROOT_USER_ACTION=ignore
WORKDIR /app
COPY pyproject.toml README.md ./
COPY tabcat_server ./tabcat_server
RUN pip install . \
 && useradd --uid 10001 --user-group --create-home --home-dir /home/tabcat tabcat \
 && mkdir /data && chown tabcat:tabcat /data \
 && rm -rf /app/tabcat_server /app/build

USER tabcat
ENV TABCAT_DATA=/data TABCAT_HOST=0.0.0.0 TABCAT_PORT=8080
# (from inside the container, the browser and a proxy on the same computer come through Docker's network (172.16/12),
# not as 127.0.0.1: let them set the server up, and believe the proxy's X-Forwarded-For. Safe while the port is
# published on this computer only (-p 127.0.0.1:8080:8080), as the README says)
ENV TABCAT_SETUP_FROM=127.0.0.1/32,::1/128,172.16.0.0/12 TABCAT_TRUSTED_PROXIES=127.0.0.1/32,::1/128,172.16.0.0/12
EXPOSE 8080
VOLUME /data
# (healthy: it answers on its port, from inside the container; curl isn't in the image, Python is)
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["python", "-c", "import os, urllib.request; urllib.request.urlopen(f\"http://127.0.0.1:{os.environ.get('TABCAT_PORT', '8080')}/api/server\", timeout=4)"]
CMD ["tabcat-server"]
