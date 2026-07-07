/**
 * Attribute bag attached to a single metric recording.
 */
export type MetricAttributes = Record<string, string | number | boolean>;

/**
 * Metadata describing a metric instrument, following the OpenTelemetry
 * Metrics API shape (name in snake_case, unit included where relevant).
 */
export interface MetricOptions {
  description?: string;
  unit?: string;
}

/** Monotonic counter: only ever increases (e.g. `links_created_total`). */
export interface Counter {
  add(value: number, attributes?: MetricAttributes): void;
}

/** Records a distribution of values (e.g. `shorten_duration_ms`). */
export interface Histogram {
  record(value: number, attributes?: MetricAttributes): void;
}

/** Records the current value of a point-in-time measurement (e.g. `active_links`). */
export interface Gauge {
  record(value: number, attributes?: MetricAttributes): void;
}

/**
 * Minimal metrics port used across the app, shaped after the
 * OpenTelemetry Metrics API (`meter.createCounter(...)`, etc.) so it can
 * be swapped for a real OTel `Meter` without changing call sites. Kept as
 * an interface so tests can supply a fake instead of a real backend.
 */
export interface Meter {
  createCounter(name: string, options?: MetricOptions): Counter;
  createHistogram(name: string, options?: MetricOptions): Histogram;
  createGauge(name: string, options?: MetricOptions): Gauge;
}

/**
 * Default {@link Meter}: discards every recording. Used until a real
 * metrics backend/exporter is wired up, so instrumentation call sites
 * work out of the box without a production dependency on an OTel SDK.
 */
class NoopMeter implements Meter {
  createCounter(): Counter {
    return { add: () => {} };
  }

  createHistogram(): Histogram {
    return { record: () => {} };
  }

  createGauge(): Gauge {
    return { record: () => {} };
  }
}

/**
 * Shared {@link Meter} instance used by default throughout the app.
 */
export const meter: Meter = new NoopMeter();
