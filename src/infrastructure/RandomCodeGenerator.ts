import { randomBytes } from "node:crypto";
import type { CodeGenerator } from "../domain/CodeGenerator.ts";

/**
 * {@link CodeGenerator} implementation producing hex-encoded short codes
 * from cryptographically random bytes.
 */
export class RandomCodeGenerator implements CodeGenerator {
  private readonly byteLength: number;

  /**
   * @param byteLength - Number of random bytes to generate; each byte
   * yields two hex characters (default `4`, producing an 8-character code).
   * @throws {RangeError} If `byteLength` is not an integer `>= 1`.
   */
  constructor(byteLength: number = 4) {
    if (!Number.isInteger(byteLength) || byteLength < 1) {
      throw new RangeError("byteLength debe ser un entero >= 1");
    }
    this.byteLength = byteLength;
  }

  /**
   * Generates a new random hex code.
   *
   * @returns A hex string of length `byteLength * 2`. Uniqueness is not
   * guaranteed; callers must check for collisions against storage.
   */
  generate(): string {
    return randomBytes(this.byteLength).toString("hex");
  }
}
