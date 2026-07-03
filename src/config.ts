export interface AppConfig {
  readonly port: number;
  readonly baseUrl: string;
  readonly dbPath: string;
}

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
