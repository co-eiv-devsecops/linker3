import type { IncomingMessage, ServerResponse } from "node:http";
import type { LinkService } from "../application/LinkService.ts";
import { readJsonBody, sendJson, sendRedirect } from "./http.ts";

export class LinkController {
  private readonly service: LinkService;
  private readonly baseUrl: string;

  constructor(service: LinkService, baseUrl: string) {
    this.service = service;
    this.baseUrl = baseUrl;
  }

  list(_req: IncomingMessage, res: ServerResponse): void {
    sendJson(res, 200, this.service.list());
  }

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

  redirect(code: string, res: ServerResponse): void {
    const target = this.service.resolve(code);
    sendRedirect(res, target);
  }
}
