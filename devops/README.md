# DevOps - ThinkBitcoin Frontend

Estrutura de automação e entrega da aplicação frontend, padronizada com o mesmo modelo de diretórios do backend.

## Estrutura
- `deploy/`: automação de deploy.
  - `helm_deploy.ps1`: padroniza deploy Helm (com fallback por variáveis de ambiente/arquivo `image-tag`) e executa `helm upgrade --install`.
- `helm/`: chart Helm para implantação em Kubernetes.
- `infra/`: scripts operacionais de infraestrutura.
  - `create_secret.ps1`: cria/aplica secret com `VITE_API_URL`.
  - `cleanup_old_logs.ps1`: coleta os logs recentes dos pods.

## Execução local (desenvolvimento)
O frontend não usa Docker localmente. Para rodar em modo de desenvolvimento com hot-reload:
```bash
cd src
npm install   # apenas na primeira vez
npm run dev
```
A aplicação ficará disponível em `http://localhost:5173`.

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


Exemplo com override de imagem (modelo do release):
```powershell
cd devops/deploy
./helm_deploy.ps1 -Namespace thinkbitcoin -ImageRepository "hellamah/thinkbitcoin.dev.front" -ImageTag "12345"
```

O script também aceita valores vindos do pipeline:
- `IMAGE_TAG`/`DOCKER_IMAGE_TAG`;
- `IMAGE_REPOSITORY`/`DOCKER_IMAGE_REPOSITORY`;
- `VITE_API_URL`/`FRONT_VITE_API_URL`;
- `DEPLOY_ENV`/`DEPLOY_ENVIRONMENT` (`dev`, `desenv`, `prod`).

Se `IMAGE_TAG` não for informado, ele tenta ler automaticamente `devops/deploy/image-tag`.

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

Esse pipeline replica o fluxo do build da API (Docker build/push + metadados de imagem) adaptado para o frontend:
- Nome da execução (`run name`) padronizado para `$(Build.BuildId)` para refletir a numeração do Docker tag (evita formato automático com data + descrição do merge);
- Resolução automática do repositório Docker com base na branch de destino:
  - `Desenv` → `hellamah/thinkbitcoin.dev.front`
  - `Prod` → `hellamah/thinkbitcoin.prod.front`
  - A resolução usa variáveis de ambiente do agente (`SYSTEM_PULLREQUEST_TARGETBRANCH` e `BUILD_SOURCEBRANCH`), evitando erro quando o pipeline não está em contexto de Pull Request;
- Build e push da imagem selecionada com tags `$(Build.BuildId)` e `latest`;
  - Padrão oficial para o passo **buildAndPush docker** (frontend):
    ```yaml
    - task: Docker@2
      displayName: buildAndPush docker
      inputs:
        containerRegistry: $(dockerRegistryServiceConnection)
        repository: $(imageRepository)
        command: buildAndPush
        Dockerfile: $(dockerfilePath)   # src/Dockerfile
        buildContext: $(buildContext)   # src
        tags: |
          $(Build.BuildId)
          latest
    ```
    - No frontend, o `repository` é resolvido por branch (`Desenv`/`Prod`) e não deve usar o repositório da API.
- Geração do arquivo `devops/deploy/image-tag` com a tag do build;
  - Padrão oficial para o passo **Set Helm Image Tag**:
    ```yaml
    - powershell: |
        $tag  = "$(Build.BuildId)"
        $path = "$(Build.SourcesDirectory)/devops/deploy/image-tag"
        $dir = Split-Path -Parent $path
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Set-Content -Path $path -Value $tag -Encoding utf8
        Write-Host "Tag escrita em ${path}: $tag"
      displayName: 'Set Helm Image Tag'
    ```
    - O uso de `${path}` no `Write-Host` evita erro de parsing com `:`.
- Cópia das pastas `devops/deploy` e `devops/helm/thinkbitcoin-front` para staging;
- Publicação do artefato `front-meta` no staging do frontend para consumo em pipelines de release do Front;
- Execução automática em Pull Requests direcionados para as branches `Desenv` e `Prod` e também em `push` (merge) nessas branches.
- Pipeline oficial de build de imagem centralizado no Azure DevOps (sem duplicação de workflow equivalente no GitHub Actions).

> Observação: ajuste a variável `dockerRegistryServiceConnection` conforme sua Service Connection do Docker Hub no Azure DevOps.
