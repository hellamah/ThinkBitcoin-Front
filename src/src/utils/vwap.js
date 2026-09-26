// VWAP — preço médio ponderado por volume.
//
// É o benchmark que mesa institucional usa para avaliar execução: comprou
// abaixo do VWAP do dia, comprou bem. Sai de dois campos que a resposta já
// traz e a tela ignorava — precoTotalNegociada (nocional em dólar) e
// precoVolume.
//
// São dois VWAPs, para duas perguntas:
//
// - O da EXIBIÇÃO é ACUMULADO a partir do início da janela carregada, que é
//   como se plota na prática: "o preço está acima do médio do período?".
// - O do SINAL é MÓVEL, das últimas 24 horas. O cruzamento usava o acumulado,
//   e numa janela de 180 dias isso quer dizer uma média que começa com três
//   dias e termina com seis meses. Medido em dado real: o BTC cruzou o VWAP
//   acumulado 8 vezes em abril e 3 de junho a setembro, todas em agosto — o
//   sinal quase só existia nos primeiros dois meses da simulação, e nunca no
//   trecho de validação. Com a média das últimas 24 horas são 60 a 90 por
//   mês, e o sinal quer dizer a mesma coisa no começo e no fim da janela.
//
// Nos dois, a média é ponderada pelo volume de cada candle. A média de VWAPs
// por candle seria outra coisa: daria peso igual a uma hora de 200 trades e a
// uma de 20.000.

import { paraNumero } from './mathUtils'

export const VwapSignal = Object.freeze({
  CROSS_UP: 'vwapCruzamentoAlta',
  CROSS_DOWN: 'vwapCruzamentoBaixa',
})

// Candles do VWAP do sinal: 24 horas na cadência horária.
export const PERIODO_VWAP_MOVEL = 24

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
 * VWAP dos últimos `periodo` candles em cada posição — o do sinal.
 *
 * Só existe com a janela cheia. Com três candles, a "média das últimas 24
 * horas" seria a de três horas, e o sinal passaria a significar outra coisa
 * sem avisar — o mesmo motivo por que a média móvel do filtro de tendência sai
 * null até ter todos os seus candles. Na simulação e no laboratório, a margem
 * de aquecimento de 3 dias cobre essa espera antes do primeiro candle
 * analisado.
 *
 * @param {Array<object>} cronologico - Do mais antigo ao mais recente.
 * @param {number} [periodo]
 * @returns {Array<number|null>}
 */
export const calcularVwapMovel = (cronologico, periodo = PERIODO_VWAP_MOVEL) => {
  const lista = cronologico || []
  const volumes = lista.map((r) => paraNumero(r?.precoVolume))
  const nocionais = lista.map((r) => paraNumero(r?.precoTotalNegociada))

  return lista.map((_, i) => {
    if (i < periodo - 1) return null
    let nocional = 0
    let volume = 0
    for (let k = i - periodo + 1; k <= i; k++) {
      // Mesmo par exigido pelo acumulado: um sem o outro desloca a média.
      if (volumes[k] !== null && nocionais[k] !== null && volumes[k] > 0) {
        volume += volumes[k]
        nocional += nocionais[k]
      }
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
 * Cruzamentos do preço com o VWAP móvel — o sinal do laboratório e da
 * simulação.
 *
 * @param {Array<object>} cronologico - Do mais antigo ao mais recente.
 * @returns {Array<string|null>} - VwapSignal onde houve cruzamento, alinhado
 *   com `cronologico`.
 */
export const cruzamentosDoVwapMovel = (cronologico) =>
  detectarCruzamentos(desvioDoVwap(cronologico, calcularVwapMovel(cronologico)))

/**
 * Estado do VWAP para exibição — o acumulado do período.
 *
 * Não traz mais os cruzamentos: eles eram do acumulado, e o único consumidor
 * era o vocabulário de sinais, que passou a usar os do VWAP móvel
 * (`cruzamentosDoVwapMovel`). Deixá-los aqui ofereceria o sinal antigo a quem
 * procurasse "cruzamentos" pelo nome.
 *
 * @param {Array<object>} registros - Série na ordem da API (mais recente primeiro).
 * @returns {{vwapAtual: number|null, desvioAtual: number|null, acima: boolean,
 *   serie: Array<number|null>}|null}
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
  }
}
