/**
 * Severity of a log entry, in increasing order of importance.
 */
export type LogLevel = "info" | "warn" | "error";

/**
 * Minimal logging port used across the app. Kept as an interface so
 * tests/callers can supply a fake instead of writing to the console.
 */
export interface Logger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

/**
 * Formats a single log line as `[timestamp] [LEVEL] message {meta}`.
 *
 * @param level - Severity of the entry.
 * @param message - Human-readable message.
 * @param meta - Optional structured details appended as JSON.
 */
function format(
  level: LogLevel,
  message: string,
  meta?: Record<string, unknown>
): string {
  const timestamp = new Date().toISOString();
  const suffix = meta ? ` ${JSON.stringify(meta)}` : "";
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${suffix}`;
}

/**
 * Default {@link Logger} implementation: writes formatted lines to the
 * console (`stdout` for info, `stderr` for warn/error).
 */
class ConsoleLogger implements Logger {
  info(message: string, meta?: Record<string, unknown>): void {
    console.log(format("info", message, meta));
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    console.warn(format("warn", message, meta));
  }

  error(message: string, meta?: Record<string, unknown>): void {
    console.error(format("error", message, meta));
  }
}

/**
 * Shared {@link Logger} instance used by default throughout the app.
 */
export const logger: Logger = new ConsoleLogger();
