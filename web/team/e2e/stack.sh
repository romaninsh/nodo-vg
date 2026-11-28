#!/usr/bin/env bash
# The real stack for the end-to-end tests: the seeded demo database and vantage-server serving
# the `team` API with the built web app (web/team/dist) on http://127.0.0.1:$PORT.
#   web/team/e2e/stack.sh up | down | logs
# The server shares the database container's network, so the datasources' own address
# (localhost:5434, database `odoo`) reaches it unchanged.
# DB_IMAGE=running uses a Postgres that already serves database `odoo` on localhost:5434 (the CI
# e2e job's service container): no database container, the server joins the host network and
# listens on its own 8090, so PORT stays 8090.
set -euo pipefail

DB_IMAGE="${DB_IMAGE:-ghcr.io/romaninsh/nodo-vg-db:latest}"
SERVER_IMAGE="${SERVER_IMAGE:-romaninsh/vantage-server:1.16.4}"
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
  if [ "$DB_IMAGE" = running ]; then
    [ "$PORT" = 8090 ] || { echo "DB_IMAGE=running serves on 8090 only"; exit 1; }
    network=host
  else
    # Postgres on 5434, the port datasource/*.yaml name; the server's 8090 is published from here.
    docker run -d --name "$DB" -p "127.0.0.1:$PORT:8090" "$DB_IMAGE" postgres -p 5434 > /dev/null
    for _ in $(seq 60); do docker exec "$DB" pg_isready -U odoo -p 5434 -q && break; sleep 1; done
    # The image's database is `nodo`; the datasources read Odoo's usual `odoo`.
    docker exec "$DB" psql -U odoo -p 5434 -d postgres -qc 'ALTER DATABASE nodo RENAME TO odoo'
    network="container:$DB"
  fi
  # nodo's sign-in file (datasource/sessions.yaml): built fresh by ingress.sh in a temporary
  # folder, mounted writable over the read-only project's data/. Open to the server's user, which
  # isn't this one; SQLite also writes its journal next to the file.
  sessions="$(mktemp -d)"
  sh "$ROOT/ingress.sh" "$sessions"
  chmod 777 "$sessions"; chmod 666 "$sessions/sessions.db"
  # data/ is git-ignored, so a fresh checkout has none; Docker needs it as the mount point
  # inside the read-only project mount.
  mkdir -p "$ROOT/data"
  docker run -d --name "$SERVER" --network "$network" \
    -v "$ROOT:/app/project:ro" -v "$sessions:/app/project/data" -v "$ROOT/web/team/dist:/app/web:ro" \
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
