#!/usr/bin/env bash
# Builds the seed image: Odoo Community 20.0 with the apps in seed/modules.txt and their demo
# data (seed/install.sh), in a Postgres 17 image whose data directory is already restored
# (starts in seconds).
#
#   seed/build.sh [image-tag]        default ghcr.io/romaninsh/nodo-vg-db:local
set -euo pipefail

cd "$(dirname "$0")"
TAG="${1:-ghcr.io/romaninsh/nodo-vg-db:local}"
NAME="nodo-seed-$$"
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
cp Dockerfile notify.sql "$OUT/"

docker build -t "$TAG" "$OUT"
echo "Built $TAG"
