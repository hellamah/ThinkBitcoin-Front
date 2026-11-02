// Os dois plugins dos gráficos do Robô ao vivo, passados por gráfico (prop `plugins`
// do react-chartjs-2): nada aqui vaza para os outros gráficos do site.

/** A linha vertical que acompanha o ponteiro: quem lê mira uma data, e não uma linha de 2px. */
export const miraVertical = {
  id: 'miraVertical',
  afterDatasetsDraw(chart, _args, opcoes) {
    const ativo = chart.tooltip?.getActiveElements?.()?.[0]
    if (!ativo) return
    const { ctx, chartArea } = chart
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(ativo.element.x, chartArea.top)
    ctx.lineTo(ativo.element.x, chartArea.bottom)
    ctx.lineWidth = 1
    ctx.strokeStyle = opcoes.cor
    ctx.stroke()
    ctx.restore()
  },
}

/**
 * O rótulo direto no fim de uma série (`rotuloFinal` no conjunto de dados), em cor de
 * texto e sobre a cor da superfície, para continuar legível ao cruzar a linha do preço.
 * `rotuloAcima` escolhe o lado: quem chama põe os dois rótulos em lados opostos da
 * distância entre eles, e assim eles não se encontram.
 */
export const rotulosFinais = {
  id: 'rotulosFinais',
  afterDatasetsDraw(chart, _args, opcoes) {
    const { ctx, chartArea } = chart
    chart.data.datasets.forEach((conjunto, indice) => {
      if (!conjunto.rotuloFinal || !chart.isDatasetVisible(indice)) return
      const ponto = chart.getDatasetMeta(indice).data.at(-1)
      if (!ponto) return
      const altura = 16
      const folga = 4
      ctx.save()
      ctx.font = "12px 'Share Tech Mono', monospace"
      const largura = ctx.measureText(conjunto.rotuloFinal).width + folga * 2
      const direita = Math.min(ponto.x, chartArea.right)
      const topo = conjunto.rotuloAcima ? ponto.y - 8 - altura : ponto.y + 8
      ctx.fillStyle = opcoes.fundo
      ctx.fillRect(direita - largura, topo, largura, altura)
      ctx.fillStyle = opcoes.cor
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      ctx.fillText(conjunto.rotuloFinal, direita - folga, topo + altura / 2)
      ctx.restore()
    })
  },
}
