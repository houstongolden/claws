FROM ubuntu:22.04
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y curl git jq python3 wget ca-certificates gnupg && rm -rf /var/lib/apt/lists/*
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt-get install -y nodejs && rm -rf /var/lib/apt/lists/*
RUN curl -sL https://github.com/tsl0922/ttyd/releases/download/1.7.7/ttyd.x86_64 -o /usr/local/bin/ttyd && chmod +x /usr/local/bin/ttyd
RUN npm install -g openclaw@latest
# Hubify CLI — collective intelligence layer
RUN npm install -g hubify@latest
RUN mkdir -p /data/.hub /data/memory /data/skills /data/projects
COPY boot.sh /usr/local/bin/boot.sh
RUN chmod +x /usr/local/bin/boot.sh
EXPOSE 8080
VOLUME ["/data"]
CMD ["/usr/local/bin/boot.sh"]
