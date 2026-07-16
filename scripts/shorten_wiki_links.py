#!/usr/bin/env python3
"""Finds and shortens external http(s) links in the project's documentation
using Linker's own `/api/shorten` endpoint.

Two modes:

  --check (default in CI)
      Read-only. Scans the given files (or the default doc set) for raw
      http(s) links that should be going through Linker but aren't, and
      exits non-zero if it finds any. Does not touch the network.

  (no --check)
      For every offending link found, calls `POST {base-url}/api/shorten`
      and rewrites the file in place, replacing the raw URL with the
      returned short link.

Usage:
    python3 scripts/shorten_wiki_links.py --check
    python3 scripts/shorten_wiki_links.py
    python3 scripts/shorten_wiki_links.py --base-url http://localhost:3000 docs/onboarding.md

Requires only the Python standard library (no pip install, no
requirements.txt) — consistent with the rest of the project having zero
runtime dependencies.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import urlparse

REPO_ROOT = Path(__file__).resolve().parent.parent

# Files/dirs scanned when no paths are given on the command line. Mirrors
# the scope agreed for the manual link-shortening pass: README, LAUNCHDARKLY.md,
# docs/, infra/**/README.md, and the .github/ community health files.
DEFAULT_TARGETS = [
    "README.md",
    "LAUNCHDARKLY.md",
    "docs",
    "infra",
    ".github/CONTRIBUTING.md",
    ".github/CODE_OF_CONDUCT.md",
    ".github/SECURITY.md",
    ".github/PULL_REQUEST_TEMPLATE.md",
]

DEFAULT_BASE_URL = "https://3.n-la-c.app"

URL_RE = re.compile(r"https?://[^\s\)\"'>\}]+")

# Structural exemptions: URLs inside these spans are never flagged, because
# they're literal commands/config values a reader is meant to copy-paste
# (e.g. `git clone <url>`), not "click to learn more" documentation links.
# Shortening them would actively break the example (verified by hand: a
# shortened `git clone` URL 404s, because git requests
# `<url>/info/refs?service=git-upload-pack` and Linker's router only
# matches the exact code as a whole path segment).
_MD_FENCE_RE = re.compile(r"```.*?```", re.DOTALL)
_MD_INLINE_CODE_RE = re.compile(r"`[^`\n]+`")
_TEX_LISTING_RE = re.compile(
    r"\\begin\{(?:lstlisting|verbatim)\}.*?\\end\{(?:lstlisting|verbatim)\}", re.DOTALL
)
_TEX_TEXTT_RE = re.compile(r"\\texttt\{[^}]*\}")

CODE_SPAN_PATTERNS = [_MD_FENCE_RE, _MD_INLINE_CODE_RE, _TEX_LISTING_RE, _TEX_TEXTT_RE]

# Explicit allowlist for exceptions that survive the structural rules above
# because they're syntactically indistinguishable from a real reference
# link (e.g. a live CI badge image, which is markdown link/image syntax in
# plain prose, not inside a code span). One regex per non-comment line.
ALLOWLIST_FILE = Path(__file__).with_suffix(".allowlist")


def load_allowlist() -> list[re.Pattern[str]]:
    if not ALLOWLIST_FILE.exists():
        return []
    patterns = []
    for line in ALLOWLIST_FILE.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        patterns.append(re.compile(line))
    return patterns


def strip_code_spans(text: str) -> str:
    """Blanks out (same length, so offsets don't shift) any text inside a
    code fence/inline code/LaTeX listing, so the URL scan never matches
    inside a literal command example."""
    for pattern in CODE_SPAN_PATTERNS:
        text = pattern.sub(lambda m: " " * len(m.group(0)), text)
    return text


def is_exempt(url: str, base_host: str, allowlist: list[re.Pattern[str]]) -> bool:
    host = urlparse(url).hostname or ""
    if host in ("localhost", "127.0.0.1"):
        return True
    if host == base_host:
        return True  # already a Linker short link, or a self-reference to Linker's own root
    return any(pattern.search(url) for pattern in allowlist)


def iter_target_files(paths: list[str]) -> list[Path]:
    files: list[Path] = []
    for raw in paths:
        p = (REPO_ROOT / raw).resolve()
        if p.is_dir():
            files.extend(sorted(p.rglob("*.md")) + sorted(p.rglob("*.tex")))
        elif p.suffix in (".md", ".tex"):
            files.append(p)
    # de-dupe, keep order
    seen = set()
    unique = []
    for f in files:
        if f not in seen:
            seen.add(f)
            unique.append(f)
    return unique


def find_offending_links(
    path: Path, base_host: str, allowlist: list[re.Pattern[str]]
) -> list[str]:
    text = path.read_text(encoding="utf-8")
    scannable = strip_code_spans(text)
    offenders = []
    for match in URL_RE.finditer(scannable):
        url = match.group(0)
        if not is_exempt(url, base_host, allowlist):
            offenders.append(url)
    return offenders


def display_path(path: Path) -> str:
    """Relative to the repo root when possible, absolute otherwise (e.g.
    when scanning a file outside the repo, such as in a test)."""
    try:
        return str(path.relative_to(REPO_ROOT))
    except ValueError:
        return str(path)


def shorten(base_url: str, url: str) -> str:
    payload = json.dumps({"url": url}).encode("utf-8")
    req = urllib.request.Request(
        f"{base_url}/api/shorten",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        body = json.loads(resp.read().decode("utf-8"))
    return body["short"]


def main() -> int:
    # Avoid mangled accents when stdout isn't UTF-8 by default (e.g. some
    # Windows terminals) — CI runners are already UTF-8, so this is a no-op there.
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "paths",
        nargs="*",
        default=DEFAULT_TARGETS,
        help="Files or directories to scan (default: project docs).",
    )
    parser.add_argument(
        "--base-url",
        default=DEFAULT_BASE_URL,
        help=f"Linker instance to shorten against (default: {DEFAULT_BASE_URL}).",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Read-only: report offending links and exit non-zero, without calling the network.",
    )
    args = parser.parse_args()

    base_host = urlparse(args.base_url).hostname or ""
    allowlist = load_allowlist()
    files = iter_target_files(args.paths)

    findings: dict[Path, list[str]] = {}
    for path in files:
        offenders = find_offending_links(path, base_host, allowlist)
        if offenders:
            findings[path] = offenders

    if not findings:
        print("OK: no se encontraron links externos sin acortar.")
        return 0

    total = sum(len(v) for v in findings.values())
    print(f"Se encontraron {total} link(s) externo(s) sin pasar por Linker:\n")
    for path, urls in findings.items():
        rel = display_path(path)
        for url in urls:
            print(f"  {rel}: {url}")

    if args.check:
        print(
            "\nCorre `python3 scripts/shorten_wiki_links.py` para acortarlos "
            "automáticamente, o agrega una excepción en "
            f"{display_path(ALLOWLIST_FILE)} si el link no debería acortarse."
        )
        return 1

    print(f"\nAcortando contra {args.base_url} ...")
    cache: dict[str, str] = {}
    had_errors = False
    for path, urls in findings.items():
        text = path.read_text(encoding="utf-8")
        for url in urls:
            if url not in cache:
                try:
                    cache[url] = shorten(args.base_url, url)
                except (urllib.error.URLError, KeyError, json.JSONDecodeError) as e:
                    print(f"  ERROR acortando {url}: {e}", file=sys.stderr)
                    had_errors = True
                    continue
            short = cache[url]
            text = text.replace(url, short)
            print(f"  {display_path(path)}: {url} -> {short}")
        path.write_text(text, encoding="utf-8")

    if had_errors:
        print("\nAlgunos links no se pudieron acortar; el archivo se dejó sin esos reemplazos.")
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
