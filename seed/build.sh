#!/usr/bin/env bash
# Builds the seed image: Odoo Community 20.0 with the apps in seed/modules.txt and their demo
# data, in a Postgres 17 image whose data directory is already restored (starts in seconds).
#
#   seed/build.sh [image-tag]        default ghcr.io/romaninsh/nodo-vg-db:local
#
# Odoo writes demo dates relative to the day it installs, so a rebuild moves the demo to today.
set -euo pipefail

cd "$(dirname "$0")"
TAG="${1:-ghcr.io/romaninsh/nodo-vg-db:local}"
ODOO_IMAGE="${ODOO_IMAGE:-odoo:20.0}"
MODULES="$(paste -sd, modules.txt)"
NAME="nodo-seed-$$"
OUT="$(mktemp -d)"

cleanup() {
  docker rm -f "$NAME-db" "$NAME-odoo" > /dev/null 2>&1 || true
  docker volume rm "$NAME-files" > /dev/null 2>&1 || true
  docker network rm "$NAME" > /dev/null 2>&1 || true
  rm -rf "$OUT"
}
trap cleanup EXIT

docker network create "$NAME" > /dev/null
docker run -d --name "$NAME-db" --network "$NAME" \
  -e POSTGRES_USER=odoo -e POSTGRES_PASSWORD=odoo -e POSTGRES_DB=postgres postgres:17 > /dev/null
for _ in $(seq 60); do docker exec "$NAME-db" pg_isready -U odoo -q && break; sleep 1; done
docker exec "$NAME-db" pg_isready -U odoo -q

echo "Installing $MODULES with demo data (several minutes)"
docker run --name "$NAME-odoo" --network "$NAME" -v "$NAME-files:/var/lib/odoo" \
  -e HOST="$NAME-db" -e USER=odoo -e PASSWORD=odoo "$ODOO_IMAGE" \
  -- -d nodo --with-demo --stop-after-init --load-language=en_US --log-level=warn -i "$MODULES"

docker exec "$NAME-db" pg_dump -U odoo -Fc nodo > "$OUT/nodo.dump"
docker cp "$NAME-odoo:/var/lib/odoo/filestore/nodo" "$OUT/filestore"
cp Dockerfile notify.sql "$OUT/"

docker build -t "$TAG" "$OUT"
echo "Built $TAG"
