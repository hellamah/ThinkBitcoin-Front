// Estatísticas de desempenho do período, derivadas do histórico já carregado.

import { mean, median, stdDev } from './mathUtils'

// Abaixo disso média e desvio não descrevem o período: com meia dúzia de
// candles qualquer leitura vira "atípica" e o alerta perde o sentido.
const MINIMO_AMOSTRAS = 8

// 2σ deixa ~5% dos candles marcados numa distribuição normal — raro o bastante
// para chamar atenção, frequente o bastante para aparecer num período típico.
const SIGMAS_VARIACAO = 2

// Volume é assimétrico e tem cauda longa, então a régua é multiplicativa sobre
// a mediana, não em desvios padrão.
export const FATOR_VOLUME = 3

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
  if (!Array.isArray(registros) || registros.length < MINIMO_AMOSTRAS) return null

  const variacoes = registros.map((r) => r?.precoPercentualVariacao)
  const mediaVariacao = mean(variacoes)
  const desvioVariacao = stdDev(variacoes)

  if (mediaVariacao === null || desvioVariacao === null) return null

  return {
    mediaVariacao,
    desvioVariacao,
    medianaVolume: median(registros.map((r) => r?.precoVolume)),
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

  const { mediaVariacao, desvioVariacao, medianaVolume } = limites

  const variacao = Number(registro.precoPercentualVariacao)
  // Desvio zero = período sem oscilação alguma; nada ali é atípico.
  const sigmas =
    Number.isFinite(variacao) && desvioVariacao > 0
      ? (variacao - mediaVariacao) / desvioVariacao
      : null

  const volume = Number(registro.precoVolume)
  const razaoVolume =
    Number.isFinite(volume) && medianaVolume > 0 ? volume / medianaVolume : null

  return {
    variacao: sigmas !== null && Math.abs(sigmas) > SIGMAS_VARIACAO,
    volume: razaoVolume !== null && razaoVolume > FATOR_VOLUME,
    sigmas,
    razaoVolume,
  }
}
