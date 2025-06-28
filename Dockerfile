# b794785d-77e3-4281-a780-3c9c7f3e77cf is the railway service id which is used to identify the cache for each service.
# Optimized Dockerfile with intelligent layer caching strategy
# --- Base Stage ---
FROM asia-southeast1-docker.pkg.dev/df-infrastructure/memo-d-foundation/base AS base
WORKDIR /code

# --- Source Stage ---
# Handle all source code and git operations in one stage since Railway provides the repo
FROM base AS source
WORKDIR /code

ARG RAILWAY_GIT_BRANCH=main
ARG RAILWAY_GIT_REPO_OWNER=dwarvesf
ARG RAILWAY_GIT_REPO_NAME=memo.d.foundation
ARG RAILWAY_ENVIRONMENT_NAME

# Copy source files in order of change frequency (least to most)
# Package files first (change less frequently)
COPY package.json pnpm-lock.yaml ./
COPY lib/obsidian-compiler/mix.exs lib/obsidian-compiler/mix.lock ./lib/obsidian-compiler/

# Copy configuration files
COPY components.json devbox.json devbox.lock ./
COPY nginx/ ./nginx/
COPY public/ ./public/

# Copy source code (changes most frequently)
COPY src/ ./src/
COPY scripts/ ./scripts/
COPY test/ ./test/
COPY lib/ ./lib/

# Copy build configuration files that exist
COPY Makefile tsconfig.json ./
COPY next.config.ts tailwind.config.mjs ./
COPY *.md ./

# Copy git-related files if they exist, then initialize git and submodules
COPY .gitmodules ./
COPY . .

# Initialize git and fetch vault submodule with caching
RUN --mount=type=cache,id=s/b794785d-77e3-4281-a780-3c9c7f3e77cf-${RAILWAY_ENVIRONMENT_NAME}-git-objects,target=/root/.cache/git \
      # Configure git globally
      git config --global --add safe.directory /code && \
      git config --global --add safe.directory /code/vault && \
      git config --global --add safe.directory '*' && \
      git config --global url."https://github.com/".insteadOf "git@github.com:" && \
      # Initialize git repository if needed
      if [ ! -d ".git" ]; then \
        git init && \
        git remote add origin https://github.com/${RAILWAY_GIT_REPO_OWNER}/${RAILWAY_GIT_REPO_NAME}.git && \
        git fetch --depth 1 --no-tags origin ${RAILWAY_GIT_BRANCH} && \
        git checkout ${RAILWAY_GIT_BRANCH}; \
      fi && \
      # Initialize vault submodule (this is the expensive 790MB operation)
      git submodule update --init --recursive --depth 1 vault && \
      cd vault && \
      git remote set-url origin https://github.com/dwarvesf/brainery.git && \
      git fetch --depth 1 --no-tags origin main && \
      git checkout main && \
      git submodule update --init --recursive --depth 1

# --- Deps Stage ---
FROM base AS deps
WORKDIR /code

# Copy only dependency files for maximum cache efficiency
COPY --from=source /code/package.json /code/pnpm-lock.yaml ./
COPY --from=source /code/lib/obsidian-compiler/mix.exs /code/lib/obsidian-compiler/mix.lock ./lib/obsidian-compiler/

ARG RAILWAY_ENVIRONMENT_NAME

# Install Node.js dependencies with cache
RUN --mount=type=cache,id=s/b794785d-77e3-4281-a780-3c9c7f3e77cf-${RAILWAY_ENVIRONMENT_NAME}-pnpm,target=/root/.local/share/pnpm \
      --mount=type=cache,id=s/b794785d-77e3-4281-a780-3c9c7f3e77cf-${RAILWAY_ENVIRONMENT_NAME}-pnpm-state,target=/root/.pnpm-state \
      pnpm install --frozen-lockfile

# Install Elixir dependencies with cache
RUN --mount=type=cache,id=s/b794785d-77e3-4281-a780-3c9c7f3e77cf-${RAILWAY_ENVIRONMENT_NAME}-mix,target=/root/.mix \
      --mount=type=cache,id=s/b794785d-77e3-4281-a780-3c9c7f3e77cf-${RAILWAY_ENVIRONMENT_NAME}-hex,target=/root/.hex \
      cd lib/obsidian-compiler && \
      mix deps.get && \
      mix compile

# --- Builder Stage ---
FROM base AS builder
WORKDIR /code

# Build arguments
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

# Environment variables
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

# Copy dependencies (cached from deps stage)
COPY --from=deps /code/node_modules ./node_modules
COPY --from=deps /code/lib/obsidian-compiler/_build ./lib/obsidian-compiler/_build
COPY --from=deps /code/lib/obsidian-compiler/deps ./lib/obsidian-compiler/deps

# Copy source code (including vault from source stage)
COPY --from=source /code .

# Build with comprehensive caching - each cache targets specific build artifacts
RUN --mount=type=cache,id=s/b794785d-77e3-4281-a780-3c9c7f3e77cf-${RAILWAY_ENVIRONMENT_NAME}-nextjs,target=/code/.next/cache \
      --mount=type=cache,id=s/b794785d-77e3-4281-a780-3c9c7f3e77cf-${RAILWAY_ENVIRONMENT_NAME}-turbo,target=/code/.turbo \
      --mount=type=cache,id=s/b794785d-77e3-4281-a780-3c9c7f3e77cf-${RAILWAY_ENVIRONMENT_NAME}-build,target=/tmp/build \
      --mount=type=cache,id=s/b794785d-77e3-4281-a780-3c9c7f3e77cf-${RAILWAY_ENVIRONMENT_NAME}-obsidian,target=/code/lib/obsidian-compiler/_build \
      chmod +x scripts/smart-build.sh && \
      ./scripts/smart-build.sh

# --- Runtime Stage ---
FROM nginx:alpine

LABEL maintainer="anhnx@d.foundation" \
      org.opencontainers.image.title="memo.d.foundation Frontend" \
      org.opencontainers.image.source="https://github.com/dwarvesf/memo.d.foundation"

# Copy static assets
COPY --from=builder /code/out/ /usr/share/nginx/html

# Copy Nginx configuration
COPY --from=builder /code/public/content/nginx_redirect_map.conf /etc/nginx/conf.d/nginx_redirect_map.conf
COPY --from=builder /code/nginx/nginx.custom.conf /etc/nginx/conf.d/default.conf

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
      CMD curl -f http://localhost/ || exit 1

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"] 