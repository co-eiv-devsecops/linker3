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
}

/**
 * Builds an {@link AppConfig} from environment variables, applying
 * sensible defaults when they are missing or invalid.
 *
 * Recognized variables: `PORT` (default `3000`), `BASE_URL` (default
 * `http://localhost:${port}`), and `DB_PATH` (default `linker.db`).
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
  };
}
