#!/usr/bin/env bash
# Builds the seed image from the committed master seed (seed/master: Odoo Community 20.0 with
# the apps in seed/modules.txt and their demo data), in a Postgres 17 image whose data
# directory is already restored (starts in seconds). No Odoo install: seed/refresh.sh rebuilds
# the master when the modules change.
#
#   seed/build.sh [image-tag]        default ghcr.io/romaninsh/nodo-vg-db:local
set -euo pipefail

cd "$(dirname "$0")"
TAG="${1:-ghcr.io/romaninsh/nodo-vg-db:local}"
OUT="$(mktemp -d)"
trap 'rm -rf "$OUT"' EXIT

cp Dockerfile notify.sql master/nodo.dump master/filestore.tar.gz "$OUT/"
docker build -t "$TAG" "$OUT"
echo "Built $TAG"
