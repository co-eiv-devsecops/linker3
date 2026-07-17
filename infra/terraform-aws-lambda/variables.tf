variable "region" {
  description = "Región de AWS donde se crea la función Lambda"
  type        = string
  default     = "us-east-1"
}

variable "function_name" {
  description = "Nombre de la función Lambda"
  type        = string
  default     = "linker-serverless"
}

variable "package_path" {
  description = "Ruta al zip generado por infra/scripts/package-serverless.sh"
  type        = string
  default     = "../../linker-serverless.zip"
}

variable "base_url" {
  description = "BASE_URL usado para construir los links cortos. Tras el primer apply, fijarlo a la Function URL emitida en los outputs y volver a aplicar."
  type        = string
  default     = ""
}

variable "log_retention_days" {
  description = "Días de retención de los logs en CloudWatch"
  type        = number
  default     = 14
}

variable "otel_exporter_otlp_endpoint" {
  description = "Endpoint OTLP (ej. Grafana Cloud) para exportar métricas/logs/trazas. Vacío desactiva el export en vez de fallar el arranque."
  type        = string
  default     = ""
}

variable "otel_exporter_otlp_headers" {
  description = "Headers de autenticación OTLP (ej. \"Authorization=Basic <token>\" para Grafana Cloud)."
  type        = string
  sensitive   = true
  default     = ""
}

variable "otel_service_name" {
  description = "Nombre de servicio OTel; distinto del de la VM para que el gate de Grafana del canary mida solo tráfico de esta función."
  type        = string
  default     = "linker-3-serverless"
}
