# Terraform — objetivo serverless de PROD (AWS Lambda)

Crea el recurso serverless real del issue #115: una función AWS Lambda
(`nodejs22.x`) con Function URL pública que ejecuta el mismo artefacto de
Linker que corre en la VM de OCI. El pipeline
`.github/workflows/serverless-deploy.yml` solo actualiza el código de la
función; la infraestructura se crea una única vez con este módulo.

## Requisitos

- Terraform >= 1.5
- Credenciales de AWS configuradas (`aws configure` o variables de entorno)
- El paquete `linker-serverless.zip` generado en la raíz del repo:

```bash
bash infra/scripts/package-serverless.sh
```

## Uso

```bash
cd infra/terraform-aws-lambda
terraform init
terraform apply
```

El primer `apply` emite `function_url` en los outputs. Con esa URL:

1. Vuelve a aplicar fijando `base_url` para que los links cortos generados
   por la Lambda apunten a sí misma:

   ```bash
   terraform apply -var 'base_url=https://<id>.lambda-url.<region>.on.aws'
   ```

2. Configura en GitHub (Settings → Environments → `prod-serverless`):
   - secrets: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
   - vars: `AWS_REGION`, `LAMBDA_FUNCTION_NAME` (por defecto
     `linker-serverless`) y `LAMBDA_FUNCTION_URL` (la del output)

A partir de ahí, cada push a `main` despliega el artefacto también en la
Lambda. Ver `docs/serverless.md` para el modelo de convivencia con la VM
de OCI y las limitaciones (SQLite efímero en `/tmp`).
