# Builder image
FROM jetpackio/devbox:latest AS builder

ARG OPENAI_API_KEY
ARG JINA_API_KEY
ARG JINA_BASE_URL

ARG RAILWAY_GIT_BRANCH=main
ENV RAILWAY_GIT_BRANCH=$RAILWAY_GIT_BRANCH

ARG RAILWAY_GIT_REPO_OWNER=dwarvesf
ENV RAILWAY_GIT_REPO_OWNER=$RAILWAY_GIT_REPO_OWNER
ARG RAILWAY_GIT_REPO_NAME=memo.d.foundation
ENV RAILWAY_GIT_REPO_NAME=$RAILWAY_GIT_REPO_NAME

ENV OPENAI_API_KEY=$OPENAI_API_KEY
ENV JINA_API_KEY=$JINA_API_KEY
ENV JINA_BASE_URL=$JINA_BASE_URL

# Copy the repository
WORKDIR /code
USER root:root
RUN mkdir -p /code && chown ${DEVBOX_USER}:${DEVBOX_USER} /code
USER ${DEVBOX_USER}:${DEVBOX_USER}

COPY --chown=${DEVBOX_USER}:${DEVBOX_USER} ./ ./

# Map git to current directory
RUN git init
RUN git remote add origin https://github.com/${RAILWAY_GIT_REPO_OWNER}/${RAILWAY_GIT_REPO_NAME}.git
RUN git fetch --depth 1 --no-tags origin ${RAILWAY_GIT_BRANCH}
RUN git clean -fdx
RUN git checkout ${RAILWAY_GIT_BRANCH}

# Installing devbox project
RUN git config --global --add safe.directory /code
RUN git config --global url."https://github.com/".insteadOf "git@github.com:"
RUN git submodule update --init --recursive --depth 1

RUN devbox run build

# Export runner
FROM nginx:alpine
COPY --from=builder /code/out/ /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
