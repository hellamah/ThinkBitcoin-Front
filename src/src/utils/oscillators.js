// Osciladores clássicos: RSI e Bandas de Bollinger.
//
// Entram na plataforma para serem MEDIDOS, não para serem seguidos. São os
// dois indicadores mais usados do mercado e estão entre os de evidência mais
// fraca; se o desfecho medido contra a taxa base der zero, isso precisa
// aparecer na tela em vez de ficar subentendido.
//
// Os períodos são os padrões da literatura (14 e 20). Encurtá-los para caber
// em janelas curtas faria "RSI 70" significar aqui algo diferente do que
// significa em qualquer outra ferramenta, o que é pior do que não calcular.
// Sem histórico suficiente, a saída é null e a tela diz isso.

import { mean, paraNumero, stdDev } from './mathUtils'

export const OscillatorSignal = Object.freeze({
  RSI_OVERBOUGHT: 'rsiSobrecompra',
  RSI_OVERSOLD: 'rsiSobrevenda',
  BAND_BREAK_UP: 'rompeuBandaSuperior',
  BAND_BREAK_DOWN: 'rompeuBandaInferior',
})

export const RSI_PERIOD = 14
export const RSI_OVERBOUGHT = 70
export const RSI_OVERSOLD = 30

export const BAND_PERIOD = 20
const BAND_DEVIATIONS = 2

const fechamentos = (cronologico) =>
  (cronologico || []).map((r) => paraNumero(r?.precoFechamento))

/**
 * RSI com suavização de Wilder, que é a formulação original.
 *
 * @param {Array<object>} cronologico - Do mais antigo ao mais recente.
 * @param {number} periodo
 * @returns {Array<number|null>} - null nas posições sem histórico suficiente.
 */
export const calcularRsi = (cronologico, periodo = RSI_PERIOD) => {
  const precos = fechamentos(cronologico)
  const saida = new Array(precos.length).fill(null)
  if (precos.length <= periodo) return saida

  const ganhos = []
  const perdas = []
  for (let i = 1; i < precos.length; i++) {
    const atual = precos[i]
    const anterior = precos[i - 1]
    // Buraco na série quebraria a suavização, que é recursiva: trata como
    // candle sem movimento em vez de propagar NaN pelo resto da série.
    if (atual === null || anterior === null) {
      ganhos.push(0)
      perdas.push(0)
      continue
    }
    const delta = atual - anterior
    ganhos.push(delta > 0 ? delta : 0)
    perdas.push(delta < 0 ? -delta : 0)
  }

  // A primeira média é simples; a partir daí, suavizada.
  let mediaGanho = mean(ganhos.slice(0, periodo)) ?? 0
  let mediaPerda = mean(perdas.slice(0, periodo)) ?? 0

  const rsiDe = (g, p) => {
    // Sem perda alguma no período a força relativa é infinita; por convenção
    // o índice satura em 100.
    if (p === 0) return g === 0 ? 50 : 100
    const rs = g / p
    return 100 - 100 / (1 + rs)
  }

  saida[periodo] = rsiDe(mediaGanho, mediaPerda)

  for (let i = periodo + 1; i < precos.length; i++) {
    const g = ganhos[i - 1]
    const p = perdas[i - 1]
    mediaGanho = (mediaGanho * (periodo - 1) + g) / periodo
    mediaPerda = (mediaPerda * (periodo - 1) + p) / periodo
    saida[i] = rsiDe(mediaGanho, mediaPerda)
  }

  return saida
}

/**
 * Bandas de Bollinger: média móvel ± k desvios padrão.
 *
 * @param {Array<object>} cronologico
 * @param {number} periodo
 * @param {number} desvios
 * @returns {Array<{media: number, superior: number, inferior: number}|null>}
 */
export const calcularBollinger = (
  cronologico,
  periodo = BAND_PERIOD,
  desvios = BAND_DEVIATIONS
) => {
  const precos = fechamentos(cronologico)
  const saida = new Array(precos.length).fill(null)

  for (let i = periodo - 1; i < precos.length; i++) {
    const janela = precos.slice(i - periodo + 1, i + 1)
    const media = mean(janela)
    const desvio = stdDev(janela)
    if (media === null || desvio === null) continue

    saida[i] = {
      media,
      superior: media + desvios * desvio,
      inferior: media - desvios * desvio,
    }
  }

  return saida
}

/**
 * Marca os candles em que o RSI ATRAVESSOU um dos limiares.
 *
 * O nível é estado — um ativo pode ficar sobrecomprado por semanas, e marcar
 * todos esses candles produziria uma linha quase igual à taxa base. A entrada
 * na zona é o evento.
 *
 * @param {Array<number|null>} rsi
 * @returns {Array<string|null>}
 */
export const detectarExtremosRsi = (rsi) => {
  const lista = rsi || []
  const marcas = new Array(lista.length).fill(null)

  for (let i = 1; i < lista.length; i++) {
    const atual = lista[i]
    const anterior = lista[i - 1]
    if (atual === null || anterior === null) continue

    if (anterior <= RSI_OVERBOUGHT && atual > RSI_OVERBOUGHT) {
      marcas[i] = OscillatorSignal.RSI_OVERBOUGHT
    } else if (anterior >= RSI_OVERSOLD && atual < RSI_OVERSOLD) {
      marcas[i] = OscillatorSignal.RSI_OVERSOLD
    }
  }

  return marcas
}

/**
 * Marca os candles que fecharam fora das bandas vindos de dentro.
 *
 * @param {Array<object>} cronologico
 * @param {Array<object|null>} bandas - Saída de calcularBollinger.
 * @returns {Array<string|null>}
 */
export const detectarRompimentos = (cronologico, bandas) => {
  const precos = fechamentos(cronologico)
  const marcas = new Array(precos.length).fill(null)

  const foraPara = (i) => {
    const b = bandas?.[i]
    const p = precos[i]
    if (!b || p === null) return null
    if (p > b.superior) return 'cima'
    if (p < b.inferior) return 'baixo'
    return 'dentro'
  }

  for (let i = 1; i < precos.length; i++) {
    const atual = foraPara(i)
    const anterior = foraPara(i - 1)
    if (atual === null || anterior === null) continue

    // Só o rompimento conta; permanecer fora da banda não é evento novo.
    if (atual === 'cima' && anterior !== 'cima') marcas[i] = OscillatorSignal.BAND_BREAK_UP
    else if (atual === 'baixo' && anterior !== 'baixo') marcas[i] = OscillatorSignal.BAND_BREAK_DOWN
  }

  return marcas
}

/**
 * Estado dos osciladores para exibição e para o laboratório.
 *
 * @param {Array<object>} registros - Série na ordem da API (mais recente primeiro).
 * @returns {{rsiAtual: number|null, bandaAtual: object|null,
 *   marcas: Array<string|null>, historicoSuficiente: boolean}|null}
 */
export const resumirOsciladores = (registros) => {
  if (!Array.isArray(registros) || registros.length === 0) return null

  const cronologico = [...registros].reverse()
  const rsi = calcularRsi(cronologico)
  const bandas = calcularBollinger(cronologico)

  const extremos = detectarExtremosRsi(rsi)
  const rompimentos = detectarRompimentos(cronologico, bandas)

  // Um candle pode disparar os dois; o laboratório mede cada sinal por si,
  // então a lista guarda ambos por posição.
  const marcas = cronologico.map((_, i) => [extremos[i], rompimentos[i]].filter(Boolean))

  return {
    rsiAtual: rsi[rsi.length - 1] ?? null,
    bandaAtual: bandas[bandas.length - 1] ?? null,
    marcas,
    historicoSuficiente: cronologico.length > RSI_PERIOD,
  }
}
