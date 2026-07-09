# Política de seguridad

## Versiones con soporte

Solo la rama `main` (lo desplegado en producción) recibe correcciones de
seguridad.

## Reportar una vulnerabilidad

**No abras un issue público.** En su lugar:

1. Ve a la pestaña **Security → Advisories** del repositorio y crea un
   *private security advisory* ("Report a vulnerability").
2. Incluye: descripción, pasos de reproducción, impacto estimado y, si la
   tienes, una propuesta de mitigación.

Si no tienes acceso a esa función (por ejemplo, cuenta de GitHub muy nueva),
contacta directamente por GitHub a
[@CARDAV-45](https://3.n-la-c.app/gh-cardav45) o
[@diegcard](https://3.n-la-c.app/gh-diegcard), mantenedores del repositorio.

Nos comprometemos a acusar recibo en un plazo razonable y a coordinar la
divulgación una vez corregida.

## Ámbito

Ejemplos de reportes válidos para este proyecto:

- Inyección (SQL, cabeceras HTTP) a través de `url`, `alias` o `code`.
- XSS almacenado o reflejado en `public/index.html`.
- Redirecciones abiertas que evadan la validación de URL.
- Exposición de secretos en el repositorio, la infraestructura o el CI.
- Configuración insegura en `cloud-init.yaml` / `provision.sh` / nginx.

Quedan fuera de ámbito los ataques de denegación de servicio por volumen y
los hallazgos que requieran acceso previo a la VM de producción.
