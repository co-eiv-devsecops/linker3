# Instancia efímera del blue/green de EC2 (equivalente en AWS al de OCI en
# infra/terraform-blue-green, pero sin bastion ni Load Balancer: la subred
# default de AWS ya asigna IP pública propia a cada instancia, así que el QA
# se hace directo contra esa IP y el switchover es solo reasignar la IP
# elástica persistente -- ver .github/workflows/blue-green-deploy-aws.yml).
#
# Este módulo crea SOLO la instancia nueva; la que ya sirve tráfico no se
# toca. El switchover y la limpieza los hace el pipeline vía AWS CLI.

resource "aws_instance" "deploy" {
  ami                    = var.ami_id
  instance_type          = var.instance_type
  subnet_id              = var.subnet_id
  vpc_security_group_ids = [var.security_group_id]
  key_name               = var.key_name

  user_data = templatefile("${path.module}/cloud-init.tpl", {
    repo_url                    = var.repo_url
    base_url                    = var.base_url
    otel_service_name           = var.otel_service_name
    otel_exporter_otlp_endpoint = var.otel_exporter_otlp_endpoint
    otel_exporter_otlp_headers  = var.otel_exporter_otlp_headers
  })
  # Cada release debe ser una instancia nueva, nunca reescribir el user_data
  # de una que ya está corriendo (por defecto el provider no fuerza replace).
  user_data_replace_on_change = true

  tags = {
    Name    = "linker-${var.deploy_color}-${var.release_id}"
    app     = "linker"
    role    = "blue-green"
    color   = var.deploy_color
    release = var.release_id
  }
}
