import { randomInt } from "node:crypto";
import type { CodeGenerator } from "../domain/CodeGenerator.ts";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/**
 * {@link CodeGenerator} implementation producing base62 short codes from
 * cryptographically random, unbiased picks (`crypto.randomInt`). Compared to
 * {@link RandomCodeGenerator}'s hex output, the wider alphabet packs more
 * entropy per character for the same code length.
 */
export class SecureCodeGenerator implements CodeGenerator {
  private readonly length: number;

  /**
   * @param length - Number of characters in the generated code (default `8`).
   * @throws {RangeError} If `length` is not an integer `>= 1`.
   */
  constructor(length: number = 8) {
    if (!Number.isInteger(length) || length < 1) {
      throw new RangeError("length debe ser un entero >= 1");
    }
    this.length = length;
  }

  /**
   * Generates a new random base62 code.
   *
   * @returns A string of length `length` drawn from `[A-Za-z0-9]`.
   * Uniqueness is not guaranteed; callers must check for collisions
   * against storage.
   */
  generate(): string {
    let code = "";
    for (let i = 0; i < this.length; i++) {
      code += ALPHABET[randomInt(ALPHABET.length)];
    }
    return code;
  }
}
