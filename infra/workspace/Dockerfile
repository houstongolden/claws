FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV OPENCLAW_STATE_DIR=/data
ENV NODE_OPTIONS="--max-old-space-size=1536"

# Install system dependencies with no-install-recommends to minimize image size.
# openssl + libssl-dev: needed for token/password generation in boot.sh.
# gettext-base: provides envsubst for nginx template rendering.
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    jq \
    python3 \
    python3-pip \
    wget \
    ca-certificates \
    gnupg \
    lsb-release \
    nginx \
    gettext-base \
    openssl \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Node.js 22
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    rm -rf /var/lib/apt/lists/*

# ttyd — live terminal monitoring with authentication
# NOTE: Version 1.7.7 supports --credential flag for HTTP Basic Auth
# This provides second layer of auth (first layer is Nginx JWT validation)
RUN curl -sL https://github.com/tsl0922/ttyd/releases/download/1.7.7/ttyd.x86_64 \
    -o /usr/local/bin/ttyd && chmod +x /usr/local/bin/ttyd

# OpenClaw — the agent runtime (latest stable AI OS template)
# Updated to 2026.3.2 for latest capabilities and security fixes
RUN npm install -g openclaw@2026.3.2

# Hubify CLI — collective intelligence layer for AI agents
# Enables workspaces to share learnings, discover skills, and contribute
# to the collective knowledge network
RUN npm install -g hubify@latest

# Python utilities used by research scripts and workspace tooling
# hubify-research is not yet on PyPI — install only available packages
RUN pip install --no-cache-dir requests python-dotenv

# Git defaults
RUN git config --global init.defaultBranch main

# Create a dedicated non-root nginx worker user (security best practice)
# nginx master process runs as root (required to bind port 80), workers as www-data
RUN id www-data || useradd -r -s /usr/sbin/nologin www-data

# Ensure nginx worker_processes directive matches www-data user
# (nginx.conf.template sets worker_processes 1, workers run as www-data by default on Ubuntu)

RUN mkdir -p /data /workspace /opt/dashboard

# Declare /data as the persistent volume mount point
VOLUME ["/data"]

# Copy template workspace files
COPY templates/ /opt/templates/

# Copy default workspace files (shared baseline, templates override these)
COPY defaults/ /opt/defaults/

# Copy workspace dashboard UI
COPY dashboard/ /opt/dashboard/

# Copy nginx config template
COPY nginx.conf.template /etc/nginx/nginx.conf.template

# Copy OpenClaw config template (used by boot.sh to generate /data/openclaw.json)
COPY openclaw.json.template /opt/openclaw.json.template

# Copy lightweight stats server (serves /api/stats and /auth/validate on port 4000)
COPY stats-server.js /opt/stats-server.js

# Copy dashboard escaping fix (runs after OpenClaw onboarding.finalize regenerates dashboard)
COPY fix-dashboard-escaping.py /opt/fix-dashboard-escaping.py

# Copy boot script
COPY boot.sh /usr/local/bin/boot.sh
RUN chmod +x /usr/local/bin/boot.sh

EXPOSE 80 3000 8080

# Health check: nginx serving the public /__health endpoint
# start-period=60s gives time for boot.sh to seed workspace + start all services
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:80/__health || exit 1

CMD ["/usr/local/bin/boot.sh"]
