param(
    [string]$ProjectName = "thinkbitcoin-front",
    [string]$ComposeFile = "./docker-compose.yml"
)

$ErrorActionPreference = "Stop"

Write-Host "[INFO] Subindo ambiente local via Docker Compose..." -ForegroundColor Cyan
docker compose -p $ProjectName -f $ComposeFile up --build -d

Write-Host "[OK] Frontend disponível em http://localhost:8080" -ForegroundColor Green
