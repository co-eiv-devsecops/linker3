/**
 * Severity of a log entry, in increasing order of importance.
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const DEFAULT_LEVEL: LogLevel = "info";

/**
 * Minimal logging port used across the app. Kept as an interface so
 * tests/callers can supply a fake instead of writing to the console.
 */
export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
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
 * Parses a `LOG_LEVEL` environment value into a {@link LogLevel},
 * falling back to `"info"` when missing or unrecognized.
 *
 * @param value - Raw environment variable value (e.g. `process.env.LOG_LEVEL`).
 */
export function parseLogLevel(value: string | undefined): LogLevel {
  if (value && value in LEVEL_ORDER) {
    return value as LogLevel;
  }
  return DEFAULT_LEVEL;
}

/**
 * Default {@link Logger} implementation: writes formatted lines to the
 * console (`stdout` for debug/info, `stderr` for warn/error), filtering
 * out any entry below the configured minimum level.
 */
class ConsoleLogger implements Logger {
  private readonly minLevel: LogLevel;

  /**
   * @param minLevel - Lowest level that will actually be emitted; entries
   * below it are silently dropped without formatting cost.
   */
  constructor(minLevel: LogLevel = DEFAULT_LEVEL) {
    this.minLevel = minLevel;
  }

  private isEnabled(level: LogLevel): boolean {
    return LEVEL_ORDER[level] >= LEVEL_ORDER[this.minLevel];
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    if (this.isEnabled("debug")) console.log(format("debug", message, meta));
  }

  info(message: string, meta?: Record<string, unknown>): void {
    if (this.isEnabled("info")) console.log(format("info", message, meta));
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    if (this.isEnabled("warn")) console.warn(format("warn", message, meta));
  }

  error(message: string, meta?: Record<string, unknown>): void {
    if (this.isEnabled("error")) console.error(format("error", message, meta));
  }
}

/**
 * Builds a console-backed {@link Logger} that filters entries below
 * `minLevel`. Used by {@link logger} and by the composition root once
 * `LOG_LEVEL` has been resolved via {@link loadConfig}.
 *
 * @param minLevel - Lowest level that will be emitted; defaults to `"info"`.
 */
export function createLogger(minLevel: LogLevel = DEFAULT_LEVEL): Logger {
  return new ConsoleLogger(minLevel);
}

/**
 * Shared {@link Logger} instance used by default throughout the app.
 * Its level is fixed at `"info"`; the composition root builds a
 * level-aware instance via {@link createLogger} using `config.logLevel`.
 */
export const logger: Logger = createLogger();
