# train.boiret.com: the site's files and the TV remote's relay, served by site/server.mjs (Node, no dependencies; Railway builds this image on every push)
FROM node:22-alpine
# set by Railway for GitHub deploys; site/build.sh writes it to /version.txt
ARG RAILWAY_GIT_COMMIT_SHA
COPY locomotive-3d.html locomotive-kid.html aiguillages.html LICENSE /src/
COPY site /src/site
RUN sh /src/site/build.sh /src /srv && mkdir /app && cp /src/site/server.mjs /app/ && rm -rf /src
USER node
CMD ["node", "/app/server.mjs", "/srv"]
