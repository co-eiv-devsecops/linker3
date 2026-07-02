variable "compartment_id" {
  description = "OCID del compartment donde se crea la instancia"
  type        = string
}

variable "subnet_id" {
  description = "OCID de la subnet ya existente donde se conecta la VM"
  type        = string
}

variable "oci_profile" {
  description = "Perfil de ~/.oci/config a usar (el mismo que usa `oci` CLI)"
  type        = string
  default     = "DEFAULT"
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

variable "display_name" {
  description = "Nombre de la instancia"
  type        = string
  default     = "linker-vm"
}

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

variable "assign_public_ip" {
  description = "La subnet ya provista por el curso maneja el acceso; por defecto sin IP pública"
  type        = bool
  default     = false
}

variable "ssh_public_key_path" {
  description = "Ruta a la llave pública SSH a inyectar en la VM"
  type        = string
  default     = "~/.ssh/linker.pub"
}
