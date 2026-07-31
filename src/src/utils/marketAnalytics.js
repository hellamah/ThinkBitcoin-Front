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

// Leitura pontual onde ausência e zero são equivalentes para a exibição: o
// card mostra "0" de qualquer forma.
const valorOuZero = (v) => paraNumero(v) ?? 0

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
    desempenho: calcularDesempenho(historico),
    amostras: historico.length,
  }
}
