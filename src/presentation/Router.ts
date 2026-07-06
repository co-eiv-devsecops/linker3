import type { IncomingMessage, ServerResponse } from "node:http";
import { AppError } from "../domain/errors.ts";
import { sendHtml, sendJson } from "./http.ts";
import type { LinkController } from "./LinkController.ts";

/**
 * Top-level HTTP request dispatcher.
 *
 * Routes incoming requests to the home page, health check, or
 * {@link LinkController} handlers, and centralizes error handling by
 * converting thrown {@link AppError}s (and unexpected errors) into JSON
 * error responses.
 */
export class Router {
  private readonly controller: LinkController;
  private readonly homePage: string;

  /**
   * @param controller - Controller handling link-related routes.
   * @param homePage - HTML markup served for `/` and `/index.html`.
   */
  constructor(controller: LinkController, homePage: string) {
    this.controller = controller;
    this.homePage = homePage;
  }

  /**
   * Entry point invoked for every incoming HTTP request. Delegates to
   * {@link dispatch} and translates any thrown error into a JSON
   * response: `AppError` subclasses use their own `status`/`message`,
   * anything else becomes a generic 500.
   *
   * @param req - Incoming request.
   * @param res - Response to write to.
   */
  async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      await this.dispatch(req, res);
    } catch (e) {
      if (e instanceof AppError) {
        sendJson(res, e.status, { error: e.message });
      } else {
        sendJson(res, 500, { error: "Error interno" });
      }
    }
  }

  /**
   * Matches the request method/URL against the known routes and invokes
   * the corresponding handler. Any path not matching a known route is
   * treated as a short-code redirect lookup.
   *
   * @param req - Incoming request.
   * @param res - Response to write to.
   */
  private async dispatch(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const { method = "GET", url = "/" } = req;

    if (url === "/" || url === "/index.html") {
      return sendHtml(res, 200, this.homePage);
    }

    if (url === "/health" && method === "GET") {
      return sendJson(res, 200, { status: "ok", uptime: process.uptime() });
    }

    if (url === "/api/links" && method === "GET") {
      return this.controller.list(req, res);
    }

    if (url === "/api/shorten" && method === "POST") {
      return this.controller.shorten(req, res);
    }

    return this.controller.redirect(url.slice(1), res);
  }
}
