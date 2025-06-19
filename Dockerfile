# --- Base Stage ---
# Use the official base image which has all the necessary tools installed.
FROM ghcr.io/dwarvesf/memo.d.foundation:base-latest AS base
WORKDIR /code

# --- Source Stage ---
# Fetches the latest source code and submodules from git. This stage ensures
# that the submodules are always present for the build.
FROM base AS source
WORKDIR /code

# Arguments for git repository details
ARG RAILWAY_GIT_BRANCH=main
ARG RAILWAY_GIT_REPO_OWNER=dwarvesf
ARG RAILWAY_GIT_REPO_NAME=memo.d.foundation

# Initialize git, fetch the specified branch, and update submodules
RUN git init && \
      git remote add origin https://github.com/${RAILWAY_GIT_REPO_OWNER}/${RAILWAY_GIT_REPO_NAME}.git && \
      git fetch --depth 1 origin ${RAILWAY_GIT_BRANCH} && \
      git checkout ${RAILWAY_GIT_BRANCH} && \
      git config --global --add safe.directory /code && \
      git submodule update --init --recursive

# --- Deps Stage ---
# Install dependencies first and cache them. This layer only rebuilds if lockfiles change.
FROM base AS deps
WORKDIR /code

# Copy dependency definition files from the 'source' stage
COPY --from=source /code/package.json /code/pnpm-lock.yaml ./
COPY --from=source /code/lib/obsidian-compiler/mix.exs /code/lib/obsidian-compiler/mix.lock ./lib/obsidian-compiler/

# Install Node.js and Elixir dependencies
RUN pnpm install --frozen-lockfile
RUN cd lib/obsidian-compiler && mix deps.get && mix compile

# --- Builder Stage ---
# This stage builds the application. It uses cached dependencies and source code.
FROM base AS builder
WORKDIR /code

# Copy all build arguments and environment variables
ARG RAILWAY_GIT_BRANCH
ARG RAILWAY_GIT_REPO_OWNER
ARG RAILWAY_GIT_REPO_NAME
ARG OPENAI_API_KEY
ARG JINA_API_KEY
ARG JINA_BASE_URL
ARG VAULT_ADDR
ARG VAULT_TOKEN
ARG VAULT_PATH
ARG MOCHI_PROFILE_API
ARG DWARVES_PAT
ENV RAILWAY_GIT_BRANCH=$RAILWAY_GIT_BRANCH
ENV RAILWAY_GIT_REPO_OWNER=$RAILWAY_GIT_REPO_OWNER
ENV RAILWAY_GIT_REPO_NAME=$RAILWAY_GIT_REPO_NAME
ENV OPENAI_API_KEY=$OPENAI_API_KEY
ENV JINA_API_KEY=$JINA_API_KEY
ENV JINA_BASE_URL=$JINA_BASE_URL
ENV VAULT_ADDR=$VAULT_ADDR
ENV VAULT_TOKEN=$VAULT_TOKEN
ENV VAULT_PATH=$VAULT_PATH
ENV MOCHI_PROFILE_API=$MOCHI_PROFILE_API
ENV DWARVES_PAT=$DWARVES_PAT

# Copy installed dependencies from the 'deps' stage
COPY --from=deps /code/node_modules ./node_modules
COPY --from=deps /code/lib/obsidian-compiler/_build ./lib/obsidian-compiler/_build
COPY --from=deps /code/lib/obsidian-compiler/deps ./lib/obsidian-compiler/deps

# Copy the full source code (with submodules) from the 'source' stage
COPY --from=source /code .

# Build the static assets using a cache mount.
# This tells Docker to persist the ./.next/cache directory between builds,
# enabling "warm" builds without relying on a local cache from the host.
RUN --mount=type=cache,target=./.next/cache make build-static

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