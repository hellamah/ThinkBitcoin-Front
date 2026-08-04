// VWAP — preço médio ponderado por volume.
//
// É o benchmark que mesa institucional usa para avaliar execução: comprou
// abaixo do VWAP do dia, comprou bem. Sai de dois campos que a resposta já
// traz e a tela ignorava — precoTotalNegociada (nocional em dólar) e
// precoVolume.
//
// O VWAP aqui é ACUMULADO a partir do início da janela carregada, que é como
// se plota na prática. A média de VWAPs por candle seria outra coisa: daria
// peso igual a uma hora de 200 trades e a uma de 20.000.

import { paraNumero } from './mathUtils'

export const VwapSignal = Object.freeze({
  CROSS_UP: 'vwapCruzamentoAlta',
  CROSS_DOWN: 'vwapCruzamentoBaixa',
})

/**
 * VWAP acumulado em cada posição da série.
 *
 * @param {Array<object>} cronologico - Do mais antigo ao mais recente.
 * @returns {Array<number|null>} - null enquanto não houver volume acumulado.
 */
export const calcularVwap = (cronologico) => {
  let nocional = 0
  let volume = 0

  return (cronologico || []).map((r) => {
    const v = paraNumero(r?.precoVolume)
    const n = paraNumero(r?.precoTotalNegociada)

    // Os dois têm de existir: somar nocional sem o volume correspondente
    // (ou o contrário) desloca a média para sempre, porque é acumulada.
    if (v !== null && n !== null && v > 0) {
      volume += v
      nocional += n
    }

    return volume > 0 ? nocional / volume : null
  })
}

/**
 * Distância percentual entre o fechamento e o VWAP em cada posição.
 *
 * @param {Array<object>} cronologico
 * @param {Array<number|null>} vwap - Saída de calcularVwap, mesmo eixo.
 * @returns {Array<number|null>}
 */
export const desvioDoVwap = (cronologico, vwap) =>
  (cronologico || []).map((r, i) => {
    const fechamento = paraNumero(r?.precoFechamento)
    const referencia = vwap?.[i]
    if (fechamento === null || !Number.isFinite(referencia) || referencia <= 0) return null
    return ((fechamento - referencia) / referencia) * 100
  })

/**
 * Marca os candles em que o preço atravessou o VWAP.
 *
 * O lado em que o preço está é estado, não evento: quase todo candle está de
 * um lado ou do outro, então medir isso devolveria algo próximo da taxa base.
 * A travessia é que é o acontecimento.
 *
 * @param {Array<number|null>} desvios - Saída de desvioDoVwap.
 * @returns {Array<string|null>} - VwapSignal onde houve cruzamento.
 */
export const detectarCruzamentos = (desvios) => {
  const lista = desvios || []
  const marcas = new Array(lista.length).fill(null)

  for (let i = 1; i < lista.length; i++) {
    const atual = lista[i]
    const anterior = lista[i - 1]
    if (atual === null || anterior === null) continue

    // Zero exato conta como "não acima"; a travessia precisa ultrapassar.
    if (anterior <= 0 && atual > 0) marcas[i] = VwapSignal.CROSS_UP
    else if (anterior >= 0 && atual < 0) marcas[i] = VwapSignal.CROSS_DOWN
  }

  return marcas
}

/**
 * Estado do VWAP para exibição.
 *
 * @param {Array<object>} registros - Série na ordem da API (mais recente primeiro).
 * @returns {{vwapAtual: number|null, desvioAtual: number|null, acima: boolean,
 *   serie: Array<number|null>, cruzamentos: Array<string|null>}|null}
 */
export const resumirVwap = (registros) => {
  if (!Array.isArray(registros) || registros.length === 0) return null

  const cronologico = [...registros].reverse()
  const serie = calcularVwap(cronologico)
  const desvios = desvioDoVwap(cronologico, serie)
  const desvioAtual = desvios[desvios.length - 1] ?? null

  return {
    vwapAtual: serie[serie.length - 1] ?? null,
    desvioAtual,
    acima: desvioAtual !== null && desvioAtual > 0,
    serie,
    cruzamentos: detectarCruzamentos(desvios),
  }
}
