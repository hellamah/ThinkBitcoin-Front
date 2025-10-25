# ThinkBitcoin Frontend

Aplicação web construída com React e Vite para acompanhar cotações de criptoativos, realizar autenticação e gerenciar preferências do usuário.

## Visão Geral
- Interface responsiva com Material UI e gráficos em tempo real fornecidos pelo Chart.js.
- Suporte a autenticação com persistência de token e preferências armazenadas no navegador.
- Internacionalização com suporte para português e inglês.
- Utilização de *hooks* customizados para preços (`useCoinPrices`) e tradução (`useTranslation`).

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
- Utilize os utilitários presentes em `src/utils` para trabalhar com enums, autenticação (`authentication.js`) e armazenamento de preferências.
- Sempre execute `npm test` antes de abrir um pull request.
- Novas traduções devem ser adicionadas em `src/lang/en.json` e `src/lang/pt.json`.

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
