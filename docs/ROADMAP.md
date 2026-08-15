# Roadmap ThinkBitcoin-Front

Este roadmap organiza a evolução do frontend do ThinkBitcoin em quatro fases, com foco em entrega contínua, operação do robô trader e evolução para uma plataforma quantitativa completa.

## Fase 1 — Base do Projeto ✅

**Objetivo:** deixar o frontend estruturado e publicável.

### Infraestrutura (DevOps)
- [x] Criar e manter repositório público do frontend.
- [x] Organizar estrutura do projeto.
- [x] Criar e manter README do projeto.
- [x] Definir padrão de versionamento.
- [x] Configurar ESLint e Prettier.
- [x] Configurar variáveis de ambiente.
- [x] Preparar build de produção.

### Build Pipeline
- [x] Pipeline de build automático (Vercel + Azure).
- [x] Instalação de dependências.
- [x] Execução de lint.
- [x] Execução de testes.
- [x] Geração do build (`dist`).

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
