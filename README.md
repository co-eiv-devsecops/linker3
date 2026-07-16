# Linker

[![CI/CD - Prod](https://github.com/co-eiv-devsecops/linker3/actions/workflows/ci-cd-prod.yml/badge.svg?branch=main)](https://github.com/co-eiv-devsecops/linker3/actions/workflows/ci-cd-prod.yml)

Acortador de URLs en Node.js con SQLite integrado y arquitectura por capas.

Producción: <https://3.n-la-c.app>

Repositorio: <https://3.n-la-c.app/gh-linker3>

## Integrantes

- Diego Cardenas
- Samuel Albarracin
- Carlos Barrero
- Isaac Palomo

## Requisitos

- Node.js 22 o superior
- npm

## Inicio rápido (desarrollo local)

```bash
git clone https://github.com/co-eiv-devsecops/linker3.git
cd linker3
npm ci
cp .env.example .env
npm start
```

Abrir en el navegador: <http://localhost:3000>

## Arquitectura actual

El proyecto sigue una separación por capas:

- Domain: entidades, contratos y errores de negocio.
- Application: casos de uso y validaciones de entrada.
- Infrastructure: implementaciones técnicas (SQLite, generador de códigos, logger).
- Presentation: capa HTTP (router, controlador, utilidades de respuesta).
- Composition root: ensamblado de dependencias en src/container.ts.

### Estructura del repositorio

```text
linker3/
├── src/
│   ├── application/      # Casos de uso (LinkService, LinkValidator, DTOs)
│   ├── composition/      # Reservado para ensamblado adicional
│   ├── domain/           # Entidades y contratos (Link, LinkRepository, CodeGenerator, errores)
│   ├── infrastructure/   # Adaptadores (SqliteLinkRepository, RandomCodeGenerator, Logger, Metrics)
│   ├── presentation/     # HTTP (Router, LinkController, utilidades)
│   ├── config.ts         # Configuración desde variables de entorno
│   ├── container.ts      # Composition root actual
│   └── main.ts           # Punto de entrada de la aplicación
├── test/                 # Pruebas unitarias e integración (node --test)
├── public/
│   └── index.html
├── scripts/
│   └── init-db.sql
├── docs/
│   └── guia-despliegue.tex
├── infra/
│   ├── docker/
│   ├── scripts/
│   │   ├── deploy.sh
│   │   └── provision.sh
│   ├── terraform/
│   └── terraform-oracle/
├── cloud-init.yaml
├── .env.example
└── package.json
```

## Variables de entorno

| Variable | Default | Descripción |
|---|---|---|
| PORT | 3000 | Puerto del servidor |
| BASE_URL | http://localhost:{PORT} | URL base de enlaces cortos |
| DB_PATH | linker.db | Ruta de la base de datos SQLite |
| LOG_LEVEL | info | Nivel mínimo de log emitido: `debug`, `info`, `warn` o `error` |
| LAUNCHDARKLY_SDK_KEY | (vacío → modo offline) | Server-side SDK key de LaunchDarkly |
| OTEL_EXPORTER_OTLP_ENDPOINT | http://localhost:4318 | Endpoint OTLP donde se exportan logs, métricas y trazas |
| OTEL_EXPORTER_OTLP_PROTOCOL | http/protobuf | Protocolo del exporter OTLP (`http/protobuf` o `http/json`) |
| OTEL_METRIC_EXPORT_INTERVAL | 60000 | Intervalo (ms) de push de métricas al colector |
| OTEL_SERVICE_NAME | linker | Nombre de servicio reportado en la telemetría |

### Verbosidad de logs

`LOG_LEVEL` filtra qué niveles se emiten sin recompilar ni cambiar código: solo se
imprimen las entradas de nivel igual o superior al configurado (`debug` < `info` <
`warn` < `error`). Por ejemplo, `LOG_LEVEL=warn` silencia los logs `debug` e `info`
y solo muestra `warn`/`error`. Si la variable falta o tiene un valor no reconocido,
se usa `info` por defecto.

El cambio se hace sobre el **mismo artefacto desplegable**: es solo una variable de
entorno, sin recompilar ni tocar el código. Ejemplo en producción:

```bash
LOG_LEVEL=warn npm start
```

## Observabilidad (OpenTelemetry)

La app está instrumentada con OpenTelemetry (logs, métricas y trazas) y exporta por
OTLP. El SDK se inicializa en `src/infrastructure/telemetry/otel.ts` antes de armar
la aplicación, y toma el destino desde variables de entorno — el **mismo artefacto**
apunta a un colector local o a Grafana Cloud cambiando solo `OTEL_EXPORTER_OTLP_ENDPOINT`:

```bash
# Local (colector en el puerto por defecto 4318)
npm start

# Grafana Cloud (u otro backend OTLP): solo cambia el endpoint y las credenciales
OTEL_EXPORTER_OTLP_ENDPOINT=https://otlp-gateway-...grafana.net/otlp \
OTEL_EXPORTER_OTLP_HEADERS="Authorization=Basic <token>" \
npm start
```

### Métricas expuestas

| Métrica | Tipo | Descripción |
|---|---|---|
| `links_created_total` | Counter | Enlaces cortos creados |
| `redirects_total` | Counter | Redirecciones resueltas |
| `active_links` | Gauge | Enlaces almacenados (medidor) |
| `in_flight_redirects` | Gauge | Redirecciones en curso (medidor) |
| `shorten_duration_ms` | Histogram | Duración de `shorten()` |
| `redirect_duration_ms` | Histogram | Duración de `resolve()` |

### Biblioteca de instrumentación (mínimo código)

Para instrumentar código nuevo, un desarrollador depende solo de puertos pequeños,
no del SDK de OpenTelemetry directamente (Inversión de Control + código testeable):

- `Logger` (`src/infrastructure/Logger.ts`) — logging con niveles filtrables por `LOG_LEVEL`.
- `Meter` (`src/infrastructure/Metrics.ts`) — `createCounter` / `createHistogram` / `createGauge`.
- El adaptador `OtelMeterAdapter` (`src/infrastructure/telemetry/OtelMeter.ts`) conecta ese
  puerto con el `Meter` real de OpenTelemetry; el composition root (`src/container.ts`) lo inyecta.

```ts
// El colaborador recibe el puerto por constructor; no sabe de OpenTelemetry.
class MiServicio {
  private readonly creados: Counter;
  constructor(meter: Meter, private readonly logger: Logger) {
    this.creados = meter.createCounter("mi_metrica_total", { unit: "1" });
  }
  hacerAlgo() {
    this.creados.add(1);
    this.logger.info("algo ocurrió");
  }
}
```

Como el puerto es una interfaz, los tests inyectan un meter/logger falso y verifican
la instrumentación sin backend real (ver `test/LinkService.metrics.test.ts`,
`test/OtelMeter.test.ts` y `test/Logger.test.ts`).

## Comandos de desarrollo

Todos los comandos se ejecutan desde la raíz del repositorio:

```bash
npm ci
npm start
npm test
npm run test:coverage
npm run test:coverage:check
npm run typecheck
npm run lint
npm run format
npm run check
```

## API básica

| Método | Ruta | Descripción |
|---|---|---|
| GET | / | Interfaz web |
| GET | /health | Estado del servicio |
| GET | /api/links | Lista de enlaces |
| POST | /api/shorten | Crea enlace corto (con alias opcional) |
| GET | /:code | Redirige al destino e incrementa visitas |

Ejemplo:

```bash
curl -X POST http://localhost:3000/api/shorten \
  -H "Content-Type: application/json" \
  -d '{"url":"https://ejemplo.com","alias":"mi-link"}'
```

## Base de datos

La base SQLite se crea automáticamente al arrancar. Para precargar datos:

```bash
sqlite3 linker.db < scripts/init-db.sql
```

## CI/CD actual

- CI general: .github/workflows/ci.yml
- Pipeline de desarrollo (rama develop): .github/workflows/ci-cd-dev.yml
- Pipeline de producción (rama main y tags v*): .github/workflows/ci-cd-prod.yml
- Pipeline de lanzamiento de funcionalidad (manual): .github/workflows/feature-launch.yml
- Despliegue blue/green real en OCI (manual): .github/workflows/blue-green-deploy-oci.yml

La guía de onboarding operativo (cómo contribuir, correr los scripts del repo,
qué pipeline usar y por qué nunca se opera OCI a mano) está en
[docs/operaciones.md](docs/operaciones.md); la de observabilidad (acceder a
Grafana y leer los dashboards) en [docs/grafana.md](docs/grafana.md).

Los PRs ejecutan CI antes de merge según la configuración de branch protection del repositorio.

### Despliegue vs. lanzamiento de funcionalidad

Son dos pipelines con propósitos distintos — no se reemplazan entre sí:

| | `ci-cd-prod.yml` (despliegue) | `feature-launch.yml` (lanzamiento) |
|---|---|---|
| Cuándo usarlo | Hay código nuevo que aún no está en producción | El código ya está desplegado, pero dormido detrás de un flag |
| Qué hace | Build, tests, imagen Docker, deploy a la VM, pruebas de API | Prende/apaga un flag de LaunchDarkly vía su API |
| Toca la VM/infra | Sí | No |
| Requiere rebuild | Sí | No — el SDK server-side ya evalúa el flag en tiempo real (streaming) |
| Disparador | Push a `main` / tag `v*.*.*` | Manual (`workflow_dispatch`) |

En la práctica: primero se despliega el código nuevo con el flag apagado (sin
cambiar comportamiento visible), y **después**, cuando se quiere activar esa
funcionalidad para los usuarios, se corre `feature-launch.yml` — sin volver a
tocar el pipeline de despliegue. Ver [LAUNCHDARKLY.md](LAUNCHDARKLY.md) para
el detalle de cómo se evalúan los flags en este proyecto.

## Despliegue

La guía completa está en docs/guia-despliegue.tex. Resumen de opciones:

- Provisionar VM con cloud-init.yaml.
- Provisionar OCI con infra/terraform-oracle.
- Despliegue blue/green real (instancia green efímera + switchover de IP)
  con el workflow blue-green-deploy-oci.yml e infra/terraform-blue-green.
- Probar paridad local con infra/terraform + infra/docker.
- Actualizar una VM ya provisionada con:

```bash
bash infra/scripts/deploy.sh
```

## Infraestructura y paridad de entornos

### Artefacto común para Node, AWS Lambda y Azure Functions

La capa HTTP usa los contratos neutrales de `src/presentation/HttpPort.ts`.
El servidor tradicional se expone mediante `NodeHttpAdapter`; los entrypoints
serverless son `src/serverless/aws.ts` y `src/serverless/azure.ts`. Los tres
ejecutan el mismo `Router`, `LinkController` y `LinkService`.

```bash
npm run build
```

El directorio `dist/` resultante es el artefacto común. Configure
`dist/serverless/aws.handler` en Lambda. En Azure Functions, registre `handler`
desde `dist/serverless/azure.js` en el trigger HTTP. El proceso Node usa
`dist/main.js` (o `npm start` durante desarrollo).

Los adaptadores no requieren SDKs de proveedor y reutilizan las dependencias en
invocaciones calientes. En serverless, SQLite solo es apropiado para datos
efímeros; la persistencia entre instancias requiere un repositorio externo.

Ver infra/README.md para detalles de Terraform y Docker.

## DevContainer

El proyecto incluye .devcontainer para un entorno reproducible en VS Code.
