import assert from "node:assert/strict";
import test from "node:test";
import { invokeHttpHandler } from "../src/infrastructure/http/ServerlessAdapter.ts";
import type { HttpHandler } from "../src/presentation/HttpPort.ts";

const echo: HttpHandler = {
  async handle(request, response) {
    response.writeHead(201, { "Content-Type": "application/json" });
    response.end(
      JSON.stringify({ method: request.method, body: await request.readBody?.() })
    );
  },
};

test("el adaptador serverless devuelve una respuesta portable", async () => {
  const result = await invokeHttpHandler(echo, {
    method: "POST",
    url: "/api/shorten",
    readBody: async () => '{"url":"https://example.com"}',
  });

  assert.equal(result.statusCode, 201);
  assert.equal(result.headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(result.body), {
    method: "POST",
    body: '{"url":"https://example.com"}',
  });
});
