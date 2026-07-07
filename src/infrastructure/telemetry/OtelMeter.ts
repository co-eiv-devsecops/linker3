/**
 * Bridges the application's small {@link Meter} port
 * ({@link module:infrastructure/Metrics}) to the real OpenTelemetry
 * Metrics API. Business code keeps depending only on the local
 * abstraction, while recordings are actually aggregated and exported by
 * the OpenTelemetry SDK over OTLP (collector / Grafana Cloud).
 *
 * @module infrastructure/telemetry/OtelMeter
 */
import type { Meter as OTelApiMeter } from "@opentelemetry/api";
import type { Counter, Gauge, Histogram, Meter, MetricOptions } from "../Metrics.ts";
import { meter as otelMeter } from "./otel.ts";

/**
 * Adapts an OpenTelemetry API {@link OTelApiMeter} to the application's
 * {@link Meter} port. The OTel instrument shapes (`add`/`record`, with
 * optional attributes) are a superset of the port, so each factory method
 * simply delegates.
 */
export class OtelMeterAdapter implements Meter {
  private readonly otel: OTelApiMeter;

  /**
   * @param otel - The OpenTelemetry meter to delegate instrument creation to.
   * Injected so tests can pass a mock instead of a real SDK meter.
   */
  constructor(otel: OTelApiMeter) {
    this.otel = otel;
  }

  createCounter(name: string, options?: MetricOptions): Counter {
    return this.otel.createCounter(name, options);
  }

  createHistogram(name: string, options?: MetricOptions): Histogram {
    return this.otel.createHistogram(name, options);
  }

  createGauge(name: string, options?: MetricOptions): Gauge {
    return this.otel.createGauge(name, options);
  }
}

/**
 * Builds a {@link Meter} backed by the process-wide OpenTelemetry meter
 * initialized in {@link module:infrastructure/telemetry/otel}. Must be
 * called after `startTelemetry()` so the real provider is registered;
 * otherwise instruments bind to a no-op proxy.
 *
 * @returns A {@link Meter} whose instruments export via the OTel SDK.
 */
export function createOtelMeter(): Meter {
  return new OtelMeterAdapter(otelMeter);
}
