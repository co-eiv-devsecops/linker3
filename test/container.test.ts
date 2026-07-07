import assert from "node:assert/strict";
import type { Server } from "node:http";
import test from "node:test";
import { type App, createApp } from "../src/container.ts";

test("createApp sin homePage explícito sirve public/index.html real", async (t) => {
  const app: App = createApp({
    port: 0,
    baseUrl: "https://short.test",
    dbPath: ":memory:",
    features: { newCodeGen: false },
    logLevel: "error",
  });

  await new Promise<void>((resolve) => app.server.listen(0, resolve));
  const address = app.server.address();
  const port = typeof address === "object" && address ? address.port : 0;

  t.after(async () => {
    await new Promise<void>((resolve, reject) =>
      (app.server as Server).close((e) => (e ? reject(e) : resolve()))
    );
    app.repository.close();
  });

  const res = await fetch(`http://127.0.0.1:${port}/`);
  const body = await res.text();

  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type") ?? "", /text\/html/);
  assert.match(body, /<html/i);
});
