// Fluxo de ordens, volatilidade e sentimento derivados dos dados que o
// dashboard já carregou. Nenhuma requisição nova: são campos que a resposta de
// /moeda/{sigla}/valor sempre trouxe e a tela descartava.
//
// Fica em utils, e não dentro do hook, para poder ser testado sem montar React
// — mesmo arranjo de marketStats, correlation e volumeChart.

import { median, paraNumero } from './mathUtils'
import { calcularAtr, calcularDesempenho } from './marketStats'
import { resumirFluxo } from './flowDivergence'
import { resumirVwap } from './vwap'
import { resumirOsciladores } from './oscillators'

// Quantos pontos o sparkline de Fear & Greed desenha. Mais que isso não
// acrescenta leitura e só engorda o path do SVG.
const SPARKLINE_POINTS = 40

const somar = (registros, campo) =>
  registros.reduce((acc, r) => acc + (paraNumero(r?.[campo]) ?? 0), 0)

/**
 * Recorta a série ao período escolhido, descartando a margem de aquecimento.
 *
 * A distinção importa porque as leituras deste módulo são de dois tipos. As de
 * ESTADO — fluxo, volatilidade, ticket, ATR, VWAP, osciladores — descrevem
 * "como está agora" e precisam dos candles anteriores para o indicador chegar
 * aquecido. As de PERÍODO — retorno, drawdown, win rate — descrevem "o que
 * aconteceu na janela", e incluir o aquecimento nelas faz o painel medir dias
 * que o usuário não pediu e anunciar mais candles do que o filtro escolheu.
 *
 * @param {Array<object>} registros
 * @param {string|number|null} aPartirDe
 * @returns {Array<object>} - A própria série quando não há recorte utilizável.
 */
export const recortarJanela = (registros, aPartirDe) => {
  if (!Array.isArray(registros)) return []
  if (aPartirDe === null || aPartirDe === undefined) return registros

  const limite = new Date(aPartirDe).getTime()
  if (!Number.isFinite(limite)) return registros

  const recortado = registros.filter((r) => {
    const bruto = r?.horaReferencia ?? r?.HoraReferencia ?? r?.dataHora ?? r?.DataHora
    if (!bruto) return false
    const t = new Date(bruto).getTime()
    return Number.isFinite(t) && t >= limite
  })

  // Recorte que não sobra nada quase sempre significa carimbo em formato
  // inesperado, e não janela vazia. Devolver a série inteira degrada para o
  // comportamento anterior em vez de apagar o painel.
  return recortado.length > 0 ? recortado : registros
}

// Leitura pontual onde ausência e zero são equivalentes para a exibição: o
// card mostra "0" de qualquer forma.
const valorOuZero = (v) => paraNumero(v) ?? 0

/**
 * Compara as moedas selecionadas lado a lado.
 *
 * Existe porque no modo comparativo o painel de desempenho sumia inteiro. As
 * leituras que NÃO se somam entre ativos — fluxo de ordens, laboratório de
 * sinais — continuam fora, mas retorno, drawdown e volatilidade são por moeda
 * e comparar exatamente isso é o motivo de alguém selecionar várias.
 *
 * @param {object} historicosPorMoeda - Séries por sigla.
 * @param {string[]} moedasFiltro - Moedas selecionadas.
 * @returns {Array<object>|null} - Ordenado por retorno; null fora do modo
 *   comparativo, onde o painel de moeda única já cobre.
 */
export const compararMoedas = (historicosPorMoeda, moedasFiltro, aPartirDe = null) => {
  if (!Array.isArray(moedasFiltro) || moedasFiltro.length < 2) return null

  const linhas = moedasFiltro
    .map((sigla) => {
      const historico = historicosPorMoeda?.[sigla] || []
      // Retorno e drawdown descrevem o período escolhido; o VWAP é acumulado e
      // fica com a série inteira, que é o que dá sentido a "preço médio do
      // período" na primeira leitura.
      const naJanela = recortarJanela(historico, aPartirDe)
      const desempenho = calcularDesempenho(naJanela)
      if (!desempenho) return null

      return {
        sigla,
        ...desempenho,
        volatilidade: median(naJanela.map((r) => r?.precoVolatilidadePercentual)),
        // Onde o preço está em relação ao custo médio ponderado do período.
        desvioVwap: resumirVwap(historico)?.desvioAtual ?? null,
      }
    })
    .filter(Boolean)

  if (linhas.length === 0) return null

  // Maior retorno primeiro: a pergunta que se faz olhando esta tabela é
  // "qual rendeu mais", e a resposta deve estar na primeira linha.
  return linhas.sort((a, b) => b.retorno - a.retorno)
}

/**
 * Consolida as leituras derivadas de uma única moeda.
 *
 * @param {object} params
 * @param {object} params.historicosPorMoeda - Séries por sigla.
 * @param {object} params.fearGreedPorMoeda - Séries de sentimento por sigla.
 * @param {string[]} params.moedasFiltro - Moedas selecionadas.
 * @returns {object|null} - null fora do modo de moeda única ou sem histórico.
 */
export const derivarAnalytics = ({
  historicosPorMoeda,
  fearGreedPorMoeda,
  moedasFiltro,
  aPartirDe = null,
}) => {
  // Fluxo e volatilidade são leituras de um ativo específico: somar moedas
  // diferentes não produz nenhum número interpretável.
  if (!Array.isArray(moedasFiltro) || moedasFiltro.length !== 1) return null

  const sigla = moedasFiltro[0]
  const historico = historicosPorMoeda?.[sigla] || []
  if (historico.length === 0) return null

  // As consultas usam ordemAsc=false: o índice 0 é a leitura mais recente.
  const atual = historico[0]

  const compradoTotal = somar(historico, 'volumeComprado')
  const vendidoTotal = somar(historico, 'volumeVendido')
  const volumeTotal = compradoTotal + vendidoTotal

  // Delta acumulado e divergência contra o preço. A mediana de volume é a
  // régua que torna o movimento de fluxo comparável com o de preço.
  const divergencia = resumirFluxo(historico, median(historico.map((r) => r?.precoVolume)))

  const fluxo = {
    divergencia,
    dominanciaCompradora: valorOuZero(atual?.dominanciaCompradoraPercentual),
    dominanciaVendedora: valorOuZero(atual?.dominanciaVendedoraPercentual),
    ratioCompraVenda: valorOuZero(atual?.precoRatioCompraVenda),
    deltaAtual: valorOuZero(atual?.volumeDelta),
    deltaAcumulado: somar(historico, 'volumeDelta'),
    // Dominância do período inteiro: é o contexto que diz se a leitura atual
    // é rotina ou desvio.
    dominanciaCompradoraPeriodo:
      volumeTotal > 0 ? (compradoTotal / volumeTotal) * 100 : null,
  }

  const volatilidadeAtual = valorOuZero(atual?.precoVolatilidadePercentual)
  const volatilidadeMediana = median(
    historico.map((r) => r?.precoVolatilidadePercentual)
  )

  const volatilidade = {
    atual: volatilidadeAtual,
    mediana: volatilidadeMediana,
    // Mediana como referência de normalidade: um único candle atípico
    // distorceria a média e faria a régua mentir.
    razao:
      volatilidadeMediana > 0 ? volatilidadeAtual / volatilidadeMediana : null,
    amplitude: valorOuZero(atual?.precoAmplitude),
  }

  // Ticket médio: quanto vale um trade, em dólar. É a dimensão que o volume
  // sozinho não separa — o mesmo volume pode vir de muita gente pequena ou de
  // pouca gente grande, e isso muda a leitura do movimento.
  const ticketAtual = valorOuZero(atual?.precoFinanceiroPorTrade)
  const ticketMediana = median(historico.map((r) => r?.precoFinanceiroPorTrade))

  const ticket = {
    atual: ticketAtual,
    mediana: ticketMediana,
    razao: ticketMediana > 0 ? ticketAtual / ticketMediana : null,
    // Número de trades sai do nocional dividido pelo ticket. O backend não
    // manda a contagem, mas ela cai dos dois campos que já vêm.
    trades:
      ticketAtual > 0
        ? Math.round(valorOuZero(atual?.precoTotalNegociada) / ticketAtual)
        : null,
  }

  const registrosFG = fearGreedPorMoeda?.[sigla] || []
  const fgAtual = registrosFG[0]

  const fearGreed = fgAtual
    ? {
        valor: valorOuZero(fgAtual.valor),
        classificacao: fgAtual.classificacao || '',
        // O sparkline lê da esquerda (mais antigo) para a direita (atual).
        serie: registrosFG
          .slice(0, SPARKLINE_POINTS)
          .map((r) => paraNumero(r?.valor))
          .filter((v) => v !== null)
          .reverse(),
      }
    : null

  return {
    sigla,
    fluxo,
    volatilidade,
    ticket,
    fearGreed,
    vwap: resumirVwap(historico),
    osciladores: resumirOsciladores(historico),
    atr: calcularAtr(historico),
    // A ÚNICA leitura de período deste bloco. Todas as acima descrevem o estado
    // atual e precisam da margem de aquecimento; esta descreve a janela, e
    // incluir o aquecimento nela faria o painel anunciar mais candles do que o
    // filtro da tela pediu.
    desempenho: calcularDesempenho(recortarJanela(historico, aPartirDe)),
    amostras: historico.length,
  }
}
