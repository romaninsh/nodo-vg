-- nodo's own sign-ins: one row per web sign-in, in a SQLite file of nodo's (data/sessions.db),
-- never in Odoo's database. A row outlives app and server restarts, so restarting no longer
-- signs everyone out. `id` is the SHA-256 of the token, never the token. ingress.sh builds it.
CREATE TABLE IF NOT EXISTS session (
  id         TEXT PRIMARY KEY,
  uid        INTEGER NOT NULL,   -- Odoo's res_users.id
  name       TEXT,
  login      TEXT,
  lang       TEXT,
  expires_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '+8 hours'))
);
