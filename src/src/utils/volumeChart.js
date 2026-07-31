// Barras de volume que acompanham o gráfico de candles.
//
// No modo candle o painel de baixo mostrava a variação percentual, que é o
// próprio corpo da vela redesenhado — (fechamento - abertura)/abertura. Volume
// é a dimensão que o candle não consegue mostrar: se o movimento teve
// participação ou foi de lado, com pouca gente negociando.

// Volume acima deste múltiplo da mediana ganha destaque. Mesmo critério do
// selo da tabela de histórico, em marketStats.
import { VOLUME_FACTOR } from './marketStats'
import { paraNumero } from './mathUtils'

/**
 * Alinha o volume do histórico ao eixo de timestamps do gráfico.
 *
 * @param {Array<object>} historico - Registros de /moeda/{sigla}/valor.
 * @param {Array<string>} timestamps - Eixo do gráfico, em ordem cronológica.
 * @returns {Array<number|null>} - Um volume por posição; null onde não há leitura.
 */
export const construirVolumes = (historico, timestamps) => {
  const porTimestamp = new Map()

  ;(historico || []).forEach((r) => {
    if (!r) return
    const dh = r.horaReferencia ?? r.dataHora
    if (!dh) return

    // Volume ausente vira barra vazia, não barra zerada: zero afirmaria que
    // não houve negociação naquele candle.
    const volume = paraNumero(r.precoVolume)
    if (volume === null) return

    porTimestamp.set(dh, volume)
  })

  return (timestamps || []).map((ts) => porTimestamp.get(ts) ?? null)
}

/**
 * Cor de cada barra: a direção vem da vela correspondente, para as duas
 * faixas contarem a mesma história na mesma coluna. Volume atípico ganha
 * contorno de destaque.
 *
 * @param {Array<number|null>} volumes
 * @param {Array<object|null>} velas - Saída de construirVelas, mesmo eixo.
 * @param {number|null} mediana - Mediana do volume no período.
 * @param {{corAlta: string, corBaixa: string, corDestaque: string}} cores
 * @returns {{fundo: string[], borda: string[], espessura: number[]}}
 */
export const estiloDasBarras = (volumes, velas, mediana, cores) => {
  const lista = volumes || []
  const limite = Number.isFinite(mediana) && mediana > 0 ? mediana * VOLUME_FACTOR : null

  const fundo = []
  const borda = []
  const espessura = []

  lista.forEach((v, i) => {
    const vela = velas?.[i]
    // Sem vela para consultar, a barra fica na cor de alta em vez de sumir:
    // a ausência de direção não significa queda.
    const cor = vela && vela.fechamento < vela.abertura ? cores.corBaixa : cores.corAlta
    fundo.push(cor)

    const atipico = limite !== null && Number.isFinite(v) && v > limite
    borda.push(atipico ? cores.corDestaque : 'transparent')
    espessura.push(atipico ? 2 : 0)
  })

  return { fundo, borda, espessura }
}
