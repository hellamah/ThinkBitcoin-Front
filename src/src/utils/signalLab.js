// Laboratório de sinais: mede o que aconteceu DEPOIS de cada sinal.
//
// Detectar um martelo ou um volume atípico é trivia enquanto ninguém responde
// "e daí?". Aqui cada sinal é cruzado com o retorno dos candles seguintes.
//
// A leitura só existe contra a taxa base do próprio período: 68% de acerto não
// significa nada se o período inteiro fechou em alta 67% das vezes. Por isso
// todo resultado sai acompanhado do delta contra a base, que é o número que
// realmente importa.

import { avaliarAnomalia, calcularLimites } from './marketStats'
import { CandlePattern, classificarCandle } from './candlePatterns'

export const SignalKey = Object.freeze({
  VOLUME_ATIPICO: 'volumeAtipico',
  VARIACAO_ATIPICA: 'variacaoAtipica',
})

// Abaixo disso a taxa é anedota: com 3 ocorrências, uma a mais vira 33 pontos
// percentuais. A UI mostra a linha mesmo assim, marcada como pouco confiável,
// porque esconder o n seria pior do que exibi-lo.
export const MINIMO_OCORRENCIAS = 5

const fechamentoDe = (r) => {
  const v = Number(r?.precoFechamento)
  return Number.isFinite(v) && v > 0 ? v : null
}

const resumir = (retornos) => {
  if (retornos.length === 0) return null
  const positivos = retornos.filter((v) => v > 0).length
  const soma = retornos.reduce((a, b) => a + b, 0)
  return {
    ocorrencias: retornos.length,
    taxaAlta: (positivos / retornos.length) * 100,
    retornoMedio: soma / retornos.length,
  }
}

/**
 * Cruza cada sinal com o retorno dos candles seguintes.
 *
 * @param {Array<object>} registros - Série na ordem da API (mais recente
 *   primeiro, ordemAsc=false).
 * @param {{horizonte?: number}} opcoes - Quantos candles à frente medir.
 * @returns {{
 *   horizonte: number,
 *   base: {ocorrencias: number, taxaAlta: number, retornoMedio: number},
 *   sinais: Array<object>
 * }|null}
 */
export const analisarSinais = (registros, { horizonte = 1 } = {}) => {
  if (!Array.isArray(registros) || registros.length === 0) return null
  if (!Number.isInteger(horizonte) || horizonte < 1) return null

  // O desfecho é cronológico; a API entrega ao contrário.
  const cronologico = [...registros].reverse()
  const limites = calcularLimites(registros)

  const porSinal = new Map()
  const retornosBase = []

  // Os últimos `horizonte` candles não têm futuro dentro da janela carregada.
  // Ficam de fora do sinal E da base, senão a comparação deixa de ser
  // sobre o mesmo conjunto de instantes.
  for (let i = 0; i < cronologico.length - horizonte; i++) {
    const atual = fechamentoDe(cronologico[i])
    const futuro = fechamentoDe(cronologico[i + horizonte])
    if (atual === null || futuro === null) continue

    const retorno = ((futuro - atual) / atual) * 100
    retornosBase.push(retorno)

    const registro = cronologico[i]

    const padrao = classificarCandle(registro)
    // NEUTRO é a ausência de padrão; agrupá-lo produziria uma linha que é
    // quase a própria base e não ensina nada.
    if (padrao && padrao !== CandlePattern.NEUTRO) {
      if (!porSinal.has(padrao)) porSinal.set(padrao, [])
      porSinal.get(padrao).push(retorno)
    }

    const anomalia = avaliarAnomalia(registro, limites)
    if (anomalia?.volume) {
      if (!porSinal.has(SignalKey.VOLUME_ATIPICO)) porSinal.set(SignalKey.VOLUME_ATIPICO, [])
      porSinal.get(SignalKey.VOLUME_ATIPICO).push(retorno)
    }
    if (anomalia?.variacao) {
      if (!porSinal.has(SignalKey.VARIACAO_ATIPICA)) porSinal.set(SignalKey.VARIACAO_ATIPICA, [])
      porSinal.get(SignalKey.VARIACAO_ATIPICA).push(retorno)
    }
  }

  const base = resumir(retornosBase)
  if (!base) return null

  const sinais = [...porSinal.entries()]
    .map(([chave, retornos]) => {
      const r = resumir(retornos)
      return {
        chave,
        ...r,
        // O delta é a leitura útil: quanto o sinal desloca a probabilidade em
        // relação a não filtrar nada.
        deltaTaxa: r.taxaAlta - base.taxaAlta,
        deltaRetorno: r.retornoMedio - base.retornoMedio,
        confiavel: r.ocorrencias >= MINIMO_OCORRENCIAS,
      }
    })
    // Maior deslocamento absoluto primeiro: é o que merece o olho.
    .sort((a, b) => Math.abs(b.deltaTaxa) - Math.abs(a.deltaTaxa))

  return { horizonte, base, sinais }
}
