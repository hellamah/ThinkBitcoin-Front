# ThinkBitcoin Frontend

Aplicação web construída com React e Vite para acompanhar cotações de criptoativos, realizar autenticação e gerenciar preferências do usuário.

## Visão Geral
- Interface responsiva com Material UI e gráficos em tempo real fornecidos pelo Chart.js.
- Suporte a autenticação com persistência de token e preferências armazenadas no navegador.
- Internacionalização com suporte para português e inglês.
- Utilização de *hooks* customizados para preços (`useCoinPrices`) e tradução (`useTranslation`).
- Planejamento evolutivo documentado no arquivo `ROADMAP.md`.

## Roadmap
- O roadmap completo de evolução do produto está em [`ROADMAP.md`](./ROADMAP.md), organizado em quatro fases:
  - Base do projeto e pipeline de entrega.
  - Painel operacional do robô trader.
  - Plataforma de pesquisa de estratégias.
  - Evolução de UX, gráficos e performance.

## Pré-requisitos
- Node.js 18 ou superior.
- npm 10 ou superior.

## Instalação
```bash
cd src
npm install
```

## Scripts Disponíveis
| Comando        | Descrição                                     |
|----------------|-----------------------------------------------|
| `npm run dev`  | Inicia o servidor de desenvolvimento do Vite. |
| `npm run build`| Gera a versão otimizada para produção.        |
| `npm run preview` | Visualiza localmente o *build* gerado.     |
| `npm test`     | Executa a suíte de testes com o Vitest.       |

## Estrutura Principal
```
src/
├─ src/
│  ├─ components/        # Componentes reutilizáveis (Layout, Modal, etc.)
│  ├─ context/           # Contextos globais (AuthContext)
│  ├─ hooks/             # Hooks customizados (tradução, preços)
│  ├─ lang/              # Arquivos de tradução
│  ├─ pages/             # Páginas principais da aplicação
│  └─ utils/             # Utilidades compartilhadas (enums, helpers)
├─ public/               # Recursos estáticos usados pelo Vite
└─ test/                 # Testes automatizados
```

## Padrões e Boas Práticas
- Utilize os utilitários presentes em `src/utils` para trabalhar com enums, autenticação (`authentication.js`), camada de API (`apiClient.js`), workflows de interface (`workflow.js`) e armazenamento de preferências.
- Sempre execute `npm test` antes de abrir um pull request.
- Novas traduções devem ser adicionadas em `src/lang/en.json` e `src/lang/pt.json`.



## Depuração no VS Code
Foi adicionado o arquivo `src/.vscode/launch.json` com configurações prontas para depuração local:

- **ThinkBitcoin Front: Vite (dev)**: inicia o servidor de desenvolvimento via `npm run dev`.
- **ThinkBitcoin Front: Abrir no Chrome**: abre o app em `http://localhost:5173` com suporte a *breakpoints* no código React.
- **ThinkBitcoin Front: Testes (Vitest)**: executa os testes (`npm test`) com depuração no terminal integrado.

> Dica: para essas configurações funcionarem sem ajustes, abra no VS Code a pasta `ThinkBitcoin-Front/src` (a que contém o `package.json`) e use a aba **Run and Debug** para selecionar uma configuração.

## DevOps
A estrutura `devops/` segue o padrão do backend e está organizada com as mesmas camadas:

- `devops/deploy`: automação de deploy local e Kubernetes.
  - `docker-compose.yml`
  - `docker_deploy.ps1`
  - `helm_deploy.ps1`
- `devops/helm`: chart Helm (`thinkbitcoin-front`) para Kubernetes.
- `devops/infra`: scripts operacionais.
  - `create_secret.ps1`
  - `cleanup_old_logs.ps1`

Também foram adicionados workflows no GitHub Actions seguindo o fluxo padrão de validação, entrega contínua e release:

- `.github/workflows/ci.yml`: valida integração contínua com `npm ci`, `npm test`, `npm run build` e `docker build` em `push` e `pull_request` para `main` e `develop`.
- `.github/workflows/cd.yml`: publica a imagem Docker no GHCR em `push` para `main` (e também permite execução manual por `workflow_dispatch`).
- `.github/workflows/release.yml`: em tags `v*.*.*` (ou manualmente), executa `npm ci`, `npm test`, `npm run build`, publica imagem Docker no GHCR com tags de release e cria a release no GitHub com notas automáticas.

Para build/push de imagem, o pipeline oficial está no Azure DevOps em `devops/azure-pipelines-front-build-image.yml`, com gatilhos em PR e também em merge (`push`) para `desenv` e `prod`.

Esse pipeline publica o artefato `front-meta` (artefato oficial do frontend).

### Variáveis e segredos esperados
- `vars.VITE_API_URL`: URL da API usada no build da imagem.
- `secrets.GITHUB_TOKEN`: token padrão do GitHub Actions para publicar no GHCR.

## Testes
```bash
cd src
npm test
```
Os testes utilizam o Vitest e são executados em modo *headless*.

## Contribuição
1. Crie uma *branch* para sua funcionalidade.
2. Garanta que os testes estejam passando (`npm test`).
3. Abra um pull request descrevendo claramente as alterações.
