// Classificação de padrões de candle.
//
// O backend já entrega a anatomia pronta em precoCorpoCandle,
// precoSombraSuperior e precoSombraInferior — campos que a tela recebia em
// toda requisição e descartava. Aqui não há geometria nova, só leitura de
// proporções entre o que já veio.
//
// Ressalva importante: padrão de candle isolado não é sinal de entrada. Martelo
// só tem significado depois de uma queda, estrela cadente depois de uma alta.
// A classificação aqui é puramente geométrica; quem dá sentido a ela é o
// desfecho medido em signalLab.js, que é o ponto do laboratório.

import { paraNumero } from './mathUtils'

export const CandlePattern = Object.freeze({
  MARTELO: 'martelo',
  ESTRELA: 'estrela',
  DOJI: 'doji',
  MARUBOZU: 'marubozu',
  NEUTRO: 'neutro',
})

// Corpo até 12% da amplitude: abertura e fechamento praticamente no mesmo
// lugar, o preço andou e voltou.
const DOJI_LIMIT = 0.12

// Corpo acima de 75% da amplitude: quase sem pavio, movimento sem disputa.
const MARUBOZU_LIMIT = 0.75

// Uma sombra precisa ser o dobro do corpo para caracterizar rejeição de preço.
const SHADOW_FACTOR = 2

/**
 * Classifica a geometria de um candle.
 *
 * @param {object} registro - Registro de /moeda/{sigla}/valor.
 * @returns {string|null} - Um valor de CandlePattern, ou null sem anatomia
 *   utilizável (amplitude zero não tem proporção definida).
 */
export const classificarCandle = (registro) => {
  if (!registro) return null

  const corpo = paraNumero(registro.precoCorpoCandle)
  const superior = paraNumero(registro.precoSombraSuperior)
  const inferior = paraNumero(registro.precoSombraInferior)
  const amplitude = paraNumero(registro.precoAmplitude)

  if ([corpo, superior, inferior].some((v) => v === null)) return null
  // Sem amplitude não há proporção: dividir daria Infinity e classificaria
  // qualquer coisa como marubozu.
  if (amplitude === null || amplitude <= 0) return null

  const proporcaoCorpo = corpo / amplitude

  // Sombra dominante vem antes de doji: a assimetria diz para que lado o preço
  // foi rejeitado, o que informa mais do que só "o corpo é pequeno".
  if (inferior >= corpo * SHADOW_FACTOR && inferior > superior) {
    return CandlePattern.MARTELO
  }
  if (superior >= corpo * SHADOW_FACTOR && superior > inferior) {
    return CandlePattern.ESTRELA
  }

  if (proporcaoCorpo <= DOJI_LIMIT) return CandlePattern.DOJI
  if (proporcaoCorpo >= MARUBOZU_LIMIT) return CandlePattern.MARUBOZU

  return CandlePattern.NEUTRO
}
