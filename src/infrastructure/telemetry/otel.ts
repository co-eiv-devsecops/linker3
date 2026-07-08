/**
 * OpenTelemetry bootstrap (composition root for observability).
 *
 * Initializes a single {@link NodeSDK} that wires OTLP/HTTP exporters for
 * traces, metrics and logs, and exposes ready-to-use `tracer`, `meter` and
 * `otelLogger` handles so the rest of the codebase can instrument business
 * logic without touching SDK internals.
 *
 * Configuration is read from the environment (same deployable artifact, no
 * rebuild): the OTLP exporters honor the standard OpenTelemetry variables,
 * chiefly `OTEL_EXPORTER_OTLP_ENDPOINT` and `OTEL_EXPORTER_OTLP_PROTOCOL`.
 * See `.env.example` for the documented variables.
 *
 * @module infrastructure/telemetry/otel
 */
import { type Meter, metrics, type Tracer, trace } from "@opentelemetry/api";
import { logs, type Logger as OtelLogger } from "@opentelemetry/api-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { NodeSDK } from "@opentelemetry/sdk-node";

/**
 * Logical name reported for this service (`service.name` resource
 * attribute) in every trace, metric and log — this is what identifies
 * this deployment among others in the observability backend (e.g.
 * Grafana). Overridable via `OTEL_SERVICE_NAME` without touching source.
 */
const SERVICE_NAME = process.env.OTEL_SERVICE_NAME ?? "linker-3";

/**
 * Semantic version attached to the emitted telemetry (instrumentation scope).
 */
const SERVICE_VERSION = process.env.OTEL_SERVICE_VERSION ?? "1.0.0";

/**
 * The single SDK instance for the process. Built lazily by
 * {@link startTelemetry} so importing this module has no side effects
 * (keeps it safe to import from tests).
 */
let sdk: NodeSDK | undefined;

/**
 * Starts the OpenTelemetry Node SDK once per process.
 *
 * Idempotent: repeated calls are no-ops after the first successful start.
 * The OTLP/HTTP exporters resolve their endpoint and protocol from the
 * environment, so pointing the app at a different backend (e.g. Grafana
 * Cloud) only requires changing `OTEL_EXPORTER_OTLP_ENDPOINT` — the same
 * built artifact is redeployed unchanged.
 *
 * @returns The started {@link NodeSDK}, or the existing one if already started.
 */
export function startTelemetry(): NodeSDK {
  if (sdk) return sdk;

  sdk = new NodeSDK({
    serviceName: SERVICE_NAME,
    traceExporter: new OTLPTraceExporter(),
    metricReaders: [
      new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter(),
        // Honor OTEL_METRIC_EXPORT_INTERVAL (ms) so the push cadence is
        // tunable per environment without a rebuild; defaults to 60s.
        exportIntervalMillis: Number(process.env.OTEL_METRIC_EXPORT_INTERVAL) || 60000,
      }),
    ],
    logRecordProcessors: [
      new BatchLogRecordProcessor({ exporter: new OTLPLogExporter() }),
    ],
  });

  sdk.start();

  // Re-resolve the handles now that the global providers are registered.
  // Instruments created from a meter obtained *before* registration are
  // bound to a no-op proxy and never export, so refreshing here (and relying
  // on ESM live bindings) guarantees importers see the real providers.
  tracer = trace.getTracer(SERVICE_NAME, SERVICE_VERSION);
  meter = metrics.getMeter(SERVICE_NAME, SERVICE_VERSION);
  otelLogger = logs.getLogger(SERVICE_NAME, SERVICE_VERSION);

  return sdk;
}

/**
 * Gracefully flushes and shuts down the SDK (exports pending telemetry).
 * Wire this to `SIGTERM`/`SIGINT` in the entry point for clean shutdowns.
 *
 * @returns A promise that resolves once the SDK has shut down.
 */
export async function shutdownTelemetry(): Promise<void> {
  if (!sdk) return;
  await sdk.shutdown();
  sdk = undefined;
}

/**
 * Shared {@link Tracer} for creating spans. Import and use directly:
 * `tracer.startActiveSpan("shorten", (span) => { ... })`.
 *
 * Exported as a live binding (`let`): {@link startTelemetry} refreshes it
 * once the SDK is registered, and ESM importers observe the updated value.
 */
export let tracer: Tracer = trace.getTracer(SERVICE_NAME, SERVICE_VERSION);

/**
 * Shared {@link Meter} for creating counters, gauges and histograms.
 * Live binding — see {@link tracer}.
 */
export let meter: Meter = metrics.getMeter(SERVICE_NAME, SERVICE_VERSION);

/**
 * Shared OpenTelemetry {@link OtelLogger} for emitting structured log records
 * over OTLP. The app's {@link Logger} facade can bridge to this.
 * Live binding — see {@link tracer}.
 */
export let otelLogger: OtelLogger = logs.getLogger(SERVICE_NAME, SERVICE_VERSION);
