# Guía de contribución

Gracias por contribuir a **Linker**. Esta guía cubre el flujo completo desde
clonar el repositorio hasta que tu cambio queda mergeado.

## 1. Preparar el entorno

```bash
git clone https://github.com/co-eiv-devsecops/linker3.git
cd linker3
npm ci                      # instala husky y las devDependencies (biome, typescript)
cp .env.example .env        # ajusta BASE_URL si es necesario
npm start                   # http://localhost:3000
```

Requisitos:

- **Node.js >= 22** (el proyecto usa `node:sqlite`, integrado desde v22).
- Sin dependencias de producción: no agregues paquetes npm al runtime sin
  discutirlo antes en un issue.

`npm ci` registra automáticamente los git hooks de Husky (ver
[Git hooks](#6-git-hooks-husky) más abajo); no hace falta ningún paso extra.

Alternativa reproducible sin instalar Node localmente: `.devcontainer/`
(Dev Containers) — ver [README.md](../README.md#devcontainer).

## 2. Flujo de trabajo (branching)

El repositorio sigue un flujo trunk-based con `develop` como rama tronco:

```
feature/mi-cambio  →  develop  →  main
```

1. Crea tu rama a partir de `develop`: `feature/<descripcion>` (o
   `fix/<descripcion>` para correcciones). Mantenla corta y enfocada en un
   solo cambio — cuanto más viva una rama, más se aleja de `develop`.
2. Trabaja en TDD (ver sección siguiente) y confirma en local que
   `npm test`, `npm run typecheck` y `npm run lint` pasan antes de subir.
3. Sube tu rama y abre el PR contra `develop` usando la plantilla
   (se completa automáticamente). El CI (`ci-cd-dev.yml`) se dispara solo:
   lint + typecheck → tests + cobertura → auditoría de dependencias.
4. **El PR es obligatorio**: nadie mergea directo a `develop` ni a `main`.
   Necesitas el CI en verde y al menos una aprobación de review antes de
   mergear.
5. `main` solo recibe merges desde `develop` (release); despliega a
   producción vía `ci-cd-prod.yml`.

## 3. TDD (Test-Driven Development)

Los cambios de comportamiento en `src/` se desarrollan con el ciclo
**red → green → refactor**:

1. **Red**: escribe primero el test en `test/` que exprese el comportamiento
   esperado (unitario para `application`/`domain`, o vía
   `app.integration.test.ts` si cruza capas). Ejecuta `npm test` y confirma
   que falla por la razón correcta (no por un typo o import roto).
2. **Green**: escribe el mínimo código en `src/` para que el test pase.
   No adelantes casos que el test todavía no exige.
3. **Refactor**: con el test en verde como red de seguridad, limpia el
   diseño (nombres, duplicación) sin cambiar comportamiento. Vuelve a
   correr `npm test` tras cada ajuste.

Ejemplo del ciclo aplicado a una regla de validación nueva:

```ts
// 1. Red — test/LinkValidator.test.ts
test("assertValidAlias rechaza alias con emoji", () => {
  assert.throws(() => validator.assertValidAlias("abc😀"), ValidationError);
});

// 2. Green — src/application/LinkValidator.ts
//    ajustar ALIAS_REGEX (o la lógica) hasta que el test pase.

// 3. Refactor — con el test en verde, simplificar si hace falta.
```

Todo PR con cambios en `src/` debe llegar con tests que fallen sin el
cambio y pasen con él. Un PR sin tests para comportamiento nuevo no se
aprueba en review.

## 4. Ejecutar tests y cobertura localmente

```bash
npm test                    # toda la suite (test/**/*.test.ts)
npm run test:coverage       # suite + reporte de cobertura en consola
npm run test:coverage:check # igual, pero falla si baja del umbral (ver package.json)
npm run typecheck           # verificación de tipos (tsc --noEmit)
npm run lint                 # biome lint .
npm run format               # biome format --write . (autoformatea)
npm run check                # biome check --write . (lint + format en un paso)
```

El CI ejecuta `test:coverage:check`, que usa los umbrales nativos del test
runner de Node (`--test-coverage-lines/branches/functions`). El número
vigente vive en el script `test:coverage:check` de `package.json` — es la
única fuente de verdad; si lo subes, actualízalo ahí (no solo en
comentarios o docs).

## 5. Pruebas de integración contra una instancia en vivo

`test/**/*.test.ts` cubre lo unitario/integración local (`npm test`), pero
antes de mover tráfico en un despliegue blue/green hace falta validar la
instancia efímera que va a recibirlo. Dos scripts en `scripts/` cubren eso
— ambos requieren solo Python 3 (stdlib, sin `pip install`) y aceptan
`--base-url` para apuntar a cualquier instancia corriendo (local, la
efímera "green", producción):

**`test_requests.py`** — smoke test funcional: crea un link, confirma que
aparece en el listado, confirma que redirige a la URL correcta. Sale con
código 1 si algo falla.

```bash
python3 scripts/test_requests.py --base-url http://localhost:3000
python3 scripts/test_requests.py --base-url https://green.internal:3000 --timeout 5
```

**`load_test.py`** — prueba de carga escalonada: dobla la concurrencia en
etapas (2, 4, 8, 16...) contra `POST /api/shorten` hasta encontrar el
punto de quiebre (tasa de error o p95 de latencia por encima del umbral),
o hasta `--max-concurrency`. Por defecto es solo diagnóstico (sale 0 aunque
encuentre un quiebre); con `--min-concurrency-required N` se convierte en
un gate que falla si el quiebre aparece antes de `N`.

```bash
python3 scripts/load_test.py --base-url http://localhost:3000
python3 scripts/load_test.py --base-url https://green.internal:3000 \
  --start-concurrency 4 --max-concurrency 128 --requests-per-stage 50
python3 scripts/load_test.py --base-url https://green.internal:3000 \
  --min-concurrency-required 32   # falla el pipeline si no aguanta 32
```

`.github/workflows/blue-green-deploy-oci.yml` ya invoca ambos (job "2) QA en
green") contra la instancia green real, vía túnel de OCI Bastion. Los
resultados de ambos scripts (cada check, con su detalle) quedan en el log de
ese step.

## 6. Git hooks (Husky)

Se ejecutan automáticamente, sin pasos manuales:

- **pre-commit**: corre `biome check --write` sobre los `.ts`/`.json` en
  stage (autoformatea y re-agrega) y luego `npm run typecheck`. Si falla,
  el commit se aborta — corrige el error y vuelve a intentar.
- **pre-push**: corre `npm test`. Si algún test falla, el push se
  cancela.

Esto significa que si `npm test` falla localmente, ni siquiera podrás
hacer `git push` — no hay forma de saltarse esto por accidente.

## 7. Commits

Usamos [Conventional Commits](https://3.n-la-c.app/conventional-commits):

```
feat(api): agregar endpoint de estadísticas
fix(links): rechazar alias con espacios
chore(ci): actualizar versión de Node en workflows
docs(readme): documentar variables de entorno
test(links): cubrir colisión de códigos generados
```

Escribe el mensaje en imperativo y explica el *por qué* en el cuerpo si el
cambio no es obvio.

## 8. Links en la documentación

Todo link `http(s)://` externo en README, `LAUNCHDARKLY.md`, `docs/` o los
archivos de `.github/` debe pasar por el propio acortador de Linker antes
de mergear (dogfooding: es la funcionalidad central del proyecto).
`scripts/shorten_wiki_links.py` automatiza esto:

```bash
# Solo reporta qué links faltan por acortar, no toca archivos ni red.
# Es lo que corre .github/workflows/link-check.yml en cada PR.
python3 scripts/shorten_wiki_links.py --check

# Acorta de verdad: llama a POST /api/shorten contra producción y
# reescribe los archivos con los links cortos resultantes.
python3 scripts/shorten_wiki_links.py

# Contra una instancia local en vez de producción (útil para probar el
# script sin escribir en la base de datos real):
python3 scripts/shorten_wiki_links.py --base-url http://localhost:3000
```

Requiere solo Python 3 (stdlib, sin `pip install`). No marca como
pendientes: links a `localhost`/`127.0.0.1`, links que ya apuntan al propio
Linker (evita acortar un short link de nuevo), y cualquier URL dentro de un
bloque de código o `\texttt{}`/`\begin{lstlisting}` — esos son comandos de
ejemplo (`git clone`, `curl`), no referencias de lectura; acortarlos los
rompería (`git clone` contra un link acortado falla, porque git pide
`/info/refs?service=git-upload-pack` y el router de Linker no resuelve
sub-rutas). Si un link sobrevive a esas reglas pero aun así no debe
acortarse (p. ej. el badge de CI del README, que es una imagen en vivo),
agrégalo a `scripts/shorten_wiki_links.allowlist` en vez de ignorar el
error del CI.

El check corre en un workflow separado (`link-check.yml`), no en `ci.yml`,
porque `ci.yml` ignora a propósito los cambios que solo tocan `.md`/`docs/`
(para no gastar minutos de Actions en typecheck/lint/tests que no aplican)
— exactamente los cambios que este check necesita revisar.

## 9. Convenciones de código

- **Frontend** (`public/index.html`): construir el DOM con
  `createElement`/`textContent`, **nunca** `innerHTML` — las URLs son
  entrada de usuario y esto previene XSS almacenado.
- **Infraestructura**: si editas `cloud-init.yaml`, sincroniza
  `infra/scripts/provision.sh` (y viceversa); son el mismo script en dos
  sitios.
- **Mensajes de error de la API**: en español, consistentes con los
  existentes (`URL inválida`, `No encontrado`…). Cambiarlos es un breaking
  change para los tests.
- No comitees `linker.db`, `node_modules/` ni credenciales
  (`terraform.tfvars` está gitignoreado a propósito).

## 10. Issues

Usa los formularios de issue (bug, funcionalidad, tarea técnica). Para
dudas de uso sin definir aún, abre una
[discusión](https://3.n-la-c.app/gh-discussions) en
vez de un issue. Para vulnerabilidades de seguridad **no abras un issue
público**: sigue [SECURITY.md](SECURITY.md).

## Código de conducta

Participar en este proyecto implica aceptar el
[Código de conducta](CODE_OF_CONDUCT.md).
