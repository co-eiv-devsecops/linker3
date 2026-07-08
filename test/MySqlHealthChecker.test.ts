import assert from "node:assert/strict";
import test from "node:test";
import type { Pool } from "mysql2/promise";
import { MySqlHealthChecker } from "../src/infrastructure/MySqlHealthChecker.ts";
import type { SpanLike, TracerLike } from "../src/infrastructure/telemetry/Tracing.ts";

function makeMockTracer() {
  const events: Array<{ type: "start" | "end"; name: string }> = [];

  const tracer: TracerLike = {
    startActiveSpan<T>(
      name: string,
      fn: (span: SpanLike) => T | Promise<T>
    ): T | Promise<T> {
      events.push({ type: "start", name });
      const span: SpanLike = {
        setAttribute() {
          return span;
        },
        end() {
          events.push({ type: "end", name });
        },
      };
      return fn(span);
    },
  };

  return { tracer, events };
}

test("check() ejecuta SELECT 1 dentro de un span 'db.mysql.healthcheck'", async () => {
  const { tracer, events } = makeMockTracer();
  const queries: string[] = [];
  const pool = {
    query: (sql: string) => {
      queries.push(sql);
      return Promise.resolve([[], []]);
    },
  } as unknown as Pool;
  const checker = new MySqlHealthChecker(pool, undefined, tracer);

  await checker.check();

  assert.deepEqual(queries, ["SELECT 1"]);
  assert.deepEqual(
    events.map((e) => [e.type, e.name]),
    [
      ["start", "db.mysql.healthcheck"],
      ["end", "db.mysql.healthcheck"],
    ]
  );
});

test("check() propaga el error cuando la consulta falla", async () => {
  const { tracer } = makeMockTracer();
  const pool = {
    query: () => Promise.reject(new Error("conexión rechazada")),
  } as unknown as Pool;
  const checker = new MySqlHealthChecker(pool, undefined, tracer);

  await assert.rejects(() => checker.check(), /conexión rechazada/);
});
