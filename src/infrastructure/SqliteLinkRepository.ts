import { DatabaseSync } from "node:sqlite";
import { ConflictError } from "../domain/errors.ts";
import type { Link } from "../domain/Link.ts";
import type { LinkRepository } from "../domain/LinkRepository.ts";

/**
 * {@link LinkRepository} implementation backed by an embedded SQLite
 * database (via Node's built-in `node:sqlite` module).
 *
 * The `links` table is created automatically on first use if it does
 * not already exist.
 */
export class SqliteLinkRepository implements LinkRepository {
  private readonly db: DatabaseSync;

  /**
   * Opens (or creates) the SQLite database at `dbPath` and ensures the
   * `links` table exists.
   *
   * @param dbPath - Filesystem path to the SQLite database file.
   */
  constructor(dbPath: string) {
    this.db = new DatabaseSync(dbPath);
    this.db.exec(`CREATE TABLE IF NOT EXISTS links (
      code    TEXT PRIMARY KEY,
      url     TEXT NOT NULL,
      visits  INTEGER DEFAULT 0
    )`);
  }

  /**
   * @param code - Short code to search for.
   * @returns The matching {@link Link}, or `null` if none exists.
   */
  findByCode(code: string): Link | null {
    const row = this.db
      .prepare("SELECT code, url, visits FROM links WHERE code = ?")
      .get(code) as Link | undefined;
    return row ? SqliteLinkRepository.toEntity(row) : null;
  }

  /**
   * @param code - Short code to store (must be unique).
   * @param url - Destination URL associated with the code.
   * @throws {ConflictError} If `code` violates the table's `PRIMARY KEY` uniqueness constraint.
   */
  save(code: string, url: string): void {
    try {
      this.db.prepare("INSERT INTO links (code, url) VALUES (?, ?)").run(code, url);
    } catch (e) {
      if (e instanceof Error && e.message.includes("UNIQUE constraint")) {
        throw new ConflictError("Código ya existe");
      }
      throw e;
    }
  }

  /**
   * @param code - Short code whose visit count should be incremented.
   */
  incrementVisits(code: string): void {
    this.db.prepare("UPDATE links SET visits = visits + 1 WHERE code = ?").run(code);
  }

  /**
   * @returns All stored links, ordered by insertion order (newest first).
   */
  findAll(): Link[] {
    const rows = this.db
      .prepare("SELECT code, url, visits FROM links ORDER BY rowid DESC")
      .all() as unknown as Link[];
    return rows.map(SqliteLinkRepository.toEntity);
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
  }
}
