# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Run locally
npm start

# Typecheck (no build step — Node runs .ts files directly)
npm run typecheck

# Run tests
npm test

# Run tests with coverage (85% line/branch/function threshold)
npm run test:coverage:check

# Lint / format (Biome)
npm run lint       # biome lint .
npm run format     # biome format --write .
npm run check      # biome check --write . (lint + format + import sort)

# Deploy to Oracle Cloud VM (git pull + restart; requires .ssh/linkervm-3.key)
bash infra/scripts/deploy.sh

# Create the production VM in Oracle Cloud (see infra/terraform-oracle/README.md)
cd infra/terraform-oracle && terraform init && terraform apply

# Local environment-parity demo via Terraform + Docker
cd infra/terraform && terraform init && terraform apply
```

No build step. `package.json` has `"type": "module"`; Node 22+ runs the `.ts` sources directly (native type stripping) — no bundler/transpiler needed at runtime. `node:sqlite` (DatabaseSync) is a Node.js built-in only available from v22 (no `--experimental-sqlite` flag needed from v22.13). TypeScript is a devDependency used only for `tsc --noEmit` typechecking.

**Biome** (`biome.json`) handles linting, formatting, and import sorting — recommended rules, 2-space indent, double quotes, scoped to `src/**` and `test/**`. **Husky** (`.husky/`) wires git hooks: `pre-commit` runs `biome check --write` on staged `.ts`/`.json` files (re-staging fixes) plus `tsc --noEmit`; `pre-push` runs the full test suite. Hooks activate automatically via the `prepare` script on `npm install`.

## Architecture

**Linker** is a URL shortener with no runtime npm dependencies: a raw Node.js `http` server composed in `src/container.ts`, backed by an embedded SQLite database (`linker.db`), serving a single-page frontend from `public/index.html`. Code follows a layered/hexagonal structure under `src/`.

### Layers

- `src/main.ts` — entry point: loads config, builds the app, starts listening.
- `src/container.ts` — composition root: wires repository, code generator, validator, service, controller, router into an `http.Server`.
- `src/config.ts` — `loadConfig(env)` resolves `AppConfig` (port/baseUrl/dbPath) from environment variables.
- `src/domain/` — `Link`, `LinkRepository` interface, `CodeGenerator` interface, `errors.ts` (`AppError` and subclasses: `ValidationError`, `ConflictError`, `NotFoundError`).
- `src/application/` — `LinkService` (use cases: shorten/resolve/list), `LinkValidator` (URL/alias validation), `dto.ts`.
- `src/infrastructure/` — `SqliteLinkRepository` (data access via `node:sqlite`, auto-creates schema), `RandomCodeGenerator` (8-char hex codes).
- `src/presentation/` — `Router` (dispatch), `LinkController` (request handling per route), `http.ts` (`sendJson`/`sendHtml` helpers).

### Routes

| Route | Method | Behaviour |
|---|---|---|
| `/` | GET | Serves `public/index.html` |
| `/api/links` | GET | Returns all links `[{ code, url, visits }]`, newest first |
| `/api/shorten` | POST | Accepts `{ url, alias? }` JSON, returns `{ short: "<BASE_URL>/<code>" }` (201), or `{ error }` (400/409). Alias rules: letters/digits/`-`/`_`, 3–30 chars; `409` if already taken. |
| `/:code` | GET | Looks up `code`, increments `visits`, issues a 302 redirect |

Short URLs are built from `BASE_URL` (not hardcoded).

SQLite schema (auto-created on first run):

```sql
CREATE TABLE IF NOT EXISTS links (
  code    TEXT PRIMARY KEY,
  url     TEXT NOT NULL,
  visits  INTEGER DEFAULT 0
)
```

### public/index.html

Vanilla JS, no framework. Calls `POST /api/shorten`, lists existing links from `GET /api/links`, copies to clipboard. Link rows are built with `createElement`/`textContent` (never `innerHTML`) because stored URLs are user input — keep it that way to avoid stored XSS.

## Environment variables

| Variable | Default | Notes |
|---|---|---|
| `PORT` | `3000` | Listening port |
| `BASE_URL` | `http://localhost:${PORT}` | Base for generated short URLs and startup log |
| `DB_PATH` | `linker.db` | SQLite file path |

## Deployment / IaC

Production is `https://3.n-la-c.app`, an Oracle Cloud VM behind nginx (reverse proxy on :80) with the app as the `linker` systemd service in `/opt/linker`.

- `cloud-init.yaml` (repo root) — provisions a fresh Ubuntu VM: Node 22, systemd unit, nginx config, clones the repo. Provider-agnostic.
- `infra/scripts/provision.sh` — standalone copy of the script embedded in `cloud-init.yaml` (`write_files` → `/opt/provision.sh`). **If you edit one, sync the other.**
- `infra/terraform-oracle/` — creates the real OCI VM (`VM.Standard.E5.Flex`, region `sa-bogota-1`) and injects `cloud-init.yaml` as `user_data`. Requires configured `oci` CLI and a `terraform.tfvars` (gitignored) with `compartment_id`/`subnet_id`.
- `infra/terraform/` + `infra/docker/` — local parity demo: same runtime environment (Node 22) as a Docker container, no cloud credentials needed.
- `.devcontainer/` — codified dev environment (Node 22 image, port 3000 forwarded).
- `infra/scripts/deploy.sh` — updates an already-provisioned VM: SSH in, `git pull` in `/opt/linker`, restart the `linker` service.
