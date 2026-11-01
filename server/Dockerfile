# tabcat server: docker build -t tabcat-server server && docker run -p 8080:8080 -v tabcat-data:/data tabcat-server
FROM python:3.12-slim
WORKDIR /app
COPY pyproject.toml README.md ./
COPY tabcat_server ./tabcat_server
RUN pip install --no-cache-dir . && useradd --create-home tabcat && mkdir /data && chown tabcat /data
USER tabcat
ENV TABCAT_DATA=/data TABCAT_HOST=0.0.0.0 TABCAT_PORT=8080
EXPOSE 8080
VOLUME /data
CMD ["tabcat-server"]
