/**
 * Application entry point: loads configuration, builds the app via
 * {@link createApp}, and starts the HTTP server listening.
 *
 * @module main
 */
import { loadConfig } from "./config.ts";
import { createApp } from "./container.ts";

const config = loadConfig();
const { server, ldClient, logger } = createApp(config);

try {
  await ldClient.waitForInitialization({ timeout: 5 });
  logger.info("LaunchDarkly conectado");
} catch (err) {
  logger.error("LaunchDarkly no se pudo inicializar", { err: String(err) });
}

server.listen(config.port, () =>
  logger.info(`Linker (TS) corriendo en ${config.baseUrl}`)
);
