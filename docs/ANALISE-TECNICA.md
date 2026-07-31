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

---

## Planejadas

### 1. ATR — faixa de volatilidade

`precoAmplitude` é essencialmente o *true range* do candle. A média móvel dele
dá o ATR, usado para dimensionar stop por volatilidade medida em vez de por
palpite.

Metade do caminho já existe em `marketAnalytics.volatilidade`, que calcula a
mediana do período. Falta a média móvel e o desenho da faixa no gráfico.

Ferramenta de gestão de risco, não de entrada — não gera sinal de compra ou
venda e por isso não entra no laboratório.

### 2. Bandas de Bollinger

Média móvel dos fechamentos ± 2σ. `mathUtils.stdDev` já existe.

O valor aqui é menos a banda desenhada e mais **medir no laboratório** se
tocar a banda antecede alguma coisa. O resultado pode perfeitamente ser "não
desloca a taxa base", que já é informação útil.

### 3. RSI

Índice de força relativa sobre os fechamentos.

Incluído com ressalva explícita: é o indicador mais usado e um dos de
evidência mais fraca. A razão de implementá-lo é justamente submetê-lo à
mesma régua dos outros. Se o delta contra a base for nulo, isso deve aparecer
na tela em vez de ficar subentendido.

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
