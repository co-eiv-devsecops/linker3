#!/usr/bin/env python3
"""Post-deploy gate against Grafana: queries the project's metrics through
the Grafana datasource proxy API and fails (exit 1) if any metric exceeds
its threshold during the post-switchover window.

Meant to run in the blue/green pipeline right after traffic is switched to
the green instance, so a deploy that "works" but degrades latency/errors
is rolled back automatically instead of staying in production.

Usage:
    GRAFANA_API_TOKEN=<service-account-token> \\
    python3 scripts/check_grafana.py \\
        --grafana-url https://<org>.grafana.net \\
        --datasource-uid <prometheus-datasource-uid> \\
        --window 10m --max-p95-ms 500

    # Optionally also gate on an error-rate expression (PromQL):
    GRAFANA_API_TOKEN=... python3 scripts/check_grafana.py \\
        --grafana-url ... --datasource-uid ... \\
        --error-rate-query 'sum(rate(http_errors_total[10m])) / sum(rate(http_requests_total[10m]))' \\
        --max-error-rate 0.05

The Grafana token is read ONLY from the GRAFANA_API_TOKEN environment
variable (never a CLI flag) so it can't leak into shell history or CI
logs. Default queries target the histograms the app already exports via
OpenTelemetry (redirect_duration_ms / shorten_duration_ms); override
--p95-query if your Grafana Cloud stack renames them (e.g. appending the
unit: redirect_duration_ms_milliseconds_bucket).

Fresh deployments may have no traffic yet, so "no data" is a warning by
default; use --on-no-data fail to make it blocking.

Exit code 0 if every check passes (or is skipped), 1 otherwise. Requires
only the Python standard library (no pip install).
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass

DEFAULT_P95_QUERY = (
    "histogram_quantile(0.95, sum by (le) (rate(redirect_duration_ms_bucket[{window}])))"
)


@dataclass
class CheckResult:
    name: str
    ok: bool
    detail: str


def query_datasource(
    grafana_url: str, datasource_uid: str, token: str, promql: str, timeout: float
) -> float | None:
    """Runs an instant PromQL query through the Grafana datasource proxy.

    Returns the first sample's value as float, or None if the query
    returned an empty result (no data in the window).
    """
    url = (
        f"{grafana_url.rstrip('/')}/api/datasources/proxy/uid/{datasource_uid}"
        f"/api/v1/query?{urllib.parse.urlencode({'query': promql})}"
    )
    request = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
        },
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        payload = json.loads(response.read().decode("utf-8"))

    if payload.get("status") != "success":
        raise RuntimeError(f"Grafana/Prometheus devolvió status={payload.get('status')!r}")

    results = payload.get("data", {}).get("result", [])
    if not results:
        return None

    value = results[0]["value"][1]  # [timestamp, "value"]
    if value == "NaN":
        return None
    return float(value)


def run_check(
    name: str,
    promql: str,
    threshold: float,
    unit: str,
    args: argparse.Namespace,
    token: str,
) -> CheckResult:
    try:
        value = query_datasource(
            args.grafana_url, args.datasource_uid, token, promql, args.timeout
        )
    except urllib.error.HTTPError as exc:
        return CheckResult(name, False, f"HTTP {exc.code} consultando Grafana: {exc.reason}")
    except (urllib.error.URLError, RuntimeError, TimeoutError, ValueError, KeyError) as exc:
        return CheckResult(name, False, f"error consultando Grafana: {exc}")

    if value is None:
        ok = args.on_no_data != "fail"
        return CheckResult(
            name,
            ok,
            "sin datos en la ventana (¿instancia recién desplegada sin tráfico?)"
            + ("" if ok else " — bloqueante por --on-no-data fail"),
        )

    if value <= threshold:
        return CheckResult(name, True, f"{value:.3f}{unit} <= umbral {threshold:.3f}{unit}")
    return CheckResult(name, False, f"{value:.3f}{unit} SUPERA el umbral {threshold:.3f}{unit}")


def main() -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument(
        "--grafana-url",
        default=os.environ.get("GRAFANA_URL", ""),
        help="URL base de la instancia de Grafana (o env GRAFANA_URL).",
    )
    parser.add_argument(
        "--datasource-uid",
        default=os.environ.get("GRAFANA_DATASOURCE_UID", ""),
        help="UID del datasource Prometheus/Mimir en Grafana (o env GRAFANA_DATASOURCE_UID).",
    )
    parser.add_argument(
        "--window",
        default="10m",
        help="Ventana post-despliegue a evaluar en las queries (default: 10m).",
    )
    parser.add_argument(
        "--p95-query",
        default=DEFAULT_P95_QUERY,
        help="PromQL para la latencia p95; admite el placeholder {window}.",
    )
    parser.add_argument(
        "--max-p95-ms",
        type=float,
        default=500.0,
        help="Umbral de latencia p95 en ms (default: 500).",
    )
    parser.add_argument(
        "--error-rate-query",
        default="",
        help="PromQL opcional para error rate (0..1); admite {window}. Vacío = no se evalúa.",
    )
    parser.add_argument(
        "--max-error-rate",
        type=float,
        default=0.05,
        help="Umbral de error rate como fracción (default: 0.05 = 5%%).",
    )
    parser.add_argument(
        "--on-no-data",
        choices=("warn", "fail"),
        default="warn",
        help="Qué hacer si la query no devuelve datos (default: warn).",
    )
    parser.add_argument(
        "--timeout", type=float, default=30.0, help="Timeout por request a Grafana (s)."
    )
    args = parser.parse_args()

    token = os.environ.get("GRAFANA_API_TOKEN", "")
    missing = [
        name
        for name, value in (
            ("--grafana-url / GRAFANA_URL", args.grafana_url),
            ("--datasource-uid / GRAFANA_DATASOURCE_UID", args.datasource_uid),
            ("env GRAFANA_API_TOKEN", token),
        )
        if not value
    ]
    if missing:
        print(f"ERROR: falta configuración requerida: {', '.join(missing)}", file=sys.stderr)
        return 1

    checks = [
        (
            f"latencia p95 (ventana {args.window})",
            args.p95_query.format(window=args.window),
            args.max_p95_ms,
            "ms",
        )
    ]
    if args.error_rate_query:
        checks.append(
            (
                f"error rate (ventana {args.window})",
                args.error_rate_query.format(window=args.window),
                args.max_error_rate,
                "",
            )
        )

    print(f"Gate de Grafana contra {args.grafana_url} (datasource {args.datasource_uid})")
    results = [run_check(name, promql, threshold, unit, args, token) for name, promql, threshold, unit in checks]

    print()
    for result in results:
        status = "OK  " if result.ok else "FAIL"
        print(f"  [{status}] {result.name}: {result.detail}")

    if all(result.ok for result in results):
        print("\nMétricas post-despliegue dentro de los umbrales. Gate aprobado.")
        return 0
    print("\nGate de Grafana FALLIDO: hay métricas fuera de umbral.", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
