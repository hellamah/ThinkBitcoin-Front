# Roadmap ThinkBitcoin-Front

Este roadmap organiza a evolução do frontend do ThinkBitcoin em quatro fases, com foco em entrega contínua, operação do robô trader e evolução para uma plataforma quantitativa completa.

## Fase 1 — Base do Projeto ✅

**Objetivo:** deixar o frontend estruturado e publicável.

### Infraestrutura (DevOps)
- [x] Criar e manter repositório público do frontend.
- [x] Organizar estrutura do projeto.
- [x] Criar e manter README do projeto.
- [x] Definir padrão de versionamento.
- [x] Configurar ESLint. *(Corrigido em 2026-08-16: o `eslint.config.js` existia
  desde o primeiro commit, mas nenhuma das suas 5 dependências estava declarada
  no `package.json` e não havia script — a config nunca foi executável a partir
  de um checkout limpo. Agora `npm run lint` roda.)*
- [ ] Configurar Prettier. *(Estava marcado como feito; não há config nem
  dependência de Prettier no repositório.)*
- [x] Configurar variáveis de ambiente.
- [x] Preparar build de produção.

### Build Pipeline
- [x] Pipeline de build automático (Vercel + Azure).
- [x] Instalação de dependências.
- [ ] Execução de lint. *(Nunca executou. O `npm run lint` já existe, mas o
  repositório acumula 58 erros de quando a config não podia rodar — ligar o gate
  agora quebraria todo build por dívida anterior a ele. Entra depois do passivo.)*
- [x] Execução de testes. *(Corrigido em 2026-08-16: estava marcado como feito e
  não acontecia. O pipeline builda a imagem, e o `Dockerfile` fazia só
  `npm install` + `npm run build` — 507 testes que nenhuma etapa cobrava. Agora
  `npm test` roda antes do build e aborta a imagem se falhar.)*
- [x] Geração do build (`dist`).

> **Aberto, e é decisão de release:** o `Dockerfile` usa `node:18`, e o Vite 7.0.4
> declara `engines: ^20.19.0 || >=22.12.0`. O `npm install` só avisa em
> incompatibilidade de engine, não falha, então isso pode estar passando
> despercebido. Não foi alterado aqui — quem confere se a imagem builda é o
> pipeline.

### Release Pipeline
- [x] Integração com Vercel.
- [ ] Criação de imagem Docker (Legado).
- [ ] Publicação em registry.
- [x] Deploy automático.

**Entregável final:** frontend buildável e deployável automaticamente via Vercel.

---

## Fase 2 — Painel do Robô Trader

**Objetivo:** criar a interface operacional do sistema.

### Dashboard
- Visão geral do robô.
- Saldo total.
- Lucro acumulado.
- Drawdown.
- Última operação.
- Status do robô.

### Mercado
- Lista de moedas monitoradas.
- Preço atual.
- Variação.
- Volume.
- Ranking de moedas.

### Carteira
- Posições abertas.
- Histórico de posições.
- Lucro por ativo.

### Histórico de Trades
- Lista completa de trades.
- Filtros por data.
- Resultado por trade.
- Gráfico de performance.

### Decisões do algoritmo
- Decisão atual do robô.
- Probabilidade da decisão.
- Métricas utilizadas.
- Histórico de decisões.

### Logs do sistema
- Logs do robô.
- Eventos importantes.
- Erros e alertas.

**Entregável final:** painel funcional para acompanhar o robô trader.

---

## Fase 3 — Plataforma de Pesquisa de Estratégias

**Objetivo:** transformar o ThinkBitcoin em laboratório quantitativo.

### Backtest
- Selecionar moeda.
- Selecionar período histórico.
- Selecionar estratégia.
- Executar simulação.

**Resultados exibidos:**
- [x] Lucro.
- [x] Drawdown.
- [x] Win rate.
- [x] Sharpe ratio.
- [x] Curva de capital.

### Simulador de Portfólio
- Seleção de múltiplos ativos.
- Definição de alocação.
- Simulação de carteira.

**Métricas:**
- Retorno total.
- Risco.
- Volatilidade.

### Comparação de Estratégias
- Executar múltiplas estratégias.
- Comparar resultados.
- Ranking de estratégias.

### Visualização de dados históricos
- Gráficos de candles.
- Indicadores técnicos.
- Sinais gerados pelo algoritmo.

### Métricas de treinamento (RL)
- Reward por episódio.
- Convergência do modelo.
- Distribuição de ações.
- Evolução do aprendizado.

**Entregável final:** plataforma de pesquisa e experimentação de estratégias.

---

## Fase 4 — Experiência do Usuário

**Objetivo:** tornar o sistema utilizável e profissional.

### Interface
- Dark mode.
- Layout responsivo.
- Navegação simplificada.

### Gráficos
- Gráficos interativos.
- Zoom temporal.
- Comparação de métricas.

### Performance
- Carregamento assíncrono.
- Cache de dados.
- Atualização eficiente.

### Estrutura final da interface
- Dashboard.
- Mercado.
- Carteira.
- Trades.
- Strategy Lab.
- Backtests.
- Simulações.
- Training Metrics.
- Configurações.

---

## Resultado final esperado

O frontend do ThinkBitcoin deixa de ser apenas a interface de um robô trader e passa a ser uma plataforma de pesquisa quantitativa para trading.
