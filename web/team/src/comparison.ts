// The splash's architecture comparison: how Odoo does each thing, and how nodo does it on
// Vantage. Honest by design: most rows say what nodo doesn't do yet. Add a row when a new
// app needs a new area, and change a mark only when the code does.

export type Mark = "ahead" | "same" | "partly" | "different" | "not yet";

export type Row = { area: string; odoo: string; nodo: string; mark: Mark };

export const COMPARISON: Row[] = [
  {
    area: "Database",
    odoo: "Postgres schema created and migrated by Odoo",
    nodo: "That same database and schema. nodo adds no tables or columns; it adds a trigger per table that announces changes",
    mark: "same",
  },
  {
    area: "Live updates",
    odoo: "A view shows other people's changes after a reload",
    nodo: "Postgres announces each change, from nodo or Odoo, and open boards and lists re-read at once, with no timers; a web page can still lag one change behind",
    mark: "partly",
  },
  {
    area: "Business logic",
    odoo: "Python models; computed fields and constraints run in the ORM on every write",
    nodo: "Table hooks and Rhai actions; derived values computed in SQL when read. Only what each app needs is rewritten",
    mark: "partly",
  },
  {
    area: "Sign-in",
    odoo: "Database sessions, pbkdf2-sha512 password hashes, two-factor",
    nodo: "The same hashes checked against Odoo's users; sessions in server memory, so a restart signs everyone out; no two-factor",
    mark: "partly",
  },
  {
    area: "Access control",
    odoo: "Groups, model access rights and record rules",
    nodo: "Each API lists its tables, columns and actions; row rules in SQL keep people to their own to-dos. Odoo's groups aren't read",
    mark: "partly",
  },
  {
    area: "API",
    odoo: "Generic JSON-RPC over every model",
    nodo: "One API per app that lists only what the browser may use, with a typed client generated from it",
    mark: "ahead",
  },
  {
    area: "Front end",
    odoo: "OWL views built from XML view definitions",
    nodo: "A hand-written React app per Odoo app, plus a desktop admin app from the same YAML",
    mark: "different",
  },
  {
    area: "Tests",
    odoo: "Python unit tests per addon",
    nodo: "Scenario tests in YAML, run headless in CI on every pull request",
    mark: "different",
  },
  {
    area: "Rich text",
    odoo: "HTML editor for descriptions",
    nodo: "Plain text; saving a description in nodo drops its formatting",
    mark: "not yet",
  },
  {
    area: "Chatter, activities, email",
    odoo: "Messages, followers and scheduled activities on every record",
    nodo: "Followers are written so Odoo's chatter stays right; nothing of it is shown in nodo",
    mark: "not yet",
  },
  {
    area: "Many-to-many links",
    odoo: "Link tables written by the ORM",
    nodo: "Tags are written straight to Odoo's link table, keyed by the pair as Odoo keys it",
    mark: "same",
  },
  {
    area: "Translations",
    odoo: "Names stored per language",
    nodo: "English, with a fallback to whatever language is stored",
    mark: "not yet",
  },
  {
    area: "Files, reports, PDF",
    odoo: "Filestore, attachments, printed reports",
    nodo: "Not yet",
    mark: "not yet",
  },
];
