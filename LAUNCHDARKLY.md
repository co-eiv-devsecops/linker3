# LaunchDarkly Setup

This project uses [LaunchDarkly](https://3.n-la-c.app/ld-home) for feature flag management.

## SDK Details

- **SDK**: Node.js Server SDK (`@launchdarkly/node-server-sdk`)
- **SDK Type**: server-side
- **Key Type**: SDK Key
- **Installed via**: `npm install @launchdarkly/node-server-sdk`
- **Initialization file**: `src/container.ts` (composition root); `waitForInitialization` called in `src/main.ts`

## Configuration

The SDK key is configured via the `LAUNCHDARKLY_SDK_KEY` environment variable.

- **Do not hardcode** the SDK key in source code.
- The key is in `.env` locally (already in `.gitignore`). `npm start` loads `.env` automatically via Node's `--env-file-if-exists` flag.
- When `LAUNCHDARKLY_SDK_KEY` is unset (e.g. in tests or CI), the client falls back to **offline mode** so `createApp()` doesn't throw — flags evaluate to their default value in that case.
- For production, set `LAUNCHDARKLY_SDK_KEY` in the deployment environment (the Oracle Cloud VM's `/opt/linker/.env`, loaded by the systemd `EnvironmentFile` directive).

## Where to Find Things

| What | Where |
|------|-------|
| Feature flags dashboard | https://3.n-la-c.app/ld-dashboard |
| Project settings | https://3.n-la-c.app/ld-project-settings |
| Environments | https://3.n-la-c.app/ld-environments |
| API access tokens | https://3.n-la-c.app/ld-api-tokens |
| SDK documentation | https://3.n-la-c.app/ld-sdk-docs |
| LaunchDarkly docs | https://3.n-la-c.app/ld-docs |

## How Feature Flags Work in This Project

1. Flags are evaluated using the LaunchDarkly SDK, via the `ldClient` instance created in `src/container.ts` and injected into `Router`.
2. Flag values are fetched from LaunchDarkly based on the evaluation context (currently a static demo user; use a real user/context per request as the app grows).
3. Changes to flags in the dashboard take effect within seconds (server-side SDK uses streaming by default).

### Example: Evaluating a Flag

```typescript
// src/presentation/Router.ts
const context = { kind: "user", key: "demo-user" };
const enabled = await this.ldClient.boolVariation("my-first-flag", context, false);
```

A working demo endpoint is live at `GET /launchdarkly-demo` — returns the current state of `my-first-flag` as JSON. Safe to remove once you no longer need it as a reference.

### Launching a Feature Without a Deploy

Because the server-side SDK streams flag changes in real time (point 3
above), turning a flag on/off in a given environment takes effect on the
already-running process — no rebuild, no redeploy. `.github/workflows/feature-launch.yml`
automates exactly that: a manual (`workflow_dispatch`) pipeline that calls
LaunchDarkly's Management API to flip a flag, completely separate from
`ci-cd-prod.yml` (which builds and deploys code). See the
["Despliegue vs. lanzamiento de funcionalidad"](README.md#despliegue-vs-lanzamiento-de-funcionalidad)
section in the README for when to use each one. Requires the
`LAUNCHDARKLY_API_TOKEN` repo secret (a LaunchDarkly **API access token**
with write access to flags — not the same as `LAUNCHDARKLY_SDK_KEY`).

## Next Steps

### Feature Flag Best Practices
- **Use flags for every new feature**: Wrap new features in flags so you can release and roll back independently of deployments.
- **Clean up temporary flags**: Mark flags as temporary during creation and archive them when no longer needed.
- **Use descriptive flag keys**: e.g., `enable-checkout-v2` instead of `flag-1`.

### Advanced Capabilities
- **[Percentage Rollouts](https://3.n-la-c.app/ld-rollouts)** — Gradually roll out features to a percentage of users.
- **[Targeting Rules](https://3.n-la-c.app/ld-targeting-rules)** — Target specific users, segments, or contexts.
- **[Experimentation](https://3.n-la-c.app/ld-experimentation)** — Run A/B tests and measure the impact of flag variations.
- **[Guarded Rollouts](https://3.n-la-c.app/ld-guarded-rollouts)** — Automatically roll back flag changes based on metric guardrails.
- **[Observability](https://3.n-la-c.app/ld-observability)** — Monitor flag evaluations and SDK performance with built-in telemetry.

### Agent Integration (MCP Server)

This repo's `.mcp.json` already configures the LaunchDarkly hosted MCP server (OAuth, no tokens in config). With it, an agent can:

- Create and manage flags
- Toggle flags on/off across environments
- Set up targeting rules and rollouts
- Find stale/temporary flags ready to archive
- Run experiments

### Useful CLI Commands

If you have `ldcli` installed:

| Command | Description |
|---------|-------------|
| `ldcli flags list --project default` | List all feature flags |
| `ldcli flags toggle-on --project default --environment production --flag FLAG_KEY` | Turn a flag on |
| `ldcli flags create --project default --data '{"name": "My Flag", "key": "my-flag", "kind": "boolean"}'` | Create a new flag |
| `ldcli environments list --project default` | List environments and SDK keys |

## Aprendizaje continuo y experimentación

> Nota de alcance: esta sección documenta **cómo se diseñaría y evaluaría** un
> experimento con un flag existente del proyecto. No se corrió ningún
> experimento real con tráfico de producción ni se creó un flag nuevo en
> LaunchDarkly — es un plan, no un resultado.

### Caso concreto: `FEATURE_NEW_CODE_GEN`

El proyecto ya tiene dos implementaciones intercambiables de
[`CodeGenerator`](src/domain/CodeGenerator.ts):

- **`RandomCodeGenerator`** (control, hoy activo por defecto): `randomBytes(4).toString("hex")` — 8 caracteres hex, ~4.3×10⁹ códigos posibles.
- **`SecureCodeGenerator`** (tratamiento): 8 llamadas a `crypto.randomInt` sobre un alfabeto base62 — 8 caracteres, ~2.2×10¹⁴ códigos posibles (~50.000× más espacio de claves, así que en teoría reduce mucho la probabilidad de colisión de código).

Hoy, `FEATURE_NEW_CODE_GEN` es un booleano leído **una sola vez al arrancar**
(`loadConfig()` en [src/config.ts](src/config.ts)) y usado en
[src/container.ts](src/container.ts) para elegir el generador — no hay
evaluación por request ni rollout gradual posible tal como está.

**Prerrequisito técnico para poder experimentar de verdad:** mover la
decisión de "una vez al boot" a "una vez por request", evaluando el flag con
el SDK de LaunchDarkly (`ldClient.boolVariation("new-code-gen", context,
false)`) de la misma forma en que ya se hace con `my-first-flag` en
[src/presentation/Router.ts](src/presentation/Router.ts). Sin ese cambio, un
rollout por porcentaje no tiene efecto: todo el proceso queda fijo en una
sola variación desde que arranca.

#### Plan de rollout gradual (hipotético)

| Etapa | % en `SecureCodeGenerator` | Duración mínima | Condición para avanzar |
|---|---|---|---|
| 0 | 0% (baseline) | hasta reunir ≥ 500 `shorten()` con el control | Recolectar línea base de `shorten_duration_ms` |
| 1 | 10% | hasta ≥ 500 `shorten()` en tratamiento | p95 tratamiento ≤ p95 control + 10% |
| 2 | 25% | ídem | ídem |
| 3 | 50% | ídem | ídem |
| 4 | 100% | — | Confirmar en etapa 3 y promover |

Cualquier etapa que rompa la condición de avance detiene el rollout (guarded
rollout manual) y vuelve la variación afectada a 0%.

#### Métricas de OpenTelemetry ya expuestas usadas para evaluar

Ambas ya se emiten desde [src/application/LinkService.ts](src/application/LinkService.ts)
vía el `Meter` real conectado en `container.ts`
([src/infrastructure/telemetry/OtelMeter.ts](src/infrastructure/telemetry/OtelMeter.ts)):

- **`shorten_duration_ms`** (histograma) — métrica primaria/guardrail. Se
  compara la distribución (p50/p95) entre las peticiones servidas por cada
  variación del flag (usando el atributo de variación como dimensión, o
  segmentando por ventana de tiempo si no se etiqueta por variación). Como
  `SecureCodeGenerator` hace 8 llamadas a `randomInt` en un loop en vez de una
  sola llamada a `randomBytes`, es la métrica más directa para detectar una
  regresión de latencia introducida por el generador nuevo.
- **`links_created_total`** (contador) — métrica de exposición/tamaño de
  muestra. Se usa para saber cuándo cada etapa acumuló suficiente volumen
  (≥ 500 eventos en la tabla de arriba) como para confiar en la comparación
  de percentiles y no promover con una muestra demasiado chica.

#### Cómo se decidiría el resultado

1. Con `links_created_total` como contador de muestra, esperar al mínimo de
   la etapa antes de mirar cualquier otra cosa.
2. Comparar p95 de `shorten_duration_ms` entre control y tratamiento. Si el
   tratamiento se mantiene dentro de +10% del control, se avanza a la
   siguiente etapa.
3. Si el tratamiento regresiona más de 10%, o si aparece cualquier error
   inesperado del generador (`RangeError` de longitud inválida, que hoy solo
   se dispara en construcción, no en `generate()`), se revierte el flag a 0%
   y se documenta la causa antes de reintentar.
4. Al llegar al 100% sostenido en la etapa 3, se promueve la variación
   ganadora y se planea el retiro del flag (ver
   `.claude/skills/launchdarkly-flag-cleanup` de este mismo repo) para no
   dejarlo indefinidamente en el código como un flag "temporal" olvidado.

Referencias de LaunchDarkly usadas para diseñar este plan:
[rollouts por porcentaje](https://3.n-la-c.app/ld-rollouts),
[experimentation](https://3.n-la-c.app/ld-experimentation),
[guarded rollouts](https://3.n-la-c.app/ld-guarded-rollouts), y el concepto de
[métricas en OpenTelemetry](https://3.n-la-c.app/otel-metrics) para el
razonamiento de percentiles/histogramas.

### Retrospectiva / lecciones aprendidas

Lecciones concretas de este repo, no genéricas — cada una atada a un commit
real para que se puedan verificar:

- **No asumir que "ya existe" sin verificarlo.** Al implementar las métricas
  de negocio (`feat(metrics)`, `8cf452b`) se asumió que
  ya existía un `Meter` de una tarea previa ("tarea 1"); no existía en
  ninguna rama. Se construyó un puerto mínimo propio, y semanas después otro
  PR (`feat(telemetry): instrument app with OpenTelemetry`,
  `9688831`, y su fix
  `d8357cc`) reemplazó el `UpDownCounter` original por
  un `Gauge` real de OTel. Lección: verificar el estado real del código antes
  de construir sobre un prerrequisito asumido, y esperar que ese diseño
  cambie cuando el resto del equipo lo conecte a algo real.
- **La cobertura y los umbrales hay que medirlos, no asumirlos.** Antes de
  subir el gate de cobertura de 85% a 90% (`b2ba8f4`) se
  verificó con `lcov` que el código de producción ya estaba al 100% — la
  tarea asumía huecos de cobertura que ya no existían. Lección: un ticket
  puede quedar desactualizado respecto al estado real del código; conviene
  medir antes de escribir tests de relleno.
- **La documentación se desactualiza más rápido de lo que parece.**
  `CONTRIBUTING.md` seguía refiriendo `server.js` y `npm run test:ts`, restos
  de una arquitectura ya eliminada (`5539576 chore: remove server, db, and
  links modules`). Se corrigió junto con el resto de `.github/`
  (`fc39489`). Lección: actualizar la doc en el mismo
  PR que borra o mueve código, no como tarea aparte después.
- **Los conflictos de merge en archivos de configuración compartidos hay que
  resolverlos línea por línea, no con "aceptar todo".** Al agregar
  `--experimental-strip-types` a los scripts de `package.json`
  (`e9b829b`), otra rama en paralelo había agregado
  `--env-file-if-exists=.env` a los mismos scripts. Ni "aceptar actual" ni
  "aceptar entrante" ni "aceptar ambos" daban un `package.json` válido —
  había que combinar los dos flags a mano en cada línea. Lección: en
  archivos como `package.json` que todo el equipo toca, un conflicto de
  merge casi nunca se resuelve con un botón; hay que leer qué significa cada
  lado.
- **No todo se puede arreglar con un PR.** `CODEOWNERS`
  (`ba36fa4`) solo tiene efecto real si además alguien
  con permisos de admin activa "Require review from Code Owners" en la
  protección de rama — eso vive en la configuración de GitHub, no en el
  repo, y ningún commit lo puede activar. Lección: distinguir explícitamente
  qué parte de una tarea de infraestructura es "código" y qué parte es un
  paso manual fuera del repo, y dejarlo anotado para que no se dé por hecho.
- **El entorno local diverge del de CI en formas silenciosas.** El hook
  `pre-push` empezó a fallar en una máquina con Node 22.14.0 porque esa
  versión puntual no soporta ejecutar `.ts` sin
  `--experimental-strip-types`, mientras que en CI la versión resuelta por
  `setup-node@v4` con `node-version: "22"` sí lo soporta por defecto. Lección:
  fijar comportamiento explícitamente en los scripts (no depender del patch
  exacto que cada quien tenga instalado) evita que "funciona en mi máquina"
  se convierta en "no me deja hacer push".
