variable "app_port" {
  description = "Puerto del host mapeado al puerto 3000 del contenedor"
  type        = number
  default     = 3000
}

variable "base_url" {
  description = "BASE_URL inyectada a la app"
  type        = string
  default     = "http://localhost:3000"
}

variable "container_name" {
  description = "Nombre del contenedor Docker"
  type        = string
  default     = "linker-dev"
}
