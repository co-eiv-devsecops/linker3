import assert from "node:assert/strict";
import test from "node:test";
import { RandomCodeGenerator } from "../src/infrastructure/RandomCodeGenerator.ts";

test("genera códigos hexadecimales de 8 caracteres por defecto", () => {
  const generator = new RandomCodeGenerator();
  for (let i = 0; i < 20; i++) {
    assert.match(generator.generate(), /^[0-9a-f]{8}$/);
  }
});

test("respeta la longitud de bytes configurada", () => {
  const generator = new RandomCodeGenerator(6);
  assert.match(generator.generate(), /^[0-9a-f]{12}$/);
});

test("genera códigos distintos entre llamadas (no determinista)", () => {
  const generator = new RandomCodeGenerator();
  const codes = new Set(Array.from({ length: 50 }, () => generator.generate()));
  assert.ok(codes.size > 1);
});

test("rechaza longitudes de bytes inválidas", () => {
  assert.throws(() => new RandomCodeGenerator(0), RangeError);
  assert.throws(() => new RandomCodeGenerator(-1), RangeError);
  assert.throws(() => new RandomCodeGenerator(1.5), RangeError);
});
