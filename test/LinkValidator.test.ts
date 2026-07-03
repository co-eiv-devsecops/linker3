import test from "node:test";
import assert from "node:assert/strict";
import { LinkValidator } from "../src/application/LinkValidator.ts";
import { ValidationError } from "../src/domain/errors.ts";

const validator = new LinkValidator();

test("assertValidUrl acepta URLs http y https", () => {
  assert.doesNotThrow(() => validator.assertValidUrl("http://neverssl.com"));
  assert.doesNotThrow(() =>
    validator.assertValidUrl("https://www.google.com/search?q=linker")
  );
});

test("assertValidUrl rechaza URLs inválidas con ValidationError", () => {
  for (const bad of ["", "ftp://ftp.mozilla.org", "www.github.com", null, undefined, 42]) {
    assert.throws(() => validator.assertValidUrl(bad), ValidationError);
  }
});

test("assertValidAlias acepta alias válidos", () => {
  for (const ok of ["abc", "mi-alias_1", "A".repeat(30)]) {
    assert.doesNotThrow(() => validator.assertValidAlias(ok));
  }
});

test("assertValidAlias rechaza alias inválidos con ValidationError", () => {
  for (const bad of ["ab", "A".repeat(31), "con espacios", "acentuadá", "a!b", null, 7]) {
    assert.throws(() => validator.assertValidAlias(bad), ValidationError);
  }
});

test("hasAlias distingue alias presente de ausente", () => {
  assert.equal(validator.hasAlias("abc"), true);
  assert.equal(validator.hasAlias(""), false);
  assert.equal(validator.hasAlias(null), false);
  assert.equal(validator.hasAlias(undefined), false);
});
