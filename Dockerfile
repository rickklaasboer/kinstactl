FROM debian:bookworm-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY --chmod=755 dist/bin/kinstactl-linux-x64 /usr/local/bin/kinstactl
CMD ["kinstactl", "--help"]
