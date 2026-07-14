import type { IncomingMessage, ServerResponse } from "node:http";
import type { LinkService } from "../application/LinkService.ts";
import { readJsonBody, sendJson, sendNoContent, sendRedirect } from "./http.ts";

/**
 * Handles HTTP requests for link-related routes, translating between
 * raw `http` request/response objects and {@link LinkService} calls.
 *
 * Dispatched to by {@link Router}; errors thrown here (e.g. subclasses of
 * `AppError`) are caught and converted to JSON error responses upstream.
 */
export class LinkController {
  private readonly service: LinkService;
  private readonly baseUrl: string;

  /**
   * @param service - Application service implementing the link use cases.
   * @param baseUrl - Base URL prepended to generated short links.
   */
  constructor(service: LinkService, baseUrl: string) {
    this.service = service;
    this.baseUrl = baseUrl;
  }

  /**
   * Handles `GET /api/links`: responds with all stored links as JSON.
   *
   * @param _req - Incoming request (unused).
   * @param res - Response to write the link list to.
   */
  list(_req: IncomingMessage, res: ServerResponse): void {
    sendJson(res, 200, this.service.list());
  }

  /**
   * Handles `POST /api/shorten`: reads a `{ url, alias? }` JSON body,
   * creates a new short link, and responds with the resulting short URL.
   *
   * @param req - Incoming request carrying the JSON payload.
   * @param res - Response to write the created short URL to (201).
   * @throws {ValidationError} If the body is invalid JSON or the URL/alias fails validation.
   * @throws {ConflictError} If the requested alias is already taken.
   */
  async shorten(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const payload = (await readJsonBody(req)) as {
      url?: unknown;
      alias?: unknown;
    };
    const result = this.service.shorten({
      url: payload?.url as string,
      alias: payload?.alias as string | null | undefined,
    });
    sendJson(res, 201, { short: `${this.baseUrl}/${result.code}` });
  }

  /**
   * Handles `GET /:code`: resolves the short code and issues a redirect
   * to its destination URL.
   *
   * @param code - Short code extracted from the request path.
   * @param res - Response to write the redirect to.
   * @throws {NotFoundError} If no link exists for `code`.
   */
  redirect(code: string, res: ServerResponse): void {
    const target = this.service.resolve(code);
    sendRedirect(res, target);
  }

  delete(code: string, res: ServerResponse): void {
    this.service.delete(code);
    sendNoContent(res);
  }
}
