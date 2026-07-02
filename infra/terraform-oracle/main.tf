
resource "oci_core_instance" "linker" {
  availability_domain = var.availability_domain
  compartment_id      = var.compartment_id
  display_name        = var.display_name
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
    ssh_authorized_keys = file(pathexpand(var.ssh_public_key_path))
    user_data = base64encode(file("${path.module}/../../cloud-init.yaml"))
  }
}
