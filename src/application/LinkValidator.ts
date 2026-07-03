import { ValidationError } from "../domain/errors.ts";

export class LinkValidator {
  static readonly URL_REGEX = /^https?:\/\/.+/;

  static readonly ALIAS_REGEX = /^[a-zA-Z0-9_-]{3,30}$/;

  assertValidUrl(url: unknown): asserts url is string {
    if (typeof url !== "string" || !LinkValidator.URL_REGEX.test(url)) {
      throw new ValidationError("URL inválida");
    }
  }

  assertValidAlias(alias: unknown): asserts alias is string {
    if (typeof alias !== "string" || !LinkValidator.ALIAS_REGEX.test(alias)) {
      throw new ValidationError(
        "Alias inválido: solo letras, números, - y _ (3-30 caracteres)"
      );
    }
  }

  hasAlias(alias: unknown): boolean {
    return alias != null && alias !== "";
  }
}
