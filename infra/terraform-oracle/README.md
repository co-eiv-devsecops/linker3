# infra/terraform-oracle — VM real en Oracle Cloud

Crea la VM de producción/desarrollo de Linker en Oracle Cloud vía Terraform.
Es el equivalente declarativo de:

```bash
oci compute instance launch \
  --availability-domain gyPa:SA-BOGOTA-1-AD-1 \
  --compartment-id $CMP_ID \
  --subnet-id $SUBNET_ID \
  --assign-public-ip false \
  --shape "VM.Standard.E5.Flex" \
  --shape-config '{ "baselineOcpuUtilization": "BASELINE_1_2", "memoryInGBs":4, "ocpus": 1 }' \
  --image-id "ocid1.image.oc1.sa-bogota-1...." \
  --ssh-authorized-keys-file ~/.ssh/linker.pub \
  --user-data-file cloud-init.yaml
```

La VM se provisiona automáticamente con el mismo [`cloud-init.yaml`](../../cloud-init.yaml)
de la raíz del repo (Node.js, systemd, nginx) — no hay lógica de provisión
duplicada aquí.

## Requisitos

- [Terraform](https://3.n-la-c.app/terraform-install) >= 1.5
- `oci` CLI ya configurado (`oci setup config`) — Terraform reutiliza ese
  mismo perfil de `~/.oci/config`, no hace falta ingresar credenciales aparte
- Compartment y subnet ya creados (los provee el instructor/consola de OCI)
- Un par de llaves SSH generado localmente (`ssh-keygen -f ~/.ssh/linker`)

## Uso

```bash
cd infra/terraform-oracle
cp terraform.tfvars.example terraform.tfvars
# editar terraform.tfvars con su compartment_id y subnet_id reales

terraform init
terraform plan
terraform apply
```

Tras el `apply`, conectarse por SSH usando la IP privada (`terraform output private_ip`)
según el mecanismo de acceso que provea el curso (bastion/VPN), y validar:

```bash
sudo systemctl status linker
sudo systemctl status nginx
```

Para eliminar la VM:

```bash
terraform destroy
```

## Notas de diseño

- **No se crea VCN/subnet**: ya existen (entorno provisto por el curso). Este
  módulo solo referencia `subnet_id`/`compartment_id` por variable.
- **`assign_public_ip = false`**: coincide con el comando de referencia — el
  acceso a la VM se hace por la red interna que ya gestiona el curso, no por
  IP pública directa.
- **State local**: no hay backend remoto configurado; para trabajo en equipo
  real se recomendaría un backend OCI Object Storage, pero queda fuera del
  alcance de esta tarea.
