/**
 * Application entry point: loads configuration, builds the app via
 * {@link createApp}, and starts the HTTP server listening.
 *
 * @module main
 */
import { loadConfig } from "./config.ts";
import { createApp } from "./container.ts";

const config = loadConfig();
const { server } = createApp(config);

server.listen(config.port, () =>
  console.log(`Linker (TS) corriendo en ${config.baseUrl}`)
);
