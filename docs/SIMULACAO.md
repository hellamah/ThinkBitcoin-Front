# Ferramenta de Simulação de Estratégias

Documento vivo. Registra o desenho da simulação do dashboard, o que já foi
**confirmado contra o código** dos três repositórios e o que ainda está aberto.

Enquanto houver linha `⬜` na seção 2, o desenho não está fechado.

**Escopo de alteração: `ThinkBitcoin-Front` e `ThinkBitcoin-Back-DotNet`.** O
repositório Python **não é tocado** — foi lido apenas para extrair convenções
numéricas já estabelecidas (seção 3), e nenhum passo desta entrega escreve nele.

| Repositório | Papel aqui |
|---|---|
| `ThinkBitcoin-Front` | onde a ferramenta vive — todos os passos da seção 8 |
| `ThinkBitcoin-Back-DotNet` | API e banco — revisões das seções 10 e 11 |
| `ThinkBitcoin-Back-Python` | **somente leitura**, como referência de aritmética |

---

## 1. O que é (e o que não é)

Uma **simulação de estratégia baseada em regras**, rodando no navegador sobre os
candles que o dashboard já carregou. O usuário escolhe um sinal de entrada, uma
regra de saída e um custo, e vê a curva de capital, as métricas e a lista de
trades.

**Não é** o backtest do agente. Esse já existe, em
`ThinkBitcoin-Back-Python/src/ScriptComum/backtest/Backtester.py`, e faz outra
coisa: replay do agente treinado (DQN/Q-Learning) sobre o histórico com
`epsilon=0`. Os dois convivem — um mede *regra escolhida por humano*, o outro
mede *política aprendida pela máquina*.

Justamente por conviverem, **os dois têm de concordar na aritmética**. Um usuário
que vir 3,2% aqui e 1,8% lá para a mesma janela vai parar de confiar nos dois.
A seção 3 é o contrato que impede isso.

---

## 2. Estado da verificação

| # | Item | Estado | Onde foi confirmado |
|---|---|---|---|
| V1 | Campos OHLCV disponíveis na resposta | ✅ | `ValorMoedaController.cs:24-82`, `IEntidadeMoedaValor.cs` |
| V2 | Índice em `HoraReferencia` existe | ✅ | `MoedaBTCUSDTBinanceConfiguration.cs` — `builder.HasIndex(m => m.HoraReferencia)` |
| V3 | Precisão `decimal(15,5)` suficiente | ✅ | Config de todas as tabelas de moeda; menor par é DOGE |
| V4 | Cadência da coleta é **horária** | ✅ | `Back-DotNet/docs/README.md` — "coleta de uma hora", `TEMPO_REAL` olha "a hora recém-fechada" |
| V5 | Custo por perna = 0,1% | ✅ | `utils/environment.py:145` — `fee_rate: float = 0.001` |
| V6 | Dimensionamento = capital cheio (reinveste) | ✅ | `utils/environment.py:177,561` — `position_fraction = 1.0`, `notional = equity * fraction` |
| V7 | Taxa cobrada nas duas pernas | ✅ | `utils/environment.py:564` (abertura) e `:602` (fechamento) |
| V8 | Capital inicial 1000 | ✅ | `evaluation_service.py` — `initial_cash: float = 1000.0` |
| V9 | Causalidade da entrada (não colher barra não-posicionada) | ✅ | `utils/environment.py:539-543` — `exposure_prev` |
| V10 | Fórmula do stop por ATR | ✅ | `utils/environment.py:581` — `max(0.01, min(0.10, atr_pct * 2.0))` |
| V11 | Régua de linha válida | ✅ | `market_data_repository.py:133` — `price > 0 and volume > 0` |
| V12 | Buy & hold **não** paga taxa no backend | ⚠️ | `evaluation_service.py` + comentário em `environment.py:545` — ver D-01 |
| V13 | Série pode ter **buracos legítimos** | ⚠️ | `Back-DotNet/docs/README.md`, seção `LACUNAS` — ver R-01 |
| V14 | Sem teto em `quantidade` na API | ✅ | Era ⚠️. **Corrigido** — teto de 5.000 em `FuncaoObterValorMoeda`, ver B-01 |
| V15 | Densidade real de buracos por moeda/janela | ✅ | **Medido.** ~1,5% das horas faltam; 30 buracos no histórico do BTC. Ver seção 7 |
| V16 | `HoraReferencia` é única por tabela de moeda | ✅ | **Zero duplicatas nas 10 moedas.** O índice não é `IsUnique`, mas a inserção idempotente por `IdColeta` sustenta na prática |
| V17 | Quanto histórico existe por moeda | ✅ | **~20.500 candles, 866–887 dias.** Destravou D-03 |
| V18 | `signalLab.test.js` cobre o refactor | ✅ | Era ❌ (A-01). Resolvido no passo 0: 13 → 22 testes, alinhamento cravado por `retornoMedio` |
| V19 | Série da simulação é imune à paginação | ✅ | Era ❌ (A-02). Resolvido pelo D-03: o painel tem busca própria e não depende de `pagina` |
| V20 | Formato de `horaReferencia` igual em mock e produção | ✅ | Era ❌ (A-03). Resolvido na fronteira: `normalizeApiKeys` marca UTC, então as duas formas chegam idênticas |
| V21 | `HoraReferencia` = abertura do candle | ✅ | `FuncaoPreencherTbMoedaBinance` — `= p.dataHoraAberturaUtc` |

---

## 3. Contrato de aritmética

Estes valores passam a ser **constantes do front**. Não são escolha nova: foram
copiados do ambiente de simulação do Python em **2026-08-14**, onde já valem em
produção. A cópia é deliberada — o Python não é alterado, e o front não lê nada
dele em runtime.

| Parâmetro | Valor | Onde já valia |
|---|---|---|
| Custo por perna | **0,1%** | `environment.py:145` — `fee_rate = 0.001` |
| Cobrança | **nas duas pernas** | `environment.py:564` e `:602` |
| Capital inicial | **1000** | `evaluation_service.py` — `initial_cash` |
| Dimensionamento | **capital cheio, reinvestindo** | `environment.py:177,561` |
| Stop por ATR (quando entrar) | **`clamp(ATR% × 2, 1%, 10%)`** | `environment.py:581` |
| Linha válida | **preço > 0 **e** volume > 0** | `market_data_repository.py:133` |

O 0,1% também tem lastro independente: é a taxa taker de spot, e o mock da
integração com a corretora usa o mesmo `0.001m`
(`ThinkBitcoin.Externo/TransacaoPrivada/FinalizarOperacaoContaMB/`). Ou seja, o
número não depende do Python para se sustentar.

> **Sincronia:** como são cópias, podem divergir se o Python mudar. Não há
> mecanismo automático e não deve haver — acoplar os dois em runtime seria pior.
> Se alguém alterar `fee_rate` lá, esta tabela precisa ser revisitada à mão.

### O Sharpe é do front, e só dele

Verificado em 2026-08-15, antes de implementar: **a plataforma não reporta
Sharpe em lugar nenhum.** O `evaluation_service.evaluate()` devolve
`agent_return`, `trades` e `actions` — nada de risco ajustado.

O que existe no Python com esse nome é outra coisa: o "Sharpe adaptativo" de
`environment.py` (`_current_trade_pnl_history`) é **termo de reward shaping do
RL**, calculado sobre a volatilidade *interna de um trade em curso* para punir
operações estressantes. Não é métrica de desempenho e não é comparável.

Consequência: o Sharpe do painel **não tem contraparte para divergir**, então
não entra na tabela de contrato acima. Mas se um dia o backend passar a reportar
o seu, os dois precisam concordar — e este parágrafo existe para que a segunda
implementação encontre a primeira, em vez de inventar a sua.

### D-01 — Buy & hold paga taxa? **Recomendação: não**

O ambiente Python calcula o benchmark **sem custo nenhum**:

```python
buy_hold_return = (prices[-1] - prices[0]) / prices[0]   # evaluation_service.py
```

Meu desenho original cobrava uma entrada e uma saída. **Recomendo trocar para
sem custo**, por dois motivos independentes:

1. **Direção do viés.** Benchmark sem taxa é uma régua mais alta, então a
   estratégia precisa provar mais para parecer boa. Uma ferramenta de simulação
   erra para o lado de não bajular.
2. **Coerência de produto.** As duas ferramentas continuam existindo na mesma
   plataforma. Se um dia alguém comparar os dois relatórios, 0,2% de diferença
   no benchmark vira dúvida sobre qual está certo.

O motivo 1 se sustenta sozinho, mesmo se o backtest do Python for aposentado.

### D-02 — Stop em % fixo ou por ATR? ✅ **os dois, à escolha**

Entregue como modo: **Fixo** (número digitado, igual o período inteiro) ou **Por
volatilidade** (dimensionado pelo ATR do candle da entrada).

A fórmula é a do V10, copiada do backend — `clamp(ATR% × 2, 1%, 10%)`. Os
limites não são detalhe: sem o piso, um período de calmaria produz um stop de
0,1% que qualquer oscilação normal derruba; sem o teto, um candle de pânico
produz um stop de 40% que não protege de nada.

Exigiu `calcularAtrSerie`
([marketStats.js](../src/src/utils/marketStats.js)), porque a `calcularAtr` que
já existia devolve um escalar do último candle — aplicá-lo a todas as entradas
usaria a volatilidade de hoje para uma operação de seis meses atrás.

A diferença entre as duas não é só o formato: a antiga **filtra** as amplitudes
inválidas, o que encurta o array e destrói a correspondência com as posições.
Inofensivo lá, onde só o último valor importa; fatal aqui. Na versão em série a
posição é preservada e a amplitude ausente apenas não atualiza a média — o ATR
anterior segue valendo, em vez de ser puxado para baixo por um zero que ninguém
mediu.

Sem ATR ainda (começo da série), a posição abre **sem stop** e sai pelo tempo ou
pelo alvo. Inventar uma distância ali seria pior.

A tabela de operações mostra a distância que valeu em cada uma — no modo ATR ela
muda a cada entrada, e "Stop" sem o número não diz stop de quanto.

**Verificado por injeção de defeito:** trocar o multiplicador, remover o piso ou
usar o ATR do fim da série em vez do da entrada derruba um teste cada.

### D-03 — De onde vem a série? **A decisão que define o alcance da ferramenta**

Hoje o dashboard carrega no máximo **1000 candles**
([DashboardContext.jsx:15](../src/src/context/DashboardContext.jsx:15)) ≈ 41 dias
na cadência horária, e o preset padrão de 7 dias entrega ~168.

**Esse teto é escolha do front, não limite do backend.** O
`FuncaoObterValorMoeda` faz `.Take(parametro.Quantidade)` sem validação de limite
superior (V14/B-01), e o modo `HISTORICO` estende a borda mais antiga
continuamente — o volume de histórico só cresce.

Com 168 candles a ferramenta é uma demonstração: 5 a 15 trades, holdout sem
sentido (R-02), intervalo de confiança largo demais para concluir qualquer coisa
(R-03). **O que separa demonstração de ferramenta é a janela.**

Duas fontes possíveis:

- **(a) Reusar `historicosPorMoeda`.** Zero requisição nova, zero acoplamento.
  Preso à janela do filtro do dashboard.
- **(b) Busca própria do painel, com janela longa e independente.** Desamarra do
  filtro compartilhado e é o que a ferramenta pede. Custa uma requisição e
  levanta a questão do payload — 8.760 candles (1 ano) × ~25 campos dá ordem de
  4 MB de JSON por moeda.

**✅ IMPLEMENTADO em (b), janela de 180 dias.** A V17 mostrou 866 dias de
histórico disponível, e o teto de 5.000 do B-01 comporta 183 dias com o
aquecimento (4.392 candles) numa requisição só.

- [simulationWindow.js](../src/src/utils/simulationWindow.js) — janela pura e
  testável, com o aquecimento de 3 dias separado do período analisado
- [useSimulationData.js](../src/src/hooks/useSimulationData.js) — busca própria,
  independente dos filtros da tela

**Efeito medido:** de 3 operações para **76**, o aviso de amostra insuficiente
desapareceu, e o corte de validação passou a ter 13 operações — ou seja, passou
a validar algo. O intervalo de confiança do win rate (26–47%) agora exclui 50%.

A janela é **fixa e independente dos filtros do dashboard**, de propósito: o
usuário mexe no período da tela para OLHAR o mercado e nos parâmetros da
simulação para TESTAR uma regra. Amarrar as duas coisas faria o resultado da
estratégia mudar ao ajustar o zoom do gráfico — e resolve o A-02 de quebra, já
que a paginação da tabela não alcança essa série.

<details>
<summary>Registro do desenho anterior (v1 em (a))</summary>

**Recomendação original: v1 em (a), com o motor desenhado para (b).**

`simular()` recebe a série **como argumento**. De onde ela veio não é problema
do motor. Trocar (a) por (b) depois é mudança de origem de dado, não reescrita
de motor — e nenhum teste da seção 9 muda.

Isso mantém a v1 honesta (nada de requisição nova, entrega rápida, engine
provada) sem pintar a plataforma num canto.

> **Não esticar o teto global do dashboard para servir a simulação.**
> `historicosPorMoeda` alimenta também os gráficos, a matriz de correlação e a
> tabela. Subir 1000 → 8000 ali encarece tudo que já funciona, para beneficiar um
> painel só. Se a janela longa entrar, entra como busca própria do painel — (b),
> não (a) inflado.

*(Regra respeitada: `CANDLES_POR_REQUISICAO` continua em 1000.)*

</details>

### A-08 — O gargalo que eu previ não existia 🟢

> **Esta medição venceu.** Ela é anterior ao ranking (11b), que multiplicou o
> trabalho por estratégia testada. Remedido em 2026-08-15 — ver A-09.

Eu tinha anotado que 3 chamadas de `simular` por mudança de parâmetro poderiam
pesar com a janela grande. Medi antes de otimizar, e a previsão estava errada:

| Medição | Resultado |
|---|---|
| Ciclo completo do painel, 2.881 candles | **39 ms** |
| Ciclo completo, 4.326 candles | **55 ms** |
| Long tasks no `PerformanceObserver` | **nenhuma** |

O que parecia lentidão (~950 ms até o DOM mudar) era **throttling de aba em
segundo plano**: com o painel do navegador oculto, `setTimeout` é limitado a ~1 s
e o agendador do React é despriorizado. Um controle barato da mesma página, nas
mesmas condições, levou 330 ms — e nenhuma long task apareceu em nenhum dos
casos, que é a prova de que a thread nunca bloqueou.

Ficou `animation: false` na curva, mas **não como correção de lentidão** — é só
não interpolar 4.300 pontos por série a cada clique, o que não acrescenta
leitura. O comentário no código diz exatamente isso, porque a primeira versão
dele afirmava uma causa que a medição desmentiu.

**Teto disponível: 5.000 candles** (~208 dias), cravado pelo B-01. A janela-alvo
dentro desse teto ainda depende da V17. Meu palpite de trabalho é 3–6 meses
(~2.200–4.400 candles, ~1–2 MB), que já dá centenas de trades e um holdout com
significado, sem pagar o preço de um ano inteiro.

### A-09 — O ranking venceu a medição do A-08 ✅ **corrigido**

Remedido em **2026-08-15**, sobre 4.392 candles sintéticos com 7 famílias de
sinal presentes (a série real tem 14, então os números abaixo são piso, não
teto). O A-08 media um painel que ainda não tinha o ranking de 11b.

**Achado: `montarSerieDeSinais` rodava cinco vezes por troca de parâmetro sobre
exatamente os mesmos candles** — uma pelo seletor de sinais (que montava a série
e descartava, guardando só as chaves), uma pela simulação do topo, duas pelas
pontas do holdout e duas dentro de `compararEstrategias`. A ~15 ms cada, eram
~77 ms de trabalho idêntico por clique.

E o ranking era refeito ao **trocar o sinal de entrada**, que é justamente o que
o rodapé da tabela convida a fazer: `comparativoEstrategias` descartava
`sinalEntrada` do cálculo mas dependia do objeto de opções inteiro, então clicar
num nome da tabela recalculava catorze estratégias para reconstruir a tabela
idêntica.

| Ciclo | Antes | Depois |
|---|---|---|
| Troca de parâmetro de **saída** (hold, stop, alvo, custo) | 150 ms | **63 ms** |
| Troca do **sinal de entrada** | 150 ms | **8 ms** |

O que mudou:

- A série de sinais é montada **uma vez por série de candles** e repassada. Vale
  para a simulação, as duas pontas do holdout e o ranking. Como só depende da
  série, sobrevive a qualquer ajuste de parâmetro.
- O corte de validação também: ele é função da série e da janela, não dos
  parâmetros. O holdout e o ranking passam a usar **o mesmo** corte, em vez de
  cada um recortar o seu.
- `compararEstrategias` ganhou `serieDeSinais` e `serieDeSinaisAjuste`, com a
  mesma régua de tamanho que `simular` já usava.
- O ranking passou a depender só dos parâmetros de **saída**.

**Verificado por injeção:** remover a conferência de tamanho de `serieDeSinais`
derruba o teste novo — e por um motivo que não era o esperado. É dessa série que
sai o conjunto de sinais **presentes**, ou seja, quais estratégias entram na
tabela; uma série alheia não produz números errados, produz a **lista** errada.

A conferência equivalente do trecho de ajuste **não** derruba teste nenhum, e
está anotada como tal no código: `simular` já recusa série que não descreva seus
registros, então ali a guarda é de custo (uma remontagem em vez de catorze), não
de correção. Guarda que não se prova fica declarada como o que é.

---

## 4. Riscos confirmados

### R-01 — Buracos na série 🔴 **o risco que mais importa**

O motor conta **candles**, não relógio. `saidaPorTempo = 5` significa "5 linhas
do array". Se faltarem 6 horas de coleta, essas 5 linhas viram 11 horas reais —
e o resultado sai errado **sem nenhum aviso**.

Buracos não são hipótese: são um problema conhecido e ativamente gerenciado pelo
backend. De `Back-DotNet/docs/README.md`:

> Hora que existiu no calendário mas nunca virou `Coleta` (cron que não disparou,
> máquina desligada) não é recuperada por nenhum dos outros modos. O buraco seria
> permanente.

Existe um modo `LACUNAS` que varre e preenche, mas com limites que deixam buraco
residual possível:

- janela de **30 dias** (`Lacunas:JanelaDias`) — buraco mais antigo que isso
  nunca é preenchido por esse modo
- **10 horas por moeda por rodada** (`Lacunas:MaxPorRodada`)
- trava em **24 pendências** (`Lacunas:LimitePendentes`)
- sub-coleta que esgota tentativas vira `NAO_APLICAVEL` — terminal, sem retry.
  Se foi a sub-coleta `MOEDAS`, **aquela hora não tem candle nenhum**.

**Consequência para o desenho:** o motor não pode assumir continuidade. Ele passa
a comparar `horaReferencia` entre posições consecutivas e:

1. registrar `descontinuidades` na saída;
2. **não abrir trade** cujo horizonte atravesse um buraco maior que a tolerância;
3. o painel informa quantos candles faltaram na janela.

Isso deixa de ser refinamento e vira requisito de correção. Está na sequência
como passo 3b, e o `backtest.test.js` trava o caso.

### R-02 — Overfitting de parâmetro 🟠

O usuário vai testar 15 combinações de sinal/horizonte/stop na mesma janela e
escolher a melhor. Isso é sobreajuste de manual, e a ferramenta estaria
ajudando-o a se enganar: das 15, a melhor parece boa **porque** foi escolhida
depois de ver o resultado.

**Consequência:** o painel ganha um corte de holdout. Os 20% mais recentes da
janela ficam reservados, o usuário ajusta parâmetro nos 80% e a métrica de
validação sai da parte que ele não viu. Fica como **passo 5b**.

A fração de 20% não é arbitrária: é a mesma que a avaliação out-of-sample do
agente já usa (`holdout_fraction = 0.2`), então as duas telas falam a mesma
língua sobre o que é "fora da amostra". Mas a razão para existir é própria — sem
o corte, esta tela é um gerador de otimismo, independentemente do que o outro
produto faça.

**Depende de janela.** Reservar 20% de 168 candles deixa 34 candles de validação,
o que não valida nada. O holdout só passa a significar alguma coisa com a janela
esticada — ver D-03.

> Confirmado na prática assim que a tela ficou de pé: na janela padrão de 7 dias,
> o trecho de validação fica com **zero operações** para a maioria dos sinais. A
> mecânica está correta e o aviso aparece, mas a coluna só vai dizer alguma coisa
> depois do D-03. É a demonstração mais direta de por que a janela é a decisão de
> maior alcance deste documento.

**A fração é medida sobre a janela, não sobre o array.** Erro cometido e
corrigido durante a implementação: os candles de aquecimento não são período de
análise, e contá-los faria a validação reservar 28% do que o usuário escolheu em
vez de 20%. `dividirParaValidacao` recebe `aPartirDe` justamente para isso.

### R-03 — Amostra pequena 🟠

Na janela padrão (7 dias, ~168 candles) uma entrada seletiva produz talvez 5–15
trades. Nada se conclui disso.

Tratamento **permanente**, independente da janela: intervalo de Wilson exibido, e
abaixo de 20 trades as métricas saem marcadas como não conclusivas. Precedente em
[SignalLabPanel.jsx:119](../src/src/components/dashboard/SignalLabPanel.jsx:119).

Tratamento **estrutural**: esticar a janela — ver D-03. A guarda acima continua
valendo depois disso; ela protege contra sinal raro em janela longa, que é um
caso que não desaparece com mais dado.

### R-04 — Janela de aquecimento dentro da série 🟡

`historicosPorMoeda` **inclui** os 3 dias de aquecimento
([useDashboardData.js:9](../src/src/hooks/useDashboardData.js:9)); o hook não os
remove, cada consumidor refiltra por data.

O motor monta os sinais sobre a série inteira (RSI de 14 e Bollinger de 20
precisam do aquecimento) mas **só abre trade a partir de `aPartirDe`**. Sem isso,
opera em candles que o usuário não selecionou.

---

## 4b. Auditoria pré-implementação

Passagem crítica sobre as afirmações do próprio documento, feita em 2026-08-14
**antes** de escrever qualquer código. Duas alteram a sequência.

### A-01 — `signalLab.test.js` **não** é rede suficiente para o refactor 🔴

O documento afirmava que a extração de `montarSerieDeSinais` estava coberta pelo
teste existente. **Está errado.**

O `signalLab.test.js` exercita apenas dois sinais: `CandlePattern.MARTELO` e
`SignalKey.VOLUME_ATIPICO`. Ficam **sem nenhuma cobertura**:

- `divergenciaBaixista` / `divergenciaAltista` (`detectarDivergencias`)
- `vwapCruzamentoAlta` / `vwapCruzamentoBaixa` (`resumirVwap().cruzamentos`)
- os quatro de `OscillatorSignal` (`resumirOsciladores().marcas`)
- `ticketAlto`, `variacaoAtipica`

São exatamente as famílias que chegam como **array indexado por posição
cronológica** — as únicas em que a extração pode errar o alinhamento. Um
deslocamento de uma posição em qualquer uma delas **passa na suíte atual**.

O martelo e o volume atípico não correm esse risco: são calculados registro a
registro dentro do laço, sem array paralelo.

**Consequência:** entra um **passo 0** — testes de caracterização das famílias
descobertas, escritos contra o comportamento atual, **antes** de mover qualquer
linha. Sem isso o refactor é uma troca de código sem rede.

### A-02 — A paginação da tabela troca a série ✅ **corrigido**

> **Resolvido em 2026-08-15.** A série de análise deixou de ser paginada:
> `useDashboardData` fixa a primeira página, e a tabela passou a ter busca
> própria em [useHistoryPage.js](../src/src/hooks/useHistoryPage.js). São dois
> trabalhos diferentes — **analisar** quer a janela estável, **navegar** quer uma
> página de cada vez — e estavam numa requisição só.
>
> A separação é a mesma que a simulação já fazia desde o D-03. A diferença é que
> lá ela nasceu de uma necessidade de tamanho de janela, e aqui de correção.
>
> **Medido na tela**, janela customizada de 117 dias (2.881 candles, 3 páginas):
>
> | Ao clicar na página 2 | Antes | Depois |
> |---|---|---|
> | Painéis de análise que mudaram | **5** | **0** |
> | Retorno acumulado do período | −2,28% → **−12,71%** | −2,28%, cravado |
> | Drawdown máximo | −39,84% → −42,12% | −39,84%, cravado |
>
> Os cinco eram: os dois gráficos, Desempenho do Período, Fluxo de Ordens e o
> Laboratório de Sinais. Navegar numa tabela reescrevia o retorno do período em
> mais de dez pontos percentuais.
>
> **Verificado por injeção:** devolver `pagina` às dependências de
> `useDashboardData` reproduz os cinco painéis mudando. Como o ambiente de teste
> é `node` e não alcança hooks, esta é a prova que existe — e por isso ela está
> registrada aqui com os números, não só afirmada.
>
> Três coisas que a correção arrumou de passagem:
>
> - `cobertura` — o aviso de "o período foi cortado" — era recalculado sobre a
>   página nova. Ele descreve a janela, não a página.
> - A tabela recebia `pagina`/`setPagina` como prop **e** os ignorava, lendo do
>   contexto global. Quem lesse a chamada no Dashboard via uma ligação que não
>   existia. Agora existe uma só, e é a que aparece na chamada.
> - Recebia também `historicoMoeda`, que nunca usou.
>
> O diagnóstico abaixo permanece como registro.

`historicosPorMoeda[sigla]` recebe a resposta **paginada**, e `pagina` é
dependência do efeito em [useDashboardData.js:234](../src/src/hooks/useDashboardData.js:234).
A `HistoryTable` chama o `setPagina` **global** do contexto
([HistoryTable.jsx:214](../src/src/components/dashboard/HistoryTable.jsx:214)).

Ou seja: clicar na página 2 do histórico refaz a busca e substitui a série que
alimenta gráficos, laboratório de sinais **e a simulação**.

E o controle só aparece sob `totalPaginas > 1 && moedasFiltro.length === 1`
([HistoryTable.jsx:209](../src/src/components/dashboard/HistoryTable.jsx:209)) —
**exatamente o modo em que a simulação roda.**

Hoje é inerte: com `quantidade = 1000` e os presets de 24h/7d/1m, tudo cabe em
uma página e o controle nem renderiza. **O D-03 ativa a armadilha**: janela de 3
meses são ~2.200 candles = 3 páginas, e aí a simulação passa a mudar de resultado
conforme o usuário navega numa tabela ao lado, sem nenhuma relação aparente.

**Consequência:** reforça a recomendação do D-03 — quando a janela longa entrar,
entra como **busca própria do painel**, não como teto global inflado. Uma série
que a paginação de outro componente pode trocar não serve de base para simulação.

Vale como observação separada que gráficos e laboratório **já** têm esse
acoplamento hoje, em janela customizada longa. Não é criado por esta entrega.

### A-03 — Fuso: o mock e a produção discordam ✅ **corrigido**

> Confirmado contra a API real em 2026-08-14:
> `"horaReferencia":"2026-08-14T11:00:00"` — sem `Z`, como deduzido.
>
> **Corrigido em dois lugares**, cada um certo por si:
>
> 1. **`normalizeApiKeys`** ([apiClient.js](../src/src/utils/apiClient.js))
>    passa a marcar como UTC todo carimbo ISO que chegue sem fuso. Corrigir na
>    fronteira, e não em cada `new Date(...)`, porque são **mais de trinta**
>    pontos de leitura espalhados — e o próximo a ser escrito voltaria a errar.
> 2. **A guarda morta** ([dateUtils.js](../src/src/utils/dateUtils.js)) virou
>    `/(Z|[+-]\d{2}:?\d{2})$/` — marca de fuso **no fim**, não em qualquer
>    lugar.
>
> **Efeito visível:** um candle de UTC 11:00 era exibido como "11:00" e agora
> aparece como "08:00" em São Paulo. O produto mostrava horário UTC com rótulo
> de horário local; o desvio passava despercebido porque rótulo e filtro erravam
> **juntos**, então a tela parecia coerente consigo mesma. Aparecia só na borda:
> escolher "1 de abril" trazia candles a partir das 21h de 31 de março.
>
> Corrige de quebra um erro no próprio D-03: a janela da simulação é construída
> a partir de `new Date()` (UTC de verdade) e era comparada com candles lidos
> como locais — a borda dos 180 dias estava deslocada em 3 horas.
>
> Os testes cravam a **equivalência** entre as duas formas do carimbo, não um
> horário literal: um literal dependeria do fuso da máquina, passando em CI e
> falhando na mesa de alguém. Verificado por injeção: remover a normalização de
> fronteira derruba 3 testes; devolver a guarda antiga derruba outros 3.

<details>
<summary>Diagnóstico original</summary>

Três achados que se compõem:

1. `dateUtils.toLocal` tenta anexar `Z` quando a string não tem fuso, mas a
   guarda é `utcString.includes('-')`
   ([dateUtils.js:16](../src/src/utils/dateUtils.js:16)) — **sempre verdadeira**
   para qualquer data ISO, por causa dos hífens de `2026-04-01`. O ramo que
   anexa o `Z` **nunca executa**.
2. A API não configura serialização de `DateTime` (não há `JsonSerializerOptions`
   nem `AddJsonOptions` em `Program.cs`/`Startup.cs`). EF Core lendo `datetime2`
   devolve `DateTimeKind.Unspecified`, que o System.Text.Json serializa **sem
   `Z`** → o JS interpreta como **hora local**.
3. O mock gera `horaReferencia: dataPonto.toISOString()`
   ([mockApi.js](../src/src/utils/mockApi.js)) — **com `Z`** → interpretado como
   **UTC**.

Na prática há uma compensação acidental em produção: o filtro monta a data a
partir da meia-noite local e os candles também são lidos como locais, então a
comparação fica autoconsistente. **Mas mock e produção divergem pelo offset do
usuário** (3h no Brasil).

**Consequência para esta entrega:** `aPartirDe` (R-04) e o cálculo de
`horasFaltando` (R-01) dependem de comparação de instantes. Validar o painel em
modo mock **não prova o comportamento em produção**. O motor precisa de **um
ponto único de normalização de instante**, e o teste do passo 3c tem de cobrir as
duas formas de string.

A guarda morta do `toLocal` **não** é corrigida nesta entrega — é bug
pré-existente de exibição, com alcance maior que a simulação (afeta rótulos de
gráfico e tabela). Fica anotado na seção 12.

</details>

### A-04 — `HoraReferencia` é a **abertura** do candle 🟡

`FuncaoPreencherTbMoedaBinance` grava `HoraReferencia = p.dataHoraAberturaUtc`.
O candle carimbado 10:00 cobre 10:00–11:00.

Isso **valida** o desenho: entrar na `precoAbertura` do candle `i+1` é entrar no
instante imediatamente após o fechamento do candle `i` que gerou o sinal — sem
buraco e sem sobreposição. Se alguém assumir que o carimbo é o fechamento, a
linha do tempo inteira anda um candle.

Confirmado também que `PrecoAbertura` vem direto da Binance
(`PrecoAbertura = p.precoAbertura`), não é derivado.

### A-05 — Painéis mediam a margem de aquecimento ✅ **corrigido**

> `analisarSinais` ganhou `aPartirDe`, e as leituras de **período** de
> `marketAnalytics` passaram por `recortarJanela`. Os sinais e os indicadores
> continuam sendo calculados sobre a série inteira — é ali que o aquecimento
> serve —, mas a base, as ocorrências e o desempenho contam só a janela
> escolhida.
>
> **O escopo cresceu durante a correção, e por um bom motivo.** Consertar só o
> laboratório deixou na tela `167` candles ao lado de um card anunciando `240`:
> dois painéis vizinhos se contradizendo, o que é pior que os dois errarem
> junto. `calcularDesempenho` e `compararMoedas` foram junto.
>
> A separação que ficou explícita no código: `derivarAnalytics` produz leituras
> de **estado** (fluxo, volatilidade, ticket, ATR, VWAP, osciladores), que
> precisam do aquecimento, e **uma** leitura de período (`desempenho`), que não.
> Só essa última é recortada.
>
> **Efeito visível na janela de 7 dias:** o laboratório passou de 239 para 167
> ocorrências na base, o card de 240 para 168 candles, e o retorno do período de
> `+9,29%` para `−6,50%` — o valor anterior incluía a alta que aconteceu durante
> os três dias de aquecimento.
>
> `recortarJanela` degrada para a série inteira quando o recorte não deixa nada:
> carimbo em formato inesperado quase nunca significa janela vazia, e apagar o
> painel seria pior que voltar ao comportamento anterior.

<details>
<summary>Diagnóstico original — o laboratório de sinais não filtra pelo período</summary>

`analisarSinais` roda sobre a série inteira recebida, **incluindo os 3 dias de
aquecimento**. A simulação, com `aPartirDe`, vai excluí-los (R-04).

Os dois painéis vão declarar contagens de amostra diferentes para a mesma janela
— o laboratório contando ~240 candles onde a simulação conta ~168. Não é defeito
do novo painel; é divergência de critério que precisa estar documentada antes que
alguém a reporte como bug.

Corrigir o laboratório está fora desta entrega: mudaria números já exibidos hoje,
o que é decisão própria.

</details>

### A-06 — `saidaPorTempo` e `horizonte` **não** são a mesma coisa 🟡

Decidido durante a implementação, e é fonte garantida de confusão se ficar
implícito:

- O laboratório usa **horizonte**: retorno de fechamento a fechamento, `h`
  candles à frente.
- A simulação usa **candles segurados**: entra na abertura e, segurando 1
  candle, sai no fechamento **do mesmo candle**.

Segurar 1 na simulação cobre um candle; horizonte 1 no laboratório atravessa
dois fechamentos. Os dois painéis **não vão bater** para o mesmo número — e não
deveriam, porque medem coisas diferentes.

---

## 5. Desenho do motor — `utils/backtest.js`

```js
import { montarSerieDeSinais } from './signalLab'
import { intervaloWilson } from './mathUtils'
import { ExitReason, TradeDirection } from './enums'

export const simular = (registros, {
  sinalEntrada,              // chave do vocabulário (seção 6)
  direcao = TradeDirection.COMPRA,
  saidaPorTempo = 5,         // em candles; null desliga
  stopPercentual = null,
  alvoPercentual = null,
  custoPercentual = 0.1,     // por perna — V5
  capitalInicial = 1000,     // V8
  aPartirDe = null,          // ISO; antes disso só aquece indicador — R-04
  toleranciaBuracoMs = null, // null = cadência × 1,5 — R-01
} = {}) => { ... }
```

### Regras

**Entrada.** Sinal no índice cronológico `i` usa dados até o fechamento de `i`.
A entrada executa em `serie[i+1].precoAbertura`. Sem `i+1`, não há trade. É a
mesma causalidade que o `exposure_prev` do backend garante (V9): a decisão não
colhe o retorno de uma barra em que ainda não estava posicionada.

**Saída.** Enquanto a posição está aberta, cada candle é testado nesta ordem:

1. **Stop** — `precoMenor <= precoStop` → sai **no preço do stop**, não na mínima
2. **Alvo** — `precoMaior >= precoAlvo` → sai no preço do alvo
3. **Tempo** — passados N candles → sai no `precoFechamento`
4. **Fim da série** — `ExitReason.FIM_DA_SERIE`; entra na curva, **fora** do win rate

**Stop ganha do alvo no mesmo candle.** O OHLC não registra ordem intrabar.
Assumir o alvo primeiro é a escolha que faz qualquer estratégia parecer boa.
Constante comentada, não detalhe implícito.

**Custo.** `entradaEfetiva = entrada × (1 + custo/100)`,
`saidaEfetiva = saida × (1 − custo/100)`. Nas duas pernas (V7).

**Direção.** Toda a matemática em termos de `direcao × (saida − entrada) / entrada`.
Libera os sinais de baixa (`divergenciaBaixista`, `rsiSobrecompra`, `estrela`),
que testados só comprado não significam nada.

**Uma posição por vez.** Sinal com posição aberta é ignorado.
`permitirSobreposicao: false` explícito.

**Linha inválida.** `precoFechamento <= 0` ou `precoVolume <= 0` → candle
ignorado e tratado como descontinuidade (V11).

### Saída

```js
{
  parametros: { ... },
  trades: [{
    indiceEntrada, instanteEntrada, precoEntrada,
    indiceSaida, instanteSaida, precoSaida,
    motivoSaida, retornoBruto, retornoLiquido, custoPago,
    capitalDepois, barrasSeguradas,
  }],
  curva: [{ instante, capital, emPosicao }],   // UM PONTO POR CANDLE
  metricas: { ... },
  descontinuidades: [{ de, ate, horasFaltando }],   // R-01
  aviso: { amostraInsuficiente, serieTruncada, temBuracos },
}
```

`curva` com um ponto por candle (não por trade) é o que permite o gráfico
compartilhar o eixo X com o de preço e o que torna o drawdown mensurável entre
trades.

### Métricas

`calcularDesempenho` ([marketStats.js:35](../src/src/utils/marketStats.js:35))
**não é reaproveitável**: lê `precoFechamento` de registros de candle, ou seja,
mede drawdown **do preço**, não do capital. Só o laço de pico
([marketStats.js:53-59](../src/src/utils/marketStats.js:53)) se transpõe.

| Métrica | Como |
|---|---|
| `retornoTotal` | capital final / inicial − 1 |
| `drawdownMaximo` | laço de pico sobre `curva`, em capital |
| `winRate` + `intervalo` | **reusa `intervaloWilson`** ([mathUtils.js:151](../src/src/utils/mathUtils.js:151)) |
| `profitFactor` | Σ ganhos / \|Σ perdas\| |
| `retornoMedio`, `melhorTrade`, `piorTrade` | dos trades fechados |
| `exposicao` | % de candles com `emPosicao` |
| `custoTotal` | soma de `custoPago` |
| `buyAndHold` | `(ultimo − primeiro) / primeiro`, **sem custo** — D-01 |
| `alfa` | `retornoTotal − buyAndHold`. Mesmo nome que o backend usa |

`custoTotal` é número de primeira linha no painel: transforma *"rendeu 3%"* em
*"rendeu 3% e pagou 4% de taxa"*.

---

## 6. Vocabulário de entrada

Sai de graça da série de sinais — 15 chaves, todas já traduzidas nos 5 idiomas
(`signal_*` em [pt.json:174-207](../src/src/lang/pt.json:174)):

| Origem | Chaves |
|---|---|
| `CandlePattern` | `martelo`, `estrela`, `doji`, `marubozu` |
| `SignalKey` | `volumeAtipico`, `variacaoAtipica`, `ticketAlto` |
| `DivergenceKind` | `divergenciaBaixista`, `divergenciaAltista` |
| `VwapSignal` | `vwapCruzamentoAlta`, `vwapCruzamentoBaixa` |
| `OscillatorSignal` | `rsiSobrecompra`, `rsiSobrevenda`, `rompeuBandaSuperior`, `rompeuBandaInferior` |

Nenhum indicador novo, nenhuma chave de tradução nova para sinais.

### Por que sai de `signalLab.js`, e não de arquivo próprio

O laço que monta esse vocabulário existe hoje inline em
[signalLab.js:76-106](../src/src/utils/signalLab.js:76). O simulador precisa do
**mesmo vocabulário no mesmo alinhamento**; duplicar faria os dois divergirem no
primeiro sinal novo.

A extração vira um export do próprio `signalLab.js` — `montarSerieDeSinais` — em
vez de arquivo separado. É função **pura e síncrona** sobre o array já em
memória: sem requisição, sem conexão, sem estado. Mesma garantia que o
[marketAnalytics.js:1-3](../src/src/utils/marketAnalytics.js:1) documenta.

> Nota de nomenclatura: a proposta original chamava isso de "fita de sinais"
> (`signalTape.js`). O nome foi descartado — *tape* remete a ticker tape, leitura
> de fluxo em tempo real, e o SignalR foi removido do front justamente por peso e
> sensibilidade a oscilação de infra. Nome que sugere streaming num módulo que é
> aritmética pura custa uma dúvida a cada leitura futura.

---

## 7. Levantamento no banco — V15/V16/V17 ✅

Executado em **2026-08-14**, somente leitura, contra o banco do cluster
(`thinkbitcoin-mssql`, base `thinkbitcoin`).

### V17 — quanto histórico existe

| Moeda | Candles | Mais antigo | Dias | Densidade |
|---|---|---|---|---|
| BTC | 20.956 | 2024-03-10 | 887 | 0,984 |
| SOL | 20.797 | 2024-03-18 | 879 | 0,986 |
| BNB | 20.483 | 2024-03-31 | 866 | 0,986 |
| DOGE | 20.481 | 2024-03-31 | 866 | 0,986 |
| LTC | 20.458 | 2024-03-31 | 866 | 0,985 |
| LINK | 20.455 | 2024-03-31 | 866 | 0,985 |
| PAXG | 20.453 | 2024-03-31 | 866 | 0,985 |
| ADA | 20.452 | 2024-03-31 | 866 | 0,984 |
| XRP | 20.451 | 2024-03-31 | 866 | 0,985 |
| ETH | 20.450 | 2024-03-31 | 866 | 0,984 |

**Muito mais dado do que o desenho supunha.** A ferramenta rodava sobre 168
candles; existem 20.500. A densidade de ~0,985 confirma que ~1,5% das horas
faltam — o buraco não é hipótese.

### V15 — como os buracos se distribuem (BTC, histórico completo)

| Faixa | Ocorrências | Horas perdidas | Maior |
|---|---|---|---|
| até 2h | 11 | 22 | 2 |
| 3–5h | 5 | 23 | 5 |
| 6–12h | 10 | 76 | 11 |
| 13–24h | 1 | 19 | 19 |
| acima de 24h | 3 | 226 | **103** |

30 buracos, 366 horas perdidas. Os três maiores concentram 62% da perda e são
antigos (mai/jul/ago de 2025). O maior é de **103 horas** — mais de quatro dias.

Nos **últimos 180 dias**: 24 buracos, 130 horas perdidas, maior de 19h.

Ou seja, mesmo numa janela recente há cerca de um buraco a cada oito dias. A
guarda de descontinuidade (R-01) não é precaução teórica: ela vai atuar.

### V16 — duplicatas

**Zero** nas 10 moedas. A curva de capital não corre risco de contar o mesmo
movimento duas vezes. `HoraReferencia` não tem índice único, mas a inserção
idempotente por `IdColeta` sustenta a unicidade na prática.

### Queries usadas

```sql
-- Buracos na cadência horária, últimos 30 dias (trocar a tabela por moeda)
WITH ordenado AS (
    SELECT HoraReferencia,
           LAG(HoraReferencia) OVER (ORDER BY HoraReferencia) AS anterior
    FROM TbMoedaBTCUSDTBinance
    WHERE HoraReferencia >= DATEADD(DAY, -30, GETUTCDATE())
)
SELECT anterior            AS buraco_inicio,
       HoraReferencia      AS buraco_fim,
       DATEDIFF(MINUTE, anterior, HoraReferencia) / 60.0 AS horas_faltando
FROM ordenado
WHERE anterior IS NOT NULL
  AND DATEDIFF(MINUTE, anterior, HoraReferencia) > 90   -- 1h + tolerância
ORDER BY horas_faltando DESC;
```

```sql
-- V16: HoraReferencia duplicada
SELECT HoraReferencia, COUNT(*) AS n
FROM TbMoedaBTCUSDTBinance
GROUP BY HoraReferencia
HAVING COUNT(*) > 1;
```

```sql
-- V17: quanto histórico existe, por moeda (rodar trocando a tabela)
SELECT 'BTC'                AS moeda,
       COUNT(*)             AS candles,
       MIN(HoraReferencia)  AS mais_antigo,
       MAX(HoraReferencia)  AS mais_recente,
       DATEDIFF(DAY, MIN(HoraReferencia), MAX(HoraReferencia)) AS dias_cobertos,
       -- Densidade: 1.0 = uma linha por hora, sem buraco nenhum
       CAST(COUNT(*) AS FLOAT)
         / NULLIF(DATEDIFF(HOUR, MIN(HoraReferencia), MAX(HoraReferencia)), 0) AS densidade
FROM TbMoedaBTCUSDTBinance;
```

### O que o resultado decidiu

- **Janela-alvo do D-03: 180 dias** (~4.320 candles). Cabe numa requisição sob o
  teto de 5.000 do B-01, com margem — e é 25× a janela padrão de hoje.
- **Tolerância de buraco:** a cadência mediana × 1,5 (1h30) continua adequada. Os
  buracos reais são de 2h para cima, então nenhum passa despercebido e nenhum
  candle normal é marcado por engano.
- **Duplicata não é risco** — nenhuma guarda adicional necessária.

---

## 8. Sequência de ajustes — front

| # | Onde | O quê | Depende de |
|---|---|---|---|
| **0** ✅ | [test/signalLab.test.js](../src/test/signalLab.test.js) | **Testes de caracterização** das famílias descobertas por A-01: divergência, VWAP, osciladores, ticket, variação atípica. Escritos contra o comportamento **atual**, antes de mover código. 13 → 22 testes | — |
| 1 ✅ | [signalLab.js](../src/src/utils/signalLab.js) | `montarSerieDeSinais` extraído e exportado; `analisarSinais` consome. **Zero mudança de comportamento** — a suíte do passo 0 passou sem uma edição | 0 |
| 2 ✅ | [enums.js](../src/src/utils/enums.js) | `ExitReason`, `TradeDirection` | — |
| 3 ✅ | [utils/backtest.js](../src/src/utils/backtest.js) | Motor: entrada, saídas, custo, direção, métricas | 1, 2 |
| 3b ✅ | [utils/backtest.js](../src/src/utils/backtest.js) | **Guarda de descontinuidade** (R-01) | 3 |
| 3c ✅ | [test/backtest.test.js](../src/test/backtest.test.js) | 25 testes; invariantes da seção 9 confirmadas por injeção de defeito | 3, 3b |
| 4 ✅ | [Dashboard.jsx](../src/src/pages/Dashboard.jsx) | `useMemo` do `simular(...)` ao lado do `analiseSinais`, + estado dos parâmetros | 3c |
| 5 ✅ | [SimulationPanel.jsx](../src/src/components/dashboard/SimulationPanel.jsx) | Controles, métricas, tabela de operações. Após `SignalLabPanel`, guardado por `moedasFiltro.length === 1` | 4 |
| 5b ✅ | [backtest.js](../src/src/utils/backtest.js) + painel | **Corte de holdout** (R-02): `dividirParaValidacao` + tabela ajuste × validação | 5 |
| 6 ✅ | [equityChart.js](../src/src/utils/equityChart.js) + [test](../src/test/equityChart.test.js) | Curva de capital. A montagem dos pontos saiu para util testável; só a configuração do Chart.js ficou no painel. **Não** foi para o `useDashboardCharts` — os parâmetros vivem no painel, e o hook global passaria a depender deles | 5 |
| 7 ✅ | [App.css](../src/src/App.css) | `.simulation-*` no molde de `.signal-lab-*` | 5 |
| 8 ✅ | `lang/{pt,en,es,fr,it}.json` | 41 chaves do painel + 7 de `ajuda`. [lang.test.js](../src/test/lang.test.js) confere paridade e marcadores `{{}}` | 5 |
| 9 ✅ | [Dashboard.jsx](../src/src/pages/Dashboard.jsx) | Passo no `passosTour`, entre gráficos e histórico | 5 |
| **10 ✅** | [simulationWindow.js](../src/src/utils/simulationWindow.js) + [useSimulationData.js](../src/src/hooks/useSimulationData.js) | **D-03**: janela própria de 180 dias, independente dos filtros. 6 testes | V17 |
| **11 ✅** | [Simulacao.jsx](../src/src/pages/Simulacao.jsx) | **D-05**: a simulação sai do dashboard para a rota `/simulacao`. No dashboard fica um atalho, no lugar do painel | 10 |

### Como a tela foi verificada

O ambiente de teste é `node`, não `jsdom` — componente React não é testável sem
trocar a configuração do vitest, que é decisão à parte. A resposta foi **tirar do
componente tudo que dá para testar**: `montarPontosDaCurva` e `folgaDoEixo`
vivem em `equityChart.js` com teste próprio, e `dividirParaValidacao` no motor.
No painel sobrou marcação e configuração de gráfico.

O que só existe na tela foi conferido rodando o dashboard em modo mock:

| Verificação | Resultado |
|---|---|
| Painel monta e lista só os sinais presentes na janela | 14 sinais no seletor, vindos do laboratório |
| Troca de direção inverte o resultado | Mesmo candle: +0,24% comprado, −0,64% vendido |
| Custo sempre contra o operador | Bruto +0,44% nos dois lados; 0,2% de diferença em cada |
| `profitFactor` sem perdas | Exibe "—", não "∞" |
| Curva não estoura o contêiner | canvas 840 = contêiner 840 (desktop), 333 = 333 (mobile) |
| Sem rolagem horizontal da página | `scrollWidth === clientWidth` nos dois tamanhos |
| Tour percorre os painéis na ordem da tela | 6 passos: Patrimônio → Carrossel → Filtros → Gráficos → **Simulação** → Histórico |
| Passo da simulação some fora do modo de moeda única | Com 2 moedas, painel e alvo do tour desaparecem juntos |

> **Renumeração do tour.** As chaves são posicionais (`passo1`…`passoN`) e a
> simulação entra entre gráficos e histórico. Manter a convenção exigiu o
> histórico descer de `passo5` para `passo6`; deixar a simulação como `passo6`
> fora de ordem faria a chave mentir sobre onde o passo aparece, que é o único
> trabalho que essa numeração faz.
>
> O passo é incluído por **estado** (`moedasFiltro.length === 1`), não por
> `document.querySelector`: no primeiro render nada está montado, e uma consulta
> ao DOM ali filtraria o tour inteiro.

### A-10 — O contador de candles media a margem de aquecimento ✅ **corrigido**

Encontrado na revisão de 2026-08-15. A linha `simulationWindow` exibia o tamanho
da **série recebida**, que vem com os 3 dias de aquecimento: anunciava
*"Analisando 180 dias — 4.392 candles"*, e 4.392 são 183 dias.

É a mesma classe do A-05 e do commit `e401150`, corrigida no laboratório de
sinais e nos cards de período, que sobreviveu aqui. O número honesto já existia:
`metricas.candlesSimulados`, que é o tamanho da curva e portanto começa em
`aPartirDe` — e de quebra desconta os candles inutilizáveis, que também não
foram simulados.

A `prop` `candlesAnalisados` saiu do painel junto: o dado já chegava dentro de
`resultado`, e mantê-la seria oferecer duas respostas para a mesma pergunta.

### A-11 — A régua sumia justamente do elemento mais olhado ✅ **corrigido**

O cabeçalho deste painel declara o princípio: *"O buy & hold fica LADO A LADO
com o retorno, não escondido num rodapé. Um retorno de 12% não significa nada
sem saber que segurar rendeu 15%."* Os cards cumpriam. **A curva de capital
não** — ela desenhava só a estratégia e a exposição.

O gráfico é o elemento maior e o mais olhado dos dois, então desenhar só a
estratégia ali desfazia no desenho o que os números faziam questão de dizer. E
o par de percentuais não responde à pergunta que as duas linhas lado a lado
respondem: **perdeu para o buy & hold o caminho todo, ou ganhou até o fim e
devolveu no último mês?**

A régua entra em unidades de **capital**, não em percentual — é o que permite as
duas dividirem o eixo — e parte do mesmo primeiro fechamento que o card usa. Se
as duas leituras divergissem, a tela estaria discutindo consigo mesma sobre o
mesmo número; um teste crava a igualdade.

Detalhes que a verificação na tela mudou, e não os testes:

- **A cor.** `--text-faint` (0,4 de opacidade) desenhava uma linha que existia
  nos pixels e não dava para seguir com o olho. Subiu para `--text-muted`.
  Cinza, e não colorida, para não disputar com o ouro da curva nem com o verde
  da exposição.
- **A legenda passou a existir.** Com três linhas no mesmo eixo, sem ela o
  leitor adivinha qual é qual — e adivinhar errado aqui inverte a conclusão. O
  tooltip ganhou o nome da série pelo mesmo motivo.
- **A altura do contêiner subiu de 220 para 250px**, porque a legenda come uma
  faixa embaixo e o que ela ganhava em clareza a curva perdia em altura.

**Verificado por injeção:** fazer o motor parar de emitir `precoFechamento` na
curva derruba 2 testes; medir a régua a partir de outro candle derruba 4. O
teste que liga motor e desenho é o que importa — os de `equityChart` rodam sobre
pontos sintéticos e continuariam passando com o motor mudo.

### A-12 — A tabela de operações não dizia *quando* ✅ **corrigido**

Entrada, saída, candles, motivo, resultado — e nenhuma data. `instanteEntrada` e
`instanteSaida` já viajavam em todo trade desde o passo 3 e nunca eram
renderizados.

Em 180 dias e 76 operações, isso torna duas leituras impossíveis: saber se os
ganhos estão concentrados num mês só, e achar na tabela a linha correspondente a
um trecho da curva de capital.

O instante entra como segunda linha **sob o preço**, não como coluna nova: ele
pertence ao preço que acompanha, e separá-los faria o olho percorrer a tabela
inteira para juntar de novo o que é um dado só.

### A-13 — O ranking não declarava sob qual saída foi montado ✅ **corrigido**

O texto dizia "com a MESMA saída e o MESMO custo" sem dizer **qual**. A ordem
das linhas é inteiramente condicional a direção, horizonte, stop, alvo e custo —
trocar qualquer um reordena a tabela —, e sem declará-los o ranking se lia como
veredito sobre os sinais em vez de sobre a combinação que está na tela.

A linha é montada a partir dos rótulos que os próprios controles já usam:
**nenhuma chave de tradução nova**, e nenhuma chance de ela discordar dos botões
logo acima. Os rótulos trazem o `%` embutido ("Alvo %"), o que serve num campo
de formulário e atrapalha numa frase — a unidade sai do rótulo e volta junto do
número.

### A-14 — A coluna que faltava era o AJUSTE, não a validação ✅ **corrigido**

`alfaAjuste` era calculado para as catorze estratégias e **nunca exibido** —
única ocorrência do campo em todo o `src/`. Custava um terço das passadas do
ranking para não ir a lugar nenhum.

A saída óbvia era apagá-lo. Foi o contrário, e por um motivo que só apareceu ao
olhar o que a tabela comparava: **a coluna de alfa é da janela cheia, que CONTÉM
o trecho de validação.** Comparar as duas é comparar um número com um pedaço
dele mesmo. Ajuste e validação não se sobrepõem — a queda entre os dois é a
única medida limpa de quanto o resultado sobrevive fora da amostra.

Primeira leitura na tela, que é o argumento inteiro em três números:

| Sinal | Alfa (janela cheia) | Ajuste | Validação |
|---|---|---|---|
| Rompeu banda superior | +545,2% | +324,4% (37 ops) | **+53,7%** (11 ops) |
| RSI em sobrecompra | +426,9% | +247,6% (48 ops) | **+53,0%** (9 ops) |

O `simulationRankingWarning` foi reescrito nos cinco idiomas junto: ele afirmava
que a validação era "a única coluna não usada para ordenar", o que deixou de ser
verdade. Agora aponta o par e diz que é **a queda entre eles** que separa achado
de sorte.

### A-15 — A tabela listava mais operações do que o card contava ✅ **corrigido**

A tabela renderiza **todas** as operações; o card de retorno conta
`tradesConcluidos`, que exclui as que terminaram por fim da janela. Quem
contasse as linhas achava um número e lia outro logo acima, sem nada na tela
explicando a diferença.

A linha já saía esmaecida, mas isso sinaliza que ela é **diferente**, não que
ela está **fora da conta** — e é a segunda coisa que reconcilia os dois números.

A tabela ganhou título com o total, e a ressalva aparece **só quando há
divergência**: anunciar "0 sem desfecho" no caso normal responderia uma pergunta
que ninguém fez.

Conferido na tela nos dois casos. Segurando 5 candles: `Operações: 49` no título
e 49 no card, sem ressalva. Segurando 24, que deixa posição aberta na borda:

| | |
|---|---|
| Título da tabela | `Operações: 40` |
| Linhas | 40, uma esmaecida com motivo "Janela acabou" |
| Card de retorno | `Operações: 39` |
| Ressalva | *"1 operação(ões) ainda aberta(s) quando a janela acabou… as métricas contam as 39 que tiveram desfecho."* |

O título e a ressalva ficam **fora** do contêiner que rola. Presos lá dentro,
sumiriam na primeira rolagem — justamente quando a lista é longa o bastante para
alguém querer saber quantas linhas ela tem.

A forma "operação(ões)" acompanha o `simulationGaps`, que é o vizinho mais
próximo em função (uma contagem com explicação). Consistência com quem está do
lado vale mais que a redação marginalmente melhor de uma chave isolada.

### A-16 — Sharpe: o painel media retorno e queda, mas não oscilação ✅ **entregue**

Item da Fase 3 do [ROADMAP.md](ROADMAP.md:94) — *"Resultados exibidos: (…)
Sharpe ratio"* — e um buraco real: duas estratégias com o mesmo retorno e
volatilidades muito diferentes liam idênticas no painel.

| Decisão | Escolha | Por quê |
|---|---|---|
| Base do cálculo | retornos da **curva**, candle a candle | é "o que o meu capital fez"; por operação some o que acontece entre elas |
| Anualização | pela **cadência medida** (`MS_POR_ANO / cadenciaMs`) | o motor já mede a cadência; assumir "horário" numa constante mentiria se a coleta mudasse |
| Taxa livre de risco | **zero** | a plataforma não tem uma, e inventar um número seria pior |
| Divisor da variância | **n−1** | são amostra do que a estratégia faria, não a população |
| Curva parada | **null**, não `Infinity` | mesmo tratamento do profit factor sem perdas — `∞` na tela se lê como mérito |

Sai acompanhado da **volatilidade anualizada** como subvalor: a pergunta do card
é "compensou o risco?", e o tamanho do risco é a leitura de apoio.

**A ressalva que precisa acompanhar o número, e que está no tooltip:** para o
mesmo retorno total, exposição menor produz Sharpe maior — a curva fica parada
na maior parte do tempo, o desvio cai, e a razão sobe sem a estratégia ter
melhorado. É por isso que a exposição já era exibida; os dois se leem juntos.

**Verificado por injeção**, três defeitos e três testes distintos: o motor parar
de passar a cadência derruba o teste-ponte; anualizar por uma constante horária
derruba o teste de cadência; remover a guarda de desvio zero derruba o de curva
parada.

> **O primeiro teste-ponte que escrevi falhou, e estava certo em falhar.** A
> fixture usava `parado()`, onde abertura e fechamento são iguais — toda operação
> rendia exatamente zero, a curva ficava plana, e curva plana é justamente o caso
> em que o Sharpe sai `null` de propósito. O candle segurado precisa andar entre
> a abertura e o fechamento. Mesma armadilha que a fixture de
> `serieComDoisSinais` já documentava, e que eu repeti.

Leitura da primeira execução, que mostra a métrica separando o que o retorno
sozinho não separa:

| Sinal | Retorno | Volatilidade | Sharpe |
|---|---|---|---|
| Rompeu banda superior | +545,4% | 33,7% | **17,03** |
| Cruzou VWAP p/ Cima | +348,1% | 31,3% | **14,75** |
| Divergência Baixista | +131,5% | 43,0% | **6,16** |
| Ticket Alto | +3,7% | 67,7% | **0,50** |

Os números são grandes porque a leitura veio do modo mock, com dados sintéticos
onde as estratégias acertam demais, e porque anualizar retorno horário amplifica.
Em dado real a escala é outra; o que a tabela mostra é a **ordenação**, que é o
que a métrica existe para dar.

### A-17 — A régua aleatória comparava estratégias de tamanhos diferentes ✅ **corrigido**

A régua aleatória ([acaso.js](../src/src/utils/acaso.js)) mede o sinal contra
entradas sorteadas, com a mesma saída, custo, direção e filtro. Ela sorteava
**candles avulsos**, no mesmo número de vezes em que o sinal apareceu — e
comentava a escolha: "mesmo número de oportunidades, e não de operações".

Era essa a falha. Sinal de verdade vem em **rajadas**: RSI em sobrecompra,
rompimento de banda e divergência disparam em candles seguidos enquanto a
condição dura, e com a posição aberta as ocorrências seguintes são ignoradas.
Os sorteios não tinham rajada nenhuma, então operavam outro tanto:

| Sinal (demonstração, 120 dias, segurando 5) | Ocorrências | Operações do sinal | Operações dos sorteios |
|---|---|---|---|
| Divergência altista | 208 | 76 | **161** |
| Divergência baixista | 231 | 84 | **175** |
| Ticket alto | 222 | 221 | **169** |
| Volume atípico | 262 | 262 | **193** |

Com o dobro de operações, o sorteio paga o dobro de custo e fica o dobro do
tempo exposto. O percentil comparava duas estratégias de tamanhos diferentes, e
o erro mudava de lado conforme o sinal: rajada operava menos que os sorteios,
ocorrência espaçada operava mais.

**O caso que o teste crava:** um sinal sem valor nenhum — preço parado, cinco
martelos seguidos a cada 25 candles, custo de 0,1% — saía no **percentil 100**.
Os sorteios operavam 27 vezes contra 10 do sinal; a única diferença entre eles
era o custo que o sinal deixava de pagar. O ▲ do ranking tinha o mesmo defeito:
o p95 da sorte ficava em −4,9% contra −2,0% do sinal.

**A correção é rotação circular.** A lista de candidatas é girada por uma
distância sorteada: a ocorrência que estava na posição `p` vai para `p + d`, e a
que passa do fim volta pelo começo. Mantém tudo que não é o momento — quantas
ocorrências, quantas seguidas, a distância entre uma rajada e outra. Depois
dela, as operações da régua batem com as do sinal nos 14 sinais (diferença
máxima de 1, que é a rajada partida na volta do fim para o começo).

Três decisões junto:

- **Os deslocamentos curtos ficam de fora** (5% das candidatas em cada ponta,
  ~9 dias em 180). Deslocado em um candle, o sinal ainda é o sinal: entra no
  meio do mesmo movimento. Uma régua feita dessas cópias julgaria o sinal
  contra ele mesmo.
- **Sem reposição na régua da estratégia**, e com todos os deslocamentos quando
  eles cabem nas 300 iterações. Aí o percentil deixa de ser estimativa e vira a
  conta exata. Na sorte do ranking cada sinal gira com a sua distância, com
  reposição — o que se repetiria é a combinação inteira, e isso não acontece.
- **Custo nenhum.** Marcar uma rotação percorre as mesmas ocorrências que o
  sorteio percorria: 24 ms por sinal, contra 28 antes.

O que a rotação **não** resolve: deslocamentos múltiplos de 24 mantêm a hora do
dia. Um sinal cujo valor viesse só do horário teria parte da régua com o mesmo
horário, e isso a deixaria mais alta — erra para o lado de não bajular.

**No mock, os percentis quase não mudam** (volume atípico 22 → 14, estrela
74 → 76; os extremos seguem em 0 e 100): as estratégias ali acertam ou erram
demais para a régua decidir alguma coisa.

**Em dado real, mudam** — medido depois, na série de 180 dias da API local
(2026-09-26, comprado, segurando 5, já com os sinais do A-19 e do A-20):

| Sinal | Operações do sinal | Sorteio antigo | Rotação | Percentil antigo → novo |
|---|---|---|---|---|
| BTC, cruzou VWAP p/ baixo | 184 | 190 | 184 | **97 → 89** |
| BTC, ticket alto | 148 | 208 | 148 | 88 → 70 |
| BTC, divergência baixista | 36 | 63 | 36 | 87 → 79 |
| ETH, volume atípico | 188 | 282 | 188 | **100 → 94** |
| ETH, divergência baixista | 43 | 76 | 43 | 65 → 43 |
| ETH, ticket alto | 92 | 133 | 93 | 28 → 17 |
| SOL, martelo | 440 | 432 | 440 | 67 → 76 |

Os dois em negrito atravessam o limiar de 95: com a régua antiga o veredito
dizia que eles superavam o acaso. A maior parte das mudanças é para baixo, nos
sinais em rajada — divergência, ticket, volume —, que é a direção prevista: o
sorteio operava mais, pagava mais custo e ficava abaixo do sinal por isso. No
martelo os sorteios antigos já operavam quase o mesmo tanto, e o percentil anda
para os dois lados conforme a moeda (SOL 67 → 76, ETH 80 → 77): é a variação de
trocar um sorteio por outro, não viés. Nas três moedas, as operações da rotação
batem com as do sinal com diferença máxima de 1.

**Verificado por injeção:** a régua antiga derruba os três testes de rajada
(operações 27,5 contra 10, percentil 100, ▲ indevido); zerar a margem de
deslocamento derruba o teste de cópias (percentil 99,49 em vez de 100).

Os textos que descreviam o método — `ajuda.simAcaso` e
`simulationVerdictChance` — foram reescritos nos cinco idiomas: diziam "candles
sorteados, no mesmo número de vezes", que deixou de ser o que acontece.

### A-18 — "Passou nos testes" sem ter sido validado ✅ **corrigido**

O veredito declara no cabeçalho que o título nunca é mais otimista que a pior
leitura. Para a validação, a conta era `!operouNaValidacao || alfa > 0`: **sem
operação no trecho reservado, a validação contava como aprovada**. Uma regra
com alfa positivo, acima do acaso e com intervalo acima de zero saía com
"Passou nos testes desta janela" sem ter sido testada fora da amostra — e sem
ressalva nenhuma, porque a ressalva de validação só aparecia com 1 a 19
operações. Havia um teste cravando isso.

O próprio veredito já tinha o precedente certo: a régua aleatória **ainda não
medida** rebaixa para "frágil". Leitura ausente não é leitura aprovada, e agora
vale o mesmo para a validação — sem operação, ou sem trecho reservado.

A frase de validação passou a aparecer também quando ela não operou: *"Não
houve operação no trecho reservado para validação: o resultado não foi testado
fora da amostra."* Sem ela, com as outras três leituras aprovadas, o título
rebaixado ficaria sem motivo à vista.

Não vira ressalva, e sim frase: é o motivo do título, e o título é onde o
veredito explica a si mesmo.

### A-19 — Os sinais eram classificados contra o futuro ✅ **corrigido**

Pendência anotada desde a primeira versão no cabeçalho do
[backtest.js](../src/src/utils/backtest.js): volume atípico, variação atípica,
ticket alto e a normalização da divergência saíam do `calcularLimites`, que mede
a régua sobre a série **inteira**. Um candle de abril era classificado contra a
mediana de setembro. O cabeçalho media o efeito em 0,3% dos candles, nos dados
de demonstração, e avisava que ele tinha de ser resolvido **antes** de esticar a
janela. O D-03 esticou a janela para 180 dias antes disso.

**Medido em dado real** (API local, 2026-09-26, 4.391 candles, a série que a
simulação de fato busca — o endpoint é anônimo, então não precisou de login):

| | Anomalias: candles que mudam de classe | Maior mudança num mês |
|---|---|---|
| BTC | 63 a 99 (1,4% a 2,3%) | ticket alto em maio: 58 → 28 |
| ETH | 59 a 143 (1,3% a 3,3%) | ticket alto em setembro: 88 → 25 |
| SOL | 41 a 155 (0,9% a 3,5%) | volume atípico em agosto: 65 → 141 |

Na divergência, que só usa a régua para normalizar o fluxo, são 3 a 19 candles.

O mock não mostrava nada disso (19 candles em 2.809), porque é estacionário: a
mediana do período inteiro e a dos 30 dias anteriores quase coincidem.

No resultado da simulação (comprado, segurando 5, custo 0,1%), o alfa mudou de
0,1 a 14,7 pontos, sem direção fixa — variação atípica no SOL foi de −48,0% para
−62,7%, no ETH de −32,9% para −24,2%.

**A correção:** `calcularLimitesMoveis`
([marketStats.js](../src/src/utils/marketStats.js)) devolve, em cada candle, o que
o `calcularLimites` devolveria para os **720 candles até ele** (30 dias,
inclusive o próprio — no fechamento dele volume e variação já são conhecidos).
As medianas andam com a janela num array ordenado; refazê-las do zero custava
centenas de milissegundos. `detectarDivergencias` passou a aceitar uma régua por
candle. A régua do período inteiro continua na **exibição** (tabela de
histórico, card de fluxo), onde "atípico para este período" é a afirmação certa.

Vale para o laboratório **e** a simulação — um vocabulário só. Os números do
laboratório mudam junto, por decisão tomada ao ver as medições acima.

**O teste que trava a classe inteira**, e não só estes quatro sinais: corta a
série em cinco pontos e confere que **nenhum sinal de candle anterior ao corte
muda**. Qualquer sinal futuro que olhe para a frente derruba o teste. Verificado
por injeção: voltar as anomalias à régua do período derruba 2 testes; voltar a
divergência, 3; uma janela que nunca solta o candle antigo, 1.

Consequência visível nos testes de caracterização do passo 0: um candle sem 8
anteriores não tem régua, e não pode ser atípico. Os fixtures que punham o pico
no 3º ou 4º candle foram movidos para depois do 8º — e um teste novo crava que o
pico no 3º candle **não** é marcado. A divergência da série de 14 candles passou
de 8 para 6 ocorrências pelo mesmo motivo.

Custo: `montarSerieDeSinais` de 20 para 28 ms numa série de 180 dias. Roda uma
vez por moeda carregada, não por clique.

### A-20 — "Cruzou VWAP" só existia nos dois primeiros meses ✅ **corrigido**

O cruzamento era com o VWAP **acumulado desde o início da série**. Na janela de
180 dias isso é uma média que começa com três dias e termina com seis meses — e
uma média de seis meses quase não é cruzada. Cruzamentos por mês, dado real:

| | abr | mai | jun | jul | ago | set |
|---|---|---|---|---|---|---|
| BTC, acumulado | 8 | 7 | **0** | **0** | 3 | **0** |
| ETH, acumulado | 16 | 13 | **0** | **0** | 1 | **0** |
| SOL, acumulado | 27 | 36 | **0** | 6 | 1 | **0** |
| BTC, móvel de 24h | 72 | 93 | 88 | 72 | 69 | 60 |

O sinal operava 9 a 33 vezes. Dos cruzamentos dentro da janela, 87% a 97%
caíam nos dois primeiros meses, e **nenhum no trecho de validação**, nas três
moedas. Não é olhar para a frente — o acumulado é causal —, é o sinal mudar
de natureza ao longo da janela. E o mesmo nome queria dizer outra coisa no
laboratório, onde a série tem ~10 dias.

Passa a ser o VWAP **móvel dos últimos 24 candles** (`calcularVwapMovel`), que só
existe com a janela cheia — a margem de aquecimento cobre a espera. Com ele o
sinal opera 177 a 205 vezes em 180 dias, e perde para o buy & hold em todas as
três moedas (alfa de −41% a −65%). Era a leitura que o sinal antigo, com 9
operações nos primeiros dois meses, não tinha amostra para dar.

O VWAP da **exibição** (linha do gráfico, card) continua acumulado, que é como
se plota. `resumirVwap` perdeu o campo `cruzamentos`: o único consumidor era o
vocabulário, e deixá-lo lá ofereceria o sinal antigo a quem o procurasse pelo
nome.

**O primeiro teste que escrevi não pegava o defeito.** Comparava duas séries com
o mesmo final e passados em níveis opostos (50 e 200): com o preço sempre de um
lado do acumulado, as duas davam "nenhum cruzamento" — iguais entre si. Voltar
ao acumulado passava em todos os testes. A régua passou a ser a série **sem
passado nenhum**, e aí a injeção derruba o teste.

### A-21 — A curva marcava a posição aberta sem custo ✅ **corrigido**

Com posição aberta, a curva de capital era marcada pelo retorno **bruto**: ficava
~0,2% acima do que dava para realizar fechando naquele candle, e caía de uma vez
na saída, quando o custo das duas pernas entrava. Picos que nenhum operador
teria tido — e o drawdown e o Sharpe são medidos a partir da curva.

Passa a marcar pelo **retorno líquido de fechar agora** (`retornoLiquidoDe`, a
mesma conta da saída). Com preço parado, a curva durante a posição vale
exatamente o que a operação devolve ao fechar; o teste crava isso, e falhava
antes (1.000 contra 998).

Efeito medido em dado real (44 sinais em BTC, ETH e SOL, comprado, segurando 5):
retorno idêntico em todos, drawdown com mudança mediana zero e máxima de
0,18 p.p. (divergência baixista no BTC, −13,94% → −14,12%), Sharpe com mudança
máxima de 0,07. Correção de honestidade, não de resultado: o número mudava pouco,
mas mudava para o lado que bajulava.

### A-07 — Zero operações não é retorno zero 🟡

Encontrado ao ver a tela funcionando, não nos testes.

A linha de validação exibia `+0,00%` de retorno e alfa `+11,29%` com **zero
operações**. A aritmética está certa — ficar de fora de uma queda de 11% é alfa
positivo — mas a leitura fica errada: "não operou" aparecia como "operou e ficou
estável".

Retorno e alfa passam a exibir "—" quando não houve operação. O buy & hold
continua, porque ele não depende de ter operado.

---

## 9. Invariantes que o teste trava

São as que, se quebrarem, produzem número bonito e falso.

1. Entrada no `precoAbertura` de `i+1`, nunca no fechamento de `i`
2. Sinal no último candle da série → nenhum trade
3. Candle que toca stop **e** alvo → sai pelo stop
4. Custo cobrado nas duas pernas
5. Candles antes de `aPartirDe` alimentam RSI/Bollinger mas **não abrem trade**
6. `direcao: VENDA` inverte o sinal do retorno, do stop e do alvo
7. Trade aberto no fim da série entra na curva e **fica fora** do win rate
8. `buyAndHold` sem custo (D-01)
9. **Buraco na série maior que a tolerância impede o trade que o atravessaria**
10. Candle com `precoFechamento <= 0` ou `precoVolume <= 0` é descontinuidade
11. **`horaReferencia` com e sem sufixo `Z` produz o mesmo resultado** (A-03)

> **Correção sobre a invariante 11.** Escrita assim, ela parecia pedir que o
> motor normalizasse todo carimbo para UTC. **Seria errado.** Hoje o filtro monta
> a data a partir da meia-noite local e os candles são lidos com o mesmo
> `new Date()`, então os dois se compensam. Forçar UTC só no motor faria a
> simulação excluir os candles das primeiras horas da janela e divergir do
> gráfico e da tabela ao lado — trocaria um desalinhamento invisível por um
> visível.
>
> O que vale: o motor usa a **mesma leitura do resto do app**, e a detecção de
> buraco opera sobre **diferenças** entre carimbos, que são imunes à forma da
> string. É isso que o teste crava.

### Como as invariantes foram verificadas

Passar não prova nada: um teste que passa com o bug presente é decoração. Cada
invariante foi confirmada injetando o defeito correspondente no fonte e
conferindo que **o teste certo** falha.

| Defeito injetado | Teste que pegou |
|---|---|
| Alvo ganha do stop no mesmo candle | `deve fechar pelo stop quando o candle toca stop e alvo` |
| Entrada no fechamento do sinal (look-ahead) | `deve entrar na ABERTURA do candle seguinte` |
| Custo só na perna de entrada | `deve cobrar nas duas pernas` + `…também na venda` |
| Buraco não impede a entrada | `deve recusar a entrada que atravessaria um buraco` |
| Stop não espelha na venda | `deve espelhar o stop na venda` |
| Curva sem marcação a mercado | `deve medir drawdown sobre o capital` |

O mesmo método validou o passo 0: deslocar em uma posição o índice de
divergência, VWAP ou osciladores em `signalLab.js` derruba os testes novos —
e **passa nos 13 antigos**, que é exatamente o A-01.

---

## 10. Backend — revisões

Nada aqui bloqueia a v1, mas **B-01 deixou de ser higiene e virou o item que
define o alcance da ferramenta** (ver D-03).

### B-01 — Sem teto em `quantidade` ✅ **resolvido**

Era: `FuncaoObterValorMoeda` fazia `.Take(parametro.Quantidade)` sem limite
superior, e `?quantidade=1000000` partindo de qualquer usuário autenticado
materializava a tabela inteira em memória.

**Implementado** em `FuncaoObterValorMoeda`:

| Guarda | Comportamento |
|---|---|
| `Quantidade > 5000` | `ThinkBitcoinNegocioExcecao` → 400 |
| `Quantidade < 1` | 400 |
| `Pagina < 1` | 400 — antes produzia `Skip()` negativo, que o EF Core rejeitava com exceção de infraestrutura, ou seja **500 onde o certo é 400** |

As três validam **antes de tocar no repositório**: o custo de um pedido absurdo
tem de ser recusá-lo, não executá-lo e reclamar depois.

**5.000** ≈ 208 dias na cadência horária. Folga larga sobre o preset mais longo
do dashboard (1 mês, ~720) e o bastante para a simulação ter amostra que
sustente conclusão. É o teto que D-03 herda.

No front, `QUANTIDADE_MAXIMA_CANDLES` em
[apiClient.js](../src/src/utils/apiClient.js) espelha o valor — fica lá, e não no
DashboardContext, porque é contrato de API e não escolha de tela. O
[teste de contrato](../src/test/quantidadeCandles.test.js) trava a relação:
subir `CANDLES_POR_REQUISICAO` acima do teto faria **toda** requisição do
dashboard responder 400, e o sintoma (tela vazia) não apontaria para a causa.

Testes: 6 novos em `ObterValorMoedaTests` (20 → 26) e 3 no front.

> **Correção ao que ficou registrado no commit.** Escrevi que o pedido partia
> "de qualquer usuário autenticado". Está errado, e para pior: `ValorMoedaController`
> **não tem `[Authorize]`** e o `Startup` chama `UseAuthorization()` sem política
> de fallback, então o endpoint é **anônimo**. Verificado com uma requisição sem
> token, que responde 200.
>
> O teto continua valendo igual — ele não depende de autenticação. Mas o
> endpoint ser público é decisão de produto que vale revisar à parte: dados de
> mercado públicos podem ser intencionais, e nesse caso o que falta é limite de
> taxa, não `[Authorize]`.

> **O primeiro teste que escrevi aqui não servia para nada.** Ele afirmava só o
> **tipo** da exceção. Como o caso não preparava dado no banco, a função também
> falhava com `"Nenhum registro encontrado"` — a **mesma**
> `ThinkBitcoinNegocioExcecao`. Removi o teto de propósito e o teste continuou
> passando.
>
> Corrigido de duas formas: o caso passa a preparar um candle, então a única
> falha possível é o limite; e a asserção passa a ser sobre a **mensagem**.
> Depois disso, remover o teto derruba 1 teste e remover a guarda de página
> derruba 2.
>
> É a segunda vez nesta entrega que um teste passou pelo motivo errado. A regra
> que sobrou: **teste de validação só vale depois de ver o defeito ser
> injetado.**

Vale medir B-03 com a janela esticada, quando D-03 entrar.

### B-02 — `intervalo` é enviado e ignorado ✅ **resolvido**
O front anexava `intervalo` na query, mas a assinatura de `ObterValorMoeda` não
tem esse parâmetro — o ASP.NET descartava em silêncio. Parâmetro morto sugerindo
um contrato que não existe.

**Removido do request**, e só de lá: `intervalo` continua sendo usado dentro do
efeito para compor o `currentFilterKey`, que decide quando limpar a série ao
trocar de filtro. Por isso ele permanece nas dependências — tirá-lo de lá seria
uma segunda mudança, de outro assunto.

A escolha foi remover do front, e não implementar no backend, porque o parâmetro
não tem trabalho a fazer no servidor: quem descreve o período são `dataInicio` e
`dataFim`, que o front calcula a partir dele em
[DashboardContext.jsx](../src/src/context/DashboardContext.jsx).

> Sem teste automatizado. O modo mock intercepta antes do `fetch`, então não há
> requisição para capturar, e extrair o montador de query só para testar uma
> remoção seria construir estrutura para provar uma linha apagada. Verificado
> pelo fonte e pela ausência de regressão nos 445 testes.

### B-03 — `Count()` antes da paginação ✅ **medido, e a premissa estava errada**

Medido em 2026-08-14 contra o banco do cluster, com a janela que a simulação de
fato pede (183 dias de BTC, tabela com 20.958 linhas):

| Etapa | Tempo | Leituras lógicas |
|---|---|---|
| `COUNT(*)` com filtro de data | **0 ms** | **27** |
| Página de 4.285 linhas com a projeção | ~77 ms | 1.173 |

**O `Count()` não é o custo.** 27 leituras confirmam que ele resolve pelo índice
de `HoraReferencia` sem tocar na tabela. O que custa é a projeção — e ela seria
paga de qualquer forma, com ou sem a contagem.

Uma observação que a medição revelou e que vale guardar: as 1.173 leituras são
menos que as 4.285 linhas, ou seja, o otimizador está **varrendo** a tabela em
vez de fazer 4.285 buscas de chave. A consequência é que o custo de uma janela
de tamanho fixo cresce com o tamanho **total** da tabela, não com o da janela.
Hoje são 24 linhas por dia por moeda, então isso demora anos para importar.

**Nada a fazer.** Um índice cobrindo as ~25 colunas resolveria, mas duplicaria a
tabela em disco para economizar 60 ms numa operação que acontece a cada troca de
moeda. Fica anotado como o que fazer *se* o volume ou o uso crescerem.

<details>
<summary>Diagnóstico original</summary>

`FuncaoObterValorMoeda.ObterHistorico` conta a query inteira antes de paginar.
Com o índice do V2 o custo é aceitável na janela filtrada; vale medir se B-01
esticar a janela.

</details>

### B-04 — Switch fixo de 10 moedas 🟡
O roteamento sigla→tabela é `switch` literal. **Simulador de portfólio = N
requisições**, uma por moeda. Não pesa na v1 (moeda única); pesa na Fase 3 do
[ROADMAP.md:97](ROADMAP.md:97).

### B-05 — A taxa real já existe 🟢
`ThinkBitcoin.Externo/TransacaoPrivada/FinalizarOperacaoContaMB/` traz `fee` e
`fee_rate` da corretora, e o mock usa `0.001m`. O default de 0,1% tem lastro
real; mais adiante a simulação pode consumir a taxa efetiva. Não é v1.

---

## 11. Banco — revisões

### BD-01 ✅ Índice em `HoraReferencia` existe
`builder.HasIndex(m => m.HoraReferencia)` em cada configuração de moeda.
Consultas por faixa de data cobertas. **Nada a fazer.**

### BD-02 ✅ Precisão `decimal(15,5)` adequada
Sobra precisão para os 10 pares acompanhados. **Nada a fazer.**

### BD-03 ✅ Densidade de buracos — medida
~1,5% das horas faltam. 30 buracos no histórico do BTC, 366h perdidas; nos
últimos 180 dias são 24 buracos, o maior de 19h. Números completos na seção 7,
tratamento em R-01.

### BD-04 ✅ Unicidade de `HoraReferencia` — confirmada
**Zero duplicatas nas 10 moedas** (medido na seção 7). O índice não é `IsUnique`,
mas a inserção idempotente por `IdColeta` e a FK 1:1 com `Coleta` sustentam a
unicidade na prática. A curva de capital não corre risco de contar o mesmo
movimento duas vezes.

Fica a ressalva de que a garantia é comportamental, não estrutural: nada no
esquema impede a duplicata, só o código que insere.

### BD-05 🟡 Persistência de simulação — decisão de produto
Não existe tabela de simulação. A v1 roda inteira no navegador e **não persiste
nada**: fechou a aba, perdeu.

Se salvar/comparar simulações entrar no escopo, vira modelagem — `TbSimulacao`
com parâmetros + métricas e `TbSimulacaoTrade` filha. É Fase 3 do
[ROADMAP.md:80](ROADMAP.md:80) e não deve contaminar a v1.

---

## 11b. Comparação de estratégias ✅

Item **"Comparação de Estratégias"** da Fase 3 do [ROADMAP.md](ROADMAP.md:107).

`compararEstrategias` roda a **mesma** regra de saída sobre **todos** os sinais
que ocorrem na série e ranqueia por alfa. O laboratório de sinais responde "este
sinal desloca a probabilidade?"; esta tabela responde a pergunta seguinte: "e
operando cada um, com custo, qual teria sobrado?". São coisas diferentes — um
sinal pode deslocar a taxa de alta e ainda assim perder dinheiro, porque a taxa
não sabe do custo nem do tamanho dos movimentos.

A série de sinais é montada **uma vez** e reaproveitada. Sem isso, comparar 14
estratégias recalcularia RSI, Bollinger, VWAP e divergências 14 vezes sobre os
mesmos candles. `simular` passou a aceitar `serieDeSinais`, e **recusa** uma
série cujo tamanho não bata com o dos registros: ela é indexada por posição, e
uma série de outro array alinharia sinais com candles errados.

### O alerta de sobreajuste não é decorativo

Esta tela torna o R-02 **mais fácil de cometer**: são 14 estratégias numa lista
ordenada, e a primeira parece a resposta. A 95% de confiança, testar 14 hipóteses
já faz esperar que menos de uma pareça boa por puro acaso.

Por isso a coluna de validação é a única que **não** participa da ordenação — e
o rodapé da tabela diz isso com todas as letras.

A leitura real da primeira execução mostra por que a coluna importa:

| Sinal | Janela cheia | Validação |
|---|---|---|
| Rompeu banda superior | +545,4% | +53,7% (11 ops) |
| Martelo | −29,9% | **+27,5%** (49 ops) |

O primeiro colocado perde 90% do alfa fora da amostra; o penúltimo **inverte de
sinal**. Ordenar por qualquer uma das duas colunas isoladamente daria uma
resposta diferente — e é isso que a tabela precisa deixar visível em vez de
resolver por conta própria.

### Por que a comparação com o robô ficou de fora

Era a recomendação anterior, e ela **morreu na verificação**: `TbSequenciaRetorno`,
`TbPosicaoDecisao` e `TbHistoricoDecisao` estão **todas vazias** (medido em
2026-08-14). O robô foi treinado — 73.663 episódios, 6 modelos salvos — mas nunca
operou. Não há decisão nem trade para confrontar.

Descartada também a ideia de comparar com as métricas de treino: o `WinRate` de
`TbTreinamentoEpisodio` é fração de *steps* com recompensa positiva, não taxa de
acerto de operação. Cruzar os dois numa mesma tabela seria exatamente a
comparação enganosa que o resto desta plataforma se recusa a fazer.

> **Atualização, 02/10/2026.** Robô operando ou não, as tabelas ficariam vazias:
> a decisão ao vivo está implantada (`helm_deploy.ps1`), mas nada do que ela
> publica chegava ao banco — a decisão ia para uma fila sem consumidor e fora do contrato do .NET,
> a posição dependia de um evento que nenhum agente preenchia, e o consumidor
> de decisões não salvava. Corrigido nos três repositórios (ver "Decisão e
> posição ao vivo" no `ScriptComum-README.md` do Python). Depois do deploy, as
> três tabelas passam a receber uma decisão por hora e as posições da
> simulação ao vivo, e a comparação com o robô deixa de estar bloqueada por
> falta de dado. Desde a mesma época o treino conta também o acerto por trade
> (`Trades`/`TradesVencedores` em `TbTreinamentoEpisodio`).

---

## 12. Fora de escopo, anotado

**Qualquer alteração no `ThinkBitcoin-Back-Python`.** A entrega inteira acontece
entre front e .NET. O Python é referência de leitura (seção 3) e nada mais.

- **Comparar com o robô.** 🚫 **Bloqueado por falta de dado**, não por escopo.
  `TbSequenciaRetorno`, `TbPosicaoDecisao` e `TbHistoricoDecisao` estão vazias
  (ver 11b). O esquema existe e o endpoint também
  (`MarketEndpoint.RETURN_SEQUENCE`, com `[Authorize(Roles = AcessoIA)]`);
  faltam as linhas. Destravar depende de o robô operar, não de front.
  *(02/10/2026: mesmo operando, a publicação estava quebrada. Corrigida — ver
  a atualização em 11b. As linhas começam a chegar depois do deploy, se o
  consumidor ao vivo estiver de pé.)*
- **Janela longa com busca própria.** Ver D-03 (b). Depende de B-01 e da V17.
- **Portfólio multi-ativo.** Depende de B-04.
- **Taxa efetiva da corretora.** Ver B-05.
- **Alinhar o critério de período do laboratório de sinais** (A-05). Mudaria
  números já exibidos.
- ~~**Desacoplar a paginação da tabela da série dos painéis** (A-02).~~ ✅ Feito
  em 2026-08-15: a tabela ganhou busca própria e a série de análise fixou a
  primeira página. Ver A-02.

---

## 13. D-04 — Mais dado fora da amostra 🟡 **C e B feitos; A em espera**

> O D-04 foi desenhado com a simulação ainda no dashboard. Desde o D-05 ela tem
> tela própria, e é lá que as opções B e C entram — o custo novo delas não cai
> mais sobre quem só abre o dashboard.

Nasceu como "a validação quase sempre tem poucas operações": 20% de 180 dias
são 36 dias, e o card mostrava *"só 8 operação(ões): amostra curta"*. A saída
óbvia era esticar a janela ou dividir a validação em vários trechos
(walk-forward).

Medir antes de desenhar mudou o diagnóstico. O "só 8" era do mock. Em dado real
a amostra curta é problema de **parte** dos sinais — e apareceram dois problemas
maiores, que nenhuma janela resolve sozinha.

Medições de 2026-09-26, na API local, sobre ~750 dias (18.000 candles) de BTC,
ETH e SOL. Regra de todas: comprado, segurando 5 candles, custo de 0,1%.

### 13.1 O que a medição mostrou

**1. A amostra da validação é curta só para os sinais raros.** BTC, os 14 sinais,
corte 80/20:

| Janela | Dias de validação | Operações na validação (mediana) | Sinais abaixo de 20 |
|---|---|---|---|
| 180 dias (hoje) | 36 | 30 | 4 de 14 |
| 365 dias | 73 | 60 | 3 de 14 |
| 730 dias | 146 | 121 | 0 de 14 |

No ETH e no SOL, com 180 dias, são **7 de 15** abaixo de 20 — metade.

Os sinais frequentes (padrões de candle, volume, VWAP) já passam de 20 hoje. Os
que não passam são os raros: divergências e extremos de RSI nas três moedas, e
no ETH e no SOL também doji, ticket alto e rompimento da banda inferior. Somam-se
a eles as regras com filtro de tendência ou confirmação, que cortam as entradas
— justamente para onde o usuário vai quando refina uma regra.

**2. O trecho reservado não está reservado.** O card "Fora da amostra" e o
veredito mostram o alfa da validação ao vivo, para **toda** configuração
testada. Quem ajusta olhando o card está escolhendo pela validação, e depois de
vinte tentativas ela é um segundo trecho de ajuste.

O próprio painel já sabia disso em outro lugar. O mapa de sensibilidade
([sensibilidade.js](../src/src/utils/sensibilidade.js)) roda **só no ajuste**, e
o comentário diz por quê: *mostrar a validação ali daria ao usuário 36
combinações para escolher olhando o trecho reservado*. O card faz,
configuração por configuração, o que o mapa se recusa a fazer de uma vez. E a
contagem de tentativas sobe o limiar da régua aleatória (Bonferroni), mas não
entra em nada que diga respeito à validação.

**3. Escolher pelo ranking não tem habilidade medida fora da amostra.** O
ranking ordena os sinais pelo alfa do ajuste, e a primeira linha convida a
escolher. Para medir se essa escolha funciona, um protótipo de walk-forward do
**procedimento**: a cada 30 dias, escolher o sinal de maior alfa nos N dias
anteriores e operá-lo nos 30 seguintes. Os sinais são causais desde o A-19,
então são montados uma vez e valem para todas as dobras.

A comparação que importa não é com a média dos sinais. É com um **controle que
não olha resultado nenhum**: o sinal que menos operou no treino. O motivo é o
mesmo do A-17 — quem opera menos paga menos custo, e isso sozinho já põe um
sinal acima da média.

| Moeda | Treino | Escolhido pelo alfa | Controle (menos operações) | Buy & hold | Posição no mês seguinte (escolhido / controle) |
|---|---|---|---|---|---|
| BTC | 60 d | −30,2% | **+1,8%** | +0,2% | 0,67 / **0,78** |
| BTC | 90 d | −14,5% | **−3,0%** | −23,2% | 0,72 / **0,79** |
| BTC | 180 d | +2,1% | **+10,3%** | −11,1% | 0,77 / **0,82** |
| ETH | 60 d | −56,2% | **−12,7%** | −16,7% | 0,57 / **0,64** |
| ETH | 90 d | −37,9% | **−23,8%** | −38,4% | 0,60 / **0,61** |
| ETH | 180 d | −31,6% | **−10,7%** | +9,5% | 0,56 / **0,57** |
| SOL | 60 d | −44,9% | **+5,0%** | −50,2% | 0,58 / **0,60** |
| SOL | 90 d | −71,1% | **+14,4%** | −57,9% | 0,44 / **0,63** |
| SOL | 180 d | −50,8% | **+5,3%** | −28,5% | 0,51 / **0,60** |

Posição: 0 é o pior sinal do mês seguinte, 1 o melhor, 0,5 o acaso. Retornos
compostos sobre 18 a 22 dobras de 30 dias.

**O controle ganha nas 9 de 9**, em retorno e em posição. A persistência que o
escolhido parece ter (0,67 a 0,77 no BTC) é frequência de operação, não sinal. E
o controle bater o buy & hold nas quedas também não é habilidade: é ficar fora
do mercado a maior parte do tempo.

Ou seja, a tabela de ranking convida a uma escolha que o dado diz não
funcionar, e nem o alerta de sobreajuste nem o ▲ da sorte dizem isso. O ▲ julga
cada linha contra o acaso **na mesma janela**; não diz se o topo da tabela
continua no topo no mês seguinte, que é a pergunta de quem escolhe por ela.

### 13.2 Opções

**A. Janela maior, mesmo corte 80/20.**

- Resolve o **1**, em parte: com 365 dias a mediana dobra (60), mas 3 de 14
  sinais continuam abaixo de 20. Com 730, nenhum.
- Não toca no **2** nem no **3**.
- Custo medido:
  - **Dado:** 3,7 MB por moeda hoje; 7,4 MB (365) ou 15 MB (730), em 2 a 4
    requisições por causa do teto de 5.000 candles.
  - **Thread da tela:** o ranking roda a cada clique num parâmetro de saída e vai
    de 27 ms para 78 ms (365) e 172 ms (730). Com 730 ele precisa ir para o
    worker.
  - **Worker:** a sorte do ranking vai de 0,3 s para 0,5 s (365) e 1,1 s (730).

**B. Walk-forward do procedimento de escolha.**

- Uma aba nova em "Aprofundar": *"Escolher pelo passado funciona?"* — o
  protótipo acima, com a regra de saída da tela, mostrando o escolhido, o
  controle e o buy & hold, e a posição média.
- Resolve o **3**, que é o único dos três que a tela hoje afirma o contrário.
  E produz 100 a 500 operações fora da amostra, contra as ~30 do corte único.
- Precisa de pelo menos 1 ano de série (2 anos dão 18 a 22 dobras). Pode ser
  buscada **só quando a aba abre**, para a troca de moeda não pagar 15 MB.
- Custo: o protótipo leva ~11 s por configuração, mas refaz o preparo da série
  a cada dobra, porque o motor só tem início (`aPartirDe`) e não fim. Com um
  limite de fim no `simular` e o modo enxuto no treino, são ~600 simulações de
  60 a 180 dias cada — estimado em menos de 1 s no worker. **Estimativa, não
  medida.**
- Em aberto: só o sinal, ou também re-escolher stop e alvo na grade do mapa de
  sensibilidade a cada dobra.

**C. Validação cega (pré-registro).**

- O card "Fora da amostra" e o veredito deixam de mostrar a validação até o
  usuário **fixar** a configuração. Revelar grava no diário a configuração e o
  resultado, com data. Mudar a regra e revelar de novo conta como outra olhada,
  e o veredito diz quantas configurações já foram reveladas — Bonferroni na
  validação, como a régua aleatória já tem.
- Resolve o **2**. Custo pequeno: tela e `experimentos.js`, nenhum dado novo.
- Muda o fluxo da tela: até fixar, o veredito não passa de "frágil", pela regra
  do A-18 (validação ausente não é validação aprovada).
- Versão mais fraca, **C'**: continuar mostrando e só contar as olhadas.

**D. (Descartada) Validação em blocos da mesma janela.** Para uma regra escolhida
olhando a janela inteira, os blocos dela não estão fora da amostra. É a aba
"Por mês", que já existe.

### 13.3 Recomendação

**C, depois B, e A só se ainda fizer falta.**

- **C primeiro** porque é barato e conserta o número que já está na tela. Mais
  dado de validação (A) ou mais dobras (B) não adiantam enquanto a validação é
  olhada a cada ajuste.
- **B em seguida** porque responde a pergunta que o ranking levanta — e a
  resposta medida hoje é "não", o que a tela precisa dizer. Ela traz a série
  longa, sob demanda.
- **A por último**, decidido depois do B, quando já se souber o custo real de
  buscar a série longa. Independente disso, vale ativar compressão na API
  (B-06 abaixo).

### 13.4 Decisões

1. **C:** esconder a validação até fixar a configuração. ✅ **Decidido e
   implementado** — ver 13.5.
2. **B:** só o sinal, com treino fixo de 90 dias. ✅ **Decidido e
   implementado** — ver 13.6. Stop e alvo na grade multiplicariam a conta por
   36 e embaralhariam a leitura; treino escolhível recriaria o problema do C
   (testar tamanhos até um parecer bom).
3. **A:** manter 180 dias por enquanto. ✅ Decidido; reavaliar depois do B,
   que traz a série longa sob demanda.
4. **B-06:** ⬜ depende de saber se o que fica na frente da API em produção já
   comprime.

### 13.5 C — Validação cega ✅ **implementada**

**O desenho do 13.2 estava incompleto, e só apareceu ao implementar.**
Esconder o card "Fora da amostra" e a frase do veredito não esconderia a
validação: o retorno, a curva, a aba "Por mês", as operações e a régua
aleatória eram todos calculados sobre a janela **cheia** — que contém o trecho
reservado. Quem ajustasse olhando a curva estaria olhando a validação do mesmo
jeito, e o card escondido seria teatro.

A versão que conserta de verdade: **enquanto a regra não é fixada, a tela
inteira é do trecho de ajuste.** Fixar é revelar: aí aparecem a validação e a
janela cheia, para aquela regra.

| Parte da tela | Validação reservada | Regra fixada |
|---|---|---|
| Retorno, curva, cards, "Dá para confiar?", operações, excursão, "Por mês" | trecho de ajuste | janela cheia |
| Régua aleatória | medida no ajuste (`TrechoRobustez.AJUSTE`) | na janela cheia |
| Linha da janela | *"96 dias de ajuste · 2305 candles · 24 dias reservados"* | *"120 dias · 2881 candles"* |
| Card "Fora da amostra" | "Reservada" + botão **Fixar regra e revelar** | o alfa da validação + *"revelada em …"* |
| Veredito | *"Passou no ajuste — falta a validação"* quando o resto passou; nunca "passou" (A-18) | como antes |
| Ranking | sempre números do **ajuste**; validação só na linha da regra já fixada | idem |
| Mapa de sensibilidade, sorte do ranking | ajuste (já eram) | ajuste |

Detalhes que a implementação decidiu:

- **Qualquer mudança de parâmetro é outra regra**, e volta a ser só ajuste. A
  identidade é a mesma `impressaoDaConfiguracao` que conta tentativas.
- **Revelar não se desfaz.** Fica no localStorage por moeda
  (`registrarRevelacao`), com a data da primeira vez, e não é apagado junto com
  as tentativas: zerar a contagem é decisão de quem testa; desver um resultado
  não é.
- **Fixar grava no diário** a regra, os números do ajuste que a escolheram e a
  validação revelada: o registro do que se decidiu antes de ver a prova. O
  diário passa a guardar sempre o ajuste, e guardar uma regra já fixada não
  sobrescreve o registro com números da janela cheia.
- **Várias revelações gastam o trecho.** Todas usam o mesmo trecho reservado;
  a partir da segunda regra revelada numa moeda, o veredito ganha a ressalva de
  que a que passou pode ter passado por sorte. Sem inventar um número de
  correção para isso — a contagem e o aviso são o que se sustenta.
- **O ranking perdeu as colunas de janela cheia.** Mostrava retorno e alfa da
  janela inteira — catorze regras com a validação embutida, prontas para
  escolher olhando-a. Agora é tudo do ajuste; `compararEstrategias` passou a
  devolver `retornoAjuste`.
- **A janela desliza.** Ela termina "agora", então o trecho reservado anda um
  dia por dia. Uma regra revelada continua revelada — o que foi visto foi
  visto —, e com o tempo o trecho reservado passa a conter dias que ninguém viu.

**Verificado na tela (mock, BTC, segurando 3):** antes de fixar, retorno do
ajuste −85,54% e alfa −88,78%; depois de fixar, a tabela "ajuste × validação"
mostra exatamente esses dois números na linha do ajuste, e a validação
(−16,02%) aparece no card, no veredito e no diário. Trocar para 5 candles volta
a "Reservada"; voltar a 3, revelada de novo; recarregar a página, continua. No
ranking, 1 das 14 linhas com validação. Nenhum erro de console num roteiro de
troca de regra, de moeda e revelação no ETH.

**Testes:** `registrarRevelacao` (uma vez por regra, data da primeira,
separado por moeda, imune a zerar tentativas, registro malformado);
`retornoAjuste` igual ao de simular o ajuste; régua aleatória no ajuste igual
ao retorno do ajuste, na cheia igual ao da cheia, sem misturar as duas na
memória; veredito "falta a validação" e seus limites; ressalva de várias
revelações; cobertura da janela medida pela série e não pelo ajuste; tela com
card reservado, botão, linha da janela, tabela escondida e ranking com a
validação só na regra fixada.

### 13.6 B — "Escolher pelo passado funciona?" ✅ **implementada**

Aba nova em "Aprofundar", logo depois do ranking: é a pergunta que ele
levanta. A cada 30 dias, escolhe o sinal de maior alfa nos 90 dias anteriores
— o topo do ranking — e o opera nos 30 seguintes, com a regra de saída da tela.
Ao lado, o **controle**: no mesmo treino, o sinal que menos operou, sem olhar
resultado. E o buy & hold dos mesmos períodos.

A tela mostra os três retornos compostos, a posição média do escolhido e do
controle no período seguinte (0 = pior sinal, 1 = melhor, 0,5 = acaso), uma
frase de leitura e a tabela período a período. "Superou" exige as duas
leituras — retorno composto e posição —, porque um período extremo decide o
composto sozinho.

O que a implementação decidiu:

- **Série própria de dois anos, buscada só quando a aba abre**
  ([useSerieLonga.js](../src/src/hooks/useSerieLonga.js)). São ~17.600 candles
  em 4 requisições paralelas (teto de 5.000 por pedido; `dividirEmBlocos` em
  [simulationWindow.js](../src/src/utils/simulationWindow.js) conta as duas
  pontas inclusivas), juntadas sem repetição. Guardada por moeda durante uma
  hora — a cadência da coleta.
- **Os períodos param onde começa o trecho reservado** da validação (13.5).
  Mostrar como o procedimento se saiu nele seria mostrar a validação por outro
  caminho. Custa um período (21 → 20).
- **`simular` ganhou `ate`**, o fim exclusivo da simulação. O protótipo
  recortava a série a cada período e refazia o preparo dela: ~11 s por
  configuração. Com `aPartirDe` e `ate` sobre a mesma série, o preparo é
  reaproveitado e a caminhada inteira leva **~100 ms** em dois anos reais
  (21 períodos, o maior de 40 ms), mais ~200 ms para a série de sinais, uma vez
  por série. Por isso **não foi para o worker**: um período por vez, com a vez
  devolvida à tela entre eles, e a tela diz em que período a conta está.
- **Reproduz o protótipo exatamente** em dado real: BTC, treino de 90 dias —
  escolhido −14,5% (146 operações, posição 0,72), controle −3,0% (0,79), buy &
  hold −23,2%; ETH e SOL idem. Ou seja, a tabela do 13.1 é o que a aba mostra.
- **O mock passou a ter dois anos** (era 120 dias), guardado por moeda e hora:
  sem isso a aba não tinha período nenhum no modo demo, e a própria simulação
  anunciava "janela curta" em todo teste. Gerar dois anos leva ~160 ms na
  primeira requisição da hora; as seguintes, ~10 ms. No mock os números são
  absurdos (+7.856.169%): os sinais sintéticos acertam demais, como o A-16 já
  registrava.

**Verificado por injeção:** o treino enxergar o mês de teste derruba o teste
de causalidade (o período cujo teste começa na virada tem de ter escolhido o
sinal que só ganhava no treino); o controle pelo maior número de operações
derruba o teste de escolha. `simular` com `ate` é conferido contra a série
cortada em três pontos, inclusive com posição aberta no corte.

**Na tela (mock, BTC):** do clique ao resultado, ~0,8 s — busca dos 4 blocos,
série de sinais e 20 períodos —, passando por "Calculando o período 15 de
20…"; rodapé com a data em que os períodos param; nenhum erro de console.

### B-06 — A API não comprime a resposta 🟡

Medido em 2026-09-26 direto na porta da API (13501), com `Accept-Encoding: gzip,
br`: a resposta volta sem `Content-Encoding`, 3,7 MB para 180 dias. Com gzip a
mesma resposta tem 0,58 MB — **6,4× menos**. A janela longa do D-04 (15 MB por
moeda) passaria a ~2,3 MB.

Não foi verificado se o ingress de produção comprime antes de entregar ao
navegador — só a API direta. É a primeira coisa a conferir: se o ingress já
comprime, B-06 não tem nada a fazer.

Fica também anotado que o motor e os sinais leem 14 dos 25 campos de cada
candle. Uma projeção enxuta cortaria os outros 11, mas mexe no contrato do
endpoint; a compressão não mexe em nada.

---

## 14. D-05 — A simulação ganhou tela própria ✅

A simulação morava no fim do dashboard, abaixo do laboratório de sinais. Saiu
para a rota **`/simulacao`** ([Simulacao.jsx](../src/src/pages/Simulacao.jsx)),
com item no menu. No dashboard ficou um atalho no lugar do painel.

### Por quê

**O custo dela caía sobre toda visita ao dashboard.** O dashboard abre com uma
moeda selecionada — a preferida, ou o BTC —, e o hook da simulação rodava
sempre que havia uma moeda só: buscava os 180 dias (3,7 MB, sem compressão —
ver B-06), punha o worker a rodar a régua aleatória (300 simulações), o mapa de
sensibilidade e a sorte do ranking, e o ranking na thread da tela. Para quem só
queria olhar o mercado. Agora só paga quem abre a ferramenta.

**São trabalhos diferentes**, e este documento já dizia isso no D-03: no
dashboard se mexe no período para OLHAR; na simulação, nos parâmetros para
TESTAR uma regra. A simulação nunca dependeu dos filtros de lá — tem série,
janela e URL próprias —, e do dashboard só recebia a moeda. Mover foi mudar
quem fornece a moeda.

**O D-04 pesa mais.** Validação cega, walk-forward com 2 anos de série, talvez
uma janela maior: no dashboard, cada um multiplicaria o custo de cima.

### O que mudou

| Onde | O quê |
|---|---|
| `/simulacao` | A moeda vem do parâmetro `moeda` da URL (o mesmo do dashboard e do heatmap); sem ele, a preferida. Volta para a URL ao ser escolhida, com `replace`, sem apagar os `sim.*`. O título do painel é o `h1` da página |
| Seletor de moeda | Pílulas logo abaixo do título, em **todos** os estados do painel — trocar de moeda enquanto a série carrega é justamente quando se quer |
| Dashboard | Atalho *"Simular BTC →"* no lugar do painel, só com uma moeda selecionada, como antes |
| Laboratório de sinais | Cada linha ganha o atalho para simular aquele sinal, na moeda analisada — mesmo vocabulário, a chave vai direto para `sim.sinal` |
| Links antigos | `/dashboard?sim.*` redireciona para `/simulacao` com a configuração inteira |
| Tour do dashboard | O passo da simulação continua, apontando para o atalho, com o texto dizendo que ela tem tela própria. Nenhuma chave renumerada |
| Moeda preferida | A busca pelos seis nomes do campo saiu do Dashboard para `acharMoedaPreferida` ([preferences.js](../src/src/utils/preferences.js)): duas telas precisam da mesma escolha, e duas cópias discordariam no primeiro campo novo |

### Três coisas que só apareceram fazendo

1. **Os gráficos funcionavam por carona.** Quem registrava escalas e elementos
   do Chart.js era o import do `Dashboard.jsx`. Aberta direto — link
   compartilhado, recarga —, a tela nova desenharia os gráficos sem escala
   registrada. O painel passou a registrar o que usa
   ([registroGraficos.js](../src/src/components/dashboard/simulacao/registroGraficos.js)),
   no molde da tela de treinamento. Conferido abrindo `/simulacao` numa aba
   limpa: curva desenhada, canvas de 903 px.
2. **O motor ia para o pacote inicial.** O redirecionamento dos links antigos
   mora no `App.jsx`, que é carregado por todo mundo, e reconhecer o link
   importando o `parametrosSimulacao` levaria o `backtest` junto. A rota e o
   reconhecimento saíram para um módulo sem dependência
   ([rotaSimulacao.js](../src/src/utils/rotaSimulacao.js)). Conferido no build:
   o marcador `'sem-tolerancia'`, que só existe no `backtest.js`, não aparece
   no pacote inicial.
3. **O menu do celular transbordou.** Com o sétimo item, a barra inferior pedia
   424 px, e o último ícone saía da tela num celular de 375 px — antes cabia
   no limite, 375 de 375. O `space-around` já distribui o espaço entre os
   ícones, então o gap fixo de 16 px só servia de piso: abaixo de 480 px ele
   sai e as bordas encolhem. Cabe em 296 px; conferido em 375 e em 320.

### Medido

Build de produção, antes (`8af68db`) e depois:

| Chunk | Antes | Depois |
|---|---|---|
| Dashboard | 158 KB (47,3 KB gzip), com o motor dentro | 76 KB (22,8 KB gzip) |
| Compartilhado (laboratório de sinais + motor) | — | 26 KB (9,4 KB gzip) |
| Simulação | — | 59 KB (17,7 KB gzip), só quando a tela abre |

O dashboard passa de 47 para 32 KB gzip de código, e deixa de buscar os
3,7 MB da série da simulação e de ocupar o worker a cada visita.

O motor ainda chega ao dashboard pelo chunk compartilhado: o atalho do
laboratório monta o endereço com o `escreverParametrosNaUrl`, que importa o
`backtest` por uma constante (o custo padrão). São ~9 KB gzip, contra os 3,7 MB
que saíram; ficou anotado em vez de resolvido.

### Verificado

- **Testes:** `acharMoedaPreferida` (grafias, BTC como padrão, lista vazia),
  `temParametrosDaSimulacao` e `enderecoDaSimulacao` (ida e volta com a leitura
  da tela), seletor visível no carregamento e com resultado, título como `h1`
  ou `h2`, atalho do dashboard e links do laboratório.
- **Na tela (mock):** URL ganha a moeda; trocar parâmetro e depois moeda deixa
  `?moeda=ETH&sim.segurar=24`; o dashboard não monta mais o painel e tem o
  atalho dentro do alvo do tour; 14 links no laboratório, o clique abre a
  simulação no sinal certo; `/dashboard?sim.sinal=martelo&sim.segurar=24` abre
  a simulação com os dois; sem rolagem horizontal em 375 e 320 px.
