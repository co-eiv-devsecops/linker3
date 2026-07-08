import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { init, type LDClient } from "@launchdarkly/node-server-sdk";
import { createPool, type Pool } from "mysql2/promise";
import { LinkService } from "./application/LinkService.ts";
import { LinkValidator } from "./application/LinkValidator.ts";
import type { AppConfig } from "./config.ts";
import { createLogger, type Logger } from "./infrastructure/Logger.ts";
import { MySqlHealthChecker } from "./infrastructure/MySqlHealthChecker.ts";
import { RandomCodeGenerator } from "./infrastructure/RandomCodeGenerator.ts";
import { SecureCodeGenerator } from "./infrastructure/SecureCodeGenerator.ts";
import { SqliteLinkRepository } from "./infrastructure/SqliteLinkRepository.ts";
import { createOtelMeter } from "./infrastructure/telemetry/OtelMeter.ts";
import { LinkController } from "./presentation/LinkController.ts";
import { Router } from "./presentation/Router.ts";

/**
 * The fully wired application: the running HTTP server plus a handle to
 * the repository (exposed so callers, e.g. tests, can close it cleanly).
 */
export interface App {
  /** The underlying `http.Server`, not yet listening on any port. */
  server: Server;
  /** The SQLite-backed repository instance used by the app. */
  repository: SqliteLinkRepository;
  /** The LaunchDarkly client instance used by the app. */
  ldClient: LDClient;
  /** The level-aware {@link Logger} instance used by the app, per `config.logLevel`. */
  logger: Logger;
  /** The MySQL connection pool backing the `/healthz` check. */
  mysqlPool: Pool;
}

/**
 * Composition root: instantiates and wires every layer (repository, code
 * generator, validator, service, controller, router) into a single
 * `http.Server`.
 *
 * @param config - Resolved application configuration (port, base URL, DB path).
 * @param homePage - Optional HTML to serve at `/`; defaults to reading
 * `public/index.html` from disk. Useful for injecting a stub in tests.
 * @returns The wired {@link App}, ready to `listen()`.
 */
export function createApp(config: AppConfig, homePage?: string): App {
  const ui =
    homePage ??
    readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "..", "public", "index.html"),
      "utf8"
    );

  const logger = createLogger(config.logLevel);
  const repository = new SqliteLinkRepository(config.dbPath, logger);
  const codeGenerator = config.features.newCodeGen
    ? new SecureCodeGenerator()
    : new RandomCodeGenerator();
  const validator = new LinkValidator();
  // Inject the OpenTelemetry-backed meter so business metrics are actually
  // recorded and exported over OTLP (instead of the default no-op meter).
  const meter = createOtelMeter();
  const service = new LinkService(repository, codeGenerator, validator, logger, meter);
  const controller = new LinkController(service, config.baseUrl);
  const sdkKey = process.env.LAUNCHDARKLY_SDK_KEY;
  const ldClient = init(sdkKey ?? "", sdkKey ? undefined : { offline: true });
  const mysqlPool = createPool({
    host: config.mysql.host,
    database: config.mysql.database,
    user: config.mysql.user,
    password: config.mysql.password,
    // Fail fast so /healthz never hangs on the OS-level TCP timeout.
    connectTimeout: 5000,
  });
  const healthChecker = new MySqlHealthChecker(mysqlPool, logger);
  const router = new Router(controller, ui, ldClient, logger, undefined, healthChecker);

  const server = createServer((req, res) => {
    void router.handle(req, res);
  });

  return { server, repository, ldClient, logger, mysqlPool };
}
