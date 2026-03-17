param(
    [string]$Namespace = "thinkbitcoin",
    [string]$SecretName = "thinkbitcoin-front-secret",
    [string]$ApiUrl,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($ApiUrl)) {
    throw "Informe -ApiUrl com a URL da API (ex.: https://api.exemplo.com)."
}

$cmd = @(
    "create", "secret", "generic", $SecretName,
    "--from-literal=VITE_API_URL=$ApiUrl",
    "--namespace", $Namespace,
    "--dry-run=client", "-o", "yaml"
)

if ($DryRun) {
    Write-Host "[INFO] Pré-visualização do secret (dry-run):" -ForegroundColor Yellow
    kubectl @cmd
}
else {
    Write-Host "[INFO] Criando/atualizando secret '$SecretName' no namespace '$Namespace'..." -ForegroundColor Cyan
    kubectl @cmd | kubectl apply -f -
    Write-Host "[OK] Secret aplicado com sucesso." -ForegroundColor Green
}
