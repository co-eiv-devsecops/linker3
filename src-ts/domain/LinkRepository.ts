import type { Link } from "./Link.ts";

export interface LinkRepository {
  findByCode(code: string): Link | null;

  save(code: string, url: string): void;

  incrementVisits(code: string): void;

  findAll(): Link[];
}
