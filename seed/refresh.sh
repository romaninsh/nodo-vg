#!/usr/bin/env bash
# Rebuilds the committed master seed (seed/master/nodo.dump and filestore.tar.gz): Odoo
# Community 20.0 with the apps in seed/modules.txt and their demo data, installed into a
# throwaway Postgres 17 (seed/install.sh, about two minutes). CI and the seed image load the
# committed files and never install Odoo; run this by hand when modules.txt or the Odoo image
# changes, and commit the result.
#
#   seed/refresh.sh
#
# Odoo writes demo dates relative to the day it installs, so a refresh moves the demo to today.
set -euo pipefail

cd "$(dirname "$0")"
NAME="nodo-refresh-$$"
OUT="$(mktemp -d)"

cleanup() {
  docker rm -f "$NAME-db" > /dev/null 2>&1 || true
  docker network rm "$NAME" > /dev/null 2>&1 || true
  rm -rf "$OUT"
}
trap cleanup EXIT

docker network create "$NAME" > /dev/null
docker run -d --name "$NAME-db" --network "$NAME" \
  -e POSTGRES_USER=odoo -e POSTGRES_PASSWORD=odoo -e POSTGRES_DB=postgres postgres:17 > /dev/null
for _ in $(seq 60); do docker exec "$NAME-db" pg_isready -U odoo -q && break; sleep 1; done
docker exec "$NAME-db" pg_isready -U odoo -q

DB_NETWORK="$NAME" DB_HOST="$NAME-db" DB_PORT=5432 ./install.sh "$OUT"
mkdir -p master
cp "$OUT/nodo.dump" master/nodo.dump
tar -czf master/filestore.tar.gz -C "$OUT" filestore
echo "Refreshed seed/master; commit it"
