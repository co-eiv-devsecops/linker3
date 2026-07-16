output "instance_id" {
  description = "OCID de la instancia creada (lo usa el pipeline para la limpieza)"
  value       = oci_core_instance.deploy.id
}

output "display_name" {
  description = "Nombre de la instancia (linker-<color>-<release_id>)"
  value       = oci_core_instance.deploy.display_name
}

output "private_ip" {
  description = "IP privada de la instancia (target del healthcheck vía bastion)"
  value       = oci_core_instance.deploy.private_ip
}

output "private_ip_ocid" {
  description = "OCID de la private IP primaria (target del switchover de la IP pública reservada)"
  value       = [for ip in data.oci_core_private_ips.deploy.private_ips : ip.id if ip.is_primary][0]
}
