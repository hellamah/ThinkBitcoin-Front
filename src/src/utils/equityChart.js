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
//
// E a curva sai acompanhada do BUY & HOLD, no mesmo eixo. Os cards do painel já
// colocam a régua ao lado do retorno, pelo argumento de que "+12%" não significa
// nada sem saber que segurar rendeu 15%. O gráfico é o elemento maior e o mais
// olhado dos dois, e desenhar só a estratégia ali desfaz no desenho o que os
// números fazem questão de dizer. Lado a lado as duas linhas respondem uma coisa
// que o par de percentuais não responde: PERDEU O CAMINHO TODO, ou ganhou até o
// fim e devolveu no último mês?

import { paraNumero } from './mathUtils'

/**
 * Pontos da curva prontos para o Chart.js.
 *
 * @param {Array<{
 *   instante: string|null, capital: number, emPosicao: boolean,
 *   precoFechamento: number|null
 * }>} curva
 * @param {number} capitalInicial - Referência do eixo: é a linha do "não fiz nada".
 * @returns {{
 *   rotulos: Array<string|null>,
 *   capital: Array<number|null>,
 *   emPosicao: Array<number|null>,
 *   buyAndHold: Array<number|null>,
 *   minimo: number, maximo: number
 * }|null} - null sem curva utilizável. `buyAndHold` sai todo null quando a
 *   curva não traz preço — o gráfico simplesmente não desenha a régua.
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

  // Buy & hold em unidades de CAPITAL, não em percentual: é o que permite as
  // duas linhas dividirem o mesmo eixo. O preço-base é o primeiro fechamento da
  // curva, que é o mesmo instante em que o capital ainda vale o inicial — as
  // duas partem juntas, então o que a distância entre elas mostra é diferença
  // de desempenho, não de escala.
  //
  // É também o mesmo primeiro preço que `calcularMetricas` usa para o
  // `buyAndHold` do card. Se as duas leituras divergissem, a tela estaria
  // discutindo consigo mesma sobre o mesmo número.
  const precoBase = curva.reduce((achado, ponto) => {
    if (achado !== null) return achado
    const p = paraNumero(ponto?.precoFechamento)
    return p !== null && p > 0 ? p : null
  }, null)

  const buyAndHold = curva.map((ponto) => {
    if (precoBase === null || referencia === null) return null
    const p = paraNumero(ponto?.precoFechamento)
    return p !== null && p > 0 ? referencia * (p / precoBase) : null
  })

  const candidatos = [
    ...validos,
    ...(referencia !== null ? [referencia] : []),
    // A régua entra nos limites: fora deles, uma alta forte do ativo sairia
    // cortada pelo topo do gráfico e a estratégia pareceria acompanhá-la.
    ...buyAndHold.filter((v) => v !== null),
  ]

  return {
    rotulos,
    capital,
    emPosicao,
    buyAndHold,
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
