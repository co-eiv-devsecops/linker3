/**
 * A shortened link stored by the application.
 *
 * Represents the persisted mapping between a short `code` and the
 * destination `url`, along with a `visits` counter incremented on
 * every redirect.
 */
export interface Link {
  /** Unique short code used in the redirect path (e.g. `/abc123` or a custom alias). */
  readonly code: string;
  /** Destination URL the short code redirects to. */
  readonly url: string;
  /** Number of times this link has been resolved (redirected to). */
  readonly visits: number;
}
