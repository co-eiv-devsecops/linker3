/**
 * Base class for all application-level errors.
 *
 * Carries an HTTP `status` code so the presentation layer (see
 * {@link Router}) can translate a thrown error directly into an HTTP
 * response without needing to know about specific error subtypes.
 */
export class AppError extends Error {
  /** HTTP status code to return when this error reaches the router. */
  readonly status: number;

  /**
   * @param message - Human-readable error message returned to the client.
   * @param status - HTTP status code associated with this error.
   */
  constructor(message: string, status: number) {
    super(message);
    this.name = new.target.name;
    this.status = status;
  }
}

/**
 * Thrown when user-supplied input fails validation (HTTP 400).
 */
export class ValidationError extends AppError {
  /**
   * @param message - Description of the validation failure.
   */
  constructor(message: string) {
    super(message, 400);
  }
}

/**
 * Thrown when an operation conflicts with existing state, such as a
 * short code or alias that is already taken (HTTP 409).
 */
export class ConflictError extends AppError {
  /**
   * @param message - Description of the conflict.
   */
  constructor(message: string) {
    super(message, 409);
  }
}

/**
 * Thrown when a requested resource does not exist (HTTP 404).
 */
export class NotFoundError extends AppError {
  /**
   * @param message - Description of what was not found.
   */
  constructor(message: string) {
    super(message, 404);
  }
}
