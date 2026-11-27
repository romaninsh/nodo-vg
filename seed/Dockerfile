# The nodo demo database: Odoo Community's schema and demo data, restored at build time. PGDATA
# is moved off the base image's VOLUME, so the restored data stays in the image and a container
# starts without restoring anything. Odoo's filestore (attachments, product images) is kept at
# /odoo-filestore for whatever needs it later. Built by seed/build.sh.
FROM postgres:17

ENV PGDATA=/pgdata \
    POSTGRES_USER=odoo \
    POSTGRES_PASSWORD=odoo \
    POSTGRES_DB=nodo

COPY nodo.dump /tmp/nodo.dump
COPY notify.sql /tmp/notify.sql
COPY filestore /odoo-filestore

RUN mkdir -p "$PGDATA" && chown postgres "$PGDATA" \
 && gosu postgres initdb -U odoo --auth-local=trust --auth-host=scram-sha-256 \
 && gosu postgres pg_ctl -o "-c listen_addresses=''" -w start \
 && gosu postgres psql -U odoo -d postgres -c "ALTER USER odoo PASSWORD 'odoo'" -c "CREATE DATABASE nodo" \
 && gosu postgres pg_restore -U odoo -d nodo --exit-on-error /tmp/nodo.dump \
 && gosu postgres psql -U odoo -d nodo -v ON_ERROR_STOP=1 -q -f /tmp/notify.sql \
 && gosu postgres pg_ctl -m fast -w stop \
 && echo "listen_addresses = '*'" >> "$PGDATA/postgresql.conf" \
 && echo "host all all all scram-sha-256" >> "$PGDATA/pg_hba.conf" \
 && rm /tmp/nodo.dump /tmp/notify.sql
