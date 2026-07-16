# infra/terraform-blue-green — instancia efímera (green) para blue/green real

Crea la instancia **nueva** del despliegue azul/verde en OCI. Es el paso 1 del
pipeline real [`blue-green-deploy-oci.yml`](../../.github/workflows/blue-green-deploy-oci.yml):

1. **Este módulo** crea `linker-green-<release_id>` (misma imagen, shape y
   `cloud-init.yaml` que la VM de producción de [`infra/terraform-oracle`](../terraform-oracle/)).
2. El pipeline corre healthcheck + pruebas funcionales contra su IP privada
   (vía OCI Bastion).
3. Si pasan, el pipeline mueve la **IP pública reservada** de producción hacia
   la private IP de esta instancia (switchover) usando OCI CLI.
4. La instancia que quedó sin tráfico se destruye automáticamente.

La instancia activa que ya sirve producción **no se modifica** desde aquí: este
módulo solo crea; el switchover y la limpieza viven en
[`infra/scripts/blue-green/`](../scripts/blue-green/).

## Diferencias con `infra/terraform-oracle`

| | `terraform-oracle` | `terraform-blue-green` |
|---|---|---|
| Propósito | VM estable de producción (primera vez) | Instancia efímera por release |
| Nombre | `linker-vm` fijo | `linker-<color>-<release_id>` único por run |
| Ciclo de vida | Larga vida | Nace en cada deploy, muere en la limpieza |
| Autenticación | Perfil local `~/.oci/config` | Perfil local **o** `TF_VAR_*` desde secrets (CI) |
| Tags | — | `app=linker, role=blue-green, color, release` (las usa la limpieza segura) |

## Uso desde el pipeline (normal)

No hay que ejecutar nada a mano: el workflow `blue-green-deploy-oci.yml`
(disparo manual con `workflow_dispatch`) hace `terraform init/apply` con las
variables inyectadas desde los vars/secrets del repositorio. Ver la tabla de
configuración en [`docs/operaciones.md`](../../docs/operaciones.md).

El state es efímero por diseño: cada run parte de un directorio limpio, por lo
que **siempre** crea una instancia nueva; la destrucción se hace por OCID vía
OCI CLI (no depende del state). El `terraform.tfstate` del run se sube como
artefacto del workflow solo con fines de auditoría.

## Uso local (depuración del módulo)

```bash
cd infra/terraform-blue-green
cp terraform.tfvars.example terraform.tfvars   # completar compartment_id/subnet_id
terraform init
terraform plan
terraform apply     # crea linker-green-manual-prueba
terraform destroy   # no olvidar destruirla al terminar
```

Requiere `oci` CLI configurado (`oci setup config`), igual que
`terraform-oracle`.

## Outputs

| Output | Uso en el pipeline |
|---|---|
| `instance_id` | Limpieza/rollback por OCID |
| `display_name` | Trazabilidad en logs |
| `private_ip` | Healthcheck y pruebas funcionales vía bastion |
| `private_ip_ocid` | Target del switchover de la IP pública reservada |
