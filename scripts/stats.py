"""How much nodo is, counted from git at a commit: the CI report compares a PR with main, and
the splash (web/team/src/about.ts) shows the same numbers. Counted, never estimated.

    python3 -I scripts/stats.py [REF]     # prints JSON; REF defaults to HEAD
"""

import json
import re
import subprocess
import sys

# The Vantage app: everything the server loads, YAML and Rhai.
BACKEND = ("application.yaml", "datasource/", "table/", "action/", "page/", "menu/", "layout/",
           "lib/", "api/", "form/", "view/", "policy/")


def git(*args):
    return subprocess.run(["git", *args], check=True, capture_output=True, text=True).stdout


def lines(ref, path):
    return len(git("show", f"{ref}:{path}").splitlines())


def stats(ref="HEAD"):
    files = git("ls-tree", "-r", "--name-only", ref).splitlines()
    backend = [f for f in files if f.startswith(BACKEND) and f.endswith((".yaml", ".rhai"))]
    web = [f for f in files if re.match(r"web/[^/]+/(src/|index\.html$)", f)]
    generated = [f for f in web if f.endswith(".gen.ts")]
    frontend = [f for f in web if f not in generated and f.endswith((".ts", ".tsx", ".css", ".html"))]
    scenarios = [f for f in files if re.match(r"tests/scenarios/.+\.ya?ml$", f)]
    steps = sum(len(re.findall(r"^\s*- step:", git("show", f"{ref}:{f}"), re.M)) for f in scenarios)
    kind = lambda d: sum(1 for f in backend if f.startswith(d))
    # Odoo's own tables the app reads or writes: `table:` and the names its SQL selects from.
    odoo = set()
    for f in (f for f in backend if f.startswith("table/")):
        text = git("show", f"{ref}:{f}")
        if not re.search(r"^datasource:\s*odoo(_auth)?\s*$", text, re.M):
            continue
        odoo.update(re.findall(r"^table:\s*([a-z_]+)", text, re.M))
        odoo.update(re.findall(r'from\("([a-z_]+)"\)', text))
        odoo.update(re.findall(r"\b(?:FROM|JOIN)\s+([a-z_]+)\b(?!\s*\()", text))
    return {
        "backend_lines": sum(lines(ref, f) for f in backend),
        "tables": kind("table/"), "pages": kind("page/"), "actions": kind("action/"),
        "frontend_lines": sum(lines(ref, f) for f in frontend),
        "frontend_files": len(frontend),
        "generated_lines": sum(lines(ref, f) for f in generated),
        "scenario_steps": steps,
        "odoo_tables": sorted(odoo),
    }


if __name__ == "__main__":
    print(json.dumps(stats(sys.argv[1] if len(sys.argv) > 1 else "HEAD"), indent=2))
