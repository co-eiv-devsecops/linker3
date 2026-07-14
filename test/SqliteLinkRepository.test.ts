import assert from "node:assert/strict";
import test from "node:test";
import { ConflictError } from "../src/domain/errors.ts";
import { SqliteLinkRepository } from "../src/infrastructure/SqliteLinkRepository.ts";

const makeRepo = (t: { after(fn: () => void): void }) => {
  const repo = new SqliteLinkRepository(":memory:");
  t.after(() => repo.close());
  return repo;
};

test("save + findByCode persisten y recuperan un enlace", (t) => {
  const repo = makeRepo(t);
  repo.save("abc", "https://github.com/nodejs/node");

  assert.deepEqual(repo.findByCode("abc"), {
    code: "abc",
    url: "https://github.com/nodejs/node",
    visits: 0,
  });
});

test("findByCode devuelve null si el código no existe", (t) => {
  const repo = makeRepo(t);
  assert.equal(repo.findByCode("missing"), null);
});

test("save lanza ConflictError con código duplicado", (t) => {
  const repo = makeRepo(t);
  repo.save("dup", "https://nodejs.org");

  assert.throws(() => repo.save("dup", "https://www.typescriptlang.org"), ConflictError);
});

test("incrementVisits incrementa el contador solo del código dado", (t) => {
  const repo = makeRepo(t);
  repo.save("uno", "https://nodejs.org");
  repo.save("dos", "https://www.typescriptlang.org");

  repo.incrementVisits("uno");
  repo.incrementVisits("uno");

  assert.equal(repo.findByCode("uno")?.visits, 2);
  assert.equal(repo.findByCode("dos")?.visits, 0);
});

test("incrementVisits sobre un código inexistente no falla", (t) => {
  const repo = makeRepo(t);
  assert.doesNotThrow(() => repo.incrementVisits("missing"));
});

test("findAll devuelve los enlaces del más reciente al más antiguo", (t) => {
  const repo = makeRepo(t);
  repo.save("primero", "https://nodejs.org");
  repo.save("segundo", "https://www.typescriptlang.org");

  assert.deepEqual(
    repo.findAll().map((l) => l.code),
    ["segundo", "primero"]
  );
});

test("findAll devuelve lista vacía sin enlaces", (t) => {
  const repo = makeRepo(t);
  assert.deepEqual(repo.findAll(), []);
});

test("deleteByCode elimina un enlace existente", (t) => {
  const repo = makeRepo(t);
  repo.save("borrar", "https://example.com");
  assert.equal(repo.deleteByCode("borrar"), true);
  assert.equal(repo.findByCode("borrar"), null);
});

test("deleteByCode devuelve false si el enlace no existe", (t) => {
  const repo = makeRepo(t);
  assert.equal(repo.deleteByCode("missing"), false);
});
