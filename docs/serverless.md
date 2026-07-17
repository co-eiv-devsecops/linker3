# Objetivo serverless de PROD (AWS Lambda)

Linker tiene dos objetivos de despliegue en producción que comparten el
mismo artefacto (issues #114 y #115):

| Objetivo | Recurso | Pipeline | URL |
|---|---|---|---|
| VM (principal) | Instancia OCI + nginx + systemd | `.github/workflows/ci-cd-prod.yml` | `https://3.n-la-c.app` |
| Serverless (adicional) | AWS Lambda + Function URL | `.github/workflows/serverless-deploy.yml` | output `function_url` de Terraform |

El serverless **no reemplaza** a la VM: es un objetivo adicional que
demuestra que el mismo artefacto corre en ambos modelos de ejecución.

## Un solo artefacto, dos runtimes

La abstracción del issue #114 desacopló la capa HTTP del `http.Server` de
Node: `src/infrastructure/http/ServerlessAdapter.ts` expone
`invokeHttpHandler`, que ejecuta el mismo `Router`/`LinkController`/
`LinkService` a partir de una petición portable. Sobre eso hay dos
handlers delgados:

- `src/serverless/aws.ts` — AWS Lambda (API Gateway v1/v2 y Function URL)
- `src/serverless/azure.ts` — Azure Functions (sin desplegar; mismo patrón)

`src/serverless/runtime.ts` memoiza la composición de la aplicación para
reutilizarla entre invocaciones calientes de la misma instancia.

El paquete se genera con `bash infra/scripts/package-serverless.sh`, que
compila con `tsc -p tsconfig.build.json` (el mismo `dist/` para cualquier
plataforma) y agrega `public/` y las dependencias de producción. El
handler configurado en Lambda es `dist/serverless/aws.handler`.

## Flujo de despliegue (blue/green vía alias)

1. **Infraestructura (una vez):** `infra/terraform-aws-lambda/` crea la
   función, su rol IAM, el log group, el alias `live` y la Function URL
   (calificada con `qualifier = "live"`, no apunta a `$LATEST`). Ver el
   README de ese directorio.
2. **Código (cada push a `main`):** el workflow `Serverless Deploy - Prod`
   empaqueta el artefacto, valida el handler localmente, publica una
   versión nueva, le asigna 10% del tráfico junto al 90% de la versión
   actual (`aws lambda update-alias --routing-config`), verifica 20
   peticiones reales contra la Function URL y recién entonces promueve la
   versión nueva a 100% — o revierte el alias a la versión anterior si el
   canary falla. Nada de esto requiere VM, bastion ni Load Balancer propio:
   es el traffic-shifting por peso que Lambda ya trae integrado.

Si el repositorio no tiene credenciales de AWS configuradas, el deploy se
omite con un aviso (el empaquetado y la validación corren igual), de modo
que el pipeline no falla en forks ni mientras la cuenta no exista.

## Configuración

Environment de GitHub `prod-serverless`:

| Tipo | Nombre | Descripción |
|---|---|---|
| secret | `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | Credenciales del usuario IAM de despliegue |
| var | `AWS_REGION` | Región de la función (ej. `us-east-1`) |
| var | `LAMBDA_FUNCTION_NAME` | Nombre de la función (`linker-serverless` por defecto) |
| var | `LAMBDA_FUNCTION_URL` | Function URL del alias `live`; sin ella se promueve directo sin canary |
| var | `LAMBDA_ALIAS_NAME` | Alias de blue/green (`live` por defecto) |

Variables de entorno de la función (las fija Terraform):

| Variable | Valor | Motivo |
|---|---|---|
| `DB_PATH` | `/tmp/linker.db` | El filesystem de Lambda es de solo lectura salvo `/tmp` |
| `BASE_URL` | la Function URL | Los links cortos generados deben apuntar a la propia Lambda |

## Limitaciones conocidas

- **Persistencia efímera:** SQLite vive en `/tmp`, que es local a cada
  instancia de Lambda y se pierde en cold starts. Dos invocaciones pueden
  caer en instancias distintas con bases distintas. Es aceptable para el
  alcance del bono (demostrar el modelo de ejecución serverless con el
  mismo artefacto); para producción real habría que implementar un
  `LinkRepository` contra una base gestionada (p. ej. DynamoDB o RDS), lo
  cual la arquitectura hexagonal permite sin tocar dominio ni aplicación.
- **Datos no compartidos con la VM:** cada objetivo tiene su propia base;
  un link acortado en la VM no resuelve en la Lambda y viceversa.
- **Azure Functions:** el handler existe (`src/serverless/azure.ts`) pero
  no se despliega; el bono pide un proveedor y se eligió AWS por la
  compatibilidad directa del evento con Function URLs.
