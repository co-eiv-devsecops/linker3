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
