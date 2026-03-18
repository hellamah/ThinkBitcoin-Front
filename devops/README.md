# DevOps - ThinkBitcoin Frontend

Estrutura de automação e entrega da aplicação frontend, padronizada com o mesmo modelo de diretórios do backend.

## Estrutura
- `deploy/`: execução local e automação de deploy.
  - `docker-compose.yml`: sobe o frontend localmente.
  - `docker_deploy.ps1`: wrapper para subir o compose com build.
  - `helm_deploy.ps1`: faz `helm lint` e executa `helm upgrade --install`.
- `helm/`: chart Helm para implantação em Kubernetes.
- `infra/`: scripts operacionais de infraestrutura.
  - `create_secret.ps1`: cria/aplica secret com `VITE_API_URL`.
  - `cleanup_old_logs.ps1`: coleta os logs recentes dos pods.

## Execução local com Docker Compose
```bash
cd devops/deploy
docker compose up --build -d
```

Ou, via PowerShell:
```powershell
cd devops/deploy
./docker_deploy.ps1
```

A aplicação ficará disponível em `http://localhost:8080`.

## Helm
```bash
helm lint devops/helm/thinkbitcoin-front
helm template thinkbitcoin-front devops/helm/thinkbitcoin-front
```

Deploy via script:
```powershell
cd devops/deploy
./helm_deploy.ps1 -Namespace thinkbitcoin
```

## Infra
Criar/atualizar secret com URL da API:
```powershell
cd devops/infra
./create_secret.ps1 -Namespace thinkbitcoin -ApiUrl "https://api.thinkbitcoin.com"
```

Coletar logs recentes da aplicação:
```powershell
cd devops/infra
./cleanup_old_logs.ps1 -Namespace thinkbitcoin -Tail 300
```


## Pipeline Azure DevOps (YAML)
Arquivo: `devops/azure-pipelines-front-build-image.yml`

Esse pipeline replica o fluxo do build da API (Docker build/push + artefato `image-meta`) adaptado para o frontend:
- Resolução automática do repositório Docker com base na branch de destino:
  - `desenv` → `hellamah/thinkbitcoin.dev.front`
  - `prod` → `hellamah/thinkbitcoin.prod.front`
  - A resolução usa variáveis de ambiente do agente (`SYSTEM_PULLREQUEST_TARGETBRANCH` e `BUILD_SOURCEBRANCH`), evitando erro quando o pipeline não está em contexto de Pull Request;
- Build e push da imagem selecionada com tags `$(Build.BuildId)` e `latest`;
- Geração do arquivo `devops/deploy/image-tag` com a tag do build;
- Cópia das pastas `devops/deploy` e `devops/helm/thinkbitcoin-front` para staging;
- Publicação do artefato `image-meta`;
- Execução automática em Pull Requests direcionados para as branches `desenv` e `prod` e também em `push` (merge) nessas branches.
- Pipeline oficial de build de imagem centralizado no Azure DevOps (sem duplicação de workflow equivalente no GitHub Actions).

> Observação: ajuste a variável `dockerRegistryServiceConnection` conforme sua Service Connection do Docker Hub no Azure DevOps.
