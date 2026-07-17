# infra/terraform-aws-ec2-bluegreen/ — blue/green de VM en AWS

Equivalente en AWS al blue/green de OCI (`infra/terraform-blue-green` +
`blue-green-deploy-oci.yml`), pero sin bastion ni Load Balancer: la subred
default de AWS asigna IP pública propia a cada instancia, así que el QA se
hace directo contra esa IP y el switchover es solo reasignar una IP elástica
persistente. Ver `.github/workflows/blue-green-deploy-aws.yml`.

Este módulo crea **solo la instancia nueva** (green); la que ya sirve
tráfico no se toca. El switchover y la limpieza los hace el pipeline vía AWS
CLI, no Terraform.

## Recursos que se crean UNA VEZ (fuera de este módulo, no por release)

- **IP elástica**: `aws ec2 allocate-address --domain vpc`
- **Security group**: HTTP (80) abierto a todos; SSH (22) solo si vas a
  depurar a mano
- **Subred**: la default del VPC default, en una AZ soportada por el
  `instance_type` elegido (`t3.micro` no está en todas)

Sus IDs van como vars del repo: `AWS_EIP_ALLOCATION_ID`,
`AWS_SECURITY_GROUP_ID`, `AWS_SUBNET_ID`, `AWS_EC2_AMI_ID`,
`AWS_EC2_INSTANCE_ID` (la instancia "blue" actual).

## Uso

```bash
cd infra/terraform-aws-ec2-bluegreen
terraform init
terraform apply \
  -var 'release_id=manual-test' \
  -var 'ami_id=<AWS_EC2_AMI_ID>' \
  -var 'eip_allocation_id=<AWS_EIP_ALLOCATION_ID>' \
  -var 'subnet_id=<AWS_SUBNET_ID>' \
  -var 'security_group_id=<AWS_SECURITY_GROUP_ID>' \
  -var 'base_url=http://<la IP elástica>'
```

Con `-var 'key_name=<key-pair>'` opcional para poder hacer SSH de depuración
(agrega el puerto 22 al security group primero).

## Notas de diseño

- `user_data_replace_on_change = true`: cada release debe ser una instancia
  nueva; sin esto Terraform solo actualizaría el `user_data` de una instancia
  que ya está corriendo, sin volver a ejecutar `cloud-init`.
- `cloud-init.tpl` es una variante de `../../cloud-init.yaml` (el de la VM de
  OCI) con `BASE_URL`/OTEL parametrizados vía `templatefile()`, y **con**
  `npm ci --omit=dev` (la app tiene dependencias de runtime reales — OTel,
  LaunchDarkly, mysql2 — pese a lo que dice `CLAUDE.md`; el `cloud-init.yaml`
  de OCI se salva de este bug porque `ci-cd-prod.yml` corre `npm ci` en cada
  deploy real después del primer arranque).
