resource "docker_image" "linker" {
  name = "linker:local"

  build {
    context    = "${path.module}/../.."
    dockerfile = "infra/docker/Dockerfile"
  }

  triggers = {
    dockerfile_sha1 = filesha1("${path.module}/../docker/Dockerfile")
    server_sha1     = filesha1("${path.module}/../../server.js")
    db_sha1         = filesha1("${path.module}/../../src/db.js")
    links_sha1      = filesha1("${path.module}/../../src/links.js")
    ui_sha1         = filesha1("${path.module}/../../public/index.html")
  }
}

resource "docker_container" "linker" {
  name  = var.container_name
  image = docker_image.linker.image_id

  ports {
    internal = 3000
    external = var.app_port
  }

  env = [
    "PORT=3000",
    "BASE_URL=${var.base_url}",
  ]
}
