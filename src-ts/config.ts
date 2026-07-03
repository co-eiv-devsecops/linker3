/**
 * Configuración de la aplicación, resuelta desde variables de entorno.
 *
 * Se construye una única vez en el arranque (composition root) y se
 * inyecta donde haga falta, en lugar de leer `process.env` por todo el
 * código (facilita los tests y centraliza los valores por defecto).
 */
export interface AppConfig {
  /** Puerto de escucha del servidor HTTP. */
  readonly port: number;
  /** Base con la que se construyen las URLs cortas devueltas al cliente. */
  readonly baseUrl: string;
  /** Ruta del fichero SQLite. */
  readonly dbPath: string;
}

/**
 * Crea la configuración a partir de un diccionario de entorno
 * (por defecto `process.env`, inyectable en tests).
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
