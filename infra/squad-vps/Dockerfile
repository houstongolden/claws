FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# System packages
RUN apt-get update && apt-get install -y \
    curl git jq python3 python3-pip wget \
    ca-certificates gnupg lsb-release \
    && rm -rf /var/lib/apt/lists/*

# Node.js 22
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# ttyd web terminal (static binary)
RUN curl -sL https://github.com/tsl0922/ttyd/releases/download/1.7.7/ttyd.x86_64 \
    -o /usr/local/bin/ttyd && chmod +x /usr/local/bin/ttyd

# OpenClaw
RUN npm install -g openclaw@latest

# Hubify CLI — collective intelligence layer
RUN npm install -g hubify@latest

# Git config defaults
RUN git config --global init.defaultBranch main

# Workspace directory (will be overlaid by Fly volume)
RUN mkdir -p /workspace/.hubify

# Boot script — starts ttyd, keeps container alive
COPY boot.sh /usr/local/bin/boot.sh
RUN chmod +x /usr/local/bin/boot.sh

EXPOSE 8080

CMD ["/usr/local/bin/boot.sh"]
