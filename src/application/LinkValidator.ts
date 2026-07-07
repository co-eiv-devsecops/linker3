import { ValidationError } from "../domain/errors.ts";

/**
 * Validates URLs and aliases used when creating short links.
 *
 * Used by {@link LinkService} to enforce input constraints before a link
 * is persisted, keeping validation rules independent of storage and
 * transport concerns.
 */
export class LinkValidator {
  /** Matches URLs starting with `http://` or `https://` followed by any content. */
  static readonly URL_REGEX = /^https?:\/\/.+/;

  /** Matches aliases of 3-30 characters composed of letters, digits, `-` and `_`. */
  static readonly ALIAS_REGEX = /^[a-zA-Z0-9_-]{3,30}$/;

  /**
   * Asserts that `url` is a non-empty string matching {@link URL_REGEX}.
   *
   * @param url - Value to validate.
   * @throws {ValidationError} If `url` is not a valid `http(s)` URL.
   */
  assertValidUrl(url: unknown): asserts url is string {
    if (typeof url !== "string" || !LinkValidator.URL_REGEX.test(url)) {
      throw new ValidationError("URL inválida");
    }
  }

  /**
   * Asserts that `alias` matches {@link ALIAS_REGEX}.
   *
   * @param alias - Value to validate.
   * @throws {ValidationError} If `alias` is not 3-30 alphanumeric/`-`/`_` characters.
   */
  assertValidAlias(alias: unknown): asserts alias is string {
    if (typeof alias !== "string" || !LinkValidator.ALIAS_REGEX.test(alias)) {
      throw new ValidationError(
        "Alias inválido: solo letras, números, - y _ (3-30 caracteres)"
      );
    }
  }

  /**
   * Determines whether an alias value was actually supplied.
   *
   * @param alias - Value to check.
   * @returns `true` if `alias` is neither `null`, `undefined`, nor an empty string.
   */
  hasAlias(alias: unknown): boolean {
    return alias != null && alias !== "";
  }
}
