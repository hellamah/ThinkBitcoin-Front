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

/**
 * Consolida o desempenho de uma série de candles.
 *
 * @param {Array<object>} registros - Registros de /moeda/{sigla}/valor, na
 *   ordem em que a API entrega (ordemAsc=false: do mais recente ao mais antigo).
 * @returns {{
 *   retorno: number, drawdown: number, winRate: number,
 *   melhor: number, pior: number, amostras: number
 * }|null} Percentuais; null se não houver fechamento válido.
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

  return {
    retorno,
    drawdown,
    winRate: variacoes.length > 0 ? (positivas / variacoes.length) * 100 : 0,
    melhor: variacoes.length > 0 ? Math.max(...variacoes) : 0,
    pior: variacoes.length > 0 ? Math.min(...variacoes) : 0,
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
 * Régua de normalidade do período, usada para marcar candles atípicos.
 *
 * Calculada sobre a série inteira da moeda, não sobre a página exibida: o que
 * define "fora do normal" é o período, e uma página de 20 linhas produziria
 * limites diferentes a cada navegação.
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
