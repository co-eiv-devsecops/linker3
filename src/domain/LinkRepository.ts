import type { Link } from "./Link.ts";

/**
 * Persistence contract for {@link Link} records.
 *
 * Implementations are responsible for storage details (e.g. SQLite); the
 * rest of the application depends only on this interface, keeping the
 * domain and application layers independent of the storage engine.
 */
export interface LinkRepository {
  /**
   * Looks up a link by its short code.
   *
   * @param code - Short code to search for.
   * @returns The matching {@link Link}, or `null` if none exists.
   */
  findByCode(code: string): Link | null;

  /**
   * Persists a new code/URL pair.
   *
   * @param code - Short code to store (must be unique).
   * @param url - Destination URL associated with the code.
   * @throws {ConflictError} If `code` already exists in the repository.
   */
  save(code: string, url: string): void;

  /**
   * Atomically increments the visit counter for a given code.
   *
   * @param code - Short code whose visit count should be incremented.
   */
  incrementVisits(code: string): void;

  /**
   * Retrieves every stored link.
   *
   * @returns All links, ordered newest first.
   */
  findAll(): Link[];

  /** Deletes a link and reports whether it existed. */
  deleteByCode(code: string): boolean;
}
