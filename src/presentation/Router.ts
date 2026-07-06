import type { IncomingMessage, ServerResponse } from "node:http";
import { AppError } from "../domain/errors.ts";
import { sendHtml, sendJson } from "./http.ts";
import type { LinkController } from "./LinkController.ts";

export class Router {
  private readonly controller: LinkController;
  private readonly homePage: string;

  constructor(controller: LinkController, homePage: string) {
    this.controller = controller;
    this.homePage = homePage;
  }

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
