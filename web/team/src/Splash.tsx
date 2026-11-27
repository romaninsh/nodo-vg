import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowRight, ArrowUpRight } from "lucide-react";
import { ABOUT } from "./about";
import { COMPARISON, type Mark } from "./comparison";
import "./splash.css";

// The first thing a browser session sees: what nodo is, that it is a rewrite on Odoo's own
// database, how much code it took (src/about.ts, measured by scripts/about.py), and how its
// architecture compares with Odoo's. Once per session; "About" in the top bar and /about open
// it again.

const SEEN = "nodo.splash.seen";
const ABOUT_PATH = "/about";
const atAbout = () => window.location.pathname === ABOUT_PATH;

export const openAbout = () => {
  if (!atAbout()) window.history.pushState({ nodo_about: true }, "", ABOUT_PATH);
  window.dispatchEvent(new Event("nodo:about"));
};

function leaveAbout() {
  if (!atAbout()) return;
  if (window.history.state?.nodo_about) {
    window.history.back();
    return;
  }
  window.history.replaceState(null, "", "/");
  window.dispatchEvent(new PopStateEvent("popstate"));
}

const fmt = (n: number) => n.toLocaleString("en-GB");
const c = ABOUT.code;

const STATS: [string, string, string][] = [
  [fmt(c.backend_lines), "lines of backend", `Vantage YAML and Rhai: ${c.tables} tables · ${c.pages} pages · ${c.actions} actions`],
  [fmt(c.frontend_lines), "lines of frontend", `React and TypeScript, ${c.frontend_files} files written by hand`],
  [fmt(c.generated_lines), "lines generated", "the typed client, from the API's schema, never edited"],
  [fmt(c.scenario_steps), "scenario test steps", "run on every pull request"],
  [fmt(ABOUT.pullRequests), "pull requests merged", "one per feature, each with Odoo next to nodo"],
  [String(ABOUT.odooTables.length), "Odoo tables used", "no tables or columns added"],
  [String(ABOUT.vantage.features.length), "features added to Vantage", ABOUT.vantage.features.join("; ")],
  [String(ABOUT.vantage.issues), "issues reported to Vantage", "each with a workaround in nodo"],
];

const MARK: Record<Mark, string> = {
  ahead: "ahead",
  same: "same",
  partly: "partly",
  different: "different",
  "not yet": "not yet",
};

export function Splash() {
  const [open, setOpen] = useState(() => atAbout() || sessionStorage.getItem(SEEN) !== "1");
  const button = useRef<HTMLButtonElement>(null);
  const close = () => {
    sessionStorage.setItem(SEEN, "1");
    setOpen(false);
    leaveAbout();
  };

  useEffect(() => {
    const again = () => setOpen(true);
    const moved = () => setOpen(atAbout());
    window.addEventListener("nodo:about", again);
    window.addEventListener("popstate", moved);
    return () => {
      window.removeEventListener("nodo:about", again);
      window.removeEventListener("popstate", moved);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => button.current?.focus(), 50);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="splash" role="dialog" aria-modal="true" aria-labelledby="splash-title">
      <div className="splash-card">
        <div className="splash-top">
          <img src="/vantage-logo.svg" alt="Vantage" className="splash-logo" />
          <p className="splash-kicker">Built with VantageUI {ABOUT.vantageVersion}</p>
        </div>

        <div className="splash-grid">
          <div className="splash-intro">
            <h1 id="splash-title">nodo</h1>
            <p className="lead">
              To-do for teams whose data lives in Odoo Community 20, rewritten from scratch with Vantage and running
              on Odoo's own database. Sign in with your Odoo login; Odoo keeps working on the same data.
            </p>
            <p>
              nodo contains no Odoo code. Every screen, rule and query is new; the only thing it keeps from Odoo is
              the data structure. nodo is MIT-licensed; Odoo's schema and demo data stay under LGPL-3.0.
            </p>
            <div className="splash-actions">
              <button ref={button} type="button" className="splash-primary" onClick={close}>
                Explore the demo <ArrowRight size={16} aria-hidden="true" />
              </button>
              <a className="splash-secondary" href="https://vantage-ui.com/download/" target="_blank" rel="noreferrer">
                Build your own <ArrowUpRight size={16} aria-hidden="true" />
              </a>
            </div>
            <button
              type="button"
              className="splash-link"
              onClick={() => document.getElementById("splash-compare")?.scrollIntoView({ behavior: "smooth" })}
            >
              How it compares with Odoo <ArrowDown size={14} aria-hidden="true" />
            </button>
          </div>

          <dl className="splash-stats">
            {STATS.map(([value, label, note]) => (
              <div key={label} className="splash-stat">
                <dd>{value}</dd>
                <dt>{label}</dt>
                <p>{note}</p>
              </div>
            ))}
          </dl>
        </div>

        <section id="splash-compare" className="splash-compare" aria-labelledby="splash-compare-title">
          <p className="splash-kicker">Architecture, side by side</p>
          <h2 id="splash-compare-title">Odoo and nodo on the same database</h2>
          <table>
            <thead>
              <tr>
                <th>Area</th>
                <th>Odoo</th>
                <th>nodo on Vantage</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map((r) => (
                <tr key={r.area}>
                  <th scope="row">{r.area}</th>
                  <td>{r.odoo}</td>
                  <td>
                    <span className={`mark mark-${r.mark.replace(" ", "-")}`}>{MARK[r.mark]}</span> {r.nodo}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="splash-note">Measured on {ABOUT.measuredOn}. Rows are added as more of Odoo is rebuilt.</p>
        </section>
      </div>
    </div>
  );
}
