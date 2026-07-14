import type { IncomingMessage, ServerResponse } from "node:http";
import type { LDClient } from "@launchdarkly/node-server-sdk";
import { AppError } from "../domain/errors.ts";
import type { HealthChecker } from "../domain/HealthChecker.ts";
import { logger as defaultLogger, type Logger } from "../infrastructure/Logger.ts";
import { tracer as defaultTracer } from "../infrastructure/telemetry/otel.ts";
import { type TracerLike, withSpan } from "../infrastructure/telemetry/Tracing.ts";
import { sendHtml, sendJson } from "./http.ts";
import type { LinkController } from "./LinkController.ts";
import { openApiSpec } from "./openapiSpec.ts";

/** Content Security Policy for `/docs`, relaxed to allow the Swagger UI CDN bundle. */
const SWAGGER_CSP =
  "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; img-src 'self' data: https://cdn.jsdelivr.net; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";

const SWAGGER_UI_HTML = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Linker API — Documentación</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        url: "/openapi.json",
        dom_id: "#swagger-ui",
      });
    };
  </script>
</body>
</html>`;

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
  private readonly ldClient: LDClient;
  private readonly tracer: TracerLike;
  private readonly healthChecker: HealthChecker;

  /**
   * @param controller - Controller handling link-related routes.
   * @param homePage - HTML markup served for `/` and `/index.html`.
   * @param ldClient - Initialized LaunchDarkly client, used by the demo route.
   * @param logger - Logger used to record each request; defaults to the
   * shared console logger.
   * @param tracer - Tracer used to record the `http.request` span; defaults to the
   * shared OpenTelemetry tracer.
   * @param healthChecker - Dependency checked by `/healthz`; defaults to a
   * checker that always fails when MySQL is not configured.
   */
  constructor(
    controller: LinkController,
    homePage: string,
    ldClient: LDClient,
    logger: Logger = defaultLogger,
    tracer: TracerLike = defaultTracer,
    healthChecker: HealthChecker = {
      check: () => Promise.reject(new Error("MySQL no configurado")),
    }
  ) {
    this.controller = controller;
    this.homePage = homePage;
    this.ldClient = ldClient;
    this.logger = logger;
    this.tracer = tracer;
    this.healthChecker = healthChecker;
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
    const { method = "GET", url = "/" } = req;

    await withSpan(
      this.tracer,
      "http.request",
      { "http.method": method, "http.target": url },
      async (span) => {
        const start = Date.now();

        try {
          await this.dispatch(req, res);
          span.setAttribute("http.status_code", res.statusCode);
          this.logger.info(`${method} ${url}`, { ms: Date.now() - start });
        } catch (e) {
          const ms = Date.now() - start;
          if (e instanceof AppError) {
            span.setAttribute("http.status_code", e.status);
            span.setAttribute("error.type", e.constructor.name);
            sendJson(res, e.status, { error: e.message });
            this.logger.warn(`${method} ${url}`, {
              status: e.status,
              error: e.message,
              ms,
            });
          } else {
            span.setAttribute("http.status_code", 500);
            span.setAttribute("error.type", "UnexpectedError");
            sendJson(res, 500, { error: "Error interno" });
            const error = e instanceof Error ? (e.stack ?? e.message) : String(e);
            this.logger.error(`${method} ${url}`, { status: 500, error, ms });
          }
        }
      }
    );
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
      this.logger.debug("Chequeo de salud solicitado", { uptime: process.uptime() });
      return sendJson(res, 200, { status: "ok", uptime: process.uptime() });
    }

    if (url === "/healthz" && method === "GET") {
      try {
        await this.healthChecker.check();
        return sendJson(res, 200, { status: "ok" });
      } catch {
        return sendJson(res, 503, { status: "error" });
      }
    }

    // LaunchDarkly demo - safe to remove
    if (url === "/launchdarkly-demo" && method === "GET") {
      const context = { kind: "user", key: "demo-user" };
      const enabled = await this.ldClient.boolVariation("my-first-flag", context, false);
      // Deliver the evaluation event immediately instead of waiting for the
      // periodic 5s flush, so a single request reliably registers in
      // LaunchDarkly (e.g. onboarding "first event" detection).
      await this.ldClient.flush();
      return sendJson(res, 200, {
        flag: "my-first-flag",
        enabled,
        message: enabled
          ? "LaunchDarkly is working — the flag is ON"
          : "LaunchDarkly is working — the flag is OFF",
      });
    }

    if (url === "/openapi.json" && method === "GET") {
      return sendJson(res, 200, openApiSpec);
    }

    if ((url === "/docs" || url === "/docs/") && method === "GET") {
      return sendHtml(res, 200, SWAGGER_UI_HTML, {
        "Content-Security-Policy": SWAGGER_CSP,
      });
    }

    if (url === "/api/links" && method === "GET") {
      return this.controller.list(req, res);
    }

    if (url === "/api/shorten" && method === "POST") {
      return this.controller.shorten(req, res);
    }

    const deleteMatch = url.match(/^\/api\/links\/([^/?]+)$/);
    if (deleteMatch && method === "DELETE") {
      return this.controller.delete(decodeURIComponent(deleteMatch[1] as string), res);
    }

    if (method === "HEAD") {
      return this.controller.head(url.slice(1), res);
    }

    return this.controller.redirect(url.slice(1), res);
  }
}
