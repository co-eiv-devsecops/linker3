import assert from "node:assert/strict";
import test from "node:test";
import { LinkService } from "../src/application/LinkService.ts";
import type { CodeGenerator } from "../src/domain/CodeGenerator.ts";
import { NotFoundError } from "../src/domain/errors.ts";
import type { Meter } from "../src/infrastructure/Metrics.ts";
import { SqliteLinkRepository } from "../src/infrastructure/SqliteLinkRepository.ts";

const fixedGenerator = (code: string): CodeGenerator => ({
  generate: () => code,
});

/** Records every value passed to each instrument, keyed by metric name. */
function makeFakeMeter() {
  const counters: Record<string, number[]> = {};
  const upDownCounters: Record<string, number[]> = {};
  const histograms: Record<string, number[]> = {};

  const meter: Meter = {
    createCounter: (name) => ({
      add: (value) => {
        if (!counters[name]) counters[name] = [];
        counters[name].push(value);
      },
    }),
    createUpDownCounter: (name) => ({
      add: (value) => {
        if (!upDownCounters[name]) upDownCounters[name] = [];
        upDownCounters[name].push(value);
      },
    }),
    createHistogram: (name) => ({
      record: (value) => {
        if (!histograms[name]) histograms[name] = [];
        histograms[name].push(value);
      },
    }),
  };

  return { meter, counters, upDownCounters, histograms };
}

const makeService = (t: { after(fn: () => void): void }, code = "cafe1234") => {
  const repo = new SqliteLinkRepository(":memory:");
  t.after(() => repo.close());
  const { meter, counters, upDownCounters, histograms } = makeFakeMeter();
  const service = new LinkService(
    repo,
    fixedGenerator(code),
    undefined,
    undefined,
    meter
  );
  return { repo, service, counters, upDownCounters, histograms };
};

test("shorten incrementa links_created_total y active_links, y registra shorten_duration_ms", (t) => {
  const { service, counters, upDownCounters, histograms } = makeService(t);

  service.shorten({ url: "https://nodejs.org" });

  assert.deepEqual(counters.links_created_total, [1]);
  assert.deepEqual(upDownCounters.active_links, [1]);
  assert.equal(histograms.shorten_duration_ms?.length, 1);
  assert.ok((histograms.shorten_duration_ms?.[0] as number) >= 0);
});

test("shorten fallido (URL inválida) no dispara métricas de creación", (t) => {
  const { service, counters, upDownCounters, histograms } = makeService(t);

  assert.throws(() => service.shorten({ url: "no-es-url" }));

  assert.equal(counters.links_created_total, undefined);
  assert.equal(upDownCounters.active_links, undefined);
  assert.equal(histograms.shorten_duration_ms, undefined);
});

test("resolve incrementa redirects_total y registra redirect_duration_ms, con in_flight_redirects simétrico", (t) => {
  const { repo, service, counters, upDownCounters, histograms } = makeService(t);
  repo.save("abc", "https://www.typescriptlang.org");

  service.resolve("abc");

  assert.deepEqual(counters.redirects_total, [1]);
  assert.deepEqual(upDownCounters.in_flight_redirects, [1, -1]);
  assert.equal(histograms.redirect_duration_ms?.length, 1);
  assert.ok((histograms.redirect_duration_ms?.[0] as number) >= 0);
});

test("resolve de código inexistente decrementa in_flight_redirects sin contar la redirección", (t) => {
  const { service, counters, upDownCounters, histograms } = makeService(t);

  assert.throws(() => service.resolve("no-existe"), NotFoundError);

  assert.deepEqual(upDownCounters.in_flight_redirects, [1, -1]);
  assert.equal(counters.redirects_total, undefined);
  assert.equal(histograms.redirect_duration_ms, undefined);
});
