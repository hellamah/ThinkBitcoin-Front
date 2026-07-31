// Candlestick sem dependência nova.
//
// O chart.js não desenha candles nativamente e `chartjs-chart-financial` traria
// um pacote inteiro para um único gráfico. Como o backend já entrega OHLC pronto
// em cada registro (precoAbertura/Maior/Menor/Fechamento), o custo aqui é só
// desenhar retângulos e pavios no canvas que a linha já usava.

/**
 * Alinha o OHLC do histórico ao eixo de timestamps do gráfico.
 *
 * @param {Array<object>} historico - Registros de /moeda/{sigla}/valor.
 * @param {Array<string>} timestamps - Eixo do gráfico, em ordem cronológica.
 * @returns {Array<object|null>} Uma vela por posição do eixo; null onde não há
 *   registro completo, para o desenho simplesmente pular o ponto.
 */
export const construirVelas = (historico, timestamps) => {
  const porTimestamp = new Map()

  ;(historico || []).forEach((r) => {
    if (!r) return
    const dh = r.horaReferencia ?? r.dataHora
    if (!dh) return

    const abertura = Number(r.precoAbertura)
    const maior = Number(r.precoMaior)
    const menor = Number(r.precoMenor)
    const fechamento = Number(r.precoFechamento)

    // Uma vela incompleta desenharia um corpo ou pavio ancorado no zero.
    if (![abertura, maior, menor, fechamento].every(Number.isFinite)) return

    porTimestamp.set(dh, { abertura, maior, menor, fechamento })
  })

  return (timestamps || []).map((ts) => porTimestamp.get(ts) ?? null)
}

/**
 * Faixa vertical que comporta os pavios, com folga.
 *
 * O dataset da linha só carrega os fechamentos, então o eixo Y calculado pelo
 * chart.js cortaria máximas e mínimas.
 *
 * @param {Array<object|null>} velas
 * @returns {{min: number, max: number}|null}
 */
export const faixaDasVelas = (velas) => {
  let min = Infinity
  let max = -Infinity

  ;(velas || []).forEach((v) => {
    if (!v) return
    if (v.menor < min) min = v.menor
    if (v.maior > max) max = v.maior
  })

  if (!Number.isFinite(min) || !Number.isFinite(max)) return null

  // Série constante não tem amplitude para derivar folga; cai para 1% do valor.
  const folga = (max - min) * 0.05 || Math.abs(max) * 0.01 || 1
  return { min: min - folga, max: max + folga }
}

// Largura máxima do corpo, em px. Sem teto, poucos pontos no período viram
// blocos largos que parecem um gráfico de barras.
// Exportadas porque as barras da variação seguem exatamente a mesma medida: os
// dois painéis ficam lado a lado e qualquer divergência aqui salta aos olhos.
export const MAX_BODY_WIDTH = 18

// Fração do espaço entre pontos ocupada pelo corpo; o resto é respiro.
export const BODY_RATIO = 0.6

export const candlestickPlugin = {
  id: 'candlestick',

  // Cancela o desenho da linha e dos pontos: no modo vela o candle ocupa o
  // lugar deles. O dataset continua alimentando tooltip e eixos normalmente.
  beforeDatasetDraw(chart, args, opts) {
    if (!opts?.enabled) return undefined
    return false
  },

  afterDatasetsDraw(chart, args, opts) {
    if (!opts?.enabled) return

    const velas = opts.velas || []
    if (velas.length === 0) return

    const { ctx, chartArea, scales } = chart
    const escalaX = scales.x
    const escalaY = scales.y
    if (!escalaX || !escalaY || !chartArea) return

    const passo =
      velas.length > 1
        ? Math.abs(escalaX.getPixelForValue(1) - escalaX.getPixelForValue(0))
        : chartArea.right - chartArea.left
    const largura = Math.max(1, Math.min(passo * BODY_RATIO, MAX_BODY_WIDTH))

    ctx.save()
    // afterDatasetsDraw roda fora do clip do chart.js: sem isto, uma vela na
    // borda invade os eixos.
    ctx.beginPath()
    ctx.rect(
      chartArea.left,
      chartArea.top,
      chartArea.right - chartArea.left,
      chartArea.bottom - chartArea.top
    )
    ctx.clip()

    velas.forEach((vela, i) => {
      if (!vela) return

      const x = escalaX.getPixelForValue(i)
      const cor = vela.fechamento >= vela.abertura ? opts.corAlta : opts.corBaixa

      ctx.strokeStyle = cor
      ctx.fillStyle = cor

      // Pavio
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x, escalaY.getPixelForValue(vela.maior))
      ctx.lineTo(x, escalaY.getPixelForValue(vela.menor))
      ctx.stroke()

      // Corpo — altura mínima de 1px para o doji não sumir.
      const yAbertura = escalaY.getPixelForValue(vela.abertura)
      const yFechamento = escalaY.getPixelForValue(vela.fechamento)
      const topo = Math.min(yAbertura, yFechamento)
      const altura = Math.max(Math.abs(yFechamento - yAbertura), 1)

      ctx.fillRect(x - largura / 2, topo, largura, altura)
    })

    ctx.restore()
  },
}
