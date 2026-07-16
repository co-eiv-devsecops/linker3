import { createServer, type IncomingMessage, type Server } from "node:http";
import type { HttpHandler, HttpRequest } from "../../presentation/HttpPort.ts";

function adaptRequest(request: IncomingMessage): HttpRequest {
  return {
    method: request.method,
    url: request.url,
    readBody: async () => {
      const chunks: Buffer[] = [];
      for await (const chunk of request) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      return Buffer.concat(chunks).toString("utf8");
    },
  };
}

/** Exposes a provider-neutral handler through Node's native HTTP server. */
export function createNodeHttpServer(handler: HttpHandler): Server {
  return createServer((request, response) => {
    void handler.handle(adaptRequest(request), response);
  });
}
