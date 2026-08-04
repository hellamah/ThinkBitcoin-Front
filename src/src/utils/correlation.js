// Correlação de Pearson entre séries de mercado.
//
// A correlação é calculada sobre as VARIAÇÕES percentuais, nunca sobre os
// preços. Preços de cripto sobem juntos por tendência de mercado, então
// correlacionar níveis devolve ~0,95 para qualquer par e não informa nada. A
// variação mede co-movimento real: é isso que diz se as moedas diversificam.

import { paraNumero } from './mathUtils'

// Abaixo disso o coeficiente é ruído — com dois ou três pontos |r| fica perto
// de 1 quase sempre, sem significar nada.
const MIN_PAIRS = 5

/**
 * Coeficiente de Pearson entre duas séries alinhadas no mesmo eixo de tempo.
 *
 * @param {Array<number|null>} x - Série alinhada; null onde não há leitura.
 * @param {Array<number|null>} y - Série alinhada de mesmo comprimento.
 * @returns {number|null} - r em [-1, 1]; null sem pares suficientes.
 */
export const pearson = (x, y) => {
  if (!Array.isArray(x) || !Array.isArray(y)) return null

  const n = Math.min(x.length, y.length)
  let pares = 0
  let somaX = 0
  let somaY = 0
  let somaXX = 0
  let somaYY = 0
  let somaXY = 0

  for (let i = 0; i < n; i++) {
    const a = paraNumero(x[i])
    const b = paraNumero(y[i])
    // Descarte par a par: um buraco em uma das moedas não invalida os demais
    // instantes, só aquele ponto.
    if (a === null || b === null) continue

    pares++
    somaX += a
    somaY += b
    somaXX += a * a
    somaYY += b * b
    somaXY += a * b
  }

  if (pares < MIN_PAIRS) return null

  const numerador = pares * somaXY - somaX * somaY
  const denominador = Math.sqrt(
    (pares * somaXX - somaX * somaX) * (pares * somaYY - somaY * somaY)
  )

  // Denominador zero = série constante: sem variância não existe correlação
  // definida, e devolver 0 sugeriria "independentes", o que é diferente.
  if (!Number.isFinite(denominador) || denominador === 0) return null

  // Arredondamento de ponto flutuante estoura [-1, 1] em séries quase idênticas.
  return Math.max(-1, Math.min(1, numerador / denominador))
}

/**
 * Matriz de correlação par a par.
 *
 * @param {Array<{sigla: string, valores: Array<number|null>}>} series
 * @returns {{siglas: string[], matriz: Array<Array<number|null>>}|null}
 *   null com menos de duas séries — uma moeda sozinha não tem com o que correlacionar.
 */
export const matrizCorrelacao = (series) => {
  if (!Array.isArray(series) || series.length < 2) return null

  const n = series.length
  const siglas = series.map((s) => s?.sigla ?? '')
  const matriz = Array.from({ length: n }, () => new Array(n).fill(null))

  for (let i = 0; i < n; i++) {
    matriz[i][i] = 1
    for (let j = i + 1; j < n; j++) {
      // Pearson é simétrico: calcula metade da matriz e espelha.
      const r = pearson(series[i]?.valores, series[j]?.valores)
      matriz[i][j] = r
      matriz[j][i] = r
    }
  }

  return { siglas, matriz }
}

/**
 * Cor de fundo da célula do heatmap.
 * Verde = sobem juntas, vermelho = movem-se em oposição, neutro = sem relação.
 * A opacidade acompanha |r| para a intensidade ser lida antes do número.
 *
 * @param {number|null} r - Coeficiente.
 * @returns {string} - Cor rgba pronta para uso inline.
 */
export const corDaCorrelacao = (r) => {
  if (r === null || !Number.isFinite(r)) return 'transparent'

  const intensidade = Math.min(Math.abs(r), 1) * 0.55
  return r >= 0
    ? `rgba(76, 175, 80, ${intensidade})`
    : `rgba(244, 67, 54, ${intensidade})`
}
