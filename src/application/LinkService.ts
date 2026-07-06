import type { CodeGenerator } from "../domain/CodeGenerator.ts";
import { ConflictError, NotFoundError } from "../domain/errors.ts";
import type { Link } from "../domain/Link.ts";
import type { LinkRepository } from "../domain/LinkRepository.ts";
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

  /**
   * @param repository - Storage backend for links.
   * @param codeGenerator - Strategy used to generate short codes when no alias is provided.
   * @param validator - Input validator; defaults to a new {@link LinkValidator} instance.
   */
  constructor(
    repository: LinkRepository,
    codeGenerator: CodeGenerator,
    validator: LinkValidator = new LinkValidator()
  ) {
    this.repository = repository;
    this.codeGenerator = codeGenerator;
    this.validator = validator;
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
    this.validator.assertValidUrl(request.url);

    const useAlias = this.validator.hasAlias(request.alias);
    if (useAlias) {
      this.validator.assertValidAlias(request.alias);
    }

    const code = useAlias ? (request.alias as string) : this.codeGenerator.generate();

    if (useAlias && this.repository.findByCode(code)) {
      throw new ConflictError("El alias ya está en uso");
    }

    this.repository.save(code, request.url);
    return { code };
  }

  /**
   * Resolves a short code to its destination URL and records a visit.
   *
   * @param code - Short code to resolve.
   * @returns The destination URL.
   * @throws {NotFoundError} If no link exists for `code`.
   */
  resolve(code: string): string {
    const link = this.repository.findByCode(code);
    if (!link) {
      throw new NotFoundError("No encontrado");
    }
    this.repository.incrementVisits(code);
    return link.url;
  }

  /**
   * Lists every stored link.
   *
   * @returns All links, newest first.
   */
  list(): Link[] {
    return this.repository.findAll();
  }
}
