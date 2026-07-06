# Descripción

<!-- Qué cambia y por qué. Enfócate en el "por qué": el diff ya muestra el "qué". -->

Closes #<!-- número de issue, si aplica -->

## Tipo de cambio

<!-- Marca lo que aplique con una x -->

- [ ] 🐛 Corrección de bug (cambio que arregla un problema sin romper nada)
- [ ] ✨ Nueva funcionalidad (cambio que agrega comportamiento sin romper el existente)
- [ ] 💥 Breaking change (cambia el contrato de la API, el esquema de BD o el despliegue)
- [ ] 🔧 Refactor / deuda técnica (sin cambio funcional)
- [ ] 🏗️ Infraestructura / CI-CD (infra/, cloud-init, deploy.sh, workflows)
- [ ] 📝 Documentación

## ¿Cómo se probó?

<!-- Comandos ejecutados y resultado. Ejemplos:
- npm test → todo verde
- Prueba manual: npm start + curl a /api/shorten
-->

## Checklist

- [ ] Los tests pasan localmente (`npm test`)
- [ ] Agregué tests que cubren el cambio (o no aplica)
- [ ] El typecheck pasa (`npm run typecheck`) si toqué código TypeScript
- [ ] Actualicé la documentación afectada (README, CLAUDE.md, comentarios)
- [ ] Si edité `cloud-init.yaml` o `provision.sh`, sincronicé el otro archivo
- [ ] No incluyo secretos, credenciales ni archivos generados (`linker.db`, `node_modules`)
- [ ] El título del PR y los commits siguen [Conventional Commits](https://www.conventionalcommits.org/es/) (`feat:`, `fix:`, `chore:`…)
- [ ] El PR apunta a `develop` (solo los releases van a `main`)

## Notas para quien revisa

<!-- Orden sugerido de lectura, decisiones discutibles, áreas donde quieres feedback. -->
