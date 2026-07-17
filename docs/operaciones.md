# Guía de operaciones y onboarding operativo

Guía para que un integrante nuevo del equipo pueda **contribuir** y **operar**
Linker en producción sin depender de conocimiento tácito. Complementa al
[`README.md`](../README.md) (arquitectura) — aquí está el "cómo se trabaja y
cómo se opera" del día a día.

> Para la observabilidad (acceder a Grafana, navegar dashboards, interpretar
> paneles) ver la guía dedicada: [`docs/grafana.md`](grafana.md).

## 1. Regla de oro: cero operaciones manuales en OCI

**Nunca** se crea, modifica ni elimina infraestructura desde la consola web de
Oracle Cloud. Toda operación pasa por código versionado en este repo:

| Necesito… | Se hace con… |
|---|---|
| Crear la VM de producción (primera vez) | `infra/terraform-oracle/` (`terraform apply`) |
| Desplegar una nueva versión del código | Pipeline **CI/CD - Prod** (push/merge a `main`) o **Blue/Green Deployment (OCI real)** |
| Crear/destruir la instancia green del blue/green | Pipeline `blue-green-deploy-oci.yml` (Terraform + OCI CLI, automático) |
| Mover el tráfico de producción (switchover/rollback) | El mismo pipeline (registra/promueve backends en el Load Balancer compartido `lb-bog-lz-prod-01`) |
| Activar/desactivar una funcionalidad ya desplegada | Pipeline **Feature Launch** (flag de LaunchDarkly, no toca la VM) |
| Entrar a una VM (debug puntual) | OCI Bastion vía scripts (`infra/scripts/blue-green/run_remote.sh`), nunca abriendo puertos a mano |

¿Por qué? Reproducibilidad (cualquier entorno se reconstruye desde el repo),
auditoría (todo cambio queda en un run de Actions con quién lo aprobó) y
seguridad (las credenciales viven en secrets de GitHub, no en laptops).

Si encuentras algo que "solo se puede hacer en la consola", eso es un bug de
infraestructura: abre un issue.

## 2. Onboarding de desarrollo (primer día)

Requisitos: **Node.js 22+** (la app corre `.ts` nativo, sin build), **Python 3**
(scripts de operación, solo stdlib), **git**.

```bash
git clone git@github.com:co-eiv-devsecops/linker3.git
cd linker3
npm install     # instala devDependencies Y activa los git hooks (husky)
npm start       # http://localhost:3000
npm test        # pruebas unitarias
npm run typecheck
npm run check   # biome: lint + format + orden de imports
```

Los hooks quedan activos automáticamente tras `npm install`:

- **pre-commit**: `biome check --write` sobre los archivos staged + `tsc --noEmit`.
- **pre-push**: suite completa de tests.

Si un hook te bloquea, arregla la causa — no uses `--no-verify`.

### Flujo de contribución

1. Crea una rama desde `develop`: `feature/<descripcion>` o `fix/<descripcion>`.
2. Commits con formato *conventional commits* (`feat: ...`, `fix: ...`,
   `docs: ...`), como se ve en el historial.
3. Abre un PR hacia `develop`. El pipeline de la rama (`ci.yml`) y el de
   develop (`ci-cd-dev.yml`) deben quedar en verde.
4. Para llegar a producción, `develop` se promueve a `main` vía PR; el merge
   dispara **CI/CD - Prod**.
5. Si tu doc agrega links externos, pásalos por el acortador
   (`scripts/shorten_wiki_links.py`, sección 4) o `link-check.yml` fallará.

## 3. ¿Qué pipeline uso para qué?

| Workflow | Se dispara | Sirve para |
|---|---|---|
| `ci.yml` | push/PR en ramas de trabajo | typecheck, lint, tests de tu rama |
| `ci-cd-dev.yml` | push/PR a `develop` | validación de integración del equipo |
| `ci-cd-prod.yml` | push/tag a `main` | **desplegar código nuevo** a la VM de producción (quality-gate→build→deploy→Newman) |
| `blue-green-deploy-oci.yml` | manual (`workflow_dispatch`) | **blue/green real en OCI**: crea VM green, QA vía bastion, aprobación, switchover vía Load Balancer compartido, gate de Grafana, rollback y limpieza automáticos |
| `serverless-deploy.yml` | push a `main` | **blue/green real en Lambda**: publica versión, canary 10%, verifica, promueve o revierte el alias |
| `feature-launch.yml` | manual | **lanzar/apagar una funcionalidad** ya desplegada vía flag de LaunchDarkly (no despliega código) |
| `link-check.yml` | cambios en docs | exige que los links externos de la documentación pasen por Linker |
| `quality-gate.yml` | reusable (lo llaman los CI/CD) | lint, tests, CodeQL y escaneo de seguridad — un solo lugar, sin duplicar entre dev/prod |

Regla mental: *desplegar código* ≠ *lanzar funcionalidad*. El código se
despliega apagado detrás de un flag y se lanza después con Feature Launch.

### El pipeline blue/green real, paso a paso

`Actions → Blue/Green Deployment (OCI real) → Run workflow`. No pide OCIDs ni
IPs: todo sale de las vars/secrets del repo (sección 5).

1. **Crear green** — Terraform (`infra/terraform-blue-green/`) crea
   `linker-green-<sha>-run<N>` con el mismo `cloud-init.yaml` de producción.
   La instancia blue no se toca.
2. **QA en green** — túnel por OCI Bastion hasta la IP privada de green;
   espera el healthcheck (`/health` = 200), corre
   `scripts/test_requests.py` (funcional) y `scripts/load_test.py`
   (diagnóstico). Si algo falla, el pipeline se detiene y green se destruye
   al final: producción nunca se enteró.
3. **Aprobación manual** — environment `prod` de GitHub; un revisor aprueba
   el movimiento de tráfico.
4. **Switchover real vía Load Balancer compartido** — las VMs no tienen IP
   pública propia (`assign_public_ip = false`); el único punto de entrada es
   el Load Balancer del curso (`lb-bog-lz-prod-01`), con un backend set por
   proyecto (`linker-3` para este repo). El pipeline delega el ciclo completo
   a la reusable workflow vendorizada `oci-lb-bluegreen-ab.yml`: registra
   green como backend drenado, espera que quede sano, abre A/B 90/10, observa,
   y promueve a 100/0 — todo contra el puerto 8080 en el que escucha la app
   (ver `cloud-init.yaml`).
5. **Gate de Grafana** — `scripts/check_grafana.py` consulta métricas
   post-despliegue (latencia p95, opcionalmente error rate) contra umbrales
   configurables; si se exceden, el pipeline falla.
6. **Rollback automático** — si el A/B o el gate de Grafana fallan, la misma
   reusable workflow restaura el 100% del tráfico a blue en el Load Balancer
   y (opcionalmente) retira el backend de green.
7. **Limpieza** — se destruye la instancia que quedó **sin** tráfico (blue si
   todo salió bien, y entonces `OCI_INSTANCE_OCID` se actualiza a green; green
   si hubo fallo/rollback). El script se niega a destruir la instancia activa
   actual, pase lo que pase.

## 4. Scripts del repositorio

Todos son Python 3 **solo stdlib** (no hay `pip install`) y salen con código
`!= 0` cuando la validación falla, para poder usarlos como gates de CI.

### `scripts/test_requests.py` — smoke test funcional

Valida el ciclo completo contra una instancia corriendo: crea un link corto,
verifica que aparece en el listado y que el redirect 302 apunta al destino.

```bash
python3 scripts/test_requests.py --base-url http://localhost:3000
```

- `--base-url` (requerido): instancia a probar (local, green vía túnel, prod).
- Lo usa el QA del blue/green (simulado y real) como gate bloqueante.

### `scripts/load_test.py` — prueba de carga escalonada

Sube la concurrencia por etapas (duplicando) contra `POST /api/shorten` hasta
encontrar el punto de quiebre. Por defecto es **diagnóstico** (siempre sale 0);
se vuelve gate con `--min-concurrency-required`.

```bash
python3 scripts/load_test.py --base-url http://localhost:3000 \
  --start-concurrency 2 --max-concurrency 32 --requests-per-stage 20

# como gate: falla si no sostiene 32 concurrentes
python3 scripts/load_test.py --base-url ... --min-concurrency-required 32
```

### `scripts/shorten_wiki_links.py` — links de documentación

Encuentra links externos crudos en la documentación y los acorta usando el
propio Linker. `link-check.yml` corre el modo `--check` en CI.

```bash
python3 scripts/shorten_wiki_links.py --check   # solo detectar (lo que corre CI)
python3 scripts/shorten_wiki_links.py           # reescribir archivos acortando
```

Excepciones legítimas: agregar un patrón a
`scripts/shorten_wiki_links.allowlist` (ver comentarios del archivo).

### `scripts/check_grafana.py` — gate de métricas post-despliegue

Consulta la API de Grafana (datasource proxy, PromQL) y falla si las métricas
de la ventana post-switchover superan los umbrales. El token va **solo** por
variable de entorno.

```bash
GRAFANA_API_TOKEN=<token-service-account> \
python3 scripts/check_grafana.py \
  --grafana-url https://<tu-org>.grafana.net \
  --datasource-uid <uid-datasource-prometheus> \
  --window 10m --max-p95-ms 500
```

- `--p95-query` / `--error-rate-query`: PromQL propios si los nombres de
  métrica difieren en tu stack (admiten el placeholder `{window}`).
- `--on-no-data warn|fail`: qué hacer si aún no hay tráfico (default `warn`).
- Detalles de interpretación de métricas: [`docs/grafana.md`](grafana.md).

## 5. Configuración: lo ÚNICO que se pone a mano (una sola vez)

Todo el blue/green real se parametriza con esto en
`Settings → Secrets and variables → Actions`. Después de esto, ningún deploy
requiere tocar nada.

### Secrets

| Secret | Qué es |
|---|---|
| `OCI_CLI_USER` | OCID del usuario de API de OCI |
| `OCI_CLI_TENANCY` | OCID del tenancy |
| `OCI_CLI_FINGERPRINT` | Fingerprint de la llave de API |
| `OCI_CLI_KEY_CONTENT` | Contenido PEM de la llave privada de API |
| `DEPLOYMENT_PRIVATE_KEY` | Llave SSH privada para bastion/VMs |
| `GRAFANA_API_TOKEN` | Token de service account de Grafana (para el gate) |
| `LAUNCHDARKLY_API_TOKEN` | Solo para `feature-launch.yml` |

### Variables

| Variable | Qué es | ¿Requerida? |
|---|---|---|
| `OCI_CLI_REGION` | Región (p. ej. `sa-bogota-1`) | Sí |
| `OCI_COMPARTMENT_OCID` | Compartment de las instancias (`cmp-lz-prod-linker-3`) | Sí |
| `OCI_SUBNET_OCID` | Subnet donde nacen las VMs (`sn-bog-lz-prod-linker-3`) | Sí |
| `OCI_BASTION_OCID` | Bastion para túneles de QA/SSH | Sí |
| `OCI_LB_OCID` | OCID del Load Balancer compartido del curso (`lb-bog-lz-prod-01`) — el switchover registra/promueve backends ahí en vez de mover una IP pública reservada | Sí |
| `OCI_LB_LINKER_BACKEND` | Nombre del backend set de linker3 en ese LB (`linker-3`) | Sí |
| `DEPLOYMENT_PUBLIC_KEY` | Llave SSH pública inyectada a las VMs | Sí |
| `OCI_AVAILABILITY_DOMAIN` | AD de la instancia | No (default del módulo) |
| `OCI_IMAGE_OCID` | Imagen Ubuntu | No (default del módulo) |
| `GRAFANA_URL` | URL base de Grafana | Para el gate |
| `GRAFANA_DATASOURCE_UID` | UID del datasource Prometheus | Para el gate |
| `GRAFANA_WINDOW` | Ventana de evaluación | No (default `10m`) |
| `GRAFANA_MAX_P95_MS` | Umbral p95 en ms | No (default `500`) |
| `GRAFANA_P95_QUERY` | PromQL alterno para p95 | No |
| `GRAFANA_ERROR_RATE_QUERY` | PromQL de error rate (activa el segundo check) | No |
| `GRAFANA_MAX_ERROR_RATE` | Umbral de error rate | No (default `0.05`) |
| `GRAFANA_WAIT_SECONDS` | Espera antes de evaluar métricas | No (default `120`) |

> Si `GRAFANA_URL`/`GRAFANA_API_TOKEN` no están configurados, el gate se
> omite con un warning visible en el run — así el pipeline es usable desde el
> día uno y el gate se activa cuando Grafana esté listo.

## 6. ¿Dónde pido accesos?

- **GitHub (org `co-eiv-devsecops`)**: invitación de cualquier maintainer.
- **OCI**: el compartment/subnet/bastion los provee el curso; las credenciales
  de API ya están cargadas como secrets — un integrante nuevo normalmente
  **no** necesita credenciales OCI propias.
- **Grafana**: ver [`docs/grafana.md`](grafana.md), sección "Acceso".
- **LaunchDarkly**: invitación al proyecto por un maintainer (solo si vas a
  trabajar con flags).
