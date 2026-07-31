// Fluxo de ordens, volatilidade e sentimento derivados dos dados que o
// dashboard já carregou. Nenhuma requisição nova: são campos que a resposta de
// /moeda/{sigla}/valor sempre trouxe e a tela descartava.
//
// Fica em utils, e não dentro do hook, para poder ser testado sem montar React
// — mesmo arranjo de marketStats, correlation e volumeChart.

import { median, paraNumero } from './mathUtils'
import { calcularDesempenho } from './marketStats'

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

  const fluxo = {
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
    fearGreed,
    desempenho: calcularDesempenho(historico),
    amostras: historico.length,
  }
}
