import { DatabaseSync } from "node:sqlite";
import type { Link } from "../domain/Link.ts";
import type { LinkRepository } from "../domain/LinkRepository.ts";
import { ConflictError } from "../domain/errors.ts";

export class SqliteLinkRepository implements LinkRepository {
  private readonly db: DatabaseSync;

  constructor(dbPath: string) {
    this.db = new DatabaseSync(dbPath);
    this.db.exec(`CREATE TABLE IF NOT EXISTS links (
      code    TEXT PRIMARY KEY,
      url     TEXT NOT NULL,
      visits  INTEGER DEFAULT 0
    )`);
  }

  findByCode(code: string): Link | null {
    const row = this.db
      .prepare("SELECT code, url, visits FROM links WHERE code = ?")
      .get(code) as Link | undefined;
    return row ? SqliteLinkRepository.toEntity(row) : null;
  }

  save(code: string, url: string): void {
    try {
      this.db
        .prepare("INSERT INTO links (code, url) VALUES (?, ?)")
        .run(code, url);
    } catch (e) {
      if (e instanceof Error && e.message.includes("UNIQUE constraint")) {
        throw new ConflictError("Código ya existe");
      }
      throw e;
    }
  }

  incrementVisits(code: string): void {
    this.db
      .prepare("UPDATE links SET visits = visits + 1 WHERE code = ?")
      .run(code);
  }

  findAll(): Link[] {
    const rows = this.db
      .prepare("SELECT code, url, visits FROM links ORDER BY rowid DESC")
      .all() as unknown as Link[];
    return rows.map(SqliteLinkRepository.toEntity);
  }

  private static toEntity(row: Link): Link {
    return { code: row.code, url: row.url, visits: row.visits };
  }

  close(): void {
    this.db.close();
  }
}
