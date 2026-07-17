# Checklist de secrets/vars para despliegue (linker3)

Estado verificado el 2026-07-16 contra `gh secret list` / `gh variable list` /
`gh api .../environments` del repo `co-eiv-devsecops/linker3`. Marca cada fila
cuando el valor real quede cargado en GitHub (Settings → Secrets and variables
→ Actions). "Tipo" indica si va como *secret* (cifrado, nunca visible) o
*variable* (texto plano, visible en logs/UI).

## Ya configurados (no tocar)

| Nombre | Tipo | Usado en |
|---|---|---|
| `DEPLOYMENT_PRIVATE_KEY` | secret | `ci-cd-prod.yml`, `blue-green-deploy-oci.yml` |
| `DEPLOYMENT_PUBLIC_KEY` | variable | `ci-cd-prod.yml`, `blue-green-deploy-oci.yml` |
| `OCI_CLI_FINGERPRINT` | secret | `blue-green-deploy-oci.yml`, `ci-cd-prod.yml` |
| `OCI_CLI_KEY_CONTENT` | secret | `blue-green-deploy-oci.yml`, `ci-cd-prod.yml` |
| `OCI_CLI_USER` | secret | `blue-green-deploy-oci.yml`, `ci-cd-prod.yml` |
| `OCI_COMPARTMENT_OCID` | variable | `blue-green-deploy-oci.yml` (recién corregido, antes estaba como `OCI_COMPARTMENT_ID`; pendiente re-verificar que apunte a `cmp-lz-prod-linker-3` y no al tenancy — ver nota abajo) |
| `OCI_INSTANCE_OCID` | variable | `ci-cd-prod.yml`, `blue-green-deploy-oci.yml` |
| `OCI_CLI_REGION` | variable | `sa-bogota-1` — ya cargada |
| `OCI_BASTION_OCID` | variable | `ocid1.bastion.oc1.sa-bogota-1.amaaaaaalthnxiyayojugy7kxhsra6vkupcj4xftydrfev5ryu26titzzu3q` (`bstlinkerprojects`) — ya cargada |
| `OCI_AVAILABILITY_DOMAIN` | variable | `gyPa:SA-BOGOTA-1-AD-1` — ya cargada |
| `OCI_SUBNET_OCID` | variable | `ocid1.subnet.oc1.sa-bogota-1.aaaaaaaabglji7muwft7bknjdgnqubvjdrypqqxjd5ypwiz7mqluqpubqzbq` (`sn-bog-lz-prod-linker-3`) — ya cargada |
| `OCI_LB_OCID` | variable | `ocid1.loadbalancer.oc1.sa-bogota-1.aaaaaaaapj2wxt5msfusk3jb4vymhczobtka5cgxfftvdyauguk4f4w7lqpa` (`lb-bog-lz-prod-01`, compartido con linker1/2/4/5) — ya cargada |
| `OCI_LB_LINKER_BACKEND` | variable | `linker-3` — ya cargada |

> **Nota de arquitectura**: se migró de "IP pública reservada por VM" (diseño
> original de este repo) a "Load Balancer compartido + backend set", igual
> que linker1/linker2 — las VMs del curso no tienen IP pública propia
> (`assign_public_ip = false`). `OCI_RESERVED_PUBLIC_IP_OCID`,
> `TLS_CERTBOT_EMAIL` y `BLUE_GREEN_VERIFY_URL` ya no se usan y se retiraron
> de `blue-green-deploy-oci.yml`.

## Faltantes — despliegue OCI (VM, blue/green)

| Nombre | Tipo | Para qué sirve | Workflow |
|---|---|---|---|
| [ ] `OCI_CLI_TENANCY` | secret | OCID del tenancy de Oracle Cloud, requerido por el OCI CLI | `blue-green-deploy-oci.yml`, `ci-cd-prod.yml` |
| [ ] `OCI_IMAGE_OCID` | variable | Imagen **Ubuntu 22.04+** (no la Oracle Linux 9 que sale por defecto al crear instancia) | `blue-green-deploy-oci.yml` |
| [ ] Confirmar `OCI_COMPARTMENT_OCID` | variable | Debería ser el OCID de `cmp-lz-prod-linker-3` (Identity & Security → Compartments), no el del tenancy | `blue-green-deploy-oci.yml` |

## Faltantes — observabilidad (Grafana, gate post-deploy)

| Nombre | Tipo | Para qué sirve | Workflow |
|---|---|---|---|
| [ ] `GRAFANA_API_TOKEN` | secret | Autenticación contra la API de Grafana Cloud | `blue-green-deploy-oci.yml` |
| [ ] `GRAFANA_URL` | variable | Base URL de la instancia de Grafana | `blue-green-deploy-oci.yml` |
| [ ] `GRAFANA_DATASOURCE_UID` | variable | UID del datasource a consultar | `blue-green-deploy-oci.yml` |
| [ ] `GRAFANA_P95_QUERY` | variable | Query para la métrica de latencia p95 | `blue-green-deploy-oci.yml` |
| [ ] `GRAFANA_ERROR_RATE_QUERY` | variable | Query para la métrica de tasa de error | `blue-green-deploy-oci.yml` |
| [ ] `GRAFANA_MAX_P95_MS` | variable | Umbral máximo de p95 (ms) que aprueba el despliegue | `blue-green-deploy-oci.yml` |
| [ ] `GRAFANA_MAX_ERROR_RATE` | variable | Umbral máximo de tasa de error que aprueba el despliegue | `blue-green-deploy-oci.yml` |
| [ ] `GRAFANA_WINDOW` | variable | Ventana de tiempo de la consulta (ej. `5m`) | `blue-green-deploy-oci.yml` |
| [ ] `GRAFANA_WAIT_SECONDS` | variable | Espera antes de consultar métricas tras el switch | `blue-green-deploy-oci.yml` |

## Faltantes — AWS Lambda (serverless)

| Nombre | Tipo | Para qué sirve | Workflow |
|---|---|---|---|
| [ ] `AWS_ACCESS_KEY_ID` | secret | Credencial IAM para desplegar la Lambda | `serverless-deploy.yml` |
| [ ] `AWS_SECRET_ACCESS_KEY` | secret | Credencial IAM para desplegar la Lambda | `serverless-deploy.yml` |
| [ ] `AWS_REGION` | variable | Región de AWS donde vive la función | `serverless-deploy.yml` |
| [ ] `LAMBDA_FUNCTION_NAME` | variable | Nombre de la función Lambda a actualizar | `serverless-deploy.yml` |
| [ ] `LAMBDA_FUNCTION_URL` | variable | Function URL pública para el smoke test post-deploy | `serverless-deploy.yml` |

## Faltante — LaunchDarkly (feature flags)

| Nombre | Tipo | Para qué sirve | Workflow |
|---|---|---|---|
| [ ] `LAUNCHDARKLY_API_TOKEN` | secret | Automatización de flags desde CI | `feature-launch.yml` |

## Cómo cargarlos

```bash
gh secret set NOMBRE --repo co-eiv-devsecops/linker3
gh variable set NOMBRE --body "valor" --repo co-eiv-devsecops/linker3
```

Si un valor solo aplica a un ambiente específico (`dev`, `prod`,
`prod-serverless`), usa `--env <nombre>` en vez de cargarlo a nivel de repo.
