import { type LogLevel, parseLogLevel } from "./infrastructure/Logger.ts";

/**
 * Feature toggles that select between alternative implementations at
 * startup. Unlike LaunchDarkly-backed flags, these are read once from
 * the environment and never change at runtime.
 */
export interface FeatureFlags {
  /** When `true`, wires {@link SecureCodeGenerator} instead of {@link RandomCodeGenerator}. */
  readonly newCodeGen: boolean;
}

/**
 * Resolved application configuration.
 */
export interface AppConfig {
  /** TCP port the HTTP server listens on. */
  readonly port: number;
  /** Base URL used to build short links returned to clients. */
  readonly baseUrl: string;
  /** Filesystem path to the SQLite database file. */
  readonly dbPath: string;
  /** Build-time feature toggles; see {@link FeatureFlags}. */
  readonly features: FeatureFlags;
  /** Minimum log level emitted; see {@link LogLevel}. */
  readonly logLevel: LogLevel;
}

/**
 * Builds an {@link AppConfig} from environment variables, applying
 * sensible defaults when they are missing or invalid.
 *
 * Recognized variables: `PORT` (default `3000`), `BASE_URL` (default
 * `http://localhost:${port}`), `DB_PATH` (default `linker.db`),
 * `FEATURE_NEW_CODE_GEN` (default `false`), and `LOG_LEVEL` (default
 * `info`; one of `debug`/`info`/`warn`/`error`).
 *
 * @param env - Environment variables source; defaults to `process.env`.
 * @returns The resolved application configuration.
 */
export function loadConfig(
  env: Record<string, string | undefined> = process.env
): AppConfig {
  const port = Number(env.PORT) > 0 ? Number(env.PORT) : 3000;
  return {
    port,
    baseUrl: env.BASE_URL || `http://localhost:${port}`,
    dbPath: env.DB_PATH || "linker.db",
    features: {
      newCodeGen: env.FEATURE_NEW_CODE_GEN === "true",
    },
    logLevel: parseLogLevel(env.LOG_LEVEL),
  };
}
