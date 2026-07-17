data "aws_iam_policy_document" "lambda_assume" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "linker" {
  name               = "${var.function_name}-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

resource "aws_iam_role_policy_attachment" "basic_logs" {
  role       = aws_iam_role.linker.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "xray_write" {
  role       = aws_iam_role.linker.name
  policy_arn = "arn:aws:iam::aws:policy/AWSXRayDaemonWriteAccess"
}

resource "aws_cloudwatch_log_group" "linker" {
  name              = "/aws/lambda/${var.function_name}"
  retention_in_days = var.log_retention_days
}

resource "aws_lambda_function" "linker" {
  function_name = var.function_name
  role          = aws_iam_role.linker.arn

  # Mismo artefacto que la VM de OCI: dist/ compilado + public/ + deps de prod.
  filename         = var.package_path
  source_code_hash = filebase64sha256(var.package_path)
  handler          = "dist/serverless/aws.handler"
  runtime          = "nodejs22.x"

  memory_size = 256
  timeout     = 10

  environment {
    variables = {
      # El filesystem de Lambda es de solo lectura salvo /tmp: la base SQLite
      # vive ahí y es efímera por instancia (ver docs/serverless.md).
      DB_PATH                     = "/tmp/linker.db"
      BASE_URL                    = var.base_url != "" ? var.base_url : "http://localhost:3000"
      OTEL_SERVICE_NAME           = var.otel_service_name
      OTEL_EXPORTER_OTLP_ENDPOINT = var.otel_exporter_otlp_endpoint
      OTEL_EXPORTER_OTLP_HEADERS  = var.otel_exporter_otlp_headers
    }
  }

  tracing_config {
    mode = "Active"
  }

  depends_on = [
    aws_iam_role_policy_attachment.basic_logs,
    aws_iam_role_policy_attachment.xray_write,
    aws_cloudwatch_log_group.linker,
  ]
}

resource "aws_lambda_alias" "live" {
  name             = "live"
  description      = "Alias estable de blue/green; el pipeline serverless-deploy.yml mueve function_version/routing_config con cada release (canary -> promote/rollback), no Terraform."
  function_name    = aws_lambda_function.linker.function_name
  function_version = aws_lambda_function.linker.version

  lifecycle {
    ignore_changes = [function_version, routing_config]
  }
}

resource "aws_lambda_function_url" "linker" {
  function_name      = aws_lambda_function.linker.function_name
  qualifier          = aws_lambda_alias.live.name
  authorization_type = "NONE"
}
