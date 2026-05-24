#!/usr/bin/env python3
"""
generate_project_context.py
Scans the repository and rewrites the AUTO-GENERATED sections inside
PROJECT_CONTEXT.md without touching any manually written content.

Usage:
    python scripts/generate_project_context.py          # from repo root
    npm run context:update                              # via npm script
"""

import os
import re
import sys
import json
from pathlib import Path
from datetime import date

# ──────────────────────────────────────────────────────────────────────────────
# Configuration
# ──────────────────────────────────────────────────────────────────────────────

REPO_ROOT = Path(__file__).resolve().parent.parent
CONTEXT_FILE = REPO_ROOT / "PROJECT_CONTEXT.md"

IGNORE_DIRS = {
    "node_modules", ".next", "dist", "build", ".git",
    "__pycache__", ".venv", "venv", ".pytest_cache",
    "coverage", ".mypy_cache", ".ruff_cache",
}

BACKEND_ROOT = REPO_ROOT / "pepper-farm" / "backend"
FRONTEND_ROOT = REPO_ROOT / "pepper-farm" / "frontend"


# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────

def walk_files(root: Path, extensions: tuple) -> list[Path]:
    """Recursively yield files with given extensions, skipping ignored dirs."""
    results = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in IGNORE_DIRS]
        for fname in filenames:
            if fname.endswith(extensions):
                results.append(Path(dirpath) / fname)
    return results


def rel(path: Path) -> str:
    """Return path relative to repo root using forward slashes."""
    return path.relative_to(REPO_ROOT).as_posix()


def md_table(headers: list[str], rows: list[list[str]]) -> str:
    """Render a Markdown table."""
    sep = "|".join("---" for _ in headers)
    header_row = "| " + " | ".join(headers) + " |"
    sep_row = "|" + sep + "|"
    data_rows = ["| " + " | ".join(str(c) for c in row) + " |" for row in rows]
    return "\n".join([header_row, sep_row] + data_rows)


# ──────────────────────────────────────────────────────────────────────────────
# Section generators
# ──────────────────────────────────────────────────────────────────────────────

def generate_endpoints() -> str:
    """Scan backend routers for FastAPI endpoint decorators."""
    decorator_re = re.compile(
        r'@(?:router|app)\.(get|post|put|patch|delete)\s*\(\s*["\']([^"\']*)["\']',
        re.IGNORECASE,
    )
    prefix_re = re.compile(
        r'router\s*=\s*APIRouter\s*\([^)]*prefix\s*=\s*["\']([^"\']+)["\']',
        re.IGNORECASE,
    )

    rows: list[list[str]] = []
    router_dir = BACKEND_ROOT / "routers"
    main_py = BACKEND_ROOT / "main.py"

    files_to_scan = []
    if router_dir.exists():
        files_to_scan = sorted(walk_files(router_dir, (".py",)))
    if main_py.exists():
        files_to_scan.append(main_py)

    for fpath in files_to_scan:
        text = fpath.read_text(encoding="utf-8", errors="ignore")
        prefix_match = prefix_re.search(text)
        prefix = prefix_match.group(1).rstrip("/") if prefix_match else ""

        for m in decorator_re.finditer(text):
            method = m.group(1).upper()
            path_suffix = m.group(2)
            full_path = prefix + path_suffix if path_suffix else prefix
            rows.append([method, f"`{full_path}`", f"`{rel(fpath)}`", ""])

    # Sort by path then method
    rows.sort(key=lambda r: (r[1], r[0]))
    return md_table(
        ["Method", "Path", "Router File", "Purpose"],
        rows,
    )


def generate_models() -> str:
    """Scan backend models directory for SQLAlchemy model classes."""
    class_re = re.compile(r'^class\s+(\w+)\s*\(.*Base.*\)', re.MULTILINE)
    tablename_re = re.compile(r'__tablename__\s*=\s*["\']([^"\']+)["\']')

    rows: list[list[str]] = []
    models_dir = BACKEND_ROOT / "models"
    if not models_dir.exists():
        return "_No models directory found._"

    for fpath in sorted(walk_files(models_dir, (".py",))):
        text = fpath.read_text(encoding="utf-8", errors="ignore")
        classes = class_re.findall(text)
        tablenames = tablename_re.findall(text)

        for i, cls in enumerate(classes):
            table = tablenames[i] if i < len(tablenames) else "?"
            rows.append([f"`{cls}`", f"`{table}`", f"`{rel(fpath)}`", "", ""])

    return md_table(
        ["Model", "Table", "File", "Key Fields", "Relationships"],
        rows,
    )


def generate_envvars() -> str:
    """Scan backend and frontend for os.getenv / process.env references."""
    py_re = re.compile(r'os\.(?:getenv|environ\.get)\s*\(\s*["\']([A-Z_][A-Z0-9_]*)["\']')
    js_re = re.compile(r'process\.env\.([A-Z_][A-Z0-9_]+)')
    next_re = re.compile(r'NEXT_PUBLIC_[A-Z_0-9]+')

    found: dict[str, set[str]] = {}

    def _add(var: str, fpath: Path):
        found.setdefault(var, set()).add(rel(fpath))

    for fpath in walk_files(BACKEND_ROOT, (".py",)):
        text = fpath.read_text(encoding="utf-8", errors="ignore")
        for m in py_re.finditer(text):
            _add(m.group(1), fpath)

    for fpath in walk_files(FRONTEND_ROOT, (".ts", ".tsx", ".js", ".mjs")):
        text = fpath.read_text(encoding="utf-8", errors="ignore")
        for m in js_re.finditer(text):
            _add(m.group(1), fpath)
        for m in next_re.finditer(text):
            _add(m.group(0), fpath)

    rows = []
    for var in sorted(found):
        files = ", ".join(sorted(found[var])[:3])  # cap at 3 files shown
        rows.append([f"`{var}`", files, ""])

    return md_table(["Variable", "Used In (sample)", "Purpose"], rows)


def generate_frontend_routes() -> str:
    """Detect Next.js App Router pages from src/app directory."""
    app_dir = FRONTEND_ROOT / "src" / "app"
    if not app_dir.exists():
        return "_Frontend app directory not found._"

    rows = []
    for fpath in sorted(walk_files(app_dir, (".tsx", ".ts", ".jsx", ".js"))):
        if fpath.name not in ("page.tsx", "page.ts", "page.jsx", "page.js"):
            continue
        try:
            route_parts = fpath.relative_to(app_dir).parent.parts
        except ValueError:
            continue
        route = "/" + "/".join(route_parts) if route_parts else "/"
        rows.append([route, f"`{rel(fpath)}`", "", "", ""])

    return md_table(
        ["Route", "File", "Purpose", "Key API Calls", "Main Components"],
        rows,
    )


def generate_package_scripts() -> str:
    """Collect npm scripts from all package.json files."""
    rows = []
    for fpath in walk_files(REPO_ROOT, ("package.json",)):
        if any(p in str(fpath) for p in IGNORE_DIRS):
            continue
        try:
            data = json.loads(fpath.read_text(encoding="utf-8", errors="ignore"))
        except json.JSONDecodeError:
            continue
        scripts = data.get("scripts", {})
        for name, cmd in scripts.items():
            rows.append([f"`{name}`", f"`{rel(fpath)}`", cmd[:80]])

    return md_table(["Script", "package.json", "Command"], rows)


# ──────────────────────────────────────────────────────────────────────────────
# Section rewriter
# ──────────────────────────────────────────────────────────────────────────────

SECTION_GENERATORS = {
    "endpoints": generate_endpoints,
    "models": generate_models,
    "envvars": generate_envvars,
    "frontend-routes": generate_frontend_routes,
    "package-scripts": generate_package_scripts,
}


def rewrite_context(content: str) -> str:
    """Replace each AUTO-GENERATED block with freshly generated content."""
    for section_id, generator in SECTION_GENERATORS.items():
        start_marker = f"<!-- AUTO-GENERATED-START:{section_id} -->"
        end_marker = f"<!-- AUTO-GENERATED-END:{section_id} -->"

        if start_marker not in content:
            # Section marker doesn't exist in file; skip silently
            continue

        try:
            generated = generator()
        except Exception as exc:
            generated = f"_Generation failed: {exc}_"

        pattern = re.compile(
            re.escape(start_marker) + r".*?" + re.escape(end_marker),
            re.DOTALL,
        )
        replacement = f"{start_marker}\n{generated}\n{end_marker}"
        content = pattern.sub(replacement, content)

    # Update the "Last Updated" date line
    today = date.today().isoformat()
    content = re.sub(
        r'(\*\*Generated:\*\*\s*)[\d\-]+',
        rf'\g<1>{today}',
        content,
    )
    return content


# ──────────────────────────────────────────────────────────────────────────────
# Entry point
# ──────────────────────────────────────────────────────────────────────────────

def main():
    if not CONTEXT_FILE.exists():
        print(f"ERROR: {CONTEXT_FILE} not found. Create it first.", file=sys.stderr)
        sys.exit(1)

    original = CONTEXT_FILE.read_text(encoding="utf-8")
    updated = rewrite_context(original)

    if updated == original:
        print("PROJECT_CONTEXT.md is already up to date.")
    else:
        CONTEXT_FILE.write_text(updated, encoding="utf-8")
        print(f"Updated PROJECT_CONTEXT.md  ({CONTEXT_FILE})")

    # Report which sections were found / missing
    for section_id in SECTION_GENERATORS:
        marker = f"<!-- AUTO-GENERATED-START:{section_id} -->"
        status = "OK" if marker in updated else "MISSING (marker not in file)"
        print(f"  [{status}] {section_id}")


if __name__ == "__main__":
    main()
