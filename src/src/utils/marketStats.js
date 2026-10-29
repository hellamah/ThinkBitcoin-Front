// Estatísticas de desempenho do período, derivadas do histórico já carregado.

import { mean, median, paraNumero, stdDev } from './mathUtils'

// Abaixo disso média e desvio não descrevem o período: com meia dúzia de
// candles qualquer leitura vira "atípica" e o alerta perde o sentido.
const MIN_SAMPLES = 8

// 2σ deixa ~5% dos candles marcados numa distribuição normal — raro o bastante
// para chamar atenção, frequente o bastante para aparecer num período típico.
const SIGMA_THRESHOLD = 2

// Volume é assimétrico e tem cauda longa, então a régua é multiplicativa sobre
// a mediana, não em desvios padrão.
export const VOLUME_FACTOR = 3

// Ticket médio acima deste múltiplo da mediana: o volume da hora veio de
// poucas ordens grandes em vez de muitas pequenas. Fator menor que o do volume
// porque o ticket é bem menos disperso — 3× praticamente não ocorre.
const TICKET_FACTOR = 2

// Período padrão do ATR na formulação de Wilder.
export const ATR_PERIOD = 14

// Quantos candles, contando o próprio, a régua de normalidade dos SINAIS olha
// para trás: 30 dias na cadência horária. Longa o bastante para uma mediana de
// volume não ser puxada por uma semana agitada, curta o bastante para
// acompanhar a mudança de regime — em 180 dias o volume do BTC mudou de
// patamar mais de uma vez, e uma régua do período inteiro chamava de atípico
// o que era só o regime novo.
export const JANELA_LIMITES_MOVEIS = 720

/**
 * Consolida o desempenho de uma série de candles.
 *
 * @param {Array<object>} registros - Registros de /moeda/{sigla}/valor, na
 *   ordem em que a API entrega (ordemAsc=false: do mais recente ao mais antigo).
 * @returns {{
 *   retorno: number, drawdown: number, winRate: number|null,
 *   melhor: number|null, pior: number|null, amostras: number
 * }|null} Percentuais; null se não houver fechamento válido.
 *
 *   As três leituras de variação saem null quando a série não traz variação
 *   medida — não zero. `amostras` conta os FECHAMENTOS, que é o que sustenta
 *   retorno e drawdown; as variações são outro campo e podem faltar sem que os
 *   fechamentos faltem.
 */
export const calcularDesempenho = (registros) => {
  if (!Array.isArray(registros) || registros.length === 0) return null

  // O cálculo é cronológico; a API entrega ao contrário.
  const cronologico = [...registros].reverse()

  const fechamentos = cronologico
    .map((r) => Number(r?.precoFechamento))
    .filter((v) => Number.isFinite(v) && v > 0)

  if (fechamentos.length === 0) return null

  const primeiro = fechamentos[0]
  const ultimo = fechamentos[fechamentos.length - 1]
  const retorno = ((ultimo - primeiro) / primeiro) * 100

  // Maior queda a partir de um pico — o que o usuário teria visto de perda
  // máxima se tivesse entrado no pior momento do período.
  let pico = fechamentos[0]
  let drawdown = 0
  fechamentos.forEach((v) => {
    if (v > pico) pico = v
    const queda = ((v - pico) / pico) * 100
    if (queda < drawdown) drawdown = queda
  })

  const variacoes = cronologico
    .map((r) => Number(r?.precoPercentualVariacao))
    .filter((v) => Number.isFinite(v))

  const positivas = variacoes.filter((v) => v > 0).length

  // Sem variação medida não existe taxa, nem melhor, nem pior — e zero seria
  // uma AFIRMAÇÃO no lugar da ausência: "0,0% dos candles fecharam em alta",
  // "o melhor candle do período fez 0%". A tela não teria como distinguir isso
  // de um período que de fato ficou parado, que é uma leitura legítima e
  // completamente diferente.
  //
  // É a mesma régua que o resto do projeto já segue: o laboratório deixa em
  // branco o trecho em que o sinal não ocorreu, a simulação distingue "não
  // operou" de "rendeu zero". Faltava aqui, no painel que abre o dashboard.
  const temVariacoes = variacoes.length > 0

  return {
    retorno,
    drawdown,
    winRate: temVariacoes ? (positivas / variacoes.length) * 100 : null,
    melhor: temVariacoes ? Math.max(...variacoes) : null,
    pior: temVariacoes ? Math.min(...variacoes) : null,
    amostras: fechamentos.length,
  }
}

/**
 * ATR — amplitude média verdadeira, na suavização de Wilder.
 *
 * `precoAmplitude` é máxima menos mínima do candle, que é o true range. Mede
 * o quanto o ativo costuma andar dentro de um candle, e é usado para
 * dimensionar distâncias por volatilidade medida em vez de por palpite.
 *
 * Não gera sinal: descreve a amplitude do movimento, não sugere direção, e
 * por isso não entra no laboratório.
 *
 * @param {Array<object>} registros - Série na ordem da API (mais recente primeiro).
 * @param {number} periodo
 * @returns {{valor: number, percentual: number|null, amostras: number}|null}
 *   null sem histórico suficiente; percentual é o ATR sobre o preço atual.
 */
export const calcularAtr = (registros, periodo = ATR_PERIOD) => {
  if (!Array.isArray(registros) || registros.length < periodo) return null

  const cronologico = [...registros].reverse()
  const amplitudes = cronologico
    .map((r) => paraNumero(r?.precoAmplitude))
    .filter((v) => v !== null && v >= 0)

  if (amplitudes.length < periodo) return null

  // Primeira média simples, depois suavizada — mesma mecânica do RSI.
  let atr = mean(amplitudes.slice(0, periodo)) ?? 0
  for (let i = periodo; i < amplitudes.length; i++) {
    atr = (atr * (periodo - 1) + amplitudes[i]) / periodo
  }

  const fechamentoAtual = paraNumero(registros[0]?.precoFechamento)

  return {
    valor: atr,
    // Em percentual o ATR compara entre moedas de preços muito diferentes;
    // em dólar, BTC e DOGE não se olham lado a lado.
    percentual:
      fechamentoAtual !== null && fechamentoAtual > 0
        ? (atr / fechamentoAtual) * 100
        : null,
    amostras: amplitudes.length,
  }
}

/**
 * ATR em CADA posição da série, e não só na última.
 *
 * `calcularAtr` responde "qual é o ATR agora?" — o suficiente para um card.
 * Dimensionar um stop no instante de uma entrada passada exige outra coisa: o
 * ATR como ele era naquele candle. Um único escalar aplicado a todas as
 * entradas usaria a volatilidade de hoje para uma operação de seis meses atrás.
 *
 * A diferença de implementação está no tratamento de buraco. `calcularAtr`
 * FILTRA as amplitudes inválidas, o que encurta o array e destrói a
 * correspondência com as posições — inofensivo lá, porque só o último valor
 * importa, e fatal aqui. Nesta versão a posição é preservada e a amplitude
 * ausente apenas não atualiza a média: o ATR anterior segue valendo, em vez de
 * ser puxado para baixo por um zero que ninguém mediu.
 *
 * @param {Array<object>} registros - Série na ordem da API (mais recente primeiro).
 * @param {number} [periodo]
 * @returns {Array<number|null>} - Em ordem CRONOLÓGICA, alinhado posição a
 *   posição. null enquanto não houver histórico suficiente.
 */
export const calcularAtrSerie = (registros, periodo = ATR_PERIOD) => {
  if (!Array.isArray(registros) || registros.length === 0) return []

  const cronologico = [...registros].reverse()
  const amplitudes = cronologico.map((r) => {
    const v = paraNumero(r?.precoAmplitude)
    return v !== null && v >= 0 ? v : null
  })

  const saida = new Array(cronologico.length).fill(null)

  // Semeadura: média simples das primeiras `periodo` amplitudes válidas. O
  // índice onde isso se completa é onde a série passa a existir.
  const validas = []
  let inicio = -1
  for (let i = 0; i < amplitudes.length; i++) {
    if (amplitudes[i] === null) continue
    validas.push(amplitudes[i])
    if (validas.length === periodo) {
      inicio = i
      break
    }
  }

  if (inicio < 0) return saida

  let atr = mean(validas) ?? 0
  saida[inicio] = atr

  // A partir daí, suavização de Wilder — mesma mecânica do RSI.
  for (let i = inicio + 1; i < amplitudes.length; i++) {
    if (amplitudes[i] !== null) {
      atr = (atr * (periodo - 1) + amplitudes[i]) / periodo
    }
    saida[i] = atr
  }

  return saida
}

/**
 * Régua de normalidade do período, usada para marcar candles atípicos.
 *
 * Calculada sobre a série inteira da moeda, não sobre a página exibida: o que
 * define "fora do normal" é o período, e uma página de 20 linhas produziria
 * limites diferentes a cada navegação.
 *
 * É régua de EXIBIÇÃO. Para sinal — o que o laboratório mede e a simulação
 * opera — a régua é `calcularLimitesMoveis`, que não enxerga o futuro.
 *
 * @param {Array<object>} registros - Série completa de uma única moeda.
 * @returns {{
 *   mediaVariacao: number, desvioVariacao: number,
 *   medianaVolume: number|null, amostras: number
 * }|null} - null se a série for curta demais para descrever normalidade.
 */
export const calcularLimites = (registros) => {
  if (!Array.isArray(registros) || registros.length < MIN_SAMPLES) return null

  const variacoes = registros.map((r) => r?.precoPercentualVariacao)
  const mediaVariacao = mean(variacoes)
  const desvioVariacao = stdDev(variacoes)

  if (mediaVariacao === null || desvioVariacao === null) return null

  return {
    mediaVariacao,
    desvioVariacao,
    medianaVolume: median(registros.map((r) => r?.precoVolume)),
    medianaTicket: median(registros.map((r) => r?.precoFinanceiroPorTrade)),
    amostras: registros.length,
  }
}

// Posição em que `valor` entra num array já ordenado (busca binária).
const posicaoOrdenada = (ordenado, valor) => {
  let baixo = 0
  let alto = ordenado.length
  while (baixo < alto) {
    const meio = (baixo + alto) >> 1
    if (ordenado[meio] < valor) baixo = meio + 1
    else alto = meio
  }
  return baixo
}

const medianaOrdenada = (ordenado) => {
  const n = ordenado.length
  if (n === 0) return null
  const meio = Math.floor(n / 2)
  return n % 2 === 0 ? (ordenado[meio - 1] + ordenado[meio]) / 2 : ordenado[meio]
}

/**
 * Régua de normalidade candle a candle, medida só com o que já tinha acontecido.
 *
 * É a régua dos SINAIS. `calcularLimites` mede o período inteiro, e isso serve
 * para exibir ("atípico para este período" é uma afirmação legítima sobre o que
 * está na tela), mas não para sinal: no instante de um candle do começo da
 * janela, a mediana dos meses seguintes não existia. Um sinal classificado
 * contra ela carrega informação do futuro — e a simulação operava sobre ela.
 *
 * Medido sobre 180 dias reais, a régua do período inteiro mudava a classe de
 * até 3,5% dos candles, e em meses de regime diferente dobrava ou cortava pela
 * metade as ocorrências. O alfa simulado chegou a mudar 14 pontos.
 *
 * Cada posição devolve exatamente o que `calcularLimites` devolveria para os
 * últimos `janela` candles até ela, inclusive — o próprio candle entra, porque
 * no fechamento dele o volume e a variação já são conhecidos.
 *
 * @param {Array<object>} cronologico - Do mais antigo ao mais recente.
 * @param {number} [janela] - Quantos candles, contando o próprio.
 * @returns {Array<object|null>} - Uma régua por candle, no formato de
 *   `calcularLimites`; null onde a janela ainda é curta demais.
 */
export const calcularLimitesMoveis = (cronologico, janela = JANELA_LIMITES_MOVEIS) => {
  const lista = Array.isArray(cronologico) ? cronologico : []
  const variacoes = lista.map((r) => paraNumero(r?.precoPercentualVariacao))
  const volumes = lista.map((r) => paraNumero(r?.precoVolume))
  const tickets = lista.map((r) => paraNumero(r?.precoFinanceiroPorTrade))

  // Volume e ticket ficam num array ordenado que anda com a janela: entra o
  // candle novo, sai o que ficou para trás. Refazer a mediana do zero a cada
  // candle custava centenas de milissegundos numa série de 180 dias.
  const volumesOrdenados = []
  const ticketsOrdenados = []
  const entrar = (ordenado, v) => {
    if (v !== null) ordenado.splice(posicaoOrdenada(ordenado, v), 0, v)
  }
  const sair = (ordenado, v) => {
    if (v !== null) ordenado.splice(posicaoOrdenada(ordenado, v), 1)
  }

  return lista.map((_, i) => {
    entrar(volumesOrdenados, volumes[i])
    entrar(ticketsOrdenados, tickets[i])
    const saindo = i - janela
    if (saindo >= 0) {
      sair(volumesOrdenados, volumes[saindo])
      sair(ticketsOrdenados, tickets[saindo])
    }

    const inicio = Math.max(0, i - janela + 1)
    if (i - inicio + 1 < MIN_SAMPLES) return null

    // Média e desvio em duas passadas sobre a janela: a mesma conta do
    // `stdDev`, para que as duas réguas difiram só na janela, e nunca na
    // aritmética. Somas correntes sairiam mais baratas, mas somar e subtrair
    // ao longo de 4.000 candles acumula resíduo, e a equivalência com
    // `calcularLimites`, que o teste confere, deixaria de ser exata.
    let soma = 0
    let validos = 0
    for (let k = inicio; k <= i; k++) {
      if (variacoes[k] !== null) {
        soma += variacoes[k]
        validos++
      }
    }
    if (validos === 0) return null
    const media = soma / validos
    let quadrados = 0
    for (let k = inicio; k <= i; k++) {
      if (variacoes[k] !== null) quadrados += (variacoes[k] - media) ** 2
    }

    return {
      mediaVariacao: media,
      desvioVariacao: Math.sqrt(quadrados / validos),
      medianaVolume: medianaOrdenada(volumesOrdenados),
      medianaTicket: medianaOrdenada(ticketsOrdenados),
      amostras: i - inicio + 1,
    }
  })
}

/**
 * Classifica um candle contra a régua do período.
 *
 * @param {object} registro - Um registro da série.
 * @param {object|null} limites - Retorno de calcularLimites.
 * @returns {{
 *   variacao: boolean, volume: boolean,
 *   sigmas: number|null, razaoVolume: number|null
 * }|null} - null quando não há régua ou registro.
 */
export const avaliarAnomalia = (registro, limites) => {
  if (!registro || !limites) return null

  const { mediaVariacao, desvioVariacao, medianaVolume, medianaTicket } = limites

  const variacao = Number(registro.precoPercentualVariacao)
  // Desvio zero = período sem oscilação alguma; nada ali é atípico.
  const sigmas =
    Number.isFinite(variacao) && desvioVariacao > 0
      ? (variacao - mediaVariacao) / desvioVariacao
      : null

  const volume = Number(registro.precoVolume)
  const razaoVolume =
    Number.isFinite(volume) && medianaVolume > 0 ? volume / medianaVolume : null

  const ticket = Number(registro.precoFinanceiroPorTrade)
  const razaoTicket =
    Number.isFinite(ticket) && medianaTicket > 0 ? ticket / medianaTicket : null

  return {
    variacao: sigmas !== null && Math.abs(sigmas) > SIGMA_THRESHOLD,
    volume: razaoVolume !== null && razaoVolume > VOLUME_FACTOR,
    ticket: razaoTicket !== null && razaoTicket > TICKET_FACTOR,
    sigmas,
    razaoVolume,
    razaoTicket,
  }
}
