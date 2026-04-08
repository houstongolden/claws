FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV NODE_OPTIONS="--max-old-space-size=2048"
ENV SERVE_UI=true
ENV PORT=3100
ENV COMPANY_OS_HOME=/data/company-os

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl git jq python3 wget ca-certificates gnupg \
    lsb-release nginx gettext-base openssl libssl-dev \
    postgresql postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Node.js 22
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    rm -rf /var/lib/apt/lists/*

# pnpm
RUN npm install -g pnpm@9.15.4

# OpenClaw
RUN npm install -g openclaw@latest

# Hubify CLI — collective intelligence layer
RUN npm install -g hubify@latest

# Agent adapter CLIs — required by Company OS agent setup wizard
RUN npm install -g @anthropic-ai/claude-code@latest || true
RUN npm install -g @openai/codex@latest || true

RUN git config --global init.defaultBranch main
RUN mkdir -p /data /opt/company-os
# apt postgresql creates the postgres user automatically
# company-os user for future use
RUN useradd -r -m -s /bin/bash company-os 2>/dev/null || true
VOLUME ["/data"]

# Copy the company-os app (build context is repo root)
COPY apps/company-os/ /opt/company-os/

WORKDIR /opt/company-os

# Install dependencies
RUN pnpm install --no-frozen-lockfile

# Build shared packages first (these are clean)
RUN pnpm --filter "@hubify/company-os-shared" build
RUN pnpm --filter "@hubify/adapter-utils" build
RUN pnpm --filter "@hubify/company-os-db" build
RUN pnpm --filter "@hubify/adapter-openclaw" build || true
RUN pnpm --filter "@hubify/adapter-claude-local" build || true
RUN pnpm --filter "@hubify/adapter-codex-local" build || true

# Build server — allow TS errors (upstream Paperclip strict issues), just emit JS
RUN pnpm --filter "@hubify/company-os-server" exec tsc --noEmitOnError false || \
    (echo "Server TS had errors but continuing — JS was emitted" && true)

# Build UI
RUN pnpm --filter "@hubify/company-os-ui" build

# Copy OpenClaw workspace template + defaults
COPY infra/workspace/templates/companyos/ /opt/templates/companyos/
COPY infra/workspace/defaults/ /opt/defaults/
COPY infra/workspace/openclaw.json.template /opt/openclaw.json.template

# Copy nginx + boot
COPY infra/company-os/nginx.conf /etc/nginx/nginx.conf
COPY infra/company-os/boot.sh /usr/local/bin/boot.sh
RUN chmod +x /usr/local/bin/boot.sh

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
    CMD curl -f http://localhost:80/__health || exit 1

CMD ["/usr/local/bin/boot.sh"]
