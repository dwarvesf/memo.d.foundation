# syntax=docker/dockerfile:1
# Self-contained multi-stage Dockerfile for Railway/CI builds.
#
# Previously this build depended on a private base image hosted in Google
# Artifact Registry (asia-southeast1-docker.pkg.dev/df-infrastructure/
# memo-d-foundation/base). Railway's builders cannot authenticate to that
# registry anonymously, so `FROM <base>` failed at metadata resolution with a
# 403 Forbidden. This Dockerfile inlines the base toolchain (previously built
# separately in Dockerfile.base) directly, so the build pulls only from public
# registries (docker.io).
#
# b794785d-77e3-4281-a780-3c9c7f3e77cf is the railway service id which is used
# to identify the cache for each service. There is no way to get it from the
# environment variables.
# So we need to hardcode it in the Dockerfile.

# --- Base Stage ---
# Toolchain: Elixir 1.18 (OTP 26), Node.js 23, DuckDB, pnpm. Inlined from
# Dockerfile.base so no private-registry pull is required.
FROM elixir:1.18.4-otp-26 AS base
WORKDIR /code

LABEL maintainer="anhnx@d.foundation" \
      org.opencontainers.image.title="Memo.d.foundation Base Build Environment" \
      org.opencontainers.image.description="Base image with Elixir, Node.js, DuckDB, and build tools" \
      org.opencontainers.image.source="https://github.com/dwarvesf/memo.d.foundation" \
      org.opencontainers.image.version="1.0.0"

# Set locale environment variables for UTF-8 support
ENV LANG=en_US.UTF-8 \
      LC_ALL=en_US.UTF-8 \
      NODE_ENV=production \
      MIX_ENV=prod \
      MAKEFLAGS="-j$(nproc)"

# Install system dependencies and build tools
RUN apt-get update && apt-get install -y --no-install-recommends \
      git \
      curl \
      bash \
      unzip \
      build-essential \
      locales \
      ca-certificates \
      tzdata \
      && rm -rf /var/lib/apt/lists/*

# Set up UTF-8 locale
RUN sed -i '/en_US.UTF-8/s/^# //g' /etc/locale.gen && \
      locale-gen en_US.UTF-8 && \
      update-locale LANG=en_US.UTF-8

# Install Node.js (23.x) from NodeSource
RUN curl -fsSL https://deb.nodesource.com/setup_23.x | bash - && \
      apt-get install -y nodejs && \
      node --version && npm --version

# Install DuckDB
RUN echo "Installing DuckDB..." && \
      curl -L --connect-timeout 30 --max-time 300 --retry 3 --retry-delay 10 \
      https://github.com/duckdb/duckdb/releases/download/v1.2.2/duckdb_cli-linux-amd64.zip \
      -o duckdb.zip && \
      unzip duckdb.zip && \
      mv duckdb /usr/local/bin/ && \
      chmod +x /usr/local/bin/duckdb && \
      rm duckdb.zip && \
      echo "DuckDB installed successfully"

# Install and configure pnpm globally. Pinned to the major.minor that generates
# pnpm-lock.yaml (lockfileVersion 9.0). The deps stage copies pnpm-workspace.yaml
# (see below) which sets `dangerouslyAllowAllBuilds: true` so pnpm 11 runs all
# install scripts instead of hard-failing with ERR_PNPM_IGNORED_BUILDS in
# non-interactive CI. pnpm 10 ran all build scripts silently; this restores that
# behaviour and is robust to poisoned store state in the build cache mount.
RUN echo "Installing pnpm..." && \
      npm install -g pnpm@11.6.0 && \
      pnpm config set store-dir /root/.pnpm-store && \
      pnpm config set cache-dir /root/.pnpm-cache && \
      pnpm config set fetch-retries 3 && \
      pnpm config set fetch-retry-mintimeout 10000 && \
      pnpm config set fetch-retry-maxtimeout 60000

# Set up Elixir environment with proper configuration
RUN echo "Setting up Elixir environment..." && \
      mix local.hex --force && \
      mix local.rebar --force && \
      mix hex.config api_url https://hex.pm/api && \
      mix hex.config offline false && \
      mix hex.config http_timeout 60000 && \
      mix hex.config http_concurrency 8 && \
      mkdir -p /root/.mix && \
      mkdir -p /root/.hex

# Configure Git for optimal performance in container environment
RUN echo "Configuring Git..." && \
      git config --global init.defaultBranch main && \
      git config --global advice.detachedHead false && \
      git config --global gc.auto 0 && \
      git config --global fetch.parallel 4 && \
      git config --global submodule.fetchJobs 4 && \
      git config --global protocol.version 2 && \
      git config --global url."https://github.com/".insteadOf "git@github.com:"

# --- Source Stage ---
# Fetches the latest source code and submodules from git. This stage ensures
# that the submodules are always present for the build.
FROM base AS source
WORKDIR /code

# Arguments for git repository details
ARG RAILWAY_GIT_BRANCH=main
ARG RAILWAY_GIT_REPO_OWNER=dwarvesf
ARG RAILWAY_GIT_REPO_NAME=memo.d.foundation
ARG RAILWAY_ENVIRONMENT_NAME

ENV RAILWAY_GIT_BRANCH=$RAILWAY_GIT_BRANCH
ENV RAILWAY_GIT_REPO_OWNER=$RAILWAY_GIT_REPO_OWNER
ENV RAILWAY_GIT_REPO_NAME=$RAILWAY_GIT_REPO_NAME
ENV RAILWAY_ENVIRONMENT_NAME=$RAILWAY_ENVIRONMENT_NAME

COPY . .

# Initialize git and fetch the specified branch
RUN git init && \
      git remote add origin https://github.com/${RAILWAY_GIT_REPO_OWNER}/${RAILWAY_GIT_REPO_NAME}.git && \
      git fetch --depth 1 --no-tags origin ${RAILWAY_GIT_BRANCH} && \
      git clean -fdx && \
      git checkout ${RAILWAY_GIT_BRANCH} && \
      git config --global --add safe.directory /code && \
      git config --global url."https://github.com/".insteadOf "git@github.com:"

# Cache-optimized submodule update
# This mounts a cache for the vault submodule to avoid re-downloading 790MB each time
RUN --mount=type=cache,id=s/b794785d-77e3-4281-a780-3c9c7f3e77cf-${RAILWAY_ENVIRONMENT_NAME}-vault,target=/tmp/vault-cache \
      git config --global --add safe.directory /code/vault && \
      if [ -d "/tmp/vault-cache/.git" ]; then \
            echo "Using cached vault submodule"; \
            cp -r /tmp/vault-cache vault/; \
            cd vault && \
            git config --global --add safe.directory '*' && \
            git remote set-url origin https://github.com/dwarvesf/brainery.git && \
            git fetch --depth 1 --no-tags origin main && \
            git checkout main && \
            git submodule update --init --recursive --depth 1; \
            echo "Vault submodule updated to latest: $(cd vault && git rev-parse --short HEAD)"; \
      else \
            echo "Initializing vault submodule cache"; \
            git submodule update --init --recursive --depth 1; \
            cd vault && \
            git config --global --add safe.directory '*' && \
            git remote set-url origin https://github.com/dwarvesf/brainery.git && \
            git fetch --depth 1 --no-tags origin main && \
            git checkout main && \
            git submodule update --init --recursive --depth 1; \
            cd .. && \
            cp -r vault /tmp/vault-cache/; \
      fi

# --- Deps Stage ---
# Install dependencies first and cache them. This layer only rebuilds if lockfiles change.
FROM base AS deps
WORKDIR /code

ARG RAILWAY_ENVIRONMENT_NAME
ENV RAILWAY_ENVIRONMENT_NAME=$RAILWAY_ENVIRONMENT_NAME

# Copy dependency definition files from the 'source' stage. pnpm-workspace.yaml
# MUST be present here: pnpm 11 reads build-approval config (dangerouslyAllowAll
# Builds) from it during `pnpm install --frozen-lockfile`; without it pnpm falls
# back to its default and hard-fails with ERR_PNPM_IGNORED_BUILDS.
COPY --from=source /code/package.json /code/pnpm-lock.yaml ./
COPY --from=source /code/pnpm-workspace.yaml ./
COPY --from=source /code/lib/obsidian-compiler/mix.exs /code/lib/obsidian-compiler/mix.lock ./lib/obsidian-compiler/

# Install Node.js dependencies with cache mount for pnpm store
RUN --mount=type=cache,id=s/b794785d-77e3-4281-a780-3c9c7f3e77cf-${RAILWAY_ENVIRONMENT_NAME}-pnpm-store,target=/root/.local/share/pnpm/store \
      pnpm install --frozen-lockfile

# Install Elixir dependencies with cache mount for hex and mix
RUN --mount=type=cache,id=s/b794785d-77e3-4281-a780-3c9c7f3e77cf-${RAILWAY_ENVIRONMENT_NAME}-mix-deps,target=/root/.mix \
      --mount=type=cache,id=s/b794785d-77e3-4281-a780-3c9c7f3e77cf-${RAILWAY_ENVIRONMENT_NAME}-hex-cache,target=/root/.hex \
      cd lib/obsidian-compiler && \
      mix deps.get && \
      mix compile

# --- Builder Stage ---
# This stage builds the application. It uses cached dependencies and source code.
FROM base AS builder
WORKDIR /code

# Copy all build arguments and environment variables
ARG RAILWAY_GIT_BRANCH
ARG RAILWAY_GIT_REPO_OWNER
ARG RAILWAY_GIT_REPO_NAME
ARG RAILWAY_ENVIRONMENT_NAME
ARG OPENAI_API_KEY
ARG JINA_API_KEY
ARG JINA_BASE_URL
ARG VAULT_ADDR
ARG VAULT_TOKEN
ARG VAULT_PATH
ARG MOCHI_PROFILE_API
ARG DWARVES_PAT
ARG PLAUSIBLE_API_TOKEN

ENV RAILWAY_GIT_BRANCH=$RAILWAY_GIT_BRANCH
ENV RAILWAY_GIT_REPO_OWNER=$RAILWAY_GIT_REPO_OWNER
ENV RAILWAY_GIT_REPO_NAME=$RAILWAY_GIT_REPO_NAME
ENV RAILWAY_ENVIRONMENT_NAME=$RAILWAY_ENVIRONMENT_NAME
ENV OPENAI_API_KEY=$OPENAI_API_KEY
ENV JINA_API_KEY=$JINA_API_KEY
ENV JINA_BASE_URL=$JINA_BASE_URL
ENV VAULT_ADDR=$VAULT_ADDR
ENV VAULT_TOKEN=$VAULT_TOKEN
ENV VAULT_PATH=$VAULT_PATH
ENV MOCHI_PROFILE_API=$MOCHI_PROFILE_API
ENV DWARVES_PAT=$DWARVES_PAT
ENV PLAUSIBLE_API_TOKEN=$PLAUSIBLE_API_TOKEN

# Copy installed dependencies from the 'deps' stage
COPY --from=deps /code/node_modules ./node_modules
COPY --from=deps /code/lib/obsidian-compiler/_build ./lib/obsidian-compiler/_build
COPY --from=deps /code/lib/obsidian-compiler/deps ./lib/obsidian-compiler/deps

# Copy the full source code (with submodules) from the 'source' stage
COPY --from=source /code .

# Build the static assets using cache mounts for Next.js and build processes
# This tells Docker to persist build caches between builds for faster rebuilds.
# SKIP_INSTALL=1 skips the `pnpm install --no-frozen-lockfile` line in the
# build-static Makefile target — the deps stage already installed frozen with
# the pnpm store cache mount, and re-running the install here (without that
# store mount) causes pnpm 11 to re-link node_modules against a missing store,
# leaving package files (e.g. tsx/dist/cli.mjs) empty.
RUN --mount=type=cache,id=s/b794785d-77e3-4281-a780-3c9c7f3e77cf-${RAILWAY_ENVIRONMENT_NAME}-nextjs-cache,target=/code/.next/cache \
      --mount=type=cache,id=s/b794785d-77e3-4281-a780-3c9c7f3e77cf-${RAILWAY_ENVIRONMENT_NAME}-build-cache,target=/tmp/build-cache \
      make build-static SKIP_INSTALL=1

# --- Runner Stage ---
# This is the final, small image that will run in production.
FROM nginx:alpine

LABEL maintainer="anhnx@d.foundation" \
      org.opencontainers.image.title="memo.d.foundation Frontend" \
      org.opencontainers.image.source="https://github.com/dwarvesf/memo.d.foundation"

# Copy static assets from the builder stage
COPY --from=builder /code/out/ /usr/share/nginx/html

# Copy Nginx configuration
COPY --from=builder /code/public/content/nginx_redirect_map.conf /etc/nginx/conf.d/nginx_redirect_map.conf
COPY --from=builder /code/nginx/nginx.custom.conf /etc/nginx/conf.d/default.conf

# Healthcheck and expose port
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
      CMD curl -f http://localhost/ || exit 1
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
