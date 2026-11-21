"""The PR's summary comment: each check's result and what it found, and how the PR changes the
amount of code. Run by checks.yaml's `summary` job; prints Markdown.

    python3 -I scripts/ci_report.py --jobs JSON --base SHA [--junit FILE] [--web FILE]
        [--stories FILE] [--visual FILE] [--run URL]

--jobs is toJSON(needs); --junit the scenario run's JUnit report; --web the web build's asset
list (`<name> <bytes>` per line); --stories and --visual the UI gallery's JUnit reports (the
stories run by Vitest, the snapshots compared by Playwright).
"""

import argparse
import json
import os
import sys
import xml.etree.ElementTree as ET

sys.path.insert(0, os.path.dirname(__file__))
from stats import stats  # noqa: E402

MARKER = "<!-- nodo-ci-report -->"
ICON = {"success": "✅", "failure": "❌", "cancelled": "⏹️", "skipped": "➖"}


def junit(path, what="passed", name=lambda c: f"{c.get('classname')} › {c.get('name')}"):
    """A JUnit report as "12 passed, 1 failed" and the first failures."""
    if not path or not os.path.exists(path):
        return "no report"
    cases = ET.parse(path).getroot().iter("testcase")
    passed = failed = skipped = 0
    failures = []
    for c in cases:
        if c.find("skipped") is not None:
            skipped += 1
        elif c.find("failure") is not None or c.find("error") is not None:
            failed += 1
            failures.append(name(c))
        else:
            passed += 1
    text = f"{passed} {what}" + (f", {failed} failed" if failed else "") + (f", {skipped} skipped" if skipped else "")
    return text + "".join(f"<br>❌ {f}" for f in failures[:5])


def gallery(stories, visual):
    """The UI gallery: stories run as tests (interactions, axe), then their snapshots."""
    return (f"stories: {junit(stories, 'pass interactions and axe', lambda c: c.get('name'))}"
            f"<br>snapshots at 375 / 768 / 1280 px: {junit(visual, 'match', lambda c: c.get('name'))}")


def web(path):
    if not path or not os.path.exists(path):
        return "no build"
    sizes = {}
    for line in open(path):
        name, size = line.rsplit(" ", 1)
        ext = name.rsplit(".", 1)[-1]
        sizes[ext] = sizes.get(ext, 0) + int(size)
    return " · ".join(f"{sizes[e] / 1000:.1f} kB {e.upper()}" for e in ("js", "css") if e in sizes)


def change(new, old):
    d = new - old
    return "—" if d == 0 else f"{d:+,}"


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--jobs", required=True)
    p.add_argument("--base", required=True)
    p.add_argument("--junit")
    p.add_argument("--web")
    p.add_argument("--stories")
    p.add_argument("--visual")
    p.add_argument("--run", default="")
    a = p.parse_args()

    jobs = {k: v["result"] for k, v in json.loads(a.jobs).items()}
    bad = [k for k, r in jobs.items() if r not in ("success", "skipped")]
    head, base = stats("HEAD"), stats(a.base)

    rows = [
        ("Workflows and seed scripts", jobs.get("workflows"), "actionlint, shellcheck"),
        ("Scenario tests", jobs.get("scenarios"), junit(a.junit)),
        ("Web build", jobs.get("web"), web(a.web)),
        ("UI gallery", jobs.get("gallery"), gallery(a.stories, a.visual)),
    ]
    code = [
        ("Backend: Vantage YAML and Rhai", "backend_lines",
         f"{head['tables']} tables · {head['pages']} pages · {head['actions']} actions"),
        ("Frontend: React and TypeScript", "frontend_lines", f"{head['frontend_files']} files, written by hand"),
        ("Generated client", "generated_lines", "from the API's schema, never edited"),
        ("Scenario steps", "scenario_steps", "tests/scenarios"),
    ]

    title = "✨ all green" if not bad else f"❌ {len(bad)} failing: {', '.join(bad)}"
    out = [MARKER, f"### {title}", "", "| check | result | |", "|---|:-:|---|"]
    out += [f"| {n} | {ICON.get(r, '❔')} | {d} |" for n, r, d in rows]
    out += ["", "| code | now | this PR | |", "|---|--:|--:|---|"]
    out += [f"| {n} | {head[k]:,} | {change(head[k], base[k])} | {d} |" for n, k, d in code]
    sha = os.environ.get("HEAD_SHA", "")[:8]
    out += ["", f"<sub>{sha} · [run]({a.run}) · compared with {a.base[:8]}</sub>"]
    print("\n".join(out))


if __name__ == "__main__":
    main()
