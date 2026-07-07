import assert from "node:assert/strict";
import test from "node:test";
import { SecureCodeGenerator } from "../src/infrastructure/SecureCodeGenerator.ts";

test("genera códigos base62 de 8 caracteres por defecto", () => {
  const generator = new SecureCodeGenerator();
  for (let i = 0; i < 20; i++) {
    assert.match(generator.generate(), /^[A-Za-z0-9]{8}$/);
  }
});

test("respeta la longitud configurada", () => {
  const generator = new SecureCodeGenerator(12);
  assert.match(generator.generate(), /^[A-Za-z0-9]{12}$/);
});

test("genera códigos distintos entre llamadas (no determinista)", () => {
  const generator = new SecureCodeGenerator();
  const codes = new Set(Array.from({ length: 50 }, () => generator.generate()));
  assert.ok(codes.size > 1);
});

test("rechaza longitudes inválidas", () => {
  assert.throws(() => new SecureCodeGenerator(0), RangeError);
  assert.throws(() => new SecureCodeGenerator(-1), RangeError);
  assert.throws(() => new SecureCodeGenerator(1.5), RangeError);
});
