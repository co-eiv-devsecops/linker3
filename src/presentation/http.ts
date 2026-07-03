import type { IncomingMessage, ServerResponse } from "node:http";
import { ValidationError } from "../domain/errors.ts";

export function sendJson(
  res: ServerResponse,
  status: number,
  body: unknown
): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

export function sendHtml(
  res: ServerResponse,
  status: number,
  html: string
): void {
  res.writeHead(status, { "Content-Type": "text/html" });
  res.end(html);
}

export function sendRedirect(res: ServerResponse, location: string): void {
  res.writeHead(302, { Location: location });
  res.end();
}

export function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("error", reject);
    req.on("end", () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new ValidationError("JSON inválido"));
      }
    });
  });
}
