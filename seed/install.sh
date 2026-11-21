#!/usr/bin/env bash
# Installs Odoo Community 20.0 with the apps in seed/modules.txt and their demo data into a
# running Postgres 17 (user and password `odoo`), as database `nodo`, then writes
# <out>/nodo.dump (pg_dump -Fc) and <out>/filestore. seed/build.sh wraps it into the seed image;
# the e2e job runs it against its service container.
#
#   seed/install.sh <out>
#
# Where the Postgres is, as Docker containers see it: DB_NETWORK (default host), DB_HOST
# (default 127.0.0.1) and DB_PORT (default 5432).
#
# Odoo writes demo dates relative to the day it installs, so a rebuild moves the demo to today.
set -euo pipefail

mkdir -p "${1:?usage: seed/install.sh <out>}"
OUT="$(cd "$1" && pwd)"
cd "$(dirname "$0")"
ODOO_IMAGE="${ODOO_IMAGE:-odoo:20.0}"
DB_NETWORK="${DB_NETWORK:-host}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"
MODULES="$(paste -sd, modules.txt)"
NAME="nodo-install-$$"

cleanup() {
  docker rm -f "$NAME" > /dev/null 2>&1 || true
  docker volume rm "$NAME-files" > /dev/null 2>&1 || true
}
trap cleanup EXIT

echo "Installing $MODULES with demo data (several minutes)"
docker run --name "$NAME" --network "$DB_NETWORK" -v "$NAME-files:/var/lib/odoo" \
  -e HOST="$DB_HOST" -e PORT="$DB_PORT" -e USER=odoo -e PASSWORD=odoo "$ODOO_IMAGE" \
  -- -d nodo --with-demo --stop-after-init --load-language=en_US --log-level=warn -i "$MODULES"

docker run --rm --network "$DB_NETWORK" -e PGPASSWORD=odoo postgres:17 \
  pg_dump -h "$DB_HOST" -p "$DB_PORT" -U odoo -Fc nodo > "$OUT/nodo.dump"
docker cp "$NAME:/var/lib/odoo/filestore/nodo" "$OUT/filestore"
