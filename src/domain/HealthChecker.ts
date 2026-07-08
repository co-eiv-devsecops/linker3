/**
 * Verifies that a critical dependency is reachable, for use by the
 * `/healthz` route.
 */
export interface HealthChecker {
  /**
   * Resolves if the dependency is healthy, rejects otherwise.
   */
  check(): Promise<void>;
}
