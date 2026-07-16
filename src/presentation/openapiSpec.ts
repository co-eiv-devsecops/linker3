/**
 * OpenAPI 3.0 description of the public HTTP API, served as JSON at
 * `/openapi.json` and rendered by Swagger UI at `/docs`.
 */
export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Linker API",
    description: "Acortador de URLs monolítico.",
    version: "1.0.0",
  },
  paths: {
    "/api/links": {
      get: {
        summary: "Lista todos los enlaces acortados",
        responses: {
          "200": {
            description: "Lista de enlaces, del más reciente al más antiguo",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Link" },
                },
              },
            },
          },
        },
      },
    },
    "/api/shorten": {
      post: {
        summary: "Crea un enlace corto",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ShortenRequest" },
            },
          },
        },
        responses: {
          "201": {
            description: "Enlace creado",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { short: { type: "string", format: "uri" } },
                  required: ["short"],
                },
              },
            },
          },
          "400": {
            description: "URL o alias inválido, o cuerpo JSON malformado",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/Error" } },
            },
          },
          "409": {
            description: "El alias solicitado ya está en uso",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/Error" } },
            },
          },
        },
      },
    },
    "/api/links/{code}": {
      delete: {
        summary: "Elimina permanentemente un enlace acortado",
        parameters: [
          { name: "code", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "204": { description: "Enlace eliminado" },
          "404": {
            description: "El código no existe",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/Error" } },
            },
          },
        },
      },
    },
    "/{code}": {
      get: {
        summary: "Redirige al destino del código corto",
        parameters: [
          {
            name: "code",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "302": { description: "Redirección al destino original" },
          "404": {
            description: "El código no existe",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/Error" } },
            },
          },
        },
      },
      head: {
        summary:
          "Consulta la URL de destino de un código corto sin redirigir ni incrementar visitas",
        parameters: [
          {
            name: "code",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description:
              "El código existe; la URL de destino viene en el header Location (respuesta sin cuerpo)",
            headers: {
              Location: {
                description: "URL de destino del código corto",
                schema: { type: "string", format: "uri" },
              },
            },
          },
          "404": { description: "El código no existe" },
        },
      },
    },
    "/health": {
      get: {
        summary: "Liveness check",
        responses: { "200": { description: "El proceso está en ejecución" } },
      },
    },
    "/healthz": {
      get: {
        summary: "Readiness check (dependencias externas)",
        responses: {
          "200": { description: "Dependencias saludables" },
          "503": { description: "Alguna dependencia no está disponible" },
        },
      },
    },
  },
  components: {
    schemas: {
      Link: {
        type: "object",
        properties: {
          code: { type: "string" },
          url: { type: "string", format: "uri" },
          visits: { type: "integer", minimum: 0 },
        },
        required: ["code", "url", "visits"],
      },
      ShortenRequest: {
        type: "object",
        properties: {
          url: { type: "string", format: "uri" },
          alias: { type: "string", minLength: 3, maxLength: 30 },
        },
        required: ["url"],
      },
      Error: {
        type: "object",
        properties: { error: { type: "string" } },
        required: ["error"],
      },
    },
  },
} as const;
