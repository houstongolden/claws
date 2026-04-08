# Claws Workspace Smoke Test Image
# Minimal: just proves Fly deploy pipeline works for Claws. Full OpenClaw
# workspace image is at infra/workspace/Dockerfile (97 lines, ~1GB).
FROM alpine:3.19

RUN apk add --no-cache busybox-extras curl

WORKDIR /app

# Simple HTTP server that returns Claws workspace info
RUN cat > /app/serve.sh <<'EOF'
#!/bin/sh
PORT="${PORT:-8080}"
while true; do
  {
    echo -e "HTTP/1.1 200 OK\r"
    echo -e "Content-Type: application/json\r"
    echo -e "Access-Control-Allow-Origin: *\r"
    echo -e "\r"
    cat <<JSON
{
  "ok": true,
  "service": "claws-workspace-test",
  "version": "0.1.0",
  "pillar": "framework",
  "message": "Claws Fly.io provisioning pipeline is alive",
  "hostname": "$(hostname)",
  "uptime": $(cut -d' ' -f1 /proc/uptime),
  "memory_kb": $(grep MemTotal /proc/meminfo | awk '{print $2}')
}
JSON
  } | busybox nc -l -p "$PORT"
done
EOF
RUN chmod +x /app/serve.sh

EXPOSE 8080
CMD ["/app/serve.sh"]
