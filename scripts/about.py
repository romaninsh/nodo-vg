"""Writes web/team/src/about.ts, the numbers on the splash screen. Run it after a PR lands (or in
one that changes the app), never edit about.ts by hand:

    python3 -I scripts/about.py

Code counts come from scripts/stats.py at HEAD; merged PRs from GitHub (`gh`).
"""

import datetime
import json
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(__file__))
from stats import stats  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "web", "team", "src", "about.ts")

# The Vantage build the app runs on, and what Vantage gained or was asked for because of nodo.
# Add an entry when nodo needs a change in Vantage.
VANTAGE_VERSION = "1.14.9"
VANTAGE_FEATURES = [
    "Sign-ins kept in the server's memory, so nothing is added to Odoo's database",
    "Odoo's password hashes (passlib pbkdf2-sha512) checked and written",
]
VANTAGE_ISSUES = 5  # reported while building To-do, each with a workaround in the app


def merged_prs():
    out = subprocess.run(["gh", "pr", "list", "-R", "romaninsh/nodo-vg", "--state", "merged",
                          "--limit", "1000", "--json", "number"], check=True, capture_output=True, text=True)
    return len(json.loads(out.stdout))


def main():
    s = stats("HEAD")
    about = {
        "measuredOn": datetime.date.today().isoformat(),
        "vantageVersion": VANTAGE_VERSION,
        "code": {k: s[k] for k in ("backend_lines", "tables", "pages", "actions",
                                   "frontend_lines", "frontend_files", "generated_lines", "scenario_steps")},
        "odooTables": s["odoo_tables"],
        "pullRequests": merged_prs(),
        "vantage": {"features": VANTAGE_FEATURES, "issues": VANTAGE_ISSUES},
    }
    body = json.dumps(about, indent=2, ensure_ascii=False)
    with open(OUT, "w") as f:
        f.write("// Written by scripts/about.py; never edit by hand. Run it again after a PR lands.\n\n")
        f.write(f"export const ABOUT = {body} as const;\n")
    print(f"wrote {os.path.relpath(OUT, ROOT)}")


if __name__ == "__main__":
    main()
