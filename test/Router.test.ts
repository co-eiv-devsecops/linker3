import test from "node:test";
import assert from "node:assert/strict";
import type { IncomingMessage, ServerResponse } from "node:http";
import { Router } from "../src/presentation/Router.ts";
import { LinkController } from "../src/presentation/LinkController.ts";
import { LinkService } from "../src/application/LinkService.ts";
import { SqliteLinkRepository } from "../src/infrastructure/SqliteLinkRepository.ts";
import { RandomCodeGenerator } from "../src/infrastructure/RandomCodeGenerator.ts";
import type { LinkRepository } from "../src/domain/LinkRepository.ts";
import type { Link } from "../src/domain/Link.ts";

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

const asReq = (method: string, url: string) =>
  ({ method, url } as IncomingMessage);
const asRes = (fake: FakeResponse) => fake as unknown as ServerResponse;

const makeRouter = (t: { after(fn: () => void): void }, homePage = "") => {
  const repo = new SqliteLinkRepository(":memory:");
  t.after(() => repo.close());
  const service = new LinkService(repo, new RandomCodeGenerator());
  const controller = new LinkController(service, "https://short.test");
  return { repo, router: new Router(controller, homePage) };
};

test("GET / responde la página principal como HTML", async (t) => {
  const { router } = makeRouter(t, "<h1>hola</h1>");
  const res = new FakeResponse();

  await router.handle(asReq("GET", "/"), asRes(res));

  assert.equal(res.status, 200);
  assert.equal(res.headers["Content-Type"], "text/html");
  assert.equal(res.body, "<h1>hola</h1>");
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
  const { repo, router } = makeRouter(t);
  repo.save("abc123", "https://www.wikipedia.org");
  const res = new FakeResponse();

  await router.handle(asReq("GET", "/abc123"), asRes(res));

  assert.equal(res.status, 302);
  assert.equal(res.headers.Location, "https://www.wikipedia.org");
});

test("un AppError se traduce a su estado HTTP y mensaje JSON", async (t) => {
  const { router } = makeRouter(t);
  const res = new FakeResponse();

  await router.handle(asReq("GET", "/missing"), asRes(res));

  assert.equal(res.status, 404);
  assert.deepEqual(JSON.parse(res.body), { error: "No encontrado" });
});

test("un error inesperado responde 500 sin filtrar detalles", async (t) => {
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
  const router = new Router(controller, "");
  const res = new FakeResponse();

  await router.handle(asReq("GET", "/api/links"), asRes(res));

  assert.equal(res.status, 500);
  assert.deepEqual(JSON.parse(res.body), { error: "Error interno" });
});
