import assert from "node:assert/strict";
import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";
import test from "node:test";
import { init } from "@launchdarkly/node-server-sdk";
import { LinkService } from "../src/application/LinkService.ts";
import type { Link } from "../src/domain/Link.ts";
import type { LinkRepository } from "../src/domain/LinkRepository.ts";
import { RandomCodeGenerator } from "../src/infrastructure/RandomCodeGenerator.ts";
import { SqliteLinkRepository } from "../src/infrastructure/SqliteLinkRepository.ts";
import type { SpanLike, TracerLike } from "../src/infrastructure/telemetry/Tracing.ts";
import { LinkController } from "../src/presentation/LinkController.ts";
import { Router } from "../src/presentation/Router.ts";

class FakeResponse {
  status = 0;
  headers: Record<string, string> = {};
  body = "";

  writeHead(status: number, headers: Record<string, string>) {
    this.status = status;
    this.headers = headers;
    return this;
  }

  end(chunk?: string) {
    this.body = chunk ?? "";
  }
}

const asReq = (method: string, url: string) => ({ method, url }) as IncomingMessage;
const asRes = (fake: FakeResponse) => fake as unknown as ServerResponse;

function makeMockTracer() {
  const events: Array<{
    type: "start" | "set" | "end";
    name: string;
    parent: string | null;
    key?: string;
    value?: unknown;
  }> = [];
  const stack: string[] = [];

  const tracer: TracerLike = {
    startActiveSpan<T>(
      name: string,
      fn: (span: SpanLike) => T | Promise<T>
    ): T | Promise<T> {
      const parent = stack.at(-1) ?? null;
      stack.push(name);
      events.push({ type: "start", name, parent });

      const span: SpanLike = {
        setAttribute(key: string, value: string | number | boolean) {
          events.push({ type: "set", name, parent, key, value });
          return span;
        },
        end() {
          events.push({ type: "end", name, parent });
          stack.pop();
        },
      };

      return fn(span);
    },
  };

  return { tracer, events };
}

const makeRouter = (t: { after(fn: () => void): void }, homePage = "") => {
  const { tracer, events } = makeMockTracer();
  const repo = new SqliteLinkRepository(":memory:", undefined, tracer);
  t.after(() => repo.close());
  const service = new LinkService(
    repo,
    new RandomCodeGenerator(),
    undefined,
    undefined,
    undefined,
    tracer
  );
  const controller = new LinkController(service, "https://short.test");
  const ldClient = init("", { offline: true });
  return {
    repo,
    router: new Router(controller, homePage, ldClient, undefined, tracer),
    events,
  };
};

const makeJsonReq = (method: string, url: string, body: string) =>
  Object.assign(Readable.from([body]), { method, url }) as IncomingMessage;

test("GET / responde la página principal como HTML", async (t) => {
  const { router } = makeRouter(t, "<h1>hola</h1>");
  const res = new FakeResponse();

  await router.handle(asReq("GET", "/"), asRes(res));

  assert.equal(res.status, 200);
  assert.equal(res.headers["Content-Type"], "text/html");
  assert.equal(res.body, "<h1>hola</h1>");
});

test("GET /launchdarkly-demo responde el estado del flag", async (t) => {
  const { router } = makeRouter(t);
  const res = new FakeResponse();

  await router.handle(asReq("GET", "/launchdarkly-demo"), asRes(res));

  assert.equal(res.status, 200);
  assert.deepEqual(JSON.parse(res.body), {
    flag: "my-first-flag",
    enabled: false,
    message: "LaunchDarkly is working — the flag is OFF",
  });
});

test("GET /health responde 200 con estado ok y uptime", async (t) => {
  const { router } = makeRouter(t);
  const res = new FakeResponse();

  await router.handle(asReq("GET", "/health"), asRes(res));

  assert.equal(res.status, 200);
  const body = JSON.parse(res.body);
  assert.equal(body.status, "ok");
  assert.equal(typeof body.uptime, "number");
});

test("GET /healthz responde 200 cuando el healthChecker pasa", async (t) => {
  const { tracer, events } = makeMockTracer();
  const repo = new SqliteLinkRepository(":memory:", undefined, tracer);
  t.after(() => repo.close());
  const service = new LinkService(
    repo,
    new RandomCodeGenerator(),
    undefined,
    undefined,
    undefined,
    tracer
  );
  const controller = new LinkController(service, "https://short.test");
  const ldClient = init("", { offline: true });
  const router = new Router(controller, "", ldClient, undefined, tracer, {
    check: () => Promise.resolve(),
  });
  const res = new FakeResponse();

  await router.handle(asReq("GET", "/healthz"), asRes(res));

  assert.equal(res.status, 200);
  assert.deepEqual(JSON.parse(res.body), { status: "ok" });
  assert.deepEqual(
    events
      .filter((event) => event.type !== "set")
      .map((event) => [event.type, event.name, event.parent]),
    [
      ["start", "request", null],
      ["end", "request", null],
    ]
  );
});

test("GET /healthz responde 503 cuando el healthChecker falla", async (t) => {
  const { tracer } = makeMockTracer();
  const repo = new SqliteLinkRepository(":memory:", undefined, tracer);
  t.after(() => repo.close());
  const service = new LinkService(
    repo,
    new RandomCodeGenerator(),
    undefined,
    undefined,
    undefined,
    tracer
  );
  const controller = new LinkController(service, "https://short.test");
  const ldClient = init("", { offline: true });
  const router = new Router(controller, "", ldClient, undefined, tracer, {
    check: () => Promise.reject(new Error("conexión rechazada")),
  });
  const res = new FakeResponse();

  await router.handle(asReq("GET", "/healthz"), asRes(res));

  assert.equal(res.status, 503);
  assert.deepEqual(JSON.parse(res.body), { status: "error" });
});

test("GET /healthz sin healthChecker configurado responde 503", async (t) => {
  const { router } = makeRouter(t);
  const res = new FakeResponse();

  await router.handle(asReq("GET", "/healthz"), asRes(res));

  assert.equal(res.status, 503);
  assert.deepEqual(JSON.parse(res.body), { status: "error" });
});

test("GET /api/links delega en controller.list", async (t) => {
  const { repo, router } = makeRouter(t);
  repo.save("abc", "https://www.wikipedia.org");
  const res = new FakeResponse();

  await router.handle(asReq("GET", "/api/links"), asRes(res));

  assert.equal(res.status, 200);
  assert.deepEqual(JSON.parse(res.body), [
    { code: "abc", url: "https://www.wikipedia.org", visits: 0 },
  ]);
});

test("una ruta desconocida se despacha como redirección por código", async (t) => {
  const { repo, router, events } = makeRouter(t);
  repo.save("abc123", "https://www.wikipedia.org");
  events.length = 0;
  const res = new FakeResponse();

  await router.handle(asReq("GET", "/abc123"), asRes(res));

  assert.equal(res.status, 302);
  assert.equal(res.headers.Location, "https://www.wikipedia.org");
  assert.deepEqual(
    events
      .filter((event) => event.type !== "set")
      .map((event) => [event.type, event.name, event.parent]),
    [
      ["start", "request", null],
      ["start", "lookup", "request"],
      ["start", "increment visits", "lookup"],
      ["end", "increment visits", "lookup"],
      ["end", "lookup", "request"],
      ["end", "request", null],
    ]
  );
  assert.ok(
    events.some(
      (event) => event.type === "set" && event.key === "code" && event.value === "abc123"
    )
  );
  assert.ok(
    events.some(
      (event) =>
        event.type === "set" &&
        event.key === "url" &&
        event.value === "https://www.wikipedia.org"
    )
  );
  assert.ok(
    events.some(
      (event) =>
        event.type === "set" &&
        event.key === "duration_ms" &&
        typeof event.value === "number"
    )
  );
});

test("POST /api/shorten abre un request span y un span anidado de SQLite", async (t) => {
  const { router, events } = makeRouter(t);
  const res = new FakeResponse();
  const req = makeJsonReq(
    "POST",
    "/api/shorten",
    JSON.stringify({ url: "https://www.typescriptlang.org" })
  );

  await router.handle(req, asRes(res));

  assert.equal(res.status, 201);
  assert.deepEqual(
    events
      .filter((event) => event.type !== "set")
      .map((event) => [event.type, event.name, event.parent]),
    [
      ["start", "request", null],
      ["start", "sqlite save", "request"],
      ["end", "sqlite save", "request"],
      ["end", "request", null],
    ]
  );
  assert.ok(
    events.some(
      (event) =>
        event.type === "set" &&
        event.key === "url" &&
        event.value === "https://www.typescriptlang.org"
    )
  );
});

test("un AppError se traduce a su estado HTTP y mensaje JSON", async (t) => {
  const { router } = makeRouter(t);
  const res = new FakeResponse();

  await router.handle(asReq("GET", "/missing"), asRes(res));

  assert.equal(res.status, 404);
  assert.deepEqual(JSON.parse(res.body), { error: "No encontrado" });
});

test("un error inesperado responde 500 sin filtrar detalles", async () => {
  const brokenRepo: LinkRepository = {
    findByCode(): Link | null {
      return null;
    },
    save() {},
    incrementVisits() {},
    findAll(): Link[] {
      throw new Error("detalle interno secreto");
    },
  };
  const service = new LinkService(brokenRepo, new RandomCodeGenerator());
  const controller = new LinkController(service, "https://short.test");
  const ldClient = init("", { offline: true });
  const router = new Router(controller, "", ldClient);
  const res = new FakeResponse();

  await router.handle(asReq("GET", "/api/links"), asRes(res));

  assert.equal(res.status, 500);
  assert.deepEqual(JSON.parse(res.body), { error: "Error interno" });
});
