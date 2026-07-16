# Guía de Grafana: acceso, navegación y lectura de dashboards

Cómo entrar a la instancia de Grafana del proyecto, encontrar los dashboards
de Linker e interpretar sus paneles. Complementa a
[`docs/operaciones.md`](operaciones.md) (operación general) y a la sección de
observabilidad del [`README.md`](../README.md) (cómo la app exporta telemetría).

## Contexto: de dónde salen los datos

La app está instrumentada con OpenTelemetry (`src/infrastructure/telemetry/otel.ts`)
y exporta **logs, métricas y trazas** por OTLP al endpoint definido en
`OTEL_EXPORTER_OTLP_ENDPOINT`. En producción ese endpoint es el gateway OTLP
de Grafana Cloud, así que todo lo que ves en Grafana viene de ahí — no hay
agentes ni exporters adicionales en la VM.

Métricas propias del dominio (además de las automáticas de runtime/HTTP):

| Métrica | Tipo | Qué mide |
|---|---|---|
| `links_created_total` | counter | Links acortados creados |
| `redirects_total` | counter | Redirecciones servidas (≈ visitas) |
| `active_links` | gauge | Links vivos en la base |
| `in_flight_redirects` | gauge | Redirecciones en curso |
| `shorten_duration_ms` | histograma | Latencia de `POST /api/shorten` |
| `redirect_duration_ms` | histograma | Latencia de `GET /:code` |

> En Grafana Cloud los nombres pueden llevar sufijo de unidad según la
> traducción OTLP→Prometheus (p. ej. `redirect_duration_ms_milliseconds_bucket`).
> Si una query de esta guía no devuelve datos, busca el nombre real en
> **Explore** con el autocompletado de métricas.

## Acceso

1. **URL**: la organización del equipo en Grafana Cloud —
   `https://<org-del-equipo>.grafana.net` (la URL exacta está en la variable
   `GRAFANA_URL` de `Settings → Secrets and variables → Actions` del repo).
2. **Credenciales**: se entra con cuenta personal invitada a la organización.
   Pídele la invitación a cualquier maintainer del repo (rol `Viewer` basta
   para consultar; `Editor` para crear/editar dashboards).
3. **Tokens de máquina**: el pipeline usa un token de *service account*
   (secret `GRAFANA_API_TOKEN`), NUNCA credenciales personales. Si necesitas
   uno para experimentar, créalo en
   `Administration → Users and access → Service accounts` con permiso de
   solo lectura y caducidad corta.

## Encontrar los dashboards de Linker

1. En el menú lateral: **Dashboards**.
2. Busca la carpeta/etiqueta **Linker** (o escribe `linker` en la búsqueda).
3. El dashboard principal del servicio agrupa los paneles descritos abajo.
   Si aún no existe en tu organización, cualquier panel se reproduce en
   **Explore** con las queries de esta guía.

Alternativa sin dashboard: **Explore** (brújula en el menú) → elegir el
datasource Prometheus/Mimir del stack → escribir la query → `Run query`.

## Cómo leer los paneles principales

- **Latencia (p95)** — percentil 95 de los histogramas de duración:

  ```promql
  histogram_quantile(0.95, sum by (le) (rate(redirect_duration_ms_bucket[5m])))
  ```

  Sano: estable y por debajo del umbral del gate (500 ms por defecto). Un
  escalón sostenido después de un deploy es la señal clásica para rollback.

- **Throughput / visitas** — tasa de redirecciones por segundo:

  ```promql
  sum(rate(redirects_total[5m]))
  ```

  `redirects_total` cuenta las visitas a links cortos; `links_created_total`
  equivale a la tasa de creación. Caídas a cero con tráfico esperado =
  problema de disponibilidad, no de demanda.

- **Errores** — sube el nivel de log a `warn`/`error` en el panel de logs
  (datasource Loki) y filtra por `service_name = linker`. Los picos de
  `error` correlacionados con un deploy son motivo de rollback aunque la
  latencia se vea bien.

- **Estado del negocio** — `active_links` (gauge, debe crecer lentamente) e
  `in_flight_redirects` (gauge, cercano a 0 salvo bajo carga; si queda
  "pegado" alto, hay requests colgados).

## Filtrar por entorno y por tiempo

- **Rango de tiempo**: selector arriba a la derecha (`Last 1 hour`, etc.).
  Para validar un despliegue, usa una ventana corta alrededor del switchover
  (10–15 min) y compara con la misma ventana previa.
- **Entorno prod vs. efímero (green)**: todas las series llegan etiquetadas
  con recursos OTel. Filtra por `service_name="linker"` y usa
  `service_instance_id` / `host_name` para distinguir instancias: la green
  del blue/green aparece como un `host_name` nuevo (`linker-green-<release>`)
  mientras conviven. Ejemplo:

  ```promql
  sum by (host_name) (rate(redirects_total[5m]))
  ```

  Durante un blue/green verás dos series; tras la limpieza queda una.

## El gate automático del pipeline

El paso 6 del pipeline `blue-green-deploy-oci.yml` ejecuta
`scripts/check_grafana.py`, que consulta estas mismas métricas por la API del
datasource y falla el despliegue si superan los umbrales (ver
[`docs/operaciones.md`](operaciones.md), sección 5, para configurarlo). Es
decir: lo que un humano revisa en esta guía es exactamente lo que el pipeline
revisa solo después de cada switchover.
