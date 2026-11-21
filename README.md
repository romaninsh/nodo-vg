# nodo

Business apps for teams whose data lives in an Odoo Community 20.0 database, built from scratch
with [Vantage](https://vantage-ui.com). nodo works on the same database, unchanged, so Odoo and nodo
can run side by side on the same data. The first app is To-do.

![The same to-dos in Odoo (left) and nodo (right), read from one database](docs/screenshots/board.png)

Live demo: <https://nodo.demo.vantage-ui.com>, rebuilt every night.

## A rewrite, not a fork

nodo contains no Odoo code. None of Odoo's Python, JavaScript, templates or stylesheets is copied,
translated or linked. Every screen, rule and query is written anew: Vantage YAML and Rhai scripts
for the app, and a small React app for the web version.

The only thing nodo keeps from Odoo is the data structure: the tables and columns Odoo Community
creates. nodo reads and writes them the way Odoo does, so a row nodo saves is a row Odoo can open.
Where that meant knowing how Odoo fills a column, we looked at what Odoo writes and wrote our own
rules to match it.

nodo's code is MIT-licensed. The schema and the demo data are Odoo's, under LGPL-3.0; see `NOTICE`.

## Demo database

`ghcr.io/romaninsh/nodo-vg-db` is Postgres 17 with Odoo's schema and demo data for the apps in
`seed/modules.txt`, already restored.

```sh
docker run -d --name nodo-db -p 5435:5432 ghcr.io/romaninsh/nodo-vg-db:latest
psql postgresql://odoo:odoo@localhost:5435/nodo
```

Build it yourself:

```sh
seed/build.sh
```

## Licence

MIT (`LICENSE`). The schema and the demo data come from Odoo Community under LGPL-3.0; see
`NOTICE`. Not affiliated with Odoo S.A. "Odoo" is a trademark of Odoo S.A.
