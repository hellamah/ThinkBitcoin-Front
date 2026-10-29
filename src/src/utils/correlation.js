// Correlação de Pearson entre séries de mercado.
//
// A correlação é calculada sobre as VARIAÇÕES percentuais, nunca sobre os
// preços. Preços de cripto sobem juntos por tendência de mercado, então
// correlacionar níveis devolve ~0,95 para qualquer par e não informa nada. A
// variação mede co-movimento real: é isso que diz se as moedas diversificam.

import { paraNumero } from './mathUtils'

// Abaixo disso o coeficiente é ruído — com dois ou três pontos |r| fica perto
// de 1 quase sempre, sem significar nada.
export const MIN_PAIRS = 5

// z de 1,96 corresponde a 95% de confiança na normal padrão.
const Z_95 = 1.96

/**
 * |r| mínimo para o coeficiente se distinguir de zero, a 95% de confiança.
 *
 * O coeficiente sozinho não diz se a relação existe: r = 0,10 sobre 168 pontos
 * e r = 0,10 sobre 8 querem dizer coisas diferentes, e a matriz pintava os dois
 * do mesmo verde. Este limiar é a régua que faltava.
 *
 * Usa a transformação z de Fisher — `atanh(r)` é aproximadamente normal com
 * desvio `1/√(n−3)` — em vez do teste t. Dá o mesmo resultado nas faixas que
 * importam aqui (n = 168 → 0,151 pelos dois caminhos; n = 5 → 0,88 contra
 * 0,878) e cabe numa linha, sem precisar de uma tabela de t invertida.
 *
 * @param {number} pares - Quantos pontos sustentaram o coeficiente.
 * @returns {number} - |r| mínimo. 1 quando não há amostra que sustente nada.
 */
export const limiarDeSignificancia = (pares) => {
  if (!Number.isFinite(pares) || pares <= 3) return 1
  return Math.tanh(Z_95 / Math.sqrt(pares - 3))
}

/**
 * Coeficiente de Pearson entre duas séries alinhadas no mesmo eixo de tempo.
 *
 * @param {Array<number|null>} x - Série alinhada; null onde não há leitura.
 * @param {Array<number|null>} y - Série alinhada de mesmo comprimento.
 * @returns {number|null} - r em [-1, 1]; null sem pares suficientes.
 */
export const pearson = (x, y) => correlacaoComPares(x, y)?.r ?? null

/**
 * Como `pearson`, mas devolve também o tamanho da amostra que sustentou o
 * coeficiente — o número que decide se ele significa alguma coisa.
 *
 * Existe separado porque o descarte é par a par: numa matriz, cada célula pode
 * repousar sobre uma quantidade de pontos diferente das vizinhas, e nenhuma
 * delas é o comprimento das séries.
 *
 * @param {Array<number|null>} x
 * @param {Array<number|null>} y
 * @returns {{r: number, pares: number}|null}
 */
export const correlacaoComPares = (x, y) => {
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

  return {
    // Arredondamento de ponto flutuante estoura [-1, 1] em séries quase idênticas.
    r: Math.max(-1, Math.min(1, numerador / denominador)),
    pares,
  }
}

/**
 * Matriz de correlação par a par.
 *
 * Cada célula carrega o coeficiente, o tamanho da amostra que o sustentou e se
 * ele se distingue de zero. Os três andam juntos de propósito: o coeficiente
 * sozinho é o que fazia a tela pintar ruído de verde.
 *
 * @param {Array<{sigla: string, valores: Array<number|null>}>} series
 * @returns {{
 *   siglas: string[],
 *   matriz: Array<Array<{r: number, pares: number|null, significante: boolean}|null>>
 * }|null} null com menos de duas séries — uma moeda sozinha não tem com o que
 *   correlacionar.
 */
export const matrizCorrelacao = (series) => {
  if (!Array.isArray(series) || series.length < 2) return null

  const n = series.length
  const siglas = series.map((s) => s?.sigla ?? '')
  const matriz = Array.from({ length: n }, () => new Array(n).fill(null))

  for (let i = 0; i < n; i++) {
    // A diagonal é 1 por definição e não repousa sobre amostra nenhuma: ela
    // ancora a grade, não informa. Daí `pares` null.
    matriz[i][i] = { r: 1, pares: null, significante: true }

    for (let j = i + 1; j < n; j++) {
      // Pearson é simétrico: calcula metade da matriz e espelha.
      const par = correlacaoComPares(series[i]?.valores, series[j]?.valores)
      const celula = par && {
        ...par,
        significante: Math.abs(par.r) > limiarDeSignificancia(par.pares),
      }
      matriz[i][j] = celula
      matriz[j][i] = celula
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
