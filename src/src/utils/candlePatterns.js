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

export const CandlePattern = Object.freeze({
  MARTELO: 'martelo',
  ESTRELA: 'estrela',
  DOJI: 'doji',
  MARUBOZU: 'marubozu',
  NEUTRO: 'neutro',
})

// Corpo até 12% da amplitude: abertura e fechamento praticamente no mesmo
// lugar, o preço andou e voltou.
const LIMITE_DOJI = 0.12

// Corpo acima de 75% da amplitude: quase sem pavio, movimento sem disputa.
const LIMITE_MARUBOZU = 0.75

// Uma sombra precisa ser o dobro do corpo para caracterizar rejeição de preço.
const FATOR_SOMBRA = 2

const numero = (v) => {
  if (v === null || v === undefined || v === '') return NaN
  const n = Number(v)
  return Number.isFinite(n) ? n : NaN
}

/**
 * Classifica a geometria de um candle.
 *
 * @param {object} registro - Registro de /moeda/{sigla}/valor.
 * @returns {string|null} - Um valor de CandlePattern, ou null sem anatomia
 *   utilizável (amplitude zero não tem proporção definida).
 */
export const classificarCandle = (registro) => {
  if (!registro) return null

  const corpo = numero(registro.precoCorpoCandle)
  const superior = numero(registro.precoSombraSuperior)
  const inferior = numero(registro.precoSombraInferior)
  const amplitude = numero(registro.precoAmplitude)

  if ([corpo, superior, inferior].some(Number.isNaN)) return null
  // Sem amplitude não há proporção: dividir daria Infinity e classificaria
  // qualquer coisa como marubozu.
  if (Number.isNaN(amplitude) || amplitude <= 0) return null

  const proporcaoCorpo = corpo / amplitude

  // Sombra dominante vem antes de doji: a assimetria diz para que lado o preço
  // foi rejeitado, o que informa mais do que só "o corpo é pequeno".
  if (inferior >= corpo * FATOR_SOMBRA && inferior > superior) {
    return CandlePattern.MARTELO
  }
  if (superior >= corpo * FATOR_SOMBRA && superior > inferior) {
    return CandlePattern.ESTRELA
  }

  if (proporcaoCorpo <= LIMITE_DOJI) return CandlePattern.DOJI
  if (proporcaoCorpo >= LIMITE_MARUBOZU) return CandlePattern.MARUBOZU

  return CandlePattern.NEUTRO
}
