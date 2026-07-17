variable "region" {
  description = "Región de AWS"
  type        = string
  default     = "us-east-1"
}

variable "deploy_color" {
  description = "Color del entorno que crea este módulo (en blue/green siempre se crea el inactivo)"
  type        = string
  default     = "green"

  validation {
    condition     = contains(["blue", "green"], var.deploy_color)
    error_message = "deploy_color debe ser 'blue' o 'green'."
  }
}

variable "release_id" {
  description = "Identificador único del release (sha corto o run_id del pipeline); hace único el Name de la instancia"
  type        = string

  validation {
    condition     = can(regex("^[a-zA-Z0-9._-]{1,40}$", var.release_id))
    error_message = "release_id solo admite [a-zA-Z0-9._-], máximo 40 caracteres."
  }
}

variable "ami_id" {
  description = "AMI de Ubuntu 22.04 en la región (ver README para cómo obtenerla)"
  type        = string
}

variable "instance_type" {
  type    = string
  default = "t3.micro"
}

variable "key_name" {
  description = "Nombre del key pair de EC2 para SSH de depuración puntual (opcional)"
  type        = string
  default     = null
}

variable "eip_allocation_id" {
  description = "Allocation ID de la IP elástica persistente del blue/green (se crea una sola vez, fuera de este módulo)"
  type        = string
}

variable "subnet_id" {
  description = "Subred (se crea una sola vez, fuera de este módulo -- la del VPC default)"
  type        = string
}

variable "security_group_id" {
  description = "Security group con el puerto 80 abierto (se crea una sola vez, fuera de este módulo)"
  type        = string
}

variable "base_url" {
  description = "BASE_URL inyectada a la app -- normalmente http://<la IP elástica>"
  type        = string
}

variable "repo_url" {
  type    = string
  default = "https://github.com/co-eiv-devsecops/linker3.git"
}

variable "otel_exporter_otlp_endpoint" {
  description = "Endpoint OTLP (ej. Grafana Cloud). Vacío desactiva el export."
  type        = string
  default     = ""
}

variable "otel_exporter_otlp_headers" {
  description = "Headers de autenticación OTLP (ej. \"Authorization=Basic <token>\")."
  type        = string
  sensitive   = true
  default     = ""
}

variable "otel_service_name" {
  description = "Nombre de servicio OTel; distinto de la VM (linker-3) y de la Lambda (linker-3-serverless)"
  type        = string
  default     = "linker-3-ec2-bluegreen"
}

variable "aws_access_key_id" {
  description = "Solo CI: credenciales explícitas para que el provider no dependa de ~/.aws/credentials"
  type        = string
  default     = null
  sensitive   = true
}

variable "aws_secret_access_key" {
  type      = string
  default   = null
  sensitive = true
}
