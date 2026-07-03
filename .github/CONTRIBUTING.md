# Guía de contribución

Gracias por contribuir a **Linker**. Esta guía resume el flujo de trabajo y
las convenciones del proyecto.

## Requisitos

- **Node.js >= 22** (el proyecto usa `node:sqlite`, integrado desde v22).
- Sin dependencias de producción: no agregues paquetes npm al runtime sin
  discutirlo antes en un issue.

## Flujo de trabajo (branching)

```
feature/mi-cambio  →  develop  →  main
```

1. Crea tu rama a partir de `develop`: `feature/<descripcion>` (o
   `fix/<descripcion>` para correcciones).
2. Abre el PR contra `develop`. El CI (`ci-cd-dev.yml`) debe pasar.
3. `main` solo recibe merges desde `develop` (release); despliega a
   producción vía `ci-cd-prod.yml`.

## Commits

Usamos [Conventional Commits](https://www.conventionalcommits.org/es/):

```
feat(api): agregar endpoint de estadísticas
fix(links): rechazar alias con espacios
chore(ci): actualizar versión de Node en workflows
docs(readme): documentar variables de entorno
test(links): cubrir colisión de códigos generados
```

Escribe el mensaje en imperativo y explica el *por qué* en el cuerpo si el
cambio no es obvio.

## Ejecutar y probar

```bash
node server.js          # versión estable (JS)
npm run start:ts        # versión refactorizada (TypeScript)

npm test                # todos los tests
npm run test:js         # solo tests de la versión JS
npm run test:ts         # solo tests de la versión TS
npm run typecheck       # verificación de tipos (requiere npm install)
```

Todo PR debe llegar con tests en verde. Si agregas comportamiento, agrega
tests que lo cubran (unitarios en la capa correspondiente; ver
`src-ts/README.md` para la arquitectura).

### Cobertura

El CI (`npm run test:coverage:check`) usa los umbrales nativos del test
runner de Node (`--test-coverage-lines/branches/functions`) y falla el
pipeline si la cobertura baja del 85% en líneas, ramas o funciones.

## Convenciones de código

- **Frontend** (`public/index.html`): construir el DOM con
  `createElement`/`textContent`, **nunca** `innerHTML` — las URLs son
  entrada de usuario y esto previene XSS almacenado.
- **Infraestructura**: si editas `cloud-init.yaml`, sincroniza
  `provision.sh` (y viceversa); son el mismo script en dos sitios.
- **Mensajes de error de la API**: en español, consistentes con los
  existentes (`URL inválida`, `No encontrado`…). Cambiarlos es un breaking
  change para los tests.
- No comitees `linker.db`, `node_modules/` ni credenciales
  (`terraform.tfvars` está gitignoreado a propósito).

## Issues

Usa los formularios de issue (bug, funcionalidad, tarea técnica). Para
vulnerabilidades de seguridad **no abras un issue público**: sigue
[SECURITY.md](SECURITY.md).

## Código de conducta

Participar en este proyecto implica aceptar el
[Código de conducta](CODE_OF_CONDUCT.md).
