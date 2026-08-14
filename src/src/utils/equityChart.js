// Curva de capital da simulação.
//
// A curva sai marcada a mercado, um ponto por candle, e não um degrau por
// trade: o que interessa nela é justamente o que acontece ENTRE as operações —
// quanto a posição chegou a perder antes de virar, que é o que o drawdown mede.
// Uma linha que só se move no fechamento de cada trade desenharia uma escada
// suave sobre um percurso acidentado.
//
// O segmento em que havia posição aberta é destacado. Sem isso, a curva plana
// de quem ficou de fora e a curva plana de quem estava dentro e não andou ficam
// visualmente idênticas, e a exposição — que é metade da leitura — some.

import { paraNumero } from './mathUtils'

/**
 * Pontos da curva prontos para o Chart.js.
 *
 * @param {Array<{instante: string|null, capital: number, emPosicao: boolean}>} curva
 * @param {number} capitalInicial - Referência do eixo: é a linha do "não fiz nada".
 * @returns {{
 *   rotulos: Array<string|null>,
 *   capital: Array<number|null>,
 *   emPosicao: Array<number|null>,
 *   minimo: number, maximo: number
 * }|null} - null sem curva utilizável.
 */
export const montarPontosDaCurva = (curva, capitalInicial) => {
  if (!Array.isArray(curva) || curva.length === 0) return null

  const rotulos = []
  const capital = []
  // Série paralela que só existe onde havia posição. `null` interrompe a linha
  // no Chart.js, então os trechos sem posição não são ligados por engano.
  const emPosicao = []

  curva.forEach((ponto) => {
    const v = paraNumero(ponto?.capital)
    rotulos.push(ponto?.instante ?? null)
    capital.push(v)
    emPosicao.push(ponto?.emPosicao ? v : null)
  })

  const validos = capital.filter((v) => v !== null)
  if (validos.length === 0) return null

  // O capital inicial entra nos limites mesmo quando a curva nunca o toca: sem
  // ele, uma estratégia que só perdeu desenharia uma linha descendente sem
  // referência de onde ela começou.
  const referencia = paraNumero(capitalInicial)
  const candidatos = referencia !== null ? [...validos, referencia] : validos

  return {
    rotulos,
    capital,
    emPosicao,
    minimo: Math.min(...candidatos),
    maximo: Math.max(...candidatos),
  }
}

/**
 * Folga vertical do eixo, em fração da amplitude.
 *
 * Amplitude zero — estratégia que não abriu nenhuma operação — receberia folga
 * zero e o Chart.js desenharia a linha colada na borda. Nesse caso a folga sai
 * do próprio valor.
 */
export const folgaDoEixo = (minimo, maximo, fracao = 0.08) => {
  const amplitude = maximo - minimo
  if (amplitude > 0) return amplitude * fracao
  return Math.abs(maximo) * fracao || 1
}
