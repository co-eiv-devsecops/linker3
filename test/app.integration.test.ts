import assert from "node:assert/strict";
import type { Server } from "node:http";
import test from "node:test";
import { type App, createApp } from "../src/container.ts";

const HOME = "<html><body>linker</body></html>";

async function startApp(t: { after(fn: () => Promise<void> | void): void }) {
  const app: App = createApp(
    {
      port: 0,
      baseUrl: "https://short.test",
      dbPath: ":memory:",
      features: { newCodeGen: false },
    },
    HOME
  );

  await new Promise<void>((resolve) => app.server.listen(0, resolve));
  const address = app.server.address();
  const port = typeof address === "object" && address ? address.port : 0;

  t.after(async () => {
    await new Promise<void>((resolve, reject) =>
      (app.server as Server).close((e) => (e ? reject(e) : resolve()))
    );
    app.repository.close();
  });

  return { base: `http://127.0.0.1:${port}` };
}

test("GET / sirve la página principal", async (t) => {
  const { base } = await startApp(t);
  const res = await fetch(`${base}/`);

  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type") ?? "", /text\/html/);
  assert.equal(await res.text(), HOME);
});

test("POST /api/shorten crea un enlace y devuelve la URL corta con BASE_URL", async (t) => {
  const { base } = await startApp(t);
  const res = await fetch(`${base}/api/shorten`, {
    method: "POST",
    body: JSON.stringify({
      url: "https://nodejs.org/en/docs",
      alias: "docs",
    }),
  });

  assert.equal(res.status, 201);
  assert.deepEqual(await res.json(), { short: "https://short.test/docs" });
});

test("POST /api/shorten sin alias genera un código hex de 8 caracteres", async (t) => {
  const { base } = await startApp(t);
  const res = await fetch(`${base}/api/shorten`, {
    method: "POST",
    body: JSON.stringify({ url: "https://www.typescriptlang.org" }),
  });

  assert.equal(res.status, 201);
  const { short } = (await res.json()) as { short: string };
  assert.match(short, /^https:\/\/short\.test\/[0-9a-f]{8}$/);
});

test("POST /api/shorten responde 400 con URL inválida", async (t) => {
  const { base } = await startApp(t);
  const res = await fetch(`${base}/api/shorten`, {
    method: "POST",
    body: JSON.stringify({ url: "no-url" }),
  });

  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { error: "URL inválida" });
});

test("POST /api/shorten responde 400 con JSON malformado", async (t) => {
  const { base } = await startApp(t);
  const res = await fetch(`${base}/api/shorten`, {
    method: "POST",
    body: "{esto no es json",
  });

  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { error: "JSON inválido" });
});

test("POST /api/shorten responde 409 con alias duplicado", async (t) => {
  const { base } = await startApp(t);
  const shorten = () =>
    fetch(`${base}/api/shorten`, {
      method: "POST",
      body: JSON.stringify({ url: "https://github.com", alias: "repetido" }),
    });

  assert.equal((await shorten()).status, 201);

  const dup = await shorten();
  assert.equal(dup.status, 409);
  assert.deepEqual(await dup.json(), { error: "El alias ya está en uso" });
});

test("GET /:code redirige 302 al destino e incrementa visitas", async (t) => {
  const { base } = await startApp(t);
  await fetch(`${base}/api/shorten`, {
    method: "POST",
    body: JSON.stringify({ url: "https://www.wikipedia.org", alias: "visita" }),
  });

  const redirect = await fetch(`${base}/visita`, { redirect: "manual" });
  assert.equal(redirect.status, 302);
  assert.equal(redirect.headers.get("location"), "https://www.wikipedia.org");

  const links = (await (await fetch(`${base}/api/links`)).json()) as Array<{
    code: string;
    visits: number;
  }>;
  assert.equal(links.find((l) => l.code === "visita")?.visits, 1);
});

test("GET /:code inexistente responde 404", async (t) => {
  const { base } = await startApp(t);
  const res = await fetch(`${base}/nope`, { redirect: "manual" });

  assert.equal(res.status, 404);
  assert.deepEqual(await res.json(), { error: "No encontrado" });
});

test("GET /api/links lista los enlaces del más reciente al más antiguo", async (t) => {
  const { base } = await startApp(t);
  for (const alias of ["uno", "dos"]) {
    await fetch(`${base}/api/shorten`, {
      method: "POST",
      body: JSON.stringify({
        url: `https://developer.mozilla.org/en-US/docs/${alias}`,
        alias,
      }),
    });
  }

  const links = (await (await fetch(`${base}/api/links`)).json()) as Array<{
    code: string;
  }>;
  assert.deepEqual(
    links.map((l) => l.code),
    ["dos", "uno"]
  );
});
