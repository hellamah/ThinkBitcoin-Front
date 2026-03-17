param(
    [string]$ReleaseName = "thinkbitcoin-front",
    [string]$Namespace = "thinkbitcoin",
    [string]$ChartPath = "../helm/thinkbitcoin-front",
    [string]$ValuesFile = "../helm/thinkbitcoin-front/values.yaml",
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

Write-Host "[INFO] Validando chart Helm..." -ForegroundColor Cyan
helm lint $ChartPath

$deployArgs = @(
    "upgrade",
    "--install",
    $ReleaseName,
    $ChartPath,
    "--namespace", $Namespace,
    "--create-namespace",
    "-f", $ValuesFile
)

if ($DryRun) {
    $deployArgs += "--dry-run"
}

Write-Host "[INFO] Executando deploy Helm para '$ReleaseName' no namespace '$Namespace'..." -ForegroundColor Cyan
helm @deployArgs

Write-Host "[OK] Processo concluído." -ForegroundColor Green
