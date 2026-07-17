output "instance_id" {
  description = "ID de la instancia creada (lo usa el pipeline para el switchover y la limpieza)"
  value       = aws_instance.deploy.id
}

output "display_name" {
  value = aws_instance.deploy.tags["Name"]
}

output "public_ip" {
  description = "IP pública propia de la instancia (target del QA antes del switchover, vía la subred default de AWS)"
  value       = aws_instance.deploy.public_ip
}
