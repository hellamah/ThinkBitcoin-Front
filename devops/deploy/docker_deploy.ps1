param(
    [string]$ProjectName = "thinkbitcoin-front",
    [string]$ComposeFile = "./docker-compose.yml"
)

$ErrorActionPreference = "Stop"

Write-Host "[INFO] Subindo ambiente local via Docker Compose..." -ForegroundColor Green
docker compose -p $ProjectName -f $ComposeFile up --build -d
