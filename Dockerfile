# train.boiret.com: the three pages served as static files by Caddy (Railway builds this image on every push)
FROM caddy:2-alpine
COPY locomotive-3d.html locomotive-kid.html aiguillages.html /src/
COPY site /src/site
RUN sh /src/site/build.sh /src /srv && cp /src/site/Caddyfile /etc/caddy/Caddyfile && rm -rf /src
