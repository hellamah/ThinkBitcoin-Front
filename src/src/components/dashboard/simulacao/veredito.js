// A leitura do resultado em uma frase — a primeira coisa que o painel diz.
//
// O painel mostrava a mesma resposta em quatro lugares (pílulas, cards, cards
// de robustez, tabela de validação) e deixava para quem lê a tarefa de
// juntá-los. Aqui eles viram um título e duas ou três frases, na ordem em que a
// dúvida aparece: ganhou do buy & hold? ganhou do acaso? sobreviveu fora da
// amostra?
//
// O título nunca é mais otimista que a pior leitura: "passou nos testes" exige
// alfa positivo, régua aleatória acima do limiar (que sobe com as tentativas),
// intervalo do retorno acima de zero e validação sem perda. Qualquer uma que
// falhe rebaixa para "frágil". E diz "desta janela" de propósito — é o que foi
// medido, não uma promessa sobre a próxima.
//
// Devolve chaves de tradução e valores, não texto: quem traduz é a tela.

import { MINIMO_TRADES_CONCLUSIVO } from '../../../utils/backtest'
import { DIAS_JANELA_SIMULACAO } from '../../../utils/simulationWindow'
import { formatarLimiar, pct } from './formatacao'

export const TomVeredito = Object.freeze({
  BOM: 'bom',
  ALERTA: 'alerta',
  RUIM: 'ruim',
})

const frase = (chave, valores = {}) => ({ chave, valores })

/**
 * @param {object} entrada
 * @param {object} entrada.metricas - `resultado.metricas`.
 * @param {object|null} entrada.acaso - Régua aleatória, quando já chegou.
 * @param {boolean} [entrada.calculando] - A régua ainda está sendo medida.
 * @param {number} entrada.limiar - Percentil exigido da régua (Bonferroni).
 * @param {object|null} entrada.bootstrap - Intervalo do retorno.
 * @param {object|null} entrada.validacao - Simulação no trecho reservado.
 * @returns {{tom: string, titulo: {chave: string, valores: object},
 *   frases: Array<{chave: string, valores: object}>}}
 */
export const montarVeredito = ({ metricas, acaso, calculando = false, limiar, bootstrap, validacao }) => {
  const frases = []
  const alfa = metricas.alfa
  const temAlfa = alfa !== null && alfa !== undefined && Number.isFinite(alfa)

  // Diferença em pontos percentuais, sem sinal: o verbo já diz a direção.
  if (temAlfa) {
    const diferenca = Math.abs(alfa).toFixed(2)
    frases.push(frase(alfa > 0 ? 'simulationVerdictAhead' : 'simulationVerdictBehind', { diferenca }))
  }

  const passouAcaso = Boolean(acaso) && acaso.percentil >= limiar
  if (acaso) {
    const percentil = Math.round(acaso.percentil)
    frases.push(
      passouAcaso
        ? frase('simulationVerdictChance', { percentil })
        : frase('simulationVerdictChanceWeak', { percentil, limiar: formatarLimiar(limiar) })
    )
  } else if (calculando) {
    frases.push(frase('simulationVerdictCalculating'))
  }

  // O intervalo só entra quando o alfa é positivo: aí ele diz se o ganho se
  // distingue de zero. Com alfa negativo ele só repetiria a má notícia.
  const icPositivo = Boolean(bootstrap) && bootstrap.inferior > 0
  if (temAlfa && alfa > 0 && bootstrap) {
    if (icPositivo) frases.push(frase('simulationVerdictCiPositive'))
    else if (bootstrap.superior < 0) frases.push(frase('simulationVerdictCiNegative'))
    else frases.push(frase('simulationVerdictCiZero'))
  }

  const operouNaValidacao = Boolean(validacao && validacao.trades.length > 0)
  if (operouNaValidacao) {
    frases.push(frase('simulationVerdictValidation', { valor: pct(validacao.metricas.alfa) }))
  }

  if (metricas.amostraInsuficiente) {
    return {
      tom: TomVeredito.ALERTA,
      titulo: frase('simulationVerdictSampleShort', { count: metricas.tradesConcluidos }),
      frases,
    }
  }
  if (!temAlfa || alfa <= 0) {
    return { tom: TomVeredito.RUIM, titulo: frase('simulationVerdictBad'), frases }
  }

  const validacaoSemPerda = !operouNaValidacao || validacao.metricas.alfa > 0
  const passou = passouAcaso && icPositivo && validacaoSemPerda
  return {
    tom: passou ? TomVeredito.BOM : TomVeredito.ALERTA,
    titulo: frase(passou ? 'simulationVerdictGood' : 'simulationVerdictFragile'),
    frases,
  }
}

/**
 * As ressalvas que eram avisos soltos pelo painel, numa lista só.
 *
 * Cada uma continua dizendo o que dizia; o que muda é que elas deixam de
 * empurrar o resultado para baixo da tela. A amostra curta não entra aqui:
 * quando ela vale, é o próprio título do veredito.
 *
 * @param {object} entrada
 * @param {object} entrada.metricas
 * @param {number} entrada.descontinuidades - Quantos buracos a série tem.
 * @param {object|null} entrada.validacao
 * @returns {Array<{chave: string, valores: object}>}
 */
export const montarRessalvas = ({ metricas, descontinuidades = 0, validacao }) => {
  const ressalvas = []

  const dias =
    metricas.diasAnalisados !== null && metricas.diasAnalisados !== undefined
      ? Math.round(metricas.diasAnalisados)
      : null
  if (dias !== null && dias < DIAS_JANELA_SIMULACAO) {
    ressalvas.push(frase('simulationWindowShort', { pedidos: DIAS_JANELA_SIMULACAO, dias }))
  }

  if (descontinuidades > 0) ressalvas.push(frase('simulationGaps', { count: descontinuidades }))

  const opsValidacao = validacao?.metricas?.tradesConcluidos ?? 0
  if (validacao && validacao.trades.length > 0 && opsValidacao < MINIMO_TRADES_CONCLUSIVO) {
    ressalvas.push(
      frase('simulationCaveatValidation', { count: opsValidacao, minimo: MINIMO_TRADES_CONCLUSIVO })
    )
  }

  return ressalvas
}
