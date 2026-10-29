// Mapa de sensibilidade: a mesma entrada sob uma grade de stops e alvos.
//
// Ajustar stop e alvo campo a campo mostra um ponto por vez, e o ponto não diz
// se está num platô ou num pico. Um resultado que só existe em "stop 2%, alvo
// 3%" e some em 2,5% e em 3,5% não é uma regra — é o encaixe de uma combinação
// no passado. A grade mostra a vizinhança inteira de uma vez.
//
// **Só no trecho de AJUSTE, de propósito.** Mostrar a validação aqui daria ao
// usuário 36 combinações para escolher olhando o trecho reservado — e aí o
// trecho reservado deixaria de ser reservado. Escolhe-se no ajuste; a tabela de
// validação continua sendo o único lugar que julga.

import { simular } from './backtest'
import { StopMode } from './enums'

// Os eixos. null é "sem stop" / "sem alvo". Distâncias em %, espaçadas para
// cobrir de um stop apertado de candle horário (1%) a um de posição (8%) sem
// virar uma grade que ninguém consegue ler.
export const STOPS_MAPA = [null, 1, 2, 3, 5, 8]
export const ALVOS_MAPA = [null, 1, 2, 3, 5, 8]

/**
 * Alfa de cada combinação de stop e alvo, com o resto da regra fixo.
 *
 * O stop da grade é sempre FIXO: o stop por volatilidade não tem uma distância
 * única para pôr num eixo. Quem está no modo ATR vê a grade como referência, e
 * a tela declara isso.
 *
 * @param {Array<object>} registros - O trecho de ajuste.
 * @param {object} opcoes - Regra completa, como para `simular`.
 * @param {{stops?: Array<number|null>, alvos?: Array<number|null>}} [eixos]
 * @returns {{
 *   stops: Array<number|null>, alvos: Array<number|null>,
 *   celulas: Array<Array<{stop: number|null, alvo: number|null,
 *     alfa: number|null, operacoes: number|null}>>
 * }|null} - `celulas[i][j]` é o stop `i` com o alvo `j`. null quando nenhuma
 *   combinação opera.
 */
export const mapaDeSensibilidade = (
  registros,
  opcoes,
  { stops = STOPS_MAPA, alvos = ALVOS_MAPA } = {}
) => {
  if (!Array.isArray(registros) || registros.length < 2) return null

  let algumaOperou = false
  const celulas = stops.map((stop) =>
    alvos.map((alvo) => {
      const r = simular(registros, {
        ...opcoes,
        modoStop: StopMode.PERCENTUAL,
        stopPercentual: stop,
        alvoPercentual: alvo,
        enxuto: true,
      })
      // Sem regra de saída nenhuma (sem stop, sem alvo, sem tempo, sem sinal)
      // o motor recusa, e a célula fica vazia em vez de fingir um resultado.
      const operou = Boolean(r && r.totalTrades > 0)
      if (operou) algumaOperou = true
      return {
        stop,
        alvo,
        alfa: operou ? r.alfa : null,
        operacoes: r ? r.tradesConcluidos : null,
      }
    })
  )

  return algumaOperou ? { stops, alvos, celulas } : null
}

/**
 * Quantas vizinhas de uma célula têm alfa do mesmo sinal que ela.
 *
 * É a leitura de platô em uma frase: "7 das 8 vizinhas também superam o buy &
 * hold" descreve uma região; "1 de 8" descreve um ponto isolado.
 *
 * @param {object} mapa - Saída de `mapaDeSensibilidade`.
 * @param {number|null} stop
 * @param {number|null} alvo
 * @returns {{concordam: number, total: number}|null} - null quando a célula não
 *   está na grade ou não operou.
 */
export const vizinhancaDe = (mapa, stop, alvo) => {
  if (!mapa) return null
  const i = mapa.stops.indexOf(stop)
  const j = mapa.alvos.indexOf(alvo)
  if (i < 0 || j < 0) return null

  const centro = mapa.celulas[i][j].alfa
  if (centro === null) return null

  let total = 0
  let concordam = 0
  for (let di = -1; di <= 1; di++) {
    for (let dj = -1; dj <= 1; dj++) {
      if (di === 0 && dj === 0) continue
      const vizinha = mapa.celulas[i + di]?.[j + dj]
      if (!vizinha || vizinha.alfa === null) continue
      total++
      if (Math.sign(vizinha.alfa) === Math.sign(centro)) concordam++
    }
  }
  return { concordam, total }
}
