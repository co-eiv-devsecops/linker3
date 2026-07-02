output "instance_id" {
  value = oci_core_instance.linker.id
}

output "private_ip" {
  value = oci_core_instance.linker.private_ip
}
