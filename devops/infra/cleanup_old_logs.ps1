param(
    [string]$Namespace = "thinkbitcoin",
    [string]$AppLabel = "app.kubernetes.io/name=thinkbitcoin-front",
    [int]$Tail = 200
)

$ErrorActionPreference = "Stop"

Write-Host "[INFO] Coletando pods com label '$AppLabel'..." -ForegroundColor Cyan
$pods = kubectl get pods -n $Namespace -l $AppLabel -o jsonpath='{.items[*].metadata.name}'

if ([string]::IsNullOrWhiteSpace($pods)) {
    Write-Host "[WARN] Nenhum pod encontrado para a label informada." -ForegroundColor Yellow
    exit 0
}

foreach ($pod in $pods.Split(' ')) {
    if ([string]::IsNullOrWhiteSpace($pod)) { continue }

    Write-Host "`n[INFO] Últimas $Tail linhas do pod: $pod" -ForegroundColor Cyan
    kubectl logs $pod -n $Namespace --tail=$Tail
}

Write-Host "`n[OK] Coleta de logs finalizada." -ForegroundColor Green
