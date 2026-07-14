#!/usr/bin/env python3
"""Functional smoke test for a running Linker instance: create a short
link, confirm it shows up in the listing, and confirm it redirects to the
right destination.

Meant to run against the ephemeral "green" instance during a blue/green
deploy, before traffic is switched over — but works against any running
instance (local, staging, production) via --base-url.

Usage:
    python3 scripts/test_requests.py --base-url http://localhost:3000
    python3 scripts/test_requests.py --base-url https://green.internal:3000

Exit code 0 if every check passes, 1 otherwise. Requires only the Python
standard library (no pip install).
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from urllib.parse import urljoin


@dataclass
class Result:
    name: str
    ok: bool
    detail: str = ""


@dataclass
class Client:
    base_url: str
    timeout: float
    results: list[Result] = field(default_factory=list)

    def request(
        self, method: str, path: str, body: dict | None = None, follow_redirects: bool = True
    ):
        url = urljoin(self.base_url, path)
        data = json.dumps(body).encode("utf-8") if body is not None else None
        headers = {"Content-Type": "application/json"} if data else {}
        req = urllib.request.Request(url, data=data, headers=headers, method=method)

        opener = urllib.request.build_opener(
            _NoRedirect() if not follow_redirects else urllib.request.HTTPRedirectHandler()
        )
        try:
            resp = opener.open(req, timeout=self.timeout)
            status = resp.status
            resp_headers = dict(resp.headers)
            raw = resp.read()
        except urllib.error.HTTPError as e:
            status = e.code
            resp_headers = dict(e.headers or {})
            raw = e.read()
        try:
            payload = json.loads(raw) if raw else None
        except json.JSONDecodeError:
            payload = None
        return status, resp_headers, payload

    def check(self, name: str, condition: bool, detail: str = "") -> bool:
        self.results.append(Result(name, condition, detail))
        marker = "OK  " if condition else "FAIL"
        line = f"[{marker}] {name}"
        if detail:
            line += f" — {detail}"
        print(line)
        return condition


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    """Stops urllib from silently following the 302 so we can assert on it."""

    def redirect_request(self, *args, **kwargs):
        return None


def run(base_url: str, timeout: float) -> bool:
    client = Client(base_url=base_url, timeout=timeout)
    alias = f"smoke-{int(time.time() * 1000) % 1_000_000}"
    target_url = "https://example.com/smoke-test-destination"
    all_ok = True

    # 1. Crear un link
    status, _, payload = client.request(
        "POST", "/api/shorten", body={"url": target_url, "alias": alias}
    )
    all_ok &= client.check(
        "POST /api/shorten devuelve 201", status == 201, f"status={status} body={payload}"
    )
    short = (payload or {}).get("short", "")
    all_ok &= client.check(
        "la respuesta incluye el código creado", short.endswith(f"/{alias}"), f"short={short}"
    )

    # 2. Listar links
    status, _, payload = client.request("GET", "/api/links")
    all_ok &= client.check("GET /api/links devuelve 200", status == 200, f"status={status}")
    codes = [link.get("code") for link in (payload or [])]
    all_ok &= client.check(
        f"el link '{alias}' aparece en el listado", alias in codes, f"codes={codes[:5]}..."
    )

    # 3. Redirigir
    status, headers, _ = client.request("GET", f"/{alias}", follow_redirects=False)
    all_ok &= client.check(
        f"GET /{alias} redirige con 302", status == 302, f"status={status}"
    )
    location = headers.get("Location", "")
    all_ok &= client.check(
        "el redirect apunta a la URL original", location == target_url, f"Location={location}"
    )

    return all_ok


def main() -> int:
    # Avoid mangled accents/em-dashes when stdout isn't UTF-8 by default
    # (e.g. some Windows terminals) — CI runners are already UTF-8.
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--base-url",
        required=True,
        help="Instancia de Linker contra la que correr el smoke test (ej. la instancia green efímera).",
    )
    parser.add_argument(
        "--timeout", type=float, default=10.0, help="Timeout por request en segundos (default: 10)."
    )
    args = parser.parse_args()

    print(f"Smoke test funcional contra {args.base_url}\n")
    try:
        ok = run(args.base_url, args.timeout)
    except (urllib.error.URLError, TimeoutError) as e:
        print(f"\n[FAIL] No se pudo conectar a {args.base_url}: {e}")
        return 1

    print()
    if ok:
        print("Smoke test OK: crear, listar y redirigir funcionan.")
        return 0

    print("Smoke test FALLÓ — ver los [FAIL] arriba.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
