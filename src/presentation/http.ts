import type { IncomingMessage, ServerResponse } from "node:http";
import { ValidationError } from "../domain/errors.ts";

/**
 * Writes a JSON response body with the given status code.
 *
 * @param res - Response to write to.
 * @param status - HTTP status code.
 * @param body - Value to serialize as the JSON response body.
 */
export function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

/**
 * Writes an HTML response body with the given status code.
 *
 * @param res - Response to write to.
 * @param status - HTTP status code.
 * @param html - HTML markup to send.
 */
export function sendHtml(res: ServerResponse, status: number, html: string): void {
  res.writeHead(status, { "Content-Type": "text/html" });
  res.end(html);
}

/**
 * Issues a 302 redirect to the given location.
 *
 * @param res - Response to write to.
 * @param location - Target URL for the `Location` header.
 */
export function sendRedirect(res: ServerResponse, location: string): void {
  res.writeHead(302, { Location: location });
  res.end();
}

/**
 * Reads and parses a request body as JSON.
 *
 * @param req - Incoming request whose body will be consumed.
 * @returns A promise resolving to the parsed JSON value.
 * @throws {ValidationError} If the body is not valid JSON (rejects the returned promise).
 */
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
