#!/usr/bin/env bash
# The real stack for the end-to-end tests: the seeded demo database and vantage-server serving
# the `team` API with the built web app (web/team/dist) on http://127.0.0.1:$PORT.
#   web/team/e2e/stack.sh up | down | logs
# The server shares the database container's network, so the datasources' own address
# (localhost:5434, database `odoo`) reaches it unchanged, on a laptop and in CI alike.
set -euo pipefail

DB_IMAGE="${DB_IMAGE:-ghcr.io/romaninsh/nodo-vg-db:latest}"
SERVER_IMAGE="${SERVER_IMAGE:-romaninsh/vantage-server:1.14.8}"
PORT="${PORT:-8090}"
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
DB=nodo-e2e-db
SERVER=nodo-e2e-server

down() { docker rm -f "$SERVER" "$DB" > /dev/null 2>&1 || true; }

logs() {
  echo "--- $SERVER"; docker logs --tail 40 "$SERVER" 2>&1 || true
  echo "--- $DB"; docker logs --tail 10 "$DB" 2>&1 || true
}

up() {
  down
  [ -f "$ROOT/web/team/dist/index.html" ] || { echo "build the web app first (npm run build in web/team)"; exit 1; }
  # Postgres on 5434, the port datasource/*.yaml name; the server's 8090 is published from here.
  docker run -d --name "$DB" -p "127.0.0.1:$PORT:8090" "$DB_IMAGE" postgres -p 5434 > /dev/null
  for _ in $(seq 60); do docker exec "$DB" pg_isready -U odoo -p 5434 -q && break; sleep 1; done
  # The image's database is `nodo`; the datasources read Odoo's usual `odoo`.
  docker exec "$DB" psql -U odoo -p 5434 -d postgres -qc 'ALTER DATABASE nodo RENAME TO odoo'
  docker run -d --name "$SERVER" --network "container:$DB" \
    -v "$ROOT:/app/project:ro" -v "$ROOT/web/team/dist:/app/web:ro" \
    -e VANTAGE_API=team "$SERVER_IMAGE" --static /app/web > /dev/null
  for _ in $(seq 90); do
    curl -fs "http://127.0.0.1:$PORT/v1/ready" > /dev/null && { echo "stack up on http://127.0.0.1:$PORT"; return; }
    sleep 1
  done
  echo "vantage-server did not report ready in 90 s"; logs; exit 1
}

case "${1:-}" in
  up) up ;;
  down) down ;;
  logs) logs ;;
  *) echo "usage: $0 up | down | logs"; exit 2 ;;
esac
