// Divergência entre preço e fluxo de ordens.
//
// O delta acumulado (CVD) soma volumeComprado - volumeVendido ao longo do
// período. Quando o preço sobe e o CVD não acompanha, a alta não está sendo
// sustentada por compra real — é o tipo de leitura que só existe porque o
// backend separa volume comprado de vendido, coisa que a maioria das fontes
// de varejo não entrega.
//
// A detecção clássica compara "topo mais alto do preço contra topo mais baixo
// do indicador", o que exige escolher pivôs a olho: duas pessoas marcam pontos
// diferentes no mesmo gráfico e chegam a leituras opostas. Aqui a comparação é
// por janela deslizante de tamanho fixo, que é reprodutível e, por isso,
// mensurável no laboratório de sinais.

import { paraNumero } from './mathUtils'
import { instanteDe } from './validacaoJanela'

export const DivergenceKind = Object.freeze({
  // Preço subiu, fluxo não acompanhou: alta sem lastro de compra.
  BEARISH: 'divergenciaBaixista',
  // Preço caiu, fluxo não acompanhou: queda sem lastro de venda.
  BULLISH: 'divergenciaAltista',
})

// Quantos candles a janela olha para trás. Curto demais capta ruído de um
// candle; longo demais dilui a divergência dentro da tendência.
const WINDOW = 5

// Movimento mínimo de preço, em %, para a janela valer leitura. Sem piso,
// oscilação lateral gera divergência a cada candle.
const MIN_PRICE_MOVE = 0.5

// Movimento mínimo de fluxo, em múltiplos da mediana de volume do período.
// Normaliza o CVD, que vem em unidades da moeda e não se compara com % de
// preço em valor absoluto.
const MIN_FLOW_MOVE = 0.5

/**
 * Delta acumulado ao longo da série.
 *
 * @param {Array<object>} cronologico - Registros do mais antigo ao mais recente.
 * @returns {Array<number>} - CVD em cada posição, começando do zero.
 */
export const calcularCvd = (cronologico) => {
  let acumulado = 0
  return (cronologico || []).map((r) => {
    acumulado += paraNumero(r?.volumeDelta) ?? 0
    return acumulado
  })
}

/**
 * Marca as janelas em que preço e fluxo apontam para lados opostos.
 *
 * @param {Array<object>} registros - Série na ordem da API (mais recente primeiro).
 * @param {number|null} medianaVolume - Régua para normalizar o movimento de fluxo.
 * @returns {Array<string|null>} - Uma entrada por candle, em ordem CRONOLÓGICA;
 *   valor de DivergenceKind onde há divergência, null onde não há.
 */
export const detectarDivergencias = (registros, medianaVolume) => {
  if (!Array.isArray(registros) || registros.length === 0) return []

  const cronologico = [...registros].reverse()
  const cvd = calcularCvd(cronologico)
  const marcas = new Array(cronologico.length).fill(null)

  // Sem régua de volume não dá para dizer se o movimento de fluxo é relevante;
  // marcar tudo seria pior do que não marcar nada.
  if (!Number.isFinite(medianaVolume) || medianaVolume <= 0) return marcas

  for (let i = WINDOW; i < cronologico.length; i++) {
    const fechamento = paraNumero(cronologico[i]?.precoFechamento)
    const anterior = paraNumero(cronologico[i - WINDOW]?.precoFechamento)
    if (fechamento === null || anterior === null || anterior <= 0) continue

    const varPreco = ((fechamento - anterior) / anterior) * 100
    const varFluxo = (cvd[i] - cvd[i - WINDOW]) / medianaVolume

    // Os dois lados precisam ter se movido de forma relevante: divergência
    // entre dois movimentos irrelevantes não é sinal, é ruído.
    if (Math.abs(varPreco) < MIN_PRICE_MOVE) continue
    if (Math.abs(varFluxo) < MIN_FLOW_MOVE) continue

    if (varPreco > 0 && varFluxo < 0) marcas[i] = DivergenceKind.BEARISH
    else if (varPreco < 0 && varFluxo > 0) marcas[i] = DivergenceKind.BULLISH
  }

  return marcas
}

/**
 * Primeiro índice da série cronológica que cai dentro da janela escolhida.
 *
 * Zero quando não há recorte utilizável — ou quando o recorte não deixaria
 * candle nenhum, caso em que degradar para a série inteira é melhor do que
 * apagar o painel. Mesma escolha do `recortarJanela` do marketAnalytics.
 */
const primeiroNaJanela = (cronologico, aPartirDe) => {
  if (aPartirDe === null || aPartirDe === undefined) return 0
  const limite = new Date(aPartirDe).getTime()
  if (!Number.isFinite(limite)) return 0
  const i = cronologico.findIndex((r) => {
    const t = instanteDe(r)
    return t !== null && t >= limite
  })
  return i > 0 ? i : 0
}

/**
 * Fluxo para exibição: acumulado DO PERÍODO e divergência corrente.
 *
 * As duas leituras querem trechos diferentes da série, e é isso que o
 * `aPartirDe` separa:
 *
 * - A divergência é estado. Ela compara janelas de cinco candles, então precisa
 *   dos candles anteriores ao período — sem eles, os primeiros cinco candles
 *   exibidos nunca seriam avaliados.
 * - O acumulado é período. Ele responde "quanta compra líquida entrou na
 *   janela que eu escolhi", e a resposta não pode incluir dias que o usuário
 *   não pediu.
 *
 * Daí o CVD ser calculado sobre a série inteira e depois REBASEADO para zero no
 * primeiro candle da janela: o indicador chega aquecido e o número que sai é o
 * do período. Sem o rebase, o card somava também a margem de aquecimento — três
 * dias que, num preset de 24 horas, são o triplo do que foi pedido.
 *
 * @param {Array<object>} registros - Série na ordem da API.
 * @param {number|null} medianaVolume
 * @param {{aPartirDe?: string|number|null}} [opcoes] - Início da janela. Sem
 *   ele, a série inteira conta como período (comportamento anterior).
 * @returns {{cvd: number, serie: number[], divergenciaAtual: string|null,
 *   ocorrencias: number}|null}
 */
export const resumirFluxo = (registros, medianaVolume, { aPartirDe = null } = {}) => {
  if (!Array.isArray(registros) || registros.length === 0) return null

  const cronologico = [...registros].reverse()
  const acumulado = calcularCvd(cronologico)
  const marcas = detectarDivergencias(registros, medianaVolume)

  const inicio = primeiroNaJanela(cronologico, aPartirDe)
  // O que veio antes da janela é ponto de partida, não conteúdo dela.
  const base = inicio > 0 ? acumulado[inicio - 1] : 0
  const serie = acumulado.slice(inicio).map((v) => v - base)

  return {
    cvd: serie[serie.length - 1] ?? 0,
    // Rebaseada junto: a forma do sparkline é a do acumulado DENTRO da janela,
    // e não a de uma curva que já começa deslocada pelo aquecimento.
    serie,
    // O candle mais recente é o último da série cronológica.
    divergenciaAtual: marcas[marcas.length - 1] ?? null,
    ocorrencias: marcas.slice(inicio).filter(Boolean).length,
  }
}
