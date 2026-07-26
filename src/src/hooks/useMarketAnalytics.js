import { useMemo } from 'react'
import { median } from '../utils/mathUtils'

// Deriva fluxo de ordens, volatilidade e sentimento a partir dos dados que o
// dashboard já carregou. Nenhuma requisição nova: são campos que a resposta de
// /moeda/{sigla}/valor sempre trouxe e a tela descartava.

// Quantos pontos o sparkline de Fear & Greed desenha. Mais que isso não
// acrescenta leitura e só engorda o path do SVG.
const PONTOS_SPARKLINE = 40

const somar = (registros, campo) =>
  registros.reduce((acc, r) => acc + (Number(r?.[campo]) || 0), 0)

export default function useMarketAnalytics({
  historicosPorMoeda,
  fearGreedPorMoeda,
  moedasFiltro,
}) {
  return useMemo(() => {
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
      dominanciaCompradora: Number(atual?.dominanciaCompradoraPercentual) || 0,
      dominanciaVendedora: Number(atual?.dominanciaVendedoraPercentual) || 0,
      ratioCompraVenda: Number(atual?.precoRatioCompraVenda) || 0,
      deltaAtual: Number(atual?.volumeDelta) || 0,
      deltaAcumulado: somar(historico, 'volumeDelta'),
      // Dominância do período inteiro: é o contexto que diz se a leitura atual
      // é rotina ou desvio.
      dominanciaCompradoraPeriodo:
        volumeTotal > 0 ? (compradoTotal / volumeTotal) * 100 : null,
    }

    const volatilidadeAtual = Number(atual?.precoVolatilidadePercentual) || 0
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
      amplitude: Number(atual?.precoAmplitude) || 0,
    }

    const registrosFG = fearGreedPorMoeda?.[sigla] || []
    const fgAtual = registrosFG[0]

    const fearGreed = fgAtual
      ? {
          valor: Number(fgAtual.valor) || 0,
          classificacao: fgAtual.classificacao || '',
          // O sparkline lê da esquerda (mais antigo) para a direita (atual).
          serie: registrosFG
            .slice(0, PONTOS_SPARKLINE)
            .map((r) => Number(r?.valor))
            .filter((v) => Number.isFinite(v))
            .reverse(),
        }
      : null

    return { sigla, fluxo, volatilidade, fearGreed, amostras: historico.length }
  }, [historicosPorMoeda, fearGreedPorMoeda, moedasFiltro])
}
