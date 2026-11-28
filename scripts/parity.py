"""How far nodo's To-do is from Odoo's, per section of docs/todo.md's feature inventory: how many
features are done, and how much code each side spends on them. Writes docs/parity.md and
web/team/src/parity.ts (the About screen's table); never edit those by hand.

    python3 -I scripts/parity.py                 # write both files
    python3 -I scripts/parity.py --check         # CI: fail when they are stale or the inputs are wrong
    python3 -I scripts/parity.py --measure-odoo  # re-count Odoo's files in the odoo-web container

Inputs: docs/todo.md (the status column), docs/parity-map.yaml (which files serve which section)
and docs/parity-odoo.json (Odoo's line counts). nodo's lines are counted from the checkout.
"""

import datetime
import difflib
import json
import os
import re
import subprocess
import sys

import yaml

sys.path.insert(0, os.path.dirname(__file__))
from stats import BACKEND  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TODO = os.path.join(ROOT, "docs", "todo.md")
MAP = os.path.join(ROOT, "docs", "parity-map.yaml")
ODOO_MAP = os.path.join(ROOT, "docs", "parity-odoo-map.yaml")
ODOO = os.path.join(ROOT, "docs", "parity-odoo.json")
OUT_MD = os.path.join(ROOT, "docs", "parity.md")
OUT_TS = os.path.join(ROOT, "web", "team", "src", "parity.ts")

ODOO_CONTAINER = "odoo-web"
ODOO_ADDONS = "/usr/lib/python3/dist-packages/odoo/addons"
STATUSES = ("done", "partly", "not yet", "won't")
SIDES = ("backend", "frontend")


def fail(errors):
    for e in errors:
        print(f"parity: {e}", file=sys.stderr)
    sys.exit(1)


def git_files():
    out = subprocess.run(["git", "ls-files"], cwd=ROOT, check=True, capture_output=True, text=True).stdout
    return out.splitlines()


def nodo_sources():
    """The files scripts/stats.py counts as nodo's backend and frontend."""
    files = git_files()
    backend = [f for f in files if f.startswith(BACKEND) and f.endswith((".yaml", ".rhai"))]
    frontend = [f for f in files if re.match(r"web/[^/]+/(src/|index\.html$)", f)
                and not f.endswith(".gen.ts") and f.endswith((".ts", ".tsx", ".css", ".html"))]
    return backend + frontend


def statuses(errors):
    """Feature counts per status, for each `###` section under "## Feature inventory"."""
    counts, section, inside = {}, None, False
    with open(TODO) as f:
        for n, line in enumerate(f, 1):
            if line.startswith("## "):
                inside = line.strip() == "## Feature inventory"
                section = None
            elif inside and line.startswith("### "):
                section = line[4:].strip()
            elif inside and section and line.startswith("|"):
                cells = [c.strip() for c in line.strip().strip("|").split("|")]
                if cells[0] == "feature" or set(cells[0]) <= {"-"}:
                    continue
                status = next((s for s in STATUSES if cells[-1].startswith(s)), None)
                if status is None:
                    errors.append(f"docs/todo.md:{n}: status {cells[-1]!r} is not one of {', '.join(STATUSES)}")
                    continue
                counts.setdefault(section, dict.fromkeys(STATUSES, 0))[status] += 1
    return counts


def nodo_lines(path):
    with open(os.path.join(ROOT, path)) as f:
        return len(f.read().splitlines())


def measure(entries, count):
    """Lines per side, and the per-file breakdown, for one section's entries."""
    total, files = {}, []
    for side in SIDES:
        sum_ = 0.0
        for e in entries.get(side) or []:
            share = float(e.get("share", 1))
            lines = count(e["file"])
            sum_ += share * lines
            files.append({"side": side, "file": e["file"], "share": share, "lines": lines,
                          "why": e.get("why", "")})
        total[side] = round(sum_)
    return total, files


def load_map(errors):
    """docs/parity-map.yaml with each section's Odoo files from docs/parity-odoo-map.yaml."""
    with open(MAP) as f:
        spec = yaml.safe_load(f)
    with open(ODOO_MAP) as f:
        odoo = yaml.safe_load(f)
    if list(odoo) != list(spec["sections"]):
        errors.append(f"sections differ: parity-odoo-map.yaml has {list(odoo)}, "
                      f"parity-map.yaml has {list(spec['sections'])}")
    for name, g in spec["sections"].items():
        g["odoo"] = odoo.get(name) or {}
    return spec


def build():
    errors = []
    spec = load_map(errors)
    with open(ODOO) as f:
        odoo = json.load(f)
    counts = statuses(errors)

    mapped = list(spec["sections"])
    if mapped != list(counts):
        errors.append(f"sections differ: docs/todo.md has {list(counts)}, parity-map.yaml has {mapped}")

    # Every nodo source file is in a section, shared, or listed as not To-do; its shares add to 1.
    shares, odoo_shares = {}, {}
    groups = [*spec["sections"].values(), spec["shared"]]
    for g in groups:
        for side in SIDES:
            for e in (g.get("nodo") or {}).get(side) or []:
                shares[e["file"]] = shares.get(e["file"], 0) + float(e.get("share", 1))
            for e in (g.get("odoo") or {}).get(side) or []:
                odoo_shares[e["file"]] = odoo_shares.get(e["file"], 0) + float(e.get("share", 1))
    sources = set(nodo_sources())
    for f in sorted(sources - set(shares) - set(spec["not_todo"])):
        errors.append(f"{f} is in no section of docs/parity-map.yaml (or under not_todo)")
    for f, s in sorted(shares.items()):
        if f not in sources:
            errors.append(f"docs/parity-map.yaml lists {f}, which is not a nodo source file")
        elif abs(s - 1) > 0.02:
            errors.append(f"{f}: nodo shares add up to {s:.2f}, not 1")
    for f, s in sorted(odoo_shares.items()):
        if s > 1.001:
            errors.append(f"{f}: Odoo shares add up to {s:.2f}, more than the whole file")
        if f not in odoo["lines"]:
            errors.append(f"{f} has no line count in docs/parity-odoo.json; run --measure-odoo")
    if errors:
        fail(errors)

    def section(name, g, c):
        row = {"name": name}
        if c is not None:
            scored = c["done"] + c["partly"] + c["not yet"]
            row.update(features=sum(c.values()), done=c["done"], partly=c["partly"],
                       notYet=c["not yet"], wont=c["won't"],
                       complete=round(100 * (c["done"] + c["partly"] / 2) / scored) if scored else 0)
        row["odoo"], row["odooFiles"] = measure(g.get("odoo") or {}, lambda p: odoo["lines"][p])
        # Of Odoo's lines, those in mail and mail_tracking, which every Odoo app shares.
        row["odooMail"] = round(sum(f["share"] * f["lines"] for f in row["odooFiles"]
                                    if f["file"].startswith("mail")))
        row["nodo"], row["nodoFiles"] = measure(g.get("nodo") or {}, nodo_lines)
        return row

    sections = [section(n, g, counts[n]) for n, g in spec["sections"].items()]
    shared = section("Shared", spec["shared"], None)
    allc = {s: sum(counts[n][s] for n in counts) for s in STATUSES}
    total = section("All", {}, allc)
    for side in SIDES:
        for who in ("odoo", "nodo"):
            total[who][side] = sum(r[who][side] for r in sections) + shared[who][side]
    total["odooMail"] = sum(r["odooMail"] for r in sections) + shared["odooMail"]
    return {"odooImage": odoo["image"], "odooMeasuredOn": odoo["measured_on"],
            "sections": sections, "shared": shared, "total": total}


def fmt(n):
    return f"{n:,}"


def markdown(p):
    out = [
        "# To-do: parity with Odoo",
        "",
        "Written by `scripts/parity.py` from [todo.md](todo.md) and [parity-map.yaml](parity-map.yaml);",
        "don't edit by hand.",
        "",
        "**Complete** counts a feature as 1 when done, ½ when partly done and 0 when not yet; features",
        "nodo won't build are left out. **Lines** are every line of the files that serve a section;",
        "a file serving several sections is split by an estimated share. Odoo's side is the app code",
        "To-do uses (the project_todo addon and the parts of project and mail it relies on), counted",
        f"on {p['odooMeasuredOn']} in `{p['odooImage']}`. Neither side counts its framework (Odoo's ORM",
        "and web client; Vantage).",
        "",
        "**Of it, mail** is the part of Odoo's lines in the mail and mail_tracking addons, which every",
        "Odoo app shares (chatter, followers, activities); To-do gets them without code of its own.",
        "",
        "| Section | Features | Done | Partly | Not yet | Won't | Complete | Odoo backend | Odoo frontend | of it, mail | nodo backend | nodo frontend |",
        "|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|",
    ]
    def row(r, bold=False):
        b = "**" if bold else ""
        cells = [r["name"]]
        if "features" in r:
            cells += [str(r["features"]), str(r["done"]), str(r["partly"]), str(r["notYet"]),
                      str(r["wont"]), f"{r['complete']}%"]
        else:
            cells += [""] * 6
        cells += [fmt(r["odoo"]["backend"]), fmt(r["odoo"]["frontend"]), fmt(r["odooMail"]),
                  fmt(r["nodo"]["backend"]), fmt(r["nodo"]["frontend"])]
        return "| " + " | ".join(f"{b}{c}{b}" if c else "" for c in cells) + " |"
    out += [row(r) for r in p["sections"]]
    out += [row(p["shared"]), row(p["total"], bold=True), "", "## Files per section", ""]
    for r in [*p["sections"], p["shared"]]:
        out += [f"### {r['name']}", ""]
        for who, label in (("odooFiles", "Odoo"), ("nodoFiles", "nodo")):
            if not r[who]:
                continue
            out += [f"| {label} | side | share | lines | counted |", "|---|---|--:|--:|--:|"]
            for f in r[who]:
                why = f" ({f['why']})" if f["why"] else ""
                out.append(f"| `{f['file']}`{why} | {f['side']} | {f['share']:g} | {fmt(f['lines'])} "
                           f"| {fmt(round(f['share'] * f['lines']))} |")
            out.append("")
    return "\n".join(out)


def typescript(p):
    strip = lambda r: {k: v for k, v in r.items() if not k.endswith("Files")}
    data = {"odooImage": p["odooImage"], "odooMeasuredOn": p["odooMeasuredOn"],
            "sections": [strip(r) for r in p["sections"]], "shared": strip(p["shared"]),
            "total": strip(p["total"])}
    body = json.dumps(data, indent=2, ensure_ascii=False)
    return ("// Written by scripts/parity.py from docs/todo.md and docs/parity-map.yaml; never edit by hand.\n\n"
            f"export const PARITY = {body} as const;\n")


def measure_odoo():
    errors = []
    spec = load_map(errors)
    if errors:
        fail(errors)
    files = sorted({e["file"] for g in [*spec["sections"].values(), spec["shared"]]
                    for side in SIDES for e in (g.get("odoo") or {}).get(side) or []})
    script = 'cd "$1" && shift && for f in "$@"; do printf "%s\\t%s\\n" "$(wc -l < "$f")" "$f"; done'
    out = subprocess.run(["docker", "exec", ODOO_CONTAINER, "sh", "-c", script, "sh", ODOO_ADDONS, *files],
                         check=True, capture_output=True, text=True).stdout
    lines = {f: int(n) for n, f in (l.split("\t") for l in out.splitlines())}
    image = subprocess.run(["docker", "inspect", "-f", "{{.Config.Image}}", ODOO_CONTAINER],
                           check=True, capture_output=True, text=True).stdout.strip()
    with open(ODOO, "w") as f:
        json.dump({"image": image, "measured_on": datetime.date.today().isoformat(), "lines": lines},
                  f, indent=2)
        f.write("\n")
    print(f"measured {len(lines)} Odoo files into {os.path.relpath(ODOO, ROOT)}")


def main():
    if "--measure-odoo" in sys.argv:
        measure_odoo()
        return
    p = build()
    want = {OUT_MD: markdown(p) + "\n", OUT_TS: typescript(p)}
    if "--check" in sys.argv:
        stale = []
        for path, text in want.items():
            try:
                with open(path) as f:
                    have = f.read()
            except FileNotFoundError:
                have = None
            if have != text:
                rel = os.path.relpath(path, ROOT)
                diff = difflib.unified_diff((have or "").splitlines(), text.splitlines(), rel, "expected", lineterm="", n=0)
                print("\n".join(list(diff)[:40]), file=sys.stderr)
                stale.append(f"{rel} is stale; run python3 -I scripts/parity.py")
        if stale:
            fail(stale)
        print("parity: up to date")
        return
    for path, text in want.items():
        with open(path, "w") as f:
            f.write(text)
        print(f"wrote {os.path.relpath(path, ROOT)}")


if __name__ == "__main__":
    main()
