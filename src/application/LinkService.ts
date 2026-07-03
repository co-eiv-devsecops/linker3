import type { CodeGenerator } from "../domain/CodeGenerator.ts";
import type { Link } from "../domain/Link.ts";
import type { LinkRepository } from "../domain/LinkRepository.ts";
import { ConflictError, NotFoundError } from "../domain/errors.ts";
import type { ShortenRequest, ShortenResult } from "./dto.ts";
import { LinkValidator } from "./LinkValidator.ts";

export class LinkService {
  private readonly repository: LinkRepository;
  private readonly codeGenerator: CodeGenerator;
  private readonly validator: LinkValidator;

  constructor(
    repository: LinkRepository,
    codeGenerator: CodeGenerator,
    validator: LinkValidator = new LinkValidator()
  ) {
    this.repository = repository;
    this.codeGenerator = codeGenerator;
    this.validator = validator;
  }

  shorten(request: ShortenRequest): ShortenResult {
    this.validator.assertValidUrl(request.url);

    const useAlias = this.validator.hasAlias(request.alias);
    if (useAlias) {
      this.validator.assertValidAlias(request.alias);
    }

    const code = useAlias
      ? (request.alias as string)
      : this.codeGenerator.generate();

    if (useAlias && this.repository.findByCode(code)) {
      throw new ConflictError("El alias ya está en uso");
    }

    this.repository.save(code, request.url);
    return { code };
  }

  resolve(code: string): string {
    const link = this.repository.findByCode(code);
    if (!link) {
      throw new NotFoundError("No encontrado");
    }
    this.repository.incrementVisits(code);
    return link.url;
  }

  list(): Link[] {
    return this.repository.findAll();
  }
}
