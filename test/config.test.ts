import test from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../src/config.ts";

test("usa los valores por defecto con entorno vacío", () => {
  assert.deepEqual(loadConfig({}), {
    port: 3000,
    baseUrl: "http://localhost:3000",
    dbPath: "linker.db",
  });
});

test("respeta PORT, BASE_URL y DB_PATH del entorno", () => {
  const config = loadConfig({
    PORT: "8080",
    BASE_URL: "https://short.example.com",
    DB_PATH: "/data/links.db",
  });

  assert.deepEqual(config, {
    port: 8080,
    baseUrl: "https://short.example.com",
    dbPath: "/data/links.db",
  });
});

test("BASE_URL por defecto refleja el puerto configurado", () => {
  assert.equal(loadConfig({ PORT: "4000" }).baseUrl, "http://localhost:4000");
});

test("un PORT inválido cae al valor por defecto", () => {
  assert.equal(loadConfig({ PORT: "abc" }).port, 3000);
  assert.equal(loadConfig({ PORT: "-1" }).port, 3000);
});
