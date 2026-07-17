output "function_name" {
  description = "Nombre de la función Lambda desplegada"
  value       = aws_lambda_function.linker.function_name
}

output "function_url" {
  description = "URL pública de la función (usar como BASE_URL y como LAMBDA_FUNCTION_URL en GitHub)"
  value       = aws_lambda_function_url.linker.function_url
}

output "alias_name" {
  description = "Alias estable que apunta la Function URL (usar como LAMBDA_ALIAS_NAME en GitHub)"
  value       = aws_lambda_alias.live.name
}
