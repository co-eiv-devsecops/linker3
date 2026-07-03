import assert from "node:assert/strict";
import test from "node:test";
import { LinkService } from "../src/application/LinkService.ts";
import type { CodeGenerator } from "../src/domain/CodeGenerator.ts";
import { ConflictError, NotFoundError, ValidationError } from "../src/domain/errors.ts";
import { SqliteLinkRepository } from "../src/infrastructure/SqliteLinkRepository.ts";

const fixedGenerator = (code: string): CodeGenerator => ({
  generate: () => code,
});

const makeService = (t: { after(fn: () => void): void }, code = "cafe1234") => {
  const repo = new SqliteLinkRepository(":memory:");
  t.after(() => repo.close());
  return { repo, service: new LinkService(repo, fixedGenerator(code)) };
};

test("shorten genera un código cuando no hay alias", (t) => {
  const { repo, service } = makeService(t);

  const result = service.shorten({ url: "https://github.com/anthropics/claude-code" });

  assert.equal(result.code, "cafe1234");
  assert.deepEqual(repo.findByCode("cafe1234"), {
    code: "cafe1234",
    url: "https://github.com/anthropics/claude-code",
    visits: 0,
  });
});

test("shorten usa el alias cuando se proporciona uno válido", (t) => {
  const { service } = makeService(t, "nope");

  const result = service.shorten({
    url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript",
    alias: "mi-alias",
  });

  assert.equal(result.code, "mi-alias");
});

test("shorten lanza ValidationError con URL inválida y no persiste", (t) => {
  const { repo, service } = makeService(t);

  assert.throws(() => service.shorten({ url: "no-es-url" }), ValidationError);
  assert.deepEqual(repo.findAll(), []);
});

test("shorten lanza ValidationError con alias inválido", (t) => {
  const { service } = makeService(t);

  assert.throws(
    () => service.shorten({ url: "https://nodejs.org", alias: "a b" }),
    ValidationError
  );
});

test("shorten lanza ConflictError si el alias ya está en uso", (t) => {
  const { repo, service } = makeService(t);
  repo.save("tomado", "https://www.wikipedia.org");

  assert.throws(
    () => service.shorten({ url: "https://nodejs.org", alias: "tomado" }),
    (e: unknown) => e instanceof ConflictError && e.message === "El alias ya está en uso"
  );
});

test("shorten propaga ConflictError del repositorio en colisión de código generado", (t) => {
  const { repo, service } = makeService(t, "colision");
  repo.save("colision", "https://www.wikipedia.org");

  assert.throws(() => service.shorten({ url: "https://nodejs.org" }), ConflictError);
});

test("resolve devuelve la URL e incrementa visitas", (t) => {
  const { repo, service } = makeService(t);
  repo.save("abc", "https://www.typescriptlang.org/docs/handbook/intro.html");

  assert.equal(
    service.resolve("abc"),
    "https://www.typescriptlang.org/docs/handbook/intro.html"
  );
  assert.equal(repo.findByCode("abc")?.visits, 1);
});

test("resolve lanza NotFoundError si el código no existe", (t) => {
  const { service } = makeService(t);

  assert.throws(() => service.resolve("missing"), NotFoundError);
});

test("list devuelve todos los enlaces del repositorio", (t) => {
  const { repo, service } = makeService(t);
  repo.save("uno", "https://nodejs.org");
  repo.save("dos", "https://www.typescriptlang.org");
  repo.incrementVisits("dos");
  repo.incrementVisits("dos");
  repo.incrementVisits("dos");

  assert.deepEqual(service.list(), [
    { code: "dos", url: "https://www.typescriptlang.org", visits: 3 },
    { code: "uno", url: "https://nodejs.org", visits: 0 },
  ]);
});
