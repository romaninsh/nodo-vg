#!/bin/sh
# nodo's own data beside Odoo: the sign-in file data/sessions.db (Odoo's database is never
# changed here; seed/ builds that). Creates the file and its table when missing; an existing
# file keeps its rows. Usage: sh ingress.sh [dir]   (default: data)
set -eu
HERE="$(cd "$(dirname "$0")" && pwd)"
DIR="${1:-$HERE/data}"
mkdir -p "$DIR"
sqlite3 "$DIR/sessions.db" < "$HERE/sessions/schema.sql"
