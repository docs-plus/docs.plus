FROM oven/bun:1-slim

RUN rm -rf /var/lib/apt/lists/* && \
  apt-get update && apt-get install -y --no-install-recommends ca-certificates && \
  rm -rf /var/lib/apt/lists/*

RUN groupadd -r appuser && useradd -r -m -g appuser appuser

WORKDIR /app

COPY --chown=appuser:appuser apps/github-relay/package.json ./apps/github-relay/
COPY --chown=appuser:appuser apps/github-relay/src ./apps/github-relay/src
COPY --chown=appuser:appuser apps/github-relay/discord-users.json ./apps/github-relay/discord-users.json

RUN mkdir -p /data && chown appuser:appuser /data

USER appuser

EXPOSE 4050

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD bun -e "fetch('http://127.0.0.1:'+(process.env.PORT||'4050')+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["bun", "apps/github-relay/src/index.ts"]
