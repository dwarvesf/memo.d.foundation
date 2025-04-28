FROM jetpackio/devbox:latest AS builder

# Install git
USER root:root
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*
USER ${DEVBOX_USER}:${DEVBOX_USER}

# Clone the repository
WORKDIR /
RUN git clone --filter=blob:none https://github.com/dwarvesfoundation/memo.d.foundation.git /code
WORKDIR /code

# Installing your devbox project
RUN git submodule init --recursive --depth 15
RUN devbox run duckdb-export
RUN devbox run build
RUN devbox run -- nix-store --gc && nix-store --optimise

FROM nginx:alpine

COPY --from=builder /code/out/ /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
