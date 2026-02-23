# DevOps - ThinkBitcoin Frontend

Estrutura de automação e entrega da aplicação frontend.

## Estrutura
- `deploy/`: execução local e comandos de deploy (`docker-compose.yml`).
- `helm/`: chart Helm para implantação em Kubernetes.
- `infra/`: diretório reservado para arquivos de infraestrutura.

## Execução local com Docker Compose
```bash
cd devops/deploy
docker compose up --build -d
```

A aplicação ficará disponível em `http://localhost:8080`.

## Helm
```bash
helm lint devops/helm/thinkbitcoin-front
helm template thinkbitcoin-front devops/helm/thinkbitcoin-front
```
