param (
    [Parameter(Mandatory=$true)]
    [string]$Token
)

# Script para sincronizar segredos do Cloudflare Tunnel localmente
# Uso: .\devops\sync-secrets.ps1 -Token "SEU_TOKEN_AQUI"

Write-Host "Criando/Atualizando segredo cloudflare-secrets no namespace thinkbitcoin..." -ForegroundColor Cyan

kubectl create secret generic cloudflare-secrets --from-literal=tunnel-token=$Token -n thinkbitcoin --dry-run=client -o yaml | kubectl apply -f -

Write-Host "Reiniciando o pod do Cloudflare para aplicar a mudança..." -ForegroundColor Yellow
kubectl rollout restart deployment cloudflared -n thinkbitcoin

Write-Host "Concluído! Verifique o status com: kubectl get pods -n thinkbitcoin" -ForegroundColor Green
