#!/usr/bin/env python3
"""Staged load test against a running Linker instance: ramps up
concurrency in stages (doubling by default) until it finds the point
where the instance starts failing or slowing down beyond the given
thresholds — the "breaking point".

Meant to run against the ephemeral "green" instance during a blue/green
deploy (optional, heavier check than test_requests.py), but works against
any running instance via --base-url. Hits POST /api/shorten by default,
since writes (SQLite) are the most likely path to degrade first.

Usage:
    python3 scripts/load_test.py --base-url http://localhost:3000
    python3 scripts/load_test.py --base-url https://green.internal:3000 \\
        --start-concurrency 4 --max-concurrency 128 --requests-per-stage 50

    # Fail the pipeline if the instance can't sustain at least 32
    # concurrent requests without breaking:
    python3 scripts/load_test.py --base-url https://green.internal:3000 \\
        --min-concurrency-required 32

By default this script is a *diagnostic*: it always exits 0 once it
finishes scanning the stages (whether or not it found a breaking point in
range), matching how it's meant to be used against a blue/green
environment ("opcionalmente" per the task) — it reports numbers, it
doesn't gate the deploy unless you opt in with --min-concurrency-required.

Requires only the Python standard library (no pip install).
"""

from __future__ import annotations

import argparse
import json
import statistics
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from urllib.parse import urljoin


@dataclass
class StageResult:
    concurrency: int
    total: int
    errors: int
    latencies_ms: list[float]

    @property
    def error_rate(self) -> float:
        return self.errors / self.total if self.total else 1.0

    @property
    def p50_ms(self) -> float:
        return statistics.median(self.latencies_ms) if self.latencies_ms else float("inf")

    @property
    def p95_ms(self) -> float:
        if not self.latencies_ms:
            return float("inf")
        ordered = sorted(self.latencies_ms)
        idx = min(len(ordered) - 1, int(len(ordered) * 0.95))
        return ordered[idx]


def one_request(base_url: str, timeout: float) -> tuple[bool, float]:
    """POSTs one unique /api/shorten request. Returns (ok, latency_ms)."""
    url = urljoin(base_url, "/api/shorten")
    payload = json.dumps(
        {"url": f"https://example.com/load-test/{time.time_ns()}"}
    ).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    start = time.monotonic()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            ok = resp.status == 201
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError):
        ok = False
    return ok, (time.monotonic() - start) * 1000


def run_stage(base_url: str, concurrency: int, requests: int, timeout: float) -> StageResult:
    oks = 0
    errors = 0
    latencies: list[float] = []
    with ThreadPoolExecutor(max_workers=concurrency) as pool:
        futures = [pool.submit(one_request, base_url, timeout) for _ in range(requests)]
        for future in futures:
            ok, latency_ms = future.result()
            latencies.append(latency_ms)
            if ok:
                oks += 1
            else:
                errors += 1
    return StageResult(concurrency=concurrency, total=oks + errors, errors=errors, latencies_ms=latencies)


def main() -> int:
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")

    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--base-url", required=True, help="Instancia de Linker a probar.")
    parser.add_argument("--start-concurrency", type=int, default=2)
    parser.add_argument("--max-concurrency", type=int, default=64)
    parser.add_argument(
        "--requests-per-stage", type=int, default=30, help="Requests disparados en cada etapa."
    )
    parser.add_argument(
        "--error-rate-threshold",
        type=float,
        default=0.10,
        help="Tasa de error (0-1) que marca el punto de quiebre (default: 0.10 = 10%%).",
    )
    parser.add_argument(
        "--p95-threshold-ms",
        type=float,
        default=2000.0,
        help="Latencia p95 (ms) que marca el punto de quiebre (default: 2000).",
    )
    parser.add_argument("--timeout", type=float, default=10.0, help="Timeout por request (s).")
    parser.add_argument(
        "--min-concurrency-required",
        type=int,
        default=None,
        help="Si se da, el script sale con código 1 si el punto de quiebre aparece "
        "antes de alcanzar esta concurrencia (gate opcional para CI).",
    )
    args = parser.parse_args()

    print(f"Prueba de carga escalonada contra {args.base_url}")
    print(
        f"(concurrencia {args.start_concurrency} -> {args.max_concurrency}, "
        f"{args.requests_per_stage} requests/etapa, "
        f"umbrales: {args.error_rate_threshold:.0%} error / {args.p95_threshold_ms:.0f}ms p95)\n"
    )

    concurrency = args.start_concurrency
    breaking_point: int | None = None
    last_healthy: int | None = None

    while concurrency <= args.max_concurrency:
        result = run_stage(args.base_url, concurrency, args.requests_per_stage, args.timeout)
        status = "OK" if (
            result.error_rate <= args.error_rate_threshold
            and result.p95_ms <= args.p95_threshold_ms
        ) else "QUIEBRE"

        print(
            f"[{status:7}] concurrencia={concurrency:4} "
            f"errores={result.errors}/{result.total} ({result.error_rate:.0%}) "
            f"p50={result.p50_ms:.0f}ms p95={result.p95_ms:.0f}ms"
        )

        if status == "QUIEBRE":
            breaking_point = concurrency
            break

        last_healthy = concurrency
        concurrency *= 2

    print()
    if breaking_point is not None:
        print(f"Punto de quiebre encontrado en concurrencia={breaking_point}.")
        if last_healthy is not None:
            print(f"Última etapa sana: concurrencia={last_healthy}.")
    else:
        print(
            f"No se encontró punto de quiebre hasta concurrencia={args.max_concurrency} "
            "(subí --max-concurrency para seguir buscando)."
        )

    if args.min_concurrency_required is not None:
        required = args.min_concurrency_required
        if breaking_point is not None and breaking_point < required:
            print(
                f"\nFALLA: se requería aguantar >= {required} de concurrencia "
                f"y el quiebre apareció antes, en {breaking_point}."
            )
            return 1
        if breaking_point is None and args.max_concurrency < required:
            print(
                f"\nFALLA: se requería confirmar >= {required} de concurrencia, pero "
                f"solo se probó hasta {args.max_concurrency} (subí --max-concurrency "
                "para poder confirmarlo)."
            )
            return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
