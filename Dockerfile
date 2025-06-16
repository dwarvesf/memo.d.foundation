# Builder image
FROM jetpackio/devbox:latest AS builder

LABEL stage="builder" \
      maintainer="anhnx@d.foundation" \
      org.opencontainers.image.title="Memo.d.foundation Builder" \
      org.opencontainers.image.source="https://github.com/dwarvesf/memo.d.foundation"

# Set locale environment variables for UTF-8 support
ENV LANG C.UTF-8
ENV LC_ALL C.UTF-8

ARG OPENAI_API_KEY
ARG JINA_API_KEY
ARG JINA_BASE_URL

ARG VAULT_ADDR
ARG VAULT_TOKEN
ARG VAULT_PATH

ARG MOCHI_PROFILE_API
ARG DWARVES_PAT



ARG RAILWAY_GIT_BRANCH=main
ENV RAILWAY_GIT_BRANCH=$RAILWAY_GIT_BRANCH

ARG RAILWAY_GIT_REPO_OWNER=dwarvesf
ENV RAILWAY_GIT_REPO_OWNER=$RAILWAY_GIT_REPO_OWNER
ARG RAILWAY_GIT_REPO_NAME=memo.d.foundation
ENV RAILWAY_GIT_REPO_NAME=$RAILWAY_GIT_REPO_NAME

ENV OPENAI_API_KEY=$OPENAI_API_KEY
ENV JINA_API_KEY=$JINA_API_KEY
ENV JINA_BASE_URL=$JINA_BASE_URL

# Add Vault and GCS environment variables for StorageUtil
ENV VAULT_ADDR=$VAULT_ADDR
ENV VAULT_TOKEN=$VAULT_TOKEN
ENV VAULT_PATH=$VAULT_PATH

ENV MOCHI_PROFILE_API=$MOCHI_PROFILE_API
ENV DWARVES_PAT=$DWARVES_PAT

# Copy the repository
WORKDIR /code
# Ensure DEVBOX_USER is set in the base image or defined here.
# If not, USER root:root might be safer for these initial steps,
# then switch to a less privileged user if one is created by devbox.
USER root:root
RUN mkdir -p /code && chown ${DEVBOX_USER}:${DEVBOX_USER} /code
USER ${DEVBOX_USER}:${DEVBOX_USER}

COPY --chown=${DEVBOX_USER}:${DEVBOX_USER} ./ ./

# Map git to current directory, install devbox project, and build
RUN git init && \
    git remote add origin https://github.com/${RAILWAY_GIT_REPO_OWNER}/${RAILWAY_GIT_REPO_NAME}.git && \
    git fetch --depth 1 --no-tags origin ${RAILWAY_GIT_BRANCH} && \
    git clean -fdx && \
    git checkout ${RAILWAY_GIT_BRANCH} && \
    git config --global --add safe.directory /code && \
    # Use the provided personal access token for any GitHub HTTPS operations, including private submodules.
    git config --global url."https://${DWARVES_PAT}:x-oauth-basic@github.com/".insteadOf "https://github.com/" && \
    # Rewrite any git@github.com: SSH style URLs to HTTPS so the token mapping above applies.
    git config --global url."https://github.com/".insteadOf "git@github.com:" && \
    git submodule update --init --recursive --depth 1 && \
    devbox run build-static

# Export runner
FROM nginx:alpine

LABEL maintainer="anhnx@d.foundation" \
      org.opencontainers.image.title="memo.d.foundation Frontend" \
      org.opencontainers.image.version="1.0.0" \
      org.opencontainers.image.source="https://github.com/dwarvesf/memo.d.foundation"
      # Add org.opencontainers.image.revision=$(git rev-parse HEAD) in your CI/CD build arguments for this label

# Set locale environment variables for UTF-8 support
ENV LANG C.UTF-8
ENV LC_ALL C.UTF-8

# Copy static assets
COPY --from=builder /code/out/ /usr/share/nginx/html

# Copy the generated Nginx redirect map configuration
COPY --from=builder /code/public/content/nginx_redirect_map.conf /etc/nginx/conf.d/nginx_redirect_map.conf

# Copy custom Nginx configuration replace the default server block configuration
COPY --from=builder /code/nginx/nginx.custom.conf /etc/nginx/conf.d/default.conf

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost/ || exit 1

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
