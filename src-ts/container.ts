import { createServer, type Server } from "node:http";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { AppConfig } from "./config.ts";
import { LinkService } from "./application/LinkService.ts";
import { LinkValidator } from "./application/LinkValidator.ts";
import { RandomCodeGenerator } from "./infrastructure/RandomCodeGenerator.ts";
import { SqliteLinkRepository } from "./infrastructure/SqliteLinkRepository.ts";
import { LinkController } from "./presentation/LinkController.ts";
import { Router } from "./presentation/Router.ts";

export interface App {
  server: Server;
  repository: SqliteLinkRepository;
}

export function createApp(config: AppConfig, homePage?: string): App {
  const ui =
    homePage ??
    readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "..", "public", "index.html"),
      "utf8"
    );

  const repository = new SqliteLinkRepository(config.dbPath);
  const codeGenerator = new RandomCodeGenerator();
  const validator = new LinkValidator();
  const service = new LinkService(repository, codeGenerator, validator);
  const controller = new LinkController(service, config.baseUrl);
  const router = new Router(controller, ui);

  const server = createServer((req, res) => {
    void router.handle(req, res);
  });

  return { server, repository };
}
