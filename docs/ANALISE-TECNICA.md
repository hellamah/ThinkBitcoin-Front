# Ferramentas de Análise Técnica

Registro do que já existe, do que está planejado e — importante — do que foi
deliberadamente descartado.

## Critério de inclusão

Uma técnica só entra se o **laboratório de sinais** (`utils/signalLab.js`)
conseguir medi-la. O laboratório cruza cada sinal com o retorno dos candles
seguintes e compara com a taxa base do período. Isso exige que a detecção seja
**reprodutível**: dado o mesmo histórico, dois observadores precisam chegar ao
mesmo conjunto de marcações.

Técnica que depende de escolher pontos a olho não passa nesse critério, por
mais popular que seja. Ver "Descartadas" no fim.

Todas as ferramentas abaixo derivam de campos que a resposta de
`/moeda/{sigla}/valor` já traz. Nenhuma exige requisição nova.

---

## Implementadas

### Divergência de fluxo — `utils/flowDivergence.js`

O delta acumulado (CVD) soma `volumeComprado - volumeVendido` ao longo do
período. Quando o preço sobe e o CVD não acompanha, a alta não tem lastro de
compra real.

É a de maior valor diferencial: exige `volumeComprado` e `volumeVendido`
separados, que a maioria das fontes de varejo não expõe. O backend já entrega.

**Detecção por janela deslizante**, e não por pivôs. A formulação clássica
compara "topo mais alto do preço contra topo mais baixo do indicador", o que
obriga a escolher os topos a olho. Aqui a janela é fixa (5 candles) e os pisos
são explícitos: 0,5% de movimento de preço e 0,5× a mediana de volume no
fluxo. Sem os pisos, oscilação lateral gera divergência a cada candle.

Sinais no laboratório: `divergenciaBaixista`, `divergenciaAltista`.

### Padrões de candle — `utils/candlePatterns.js`

Martelo, estrela cadente, doji e marubozu, a partir de `precoCorpoCandle`,
`precoSombraSuperior` e `precoSombraInferior`.

Ressalva registrada no próprio módulo: padrão isolado não é sinal de entrada.
Martelo só significa reversão *depois* de uma queda. A classificação é
puramente geométrica; quem dá sentido é o desfecho medido.

### Anomalia de volume, variação e ticket — `utils/marketStats.js`

Volume acima de 3× a mediana, variação além de 2σ, ticket médio acima de 2× a
mediana. Réguas diferentes de propósito: volume é assimétrico e de cauda longa,
então usa múltiplo da mediana em vez de desvio padrão.

---

### VWAP — `utils/vwap.js`

Preço médio ponderado por volume, o benchmark que mesa institucional usa para
avaliar execução: comprou abaixo do VWAP, comprou bem.

**Acumulado** a partir do início da janela (`Σ nocional ÷ Σ volume`), que é
como se plota. A média dos VWAPs por candle seria outra coisa — daria peso
igual a uma hora de 200 trades e a uma de 20.000.

O sinal é o **cruzamento**, não o lado. Estar acima do VWAP é estado: quase
todo candle está de um lado ou do outro, então medir isso devolveria algo
próximo da taxa base. A travessia é o acontecimento.

Sinais: `vwapCruzamentoAlta`, `vwapCruzamentoBaixa`.

Detalhe de integração: a linha entra como dataset depois da série de preço,
porque o plugin de candle cancela o desenho do índice 0. O plugin foi ajustado
para cancelar só esse índice — antes cancelava todos, o que apagaria qualquer
sobreposição no modo vela.

### RSI e Bandas de Bollinger — `utils/oscillators.js`

Os dois entraram para **serem medidos**, não para serem seguidos. São os
indicadores mais usados do mercado e estão entre os de evidência mais fraca;
se o desfecho contra a taxa base der zero, isso precisa aparecer na tela.

Períodos padrão da literatura: RSI 14 com suavização de Wilder, bandas de 20
com 2σ. Encurtá-los para caber em janelas curtas faria "RSI 70" significar
aqui algo diferente do que significa em qualquer outra ferramenta. Sem
histórico suficiente a saída é `null` e o card diz isso, em vez de exibir
número calculado sobre dados de menos.

Como nos outros, o sinal é a **travessia**, não o nível: um ativo pode ficar
sobrecomprado por semanas, e marcar todos esses candles daria uma linha quase
igual à base.

**Depende do intervalo selecionado:**

| Intervalo | Candles | RSI(14) | Bollinger(20) | Banda no gráfico |
|---|---|---|---|---|
| 24h | ~3 | não calcula | não calcula | oculta |
| 7d | ~21 | 7 pontos | 2 pontos (10%) | oculta |
| 1m | ~93 | 79 pontos | 74 pontos (80%) | desenhada |

A banda só é desenhada quando cobre ao menos metade do gráfico. No filtro de
7d ela apareceria nos dois últimos candles, colada na borda direita: parecia
estática e não dizia nada. Melhor não desenhar do que desenhar um toco.

**O conserto de fundo, não feito:** o indicador poderia chegar aquecido se o
front tivesse os ~20 candles anteriores à janela. Ele não tem — `dataInicio`
e `dataFim` vão para a API, que já devolve só o recorte. Buscar a margem extra
esbarra em `historicoMoeda` e `totalPaginas` saírem do mesmo request
(`useDashboardData.js`), então a contagem de páginas da tabela passaria a
incluir os candles de aquecimento. Exigiria separar o request da série do
request da tabela.

O mock passou por três formas até sustentar os dois. Seno puro e soma de senos
falhavam pelo mesmo motivo: oscilação periódica não tem tendência sustentada, e
sem ela o RSI orbita 50. A correção não foi ajustar frequências até o indicador
acender — foi trocar a forma da série por um passeio aleatório com persistência,
que é o que preço real se parece. O extremo passou a aparecer por consequência
(RSI de 10 a 97 em 93 candles), não por encomenda.

### ATR — `marketStats.calcularAtr`

`precoAmplitude` é o *true range* do candle. Suavizado por Wilder ao longo de
14 períodos, dá o ATR: quanto o ativo costuma andar dentro de um candle.

Exposto também em percentual do preço atual, porque em dólar BTC e DOGE não se
comparam lado a lado.

**Não gera sinal e por isso não entra no laboratório.** Descreve amplitude de
movimento, não sugere direção — é insumo para dimensionar distâncias por
volatilidade medida em vez de por palpite, e a decisão de o que fazer com isso
é de quem opera.

---

## Planejadas

Nada pendente do roadmap original. Ideias que ficaram registradas nas conversas
e ainda não viraram trabalho:

- **Padrões de dois candles** (engolfo, harami) — precisam de contexto entre
  velas consecutivas, que é outra estrutura de detecção.
- **Contexto de localização dos padrões** — martelo só significa reversão
  depois de uma queda. Hoje a classificação é puramente geométrica.

---

## O que o laboratório está dizendo

Com intervalo de confiança de Wilson a 95%, **nenhum dos doze sinais se
distingue da taxa base** numa janela de ~90 candles. "Cruzou VWAP p/ Cima" com
100% de acerto tem intervalo de 21 a 100%: não informa nada.

Isso não é falha da ferramenta — é a resposta correta para esse tamanho de
amostra, e é justamente o que o painel existe para dizer. Antes da coluna de
intervalo, a mesma linha aparecia como "+51,1 p.p." e passava por descoberta.

Para separar sinal de ruído nesses deltas seria preciso ordem de grandeza mais
de histórico. A conclusão prática: o laboratório serve hoje para **descartar**
hipóteses, não para confirmá-las.

---

## Descartadas

Não passam no critério de reprodutibilidade — a detecção depende de pontos de
ancoragem escolhidos por quem olha, então o laboratório não consegue medir e a
ferramenta viraria decoração:

- **Retração de Fibonacci** — exige escolher o topo e o fundo de referência.
- **Ondas de Elliott** — contagem de ondas é interpretativa por definição.
- **Padrões gráficos nomeados** (ombro-cabeça-ombro, bandeiras, cunhas) —
  duas pessoas traçam linhas diferentes no mesmo gráfico.

Isso não é juízo sobre quem as usa. É reconhecer que, sem detecção
determinística, não há como medir se funcionam, e a plataforma se propõe a
medir.

---

## Campos ainda não aproveitados

Do contrato de `/moeda/{sigla}/valor`, seguem sem uso:

- `precoDeltaUltimoAbertura`
- `precoVariacaoAbsoluta`
- `precoDirecao` — classificação de direção que o backend já faz
- `precoMedio` — média simples do candle; o VWAP entrega a versão ponderada,
  que é a informativa, então este só entraria como comparação entre os dois

`quantidadeNegociada` foi verificado e é **idêntico** a `precoVolume` no
backend real; não acrescenta nada.
