# Builder image
FROM jetpackio/devbox:latest AS builder

USER root:root

# Clone the repository
WORKDIR /
RUN git clone --filter=blob:none https://github.com/dwarvesf/memo.d.foundation.git /code
WORKDIR /code

# Installing your devbox project
RUN git config --global --add safe.directory /code
RUN git config --global url."https://github.com/".insteadOf "git@github.com:"
RUN git submodule update --init --recursive --depth 1

RUN devbox run build

# Export runner
FROM nginx:alpine
COPY --from=builder /code/out/ /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
