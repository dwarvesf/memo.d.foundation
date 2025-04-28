FROM jetpackio/devbox:latest AS builder

# Installing your devbox project
WORKDIR /code
USER root:root
RUN mkdir -p /code && chown ${DEVBOX_USER}:${DEVBOX_USER} /code
USER ${DEVBOX_USER}:${DEVBOX_USER}
COPY --chown=${DEVBOX_USER}:${DEVBOX_USER} ./ ./

RUN git init
RUN git remote add origin https://github.com/dwarvesfoundation/memo.d.foundation.git
RUN git fetch --depth 1 --no-tags origin main
RUN git checkout main
RUN git submodule update --init --recursive --depth 15

RUN devbox run duckdb-export
RUN devbox run build
RUN devbox run -- nix-store --gc && nix-store --optimise

FROM nginx:alpine

COPY --from=builder /code/out/ /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
