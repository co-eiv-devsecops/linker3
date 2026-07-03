import { randomBytes } from "node:crypto";
import type { CodeGenerator } from "../domain/CodeGenerator.ts";

export class RandomCodeGenerator implements CodeGenerator {
  private readonly byteLength: number;

  constructor(byteLength: number = 4) {
    if (!Number.isInteger(byteLength) || byteLength < 1) {
      throw new RangeError("byteLength debe ser un entero >= 1");
    }
    this.byteLength = byteLength;
  }

  generate(): string {
    return randomBytes(this.byteLength).toString("hex");
  }
}
