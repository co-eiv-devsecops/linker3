import { performance } from "node:perf_hooks";
import type { CodeGenerator } from "../domain/CodeGenerator.ts";
import { ConflictError, NotFoundError } from "../domain/errors.ts";
import type { Link } from "../domain/Link.ts";
import type { LinkRepository } from "../domain/LinkRepository.ts";
import { logger as defaultLogger, type Logger } from "../infrastructure/Logger.ts";
import {
  type Counter,
  meter as defaultMeter,
  type Gauge,
  type Histogram,
  type Meter,
} from "../infrastructure/Metrics.ts";
import { tracer as defaultTracer } from "../infrastructure/telemetry/otel.ts";
import { type TracerLike, withSpan } from "../infrastructure/telemetry/Tracing.ts";
import type { ShortenRequest, ShortenResult } from "./dto.ts";
import { LinkValidator } from "./LinkValidator.ts";

/**
 * Application service implementing the core link-shortening use cases:
 * shortening a URL, resolving a code back to its URL, and listing all
 * stored links.
 *
 * Orchestrates the {@link LinkRepository}, {@link CodeGenerator}, and
 * {@link LinkValidator} collaborators without depending on any specific
 * storage or transport implementation.
 */
export class LinkService {
  private readonly repository: LinkRepository;
  private readonly codeGenerator: CodeGenerator;
  private readonly validator: LinkValidator;
  private readonly logger: Logger;
  private readonly linksCreatedTotal: Counter;
  private readonly redirectsTotal: Counter;
  private readonly activeLinks: Gauge;
  private readonly inFlightRedirects: Gauge;
  private readonly shortenDurationMs: Histogram;
  private readonly redirectDurationMs: Histogram;
  private readonly tracer: TracerLike;
  private activeLinksCount = 0;
  private inFlightRedirectsCount = 0;

  /**
   * @param repository - Storage backend for links.
   * @param codeGenerator - Strategy used to generate short codes when no alias is provided.
   * @param validator - Input validator; defaults to a new {@link LinkValidator} instance.
   * @param logger - Logger used to record business events; defaults to the shared console logger.
   * @param meter - Metrics port used to record business metrics; defaults to the shared no-op meter.
   */
  constructor(
    repository: LinkRepository,
    codeGenerator: CodeGenerator,
    validator: LinkValidator = new LinkValidator(),
    logger: Logger = defaultLogger,
    meter: Meter = defaultMeter,
    tracer: TracerLike = defaultTracer
  ) {
    this.repository = repository;
    this.codeGenerator = codeGenerator;
    this.validator = validator;
    this.logger = logger;
    this.tracer = tracer;
    this.linksCreatedTotal = meter.createCounter("links_created_total", {
      unit: "1",
      description: "Total de enlaces cortos creados",
    });
    this.redirectsTotal = meter.createCounter("redirects_total", {
      unit: "1",
      description: "Total de redirecciones resueltas",
    });
    this.activeLinks = meter.createGauge("active_links", {
      unit: "1",
      description: "Enlaces actualmente almacenados",
    });
    this.inFlightRedirects = meter.createGauge("in_flight_redirects", {
      unit: "1",
      description: "Redirecciones en curso de resolución",
    });
    this.shortenDurationMs = meter.createHistogram("shorten_duration_ms", {
      unit: "ms",
      description: "Duración de shorten()",
    });
    this.redirectDurationMs = meter.createHistogram("redirect_duration_ms", {
      unit: "ms",
      description: "Duración de resolve()",
    });
  }

  /**
   * Creates a new short link for the given URL, optionally using a
   * custom alias instead of an auto-generated code.
   *
   * @param request - The URL to shorten and an optional custom alias.
   * @returns The resulting short code.
   * @throws {ValidationError} If the URL or alias fails validation.
   * @throws {ConflictError} If the requested alias is already taken.
   */
  shorten(request: ShortenRequest): ShortenResult {
    return withSpan(
      this.tracer,
      "link.shorten",
      { url: request.url, has_alias: this.validator.hasAlias(request.alias) },
      (span) => {
        const start = performance.now();
        this.validator.assertValidUrl(request.url);

        const useAlias = this.validator.hasAlias(request.alias);
        if (useAlias) {
          this.validator.assertValidAlias(request.alias);
        }

        const code = useAlias ? (request.alias as string) : this.codeGenerator.generate();
        span.setAttribute("code", code);

        if (useAlias && this.repository.findByCode(code)) {
          throw new ConflictError("El alias ya está en uso");
        }

        this.repository.save(code, request.url);
        this.logger.info("Enlace creado", { code, url: request.url, alias: useAlias });

        this.linksCreatedTotal.add(1);
        this.activeLinksCount += 1;
        this.activeLinks.record(this.activeLinksCount);
        this.shortenDurationMs.record(performance.now() - start);

        return { code };
      }
    );
  }

  /**
   * Resolves a short code to its destination URL and records a visit.
   *
   * @param code - Short code to resolve.
   * @returns The destination URL.
   * @throws {NotFoundError} If no link exists for `code`.
   */
  resolve(code: string): string {
    const start = performance.now();
    this.inFlightRedirectsCount += 1;
    this.inFlightRedirects.record(this.inFlightRedirectsCount);
    try {
      return withSpan(this.tracer, "link.resolve", { code }, (resolveSpan) => {
        const link = this.repository.findByCode(code);
        resolveSpan.setAttribute("found", link !== null);
        if (!link) {
          throw new NotFoundError("No encontrado");
        }

        resolveSpan.setAttribute("url", link.url);

        withSpan(this.tracer, "link.visit.increment", { code, url: link.url }, () => {
          this.repository.incrementVisits(code);
        });

        this.logger.info("Redirección resuelta", { code, url: link.url });

        this.redirectsTotal.add(1);
        this.redirectDurationMs.record(performance.now() - start);

        return link.url;
      });
    } finally {
      this.inFlightRedirectsCount -= 1;
      this.inFlightRedirects.record(this.inFlightRedirectsCount);
    }
  }

  /**
   * Lists every stored link.
   *
   * @returns All links, newest first.
   */
  list(): Link[] {
    return withSpan(this.tracer, "link.list", {}, (span) => {
      const links = this.repository.findAll();
      span.setAttribute("count", links.length);
      this.logger.debug("Enlaces listados", { count: links.length });
      return links;
    });
  }
}
