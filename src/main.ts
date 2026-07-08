/**
 * Application entry point: loads configuration, builds the app via
 * {@link createApp}, and starts the HTTP server listening.
 *
 * @module main
 */
import { shutdownTelemetry, startTelemetry } from "./infrastructure/telemetry/otel.ts";

// Start OpenTelemetry before wiring the app so instrumentation is ready.
startTelemetry();

import { loadConfig } from "./config.ts";
import { createApp } from "./container.ts";

const config = loadConfig();
const { server, ldClient, logger, mysqlPool } = createApp(config);

/**
 * Gracefully shuts the process down: closes the LaunchDarkly client
 * (which flushes pending analytics events) first so no telemetry is lost,
 * then stops the HTTP server, closes the MySQL pool, and shuts down
 * OpenTelemetry.
 */
async function shutdown(): Promise<void> {
  try {
    await ldClient.close();
  } catch (err) {
    logger.error("Error cerrando LaunchDarkly", { err: String(err) });
  }
  server.close();
  await mysqlPool.end();
  await shutdownTelemetry();
}

/** Hard cap (ms) so a stalled exporter/connection can never hang the exit. */
const SHUTDOWN_TIMEOUT_MS = 3000;

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, () => {
    const forced = setTimeout(() => process.exit(0), SHUTDOWN_TIMEOUT_MS);
    forced.unref();
    void shutdown().finally(() => process.exit(0));
  });
}

try {
  await ldClient.waitForInitialization({ timeout: 5 });
  logger.info("LaunchDarkly conectado");
} catch (err) {
  logger.error("LaunchDarkly no se pudo inicializar", { err: String(err) });
}

server.listen(config.port, () =>
  logger.info(`Linker (TS) corriendo en ${config.baseUrl}`)
);
