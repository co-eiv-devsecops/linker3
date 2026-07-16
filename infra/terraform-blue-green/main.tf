# Instancia efímera del despliegue blue/green.
#
# Este módulo crea SOLO la instancia nueva (por convención "green"): la
# instancia activa que ya sirve producción no se toca desde aquí. El
# switchover de tráfico y la limpieza de la instancia anterior los hace el
# pipeline (.github/workflows/blue-green-deploy-oci.yml) vía OCI CLI —
# ver infra/scripts/blue-green/.

locals {
  instance_name = "linker-${var.deploy_color}-${var.release_id}"

  ssh_public_key = var.ssh_public_key != "" ? var.ssh_public_key : file(pathexpand(var.ssh_public_key_path))
}

resource "oci_core_instance" "deploy" {
  availability_domain = var.availability_domain
  compartment_id      = var.compartment_id
  display_name        = local.instance_name
  shape               = var.shape

  shape_config {
    ocpus                     = var.shape_ocpus
    memory_in_gbs             = var.shape_memory_in_gbs
    baseline_ocpu_utilization = var.shape_baseline_ocpu_utilization
  }

  create_vnic_details {
    subnet_id        = var.subnet_id
    assign_public_ip = var.assign_public_ip
  }

  source_details {
    source_type = "image"
    source_id   = var.image_id
  }

  metadata = {
    ssh_authorized_keys = local.ssh_public_key
    user_data           = base64encode(file("${path.module}/../../cloud-init.yaml"))
  }

  freeform_tags = {
    app     = "linker"
    role    = "blue-green"
    color   = var.deploy_color
    release = var.release_id
  }
}

# La VNIC primaria y su private IP: el switchover mueve la IP pública
# reservada de producción hacia el OCID de esta private IP.
data "oci_core_vnic_attachments" "deploy" {
  compartment_id = var.compartment_id
  instance_id    = oci_core_instance.deploy.id
}

data "oci_core_private_ips" "deploy" {
  vnic_id = data.oci_core_vnic_attachments.deploy.vnic_attachments[0].vnic_id
}
