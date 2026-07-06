/**
 * Application entry point: loads configuration, builds the app via
 * {@link createApp}, and starts the HTTP server listening.
 *
 * @module main
 */
import { loadConfig } from "./config.ts";
import { createApp } from "./container.ts";
import { logger } from "./infrastructure/Logger.ts";

const config = loadConfig();
const { server } = createApp(config);

server.listen(config.port, () =>
  logger.info(`Linker (TS) corriendo en ${config.baseUrl}`)
);
