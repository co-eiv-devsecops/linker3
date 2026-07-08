import { DatabaseSync } from "node:sqlite";
import { ConflictError } from "../domain/errors.ts";
import type { Link } from "../domain/Link.ts";
import type { LinkRepository } from "../domain/LinkRepository.ts";
import { logger as defaultLogger, type Logger } from "./Logger.ts";
import { tracer as defaultTracer } from "./telemetry/otel.ts";
import { type TracerLike, withSpan } from "./telemetry/Tracing.ts";

/**
 * {@link LinkRepository} implementation backed by an embedded SQLite
 * database (via Node's built-in `node:sqlite` module).
 *
 * The `links` table is created automatically on first use if it does
 * not already exist.
 */
export class SqliteLinkRepository implements LinkRepository {
  private readonly db: DatabaseSync;
  private readonly logger: Logger;
  private readonly tracer: TracerLike;

  /**
   * Opens (or creates) the SQLite database at `dbPath` and ensures the
   * `links` table exists.
   *
   * @param dbPath - Filesystem path to the SQLite database file.
   * @param logger - Logger used to record data-access events; defaults to the shared console logger.
   */
  constructor(
    dbPath: string,
    logger: Logger = defaultLogger,
    tracer: TracerLike = defaultTracer
  ) {
    this.db = new DatabaseSync(dbPath);
    this.db.exec(`CREATE TABLE IF NOT EXISTS links (
      code    TEXT PRIMARY KEY,
      url     TEXT NOT NULL,
      visits  INTEGER DEFAULT 0
    )`);
    this.logger = logger;
    this.tracer = tracer;
    this.logger.info("Base de datos SQLite abierta", { dbPath });
  }

  /**
   * @param code - Short code to search for.
   * @returns The matching {@link Link}, or `null` if none exists.
   */
  findByCode(code: string): Link | null {
    return withSpan(
      this.tracer,
      "db.sqlite.find_by_code",
      { "db.system": "sqlite", code },
      (span) => {
        this.logger.debug("Buscando enlace por código", { code });
        const row = this.db
          .prepare("SELECT code, url, visits FROM links WHERE code = ?")
          .get(code) as Link | undefined;
        span.setAttribute("found", row !== undefined);
        return row ? SqliteLinkRepository.toEntity(row) : null;
      }
    );
  }

  /**
   * @param code - Short code to store (must be unique).
   * @param url - Destination URL associated with the code.
   * @throws {ConflictError} If `code` violates the table's `PRIMARY KEY` uniqueness constraint.
   */
  save(code: string, url: string): void {
    try {
      withSpan(
        this.tracer,
        "db.sqlite.save_link",
        { "db.system": "sqlite", code, url },
        () => {
          this.db.prepare("INSERT INTO links (code, url) VALUES (?, ?)").run(code, url);
        }
      );
    } catch (e) {
      if (e instanceof Error && e.message.includes("UNIQUE constraint")) {
        this.logger.warn("Conflicto de código al guardar enlace", { code });
        throw new ConflictError("Código ya existe");
      }
      throw e;
    }
  }

  /**
   * @param code - Short code whose visit count should be incremented.
   */
  incrementVisits(code: string): void {
    withSpan(
      this.tracer,
      "db.sqlite.increment_visits",
      { "db.system": "sqlite", code },
      () => {
        this.logger.debug("Incrementando contador de visitas", { code });
        this.db.prepare("UPDATE links SET visits = visits + 1 WHERE code = ?").run(code);
      }
    );
  }

  /**
   * @returns All stored links, ordered by insertion order (newest first).
   */
  findAll(): Link[] {
    return withSpan(
      this.tracer,
      "db.sqlite.find_all",
      { "db.system": "sqlite" },
      (span) => {
        const rows = this.db
          .prepare("SELECT code, url, visits FROM links ORDER BY rowid DESC")
          .all() as unknown as Link[];
        span.setAttribute("count", rows.length);
        return rows.map(SqliteLinkRepository.toEntity);
      }
    );
  }

  /**
   * Maps a raw database row into a plain {@link Link} entity.
   *
   * @param row - Row returned by the SQLite driver.
   * @returns The corresponding {@link Link}.
   */
  private static toEntity(row: Link): Link {
    return { code: row.code, url: row.url, visits: row.visits };
  }

  /**
   * Closes the underlying database connection.
   */
  close(): void {
    this.db.close();
    this.logger.info("Conexión a la base de datos cerrada");
  }
}
