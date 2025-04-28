FROM jetpackio/devbox:latest AS builder

# Installing your devbox project
WORKDIR /code
USER root:root
RUN mkdir -p /code && chown ${DEVBOX_USER}:${DEVBOX_USER} /code
USER ${DEVBOX_USER}:${DEVBOX_USER}
COPY --chown=${DEVBOX_USER}:${DEVBOX_USER} devbox.json devbox.json
COPY --chown=${DEVBOX_USER}:${DEVBOX_USER} devbox.lock devbox.lock
COPY --chown=${DEVBOX_USER}:${DEVBOX_USER} package.json package.json
COPY --chown=${DEVBOX_USER}:${DEVBOX_USER} pnpm-lock.yaml pnpm-lock.yaml

RUN devbox run -- make build && nix-store --gc && nix-store --optimise

FROM nginx:alpine

COPY --from=builder /app/out/ /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
