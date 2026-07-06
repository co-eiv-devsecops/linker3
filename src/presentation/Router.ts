import type { IncomingMessage, ServerResponse } from "node:http";
import { AppError } from "../domain/errors.ts";
import { logger as defaultLogger, type Logger } from "../infrastructure/Logger.ts";
import { sendHtml, sendJson } from "./http.ts";
import type { LinkController } from "./LinkController.ts";

/**
 * Top-level HTTP request dispatcher.
 *
 * Routes incoming requests to the home page, health check, or
 * {@link LinkController} handlers, and centralizes error handling by
 * converting thrown {@link AppError}s (and unexpected errors) into JSON
 * error responses. Every request is logged on completion.
 */
export class Router {
  private readonly controller: LinkController;
  private readonly homePage: string;
  private readonly logger: Logger;

  /**
   * @param controller - Controller handling link-related routes.
   * @param homePage - HTML markup served for `/` and `/index.html`.
   * @param logger - Logger used to record each request; defaults to the
   * shared console logger.
   */
  constructor(
    controller: LinkController,
    homePage: string,
    logger: Logger = defaultLogger
  ) {
    this.controller = controller;
    this.homePage = homePage;
    this.logger = logger;
  }

  /**
   * Entry point invoked for every incoming HTTP request. Delegates to
   * {@link dispatch} and translates any thrown error into a JSON
   * response: `AppError` subclasses use their own `status`/`message`,
   * anything else becomes a generic 500. Logs the outcome of every
   * request, including a stack trace for unexpected errors.
   *
   * @param req - Incoming request.
   * @param res - Response to write to.
   */
  async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const start = Date.now();
    const { method = "GET", url = "/" } = req;

    try {
      await this.dispatch(req, res);
      this.logger.info(`${method} ${url}`, { ms: Date.now() - start });
    } catch (e) {
      const ms = Date.now() - start;
      if (e instanceof AppError) {
        sendJson(res, e.status, { error: e.message });
        this.logger.warn(`${method} ${url}`, { status: e.status, error: e.message, ms });
      } else {
        sendJson(res, 500, { error: "Error interno" });
        const error = e instanceof Error ? (e.stack ?? e.message) : String(e);
        this.logger.error(`${method} ${url}`, { status: 500, error, ms });
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
