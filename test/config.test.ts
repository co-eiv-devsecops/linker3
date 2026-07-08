import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig } from "../src/config.ts";

const emptyMysql = { host: "", database: "", user: "", password: "" };

test("usa los valores por defecto con entorno vacío", () => {
  assert.deepEqual(loadConfig({}), {
    port: 3000,
    baseUrl: "http://localhost:3000",
    dbPath: "linker.db",
    features: { newCodeGen: false },
    logLevel: "info",
    mysql: emptyMysql,
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
    features: { newCodeGen: false },
    logLevel: "info",
    mysql: emptyMysql,
  });
});

test("respeta las variables MYSQL_* del entorno", () => {
  const config = loadConfig({
    MYSQL_HOST: "10.0.65.126",
    MYSQL_DATABASE: "linker_db_1",
    MYSQL_USER: "linker_user_1",
    MYSQL_PWD: "secreto",
  });

  assert.deepEqual(config.mysql, {
    host: "10.0.65.126",
    database: "linker_db_1",
    user: "linker_user_1",
    password: "secreto",
  });
});

test("LOG_LEVEL se propaga cuando es un nivel válido", () => {
  assert.equal(loadConfig({ LOG_LEVEL: "debug" }).logLevel, "debug");
  assert.equal(loadConfig({ LOG_LEVEL: "warn" }).logLevel, "warn");
  assert.equal(loadConfig({ LOG_LEVEL: "error" }).logLevel, "error");
});

test("LOG_LEVEL ausente o inválido cae al valor por defecto (info)", () => {
  assert.equal(loadConfig({}).logLevel, "info");
  assert.equal(loadConfig({ LOG_LEVEL: "verbose" }).logLevel, "info");
});

test("FEATURE_NEW_CODE_GEN=true activa features.newCodeGen", () => {
  assert.equal(loadConfig({ FEATURE_NEW_CODE_GEN: "true" }).features.newCodeGen, true);
});

test("FEATURE_NEW_CODE_GEN=false o ausente deja features.newCodeGen en false", () => {
  assert.equal(loadConfig({ FEATURE_NEW_CODE_GEN: "false" }).features.newCodeGen, false);
  assert.equal(loadConfig({}).features.newCodeGen, false);
});

test("BASE_URL por defecto refleja el puerto configurado", () => {
  assert.equal(loadConfig({ PORT: "4000" }).baseUrl, "http://localhost:4000");
});

test("un PORT inválido cae al valor por defecto", () => {
  assert.equal(loadConfig({ PORT: "abc" }).port, 3000);
  assert.equal(loadConfig({ PORT: "-1" }).port, 3000);
});
