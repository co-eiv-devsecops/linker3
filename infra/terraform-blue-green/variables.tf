# --- Identidad del despliegue -------------------------------------------------

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
  description = "Identificador único del release (p. ej. sha corto o run_id del pipeline); hace único el display_name de la instancia"
  type        = string

  validation {
    condition     = can(regex("^[a-zA-Z0-9._-]{1,40}$", var.release_id))
    error_message = "release_id solo admite [a-zA-Z0-9._-], máximo 40 caracteres."
  }
}

# --- Red / ubicación (provistos por el curso) ---------------------------------

variable "compartment_id" {
  description = "OCID del compartment donde se crea la instancia"
  type        = string
}

variable "subnet_id" {
  description = "OCID de la subnet ya existente donde se conecta la VM"
  type        = string
}

variable "region" {
  description = "Región de OCI"
  type        = string
  default     = "sa-bogota-1"
}

variable "availability_domain" {
  description = "Availability Domain donde se lanza la instancia"
  type        = string
  default     = "gyPa:SA-BOGOTA-1-AD-1"
}

variable "assign_public_ip" {
  description = "La subnet provista por el curso maneja el acceso (bastion); por defecto sin IP pública"
  type        = bool
  default     = false
}

# --- Forma de la instancia (mismos defaults que infra/terraform-oracle) -------

variable "shape" {
  description = "Shape de la instancia (Flex requiere shape_config)"
  type        = string
  default     = "VM.Standard.E5.Flex"
}

variable "shape_ocpus" {
  type    = number
  default = 1
}

variable "shape_memory_in_gbs" {
  type    = number
  default = 4
}

variable "shape_baseline_ocpu_utilization" {
  type    = string
  default = "BASELINE_1_2"
}

variable "image_id" {
  description = "OCID de la imagen (Ubuntu, region sa-bogota-1)"
  type        = string
  default     = "ocid1.image.oc1.sa-bogota-1.aaaaaaaaw7eyundl5ujyif7fvp7fvruy4eijcxygmo64nx6imaygskhmndla"
}

# --- Acceso SSH ---------------------------------------------------------------

variable "ssh_public_key" {
  description = "Contenido de la llave pública SSH (preferido en CI: se pasa como TF_VAR_ssh_public_key). Si está vacío se lee ssh_public_key_path."
  type        = string
  default     = ""
}

variable "ssh_public_key_path" {
  description = "Ruta local a la llave pública SSH (fallback para uso fuera de CI)"
  type        = string
  default     = "~/.ssh/linker.pub"
}

# --- Autenticación del provider (solo CI; en local se usa oci_profile) --------

variable "oci_profile" {
  description = "Perfil de ~/.oci/config a usar en ejecución local"
  type        = string
  default     = "DEFAULT"
}

variable "tenancy_ocid" {
  description = "OCID del tenancy (solo CI; en local dejar null y usar oci_profile)"
  type        = string
  default     = null
}

variable "user_ocid" {
  description = "OCID del usuario de API (solo CI)"
  type        = string
  default     = null
}

variable "fingerprint" {
  description = "Fingerprint de la llave de API (solo CI)"
  type        = string
  default     = null
}

variable "private_key" {
  description = "Contenido PEM de la llave privada de API (solo CI, nunca en tfvars versionados)"
  type        = string
  default     = null
  sensitive   = true
}
