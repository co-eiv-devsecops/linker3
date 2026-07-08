import type { Pool } from "mysql2/promise";
import type { HealthChecker } from "../domain/HealthChecker.ts";
import { logger as defaultLogger, type Logger } from "./Logger.ts";
import { tracer as defaultTracer } from "./telemetry/otel.ts";
import { type TracerLike, withSpan } from "./telemetry/Tracing.ts";

/**
 * {@link HealthChecker} implementation that verifies MySQL connectivity
 * by running `SELECT 1`.
 */
export class MySqlHealthChecker implements HealthChecker {
  private readonly pool: Pool;
  private readonly logger: Logger;
  private readonly tracer: TracerLike;

  /**
   * @param pool - `mysql2/promise` connection pool to check against.
   * @param logger - Logger used to record check failures; defaults to the shared console logger.
   * @param tracer - Tracer used to record the `mysql select 1` span; defaults to the shared OpenTelemetry tracer.
   */
  constructor(
    pool: Pool,
    logger: Logger = defaultLogger,
    tracer: TracerLike = defaultTracer
  ) {
    this.pool = pool;
    this.logger = logger;
    this.tracer = tracer;
  }

  /**
   * Runs `SELECT 1` against the pool inside a `mysql select 1` span.
   *
   * @throws If the query fails (connection refused, auth failure, etc.).
   */
  async check(): Promise<void> {
    try {
      await withSpan(this.tracer, "mysql select 1", {}, async () => {
        await this.pool.query("SELECT 1");
      });
    } catch (e) {
      this.logger.error("Healthcheck de MySQL falló", {
        error: e instanceof Error ? e.message : String(e),
      });
      throw e;
    }
  }
}
