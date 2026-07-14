import type { IncomingMessage, ServerResponse } from "node:http";
import { ValidationError } from "../domain/errors.ts";

/**
 * Baseline security headers applied to every response: a strict
 * same-origin CSP (the SPA relies on inline `<script>`/`<style>` tags,
 * hence `'unsafe-inline'`), clickjacking/MIME-sniffing protections, and a
 * conservative referrer policy.
 */
export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

/**
 * Writes a JSON response body with the given status code.
 *
 * @param res - Response to write to.
 * @param status - HTTP status code.
 * @param body - Value to serialize as the JSON response body.
 * @param extraHeaders - Additional headers merged in on top of the
 * defaults (e.g. to relax the CSP for a specific route).
 */
export function sendJson(
  res: ServerResponse,
  status: number,
  body: unknown,
  extraHeaders: Record<string, string> = {}
): void {
  res.writeHead(status, {
    "Content-Type": "application/json",
    ...SECURITY_HEADERS,
    ...extraHeaders,
  });
  res.end(JSON.stringify(body));
}

/**
 * Writes an HTML response body with the given status code.
 *
 * @param res - Response to write to.
 * @param status - HTTP status code.
 * @param html - HTML markup to send.
 * @param extraHeaders - Additional headers merged in on top of the
 * defaults (e.g. to relax the CSP for a specific route).
 */
export function sendHtml(
  res: ServerResponse,
  status: number,
  html: string,
  extraHeaders: Record<string, string> = {}
): void {
  res.writeHead(status, {
    "Content-Type": "text/html",
    ...SECURITY_HEADERS,
    ...extraHeaders,
  });
  res.end(html);
}

/**
 * Issues a 302 redirect to the given location.
 *
 * @param res - Response to write to.
 * @param location - Target URL for the `Location` header.
 */
export function sendRedirect(res: ServerResponse, location: string): void {
  res.writeHead(302, { Location: location, ...SECURITY_HEADERS });
  res.end();
}

export function sendNoContent(res: ServerResponse): void {
  res.writeHead(204, SECURITY_HEADERS);
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
