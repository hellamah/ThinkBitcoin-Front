// Estatísticas de desempenho do período, derivadas do histórico já carregado.

/**
 * Consolida o desempenho de uma série de candles.
 *
 * @param {Array<object>} registros - Registros de /moeda/{sigla}/valor, na
 *   ordem em que a API entrega (ordemAsc=false: do mais recente ao mais antigo).
 * @returns {{
 *   retorno: number, drawdown: number, winRate: number,
 *   melhor: number, pior: number, amostras: number
 * }|null} Percentuais; null se não houver fechamento válido.
 */
export const calcularDesempenho = (registros) => {
  if (!Array.isArray(registros) || registros.length === 0) return null

  // O cálculo é cronológico; a API entrega ao contrário.
  const cronologico = [...registros].reverse()

  const fechamentos = cronologico
    .map((r) => Number(r?.precoFechamento))
    .filter((v) => Number.isFinite(v) && v > 0)

  if (fechamentos.length === 0) return null

  const primeiro = fechamentos[0]
  const ultimo = fechamentos[fechamentos.length - 1]
  const retorno = ((ultimo - primeiro) / primeiro) * 100

  // Maior queda a partir de um pico — o que o usuário teria visto de perda
  // máxima se tivesse entrado no pior momento do período.
  let pico = fechamentos[0]
  let drawdown = 0
  fechamentos.forEach((v) => {
    if (v > pico) pico = v
    const queda = ((v - pico) / pico) * 100
    if (queda < drawdown) drawdown = queda
  })

  const variacoes = cronologico
    .map((r) => Number(r?.precoPercentualVariacao))
    .filter((v) => Number.isFinite(v))

  const positivas = variacoes.filter((v) => v > 0).length

  return {
    retorno,
    drawdown,
    winRate: variacoes.length > 0 ? (positivas / variacoes.length) * 100 : 0,
    melhor: variacoes.length > 0 ? Math.max(...variacoes) : 0,
    pior: variacoes.length > 0 ? Math.min(...variacoes) : 0,
    amostras: fechamentos.length,
  }
}
