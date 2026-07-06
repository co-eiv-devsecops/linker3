/**
 * Input payload for {@link LinkService.shorten}.
 */
export interface ShortenRequest {
  /** URL to be shortened. Must be a valid `http(s)` URL. */
  url: string;
  /** Optional custom alias to use instead of an auto-generated code. */
  alias?: string | null;
}

/**
 * Result returned by {@link LinkService.shorten}.
 */
export interface ShortenResult {
  /** The short code assigned to the new link (generated or custom alias). */
  code: string;
}
