terraform {
  required_version = ">= 1.5"

  required_providers {
    oci = {
      source  = "oracle/oci"
      version = "~> 6.0"
    }
  }
}

# Autenticación dual:
# - Local: se usa el perfil de ~/.oci/config (var.oci_profile), igual que
#   infra/terraform-oracle.
# - CI (GitHub Actions): se inyectan tenancy/user/fingerprint/private_key
#   como TF_VAR_* desde los secrets del repo, sin escribir archivos de
#   configuración en el runner.
provider "oci" {
  region              = var.region
  tenancy_ocid        = var.tenancy_ocid
  user_ocid           = var.user_ocid
  fingerprint         = var.fingerprint
  private_key         = var.private_key
  config_file_profile = var.tenancy_ocid == null ? var.oci_profile : null
}
