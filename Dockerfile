# Copyright © 2021 Exact Realty Limited
#
# Permission to use, copy, modify, and distribute this software for any
# purpose with or without fee is hereby granted, provided that the above
# copyright notice and this permission notice appear in all copies.
#
# THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
# REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
# AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
# INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
# LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
# OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
# PERFORMANCE OF THIS SOFTWARE.

FROM node:lts-alpine3.14 AS builder-stage1

RUN adduser -S -g "" -h "/home/build" "build" \
 && apk add --update --no-cache "python3" "make"

COPY --chown=0.0 . /home/build/app

WORKDIR /home/build/app

RUN install -o build -m 700 -d node_modules \
 && install -o build -m 700 -d dist

USER build

ENV CI=true

ARG NODE_ENV=production

RUN make ci-build

FROM node:lts-alpine3.14 AS builder-stage2

RUN adduser -S -g "" -h "/home/build" "build" \
 && apk add --update --no-cache "python3" "make"

RUN install -d -o build /home/build/app/dist

USER build

RUN echo "prefix = $HOME/node-prefix" > $HOME/.npmrc \
 && npm install -g pkg

COPY --from=builder-stage1 --chown=0.0 --chmod=444 /home/build/app/dist/app.js /home/build/app/dist/app.js

WORKDIR /home/build/app/dist

RUN export NODE_MAJOR="$(node -e 'process.stdout.write(String(+process.versions.node.split(".")[0]))')" \
 && $HOME/node-prefix/bin/pkg -t "node${NODE_MAJOR}-alpine-x86_64" "app.js"

FROM alpine:3.14 AS runner-pre

RUN apk add --no-cache tini cpio \
 && addgroup -S "runner" \
 && adduser -S -G "runner" -g "" -h "/home/runner" "runner"

ARG CONFIG_DIR=/usr/local/etc/hydra-rfc8693

COPY --chown=root:runner --chmod=440 config $CONFIG_DIR
COPY --from=builder-stage2 --chown=root:runner --chmod=550 /home/build/app/dist/app /usr/local/bin/app

RUN mkdir rootfs \
 && find / \( -type f \( -path '/sbin/tini' -o -path '/lib/ld-musl*' -o -path '/etc/hosts' -o -path '/etc/passwd' -o -path '/etc/group' -o -path '/etc/shadow' -o -path '/usr/local/*' -o -path '/srv/*' \) \) | cpio -H ustar -o | tar -xC rootfs \
 && grep -E '^(root|runner):' "/etc/passwd" | sed -e 's@:[^:]*$@:/sbin/nologin@g' > "/rootfs/etc/passwd" \
 && grep -E '^(root|runner):' "/etc/group" > "/rootfs/etc/group" \
 && grep -E '^(root|runner):' "/etc/shadow" > "/rootfs/etc/shadow" \
 && chown -R root:runner "/rootfs/${CONFIG_DIR}" \
 && chmod -R u=rX,g=rX,o= "/rootfs/${CONFIG_DIR}"

FROM scratch AS runner

ARG NODE_ENV=production
ARG CONFIG_DIR=/usr/local/etc/hydra-rfc8693
ENV NODE_CONFIG_STRICT_MODE=1 NODE_CONFIG_DIR=${CONFIG_DIR} NODE_ENV=${NODE_ENV}

COPY --from=runner-pre /rootfs /

USER runner:runner

ENTRYPOINT ["/sbin/tini", "--"]
CMD [ "/usr/local/bin/app" ] 
