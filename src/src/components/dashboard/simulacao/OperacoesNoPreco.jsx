import React, { useMemo } from 'react'
import { Line } from 'react-chartjs-2'

import * as mathUtils from '../../../utils/mathUtils'
import { faixaDasVelas } from '../../../utils/candlestickChart'
import { toLocalChartLabel } from '../../../utils/dateUtils'
import { TradeDirection } from '../../../utils/enums'
import { opcoesBaseGrafico, pct } from './formatacao'

// Candles antes da entrada e depois da saída na vista focada. Um dia de cada
// lado na cadência horária: o bastante para ver de onde o preço vinha e o que
// fez depois, sem que a operação vire um traço no meio do gráfico.
const MARGEM_FOCO = 24

const velaDe = (registro) => {
  const abertura = Number(registro?.precoAbertura)
  const maior = Number(registro?.precoMaior)
  const menor = Number(registro?.precoMenor)
  const fechamento = Number(registro?.precoFechamento)
  return [abertura, maior, menor, fechamento].every(Number.isFinite)
    ? { abertura, maior, menor, fechamento }
    : null
}

/**
 * As operações desenhadas sobre o preço.
 *
 * A tabela diz o que cada operação rendeu; este gráfico diz ONDE ela
 * aconteceu. É o que torna o motor auditável a olho: dá para ver se as
 * entradas estão mesmo depois dos sinais, se o stop ficou onde deveria, se as
 * perdas se concentram num trecho do gráfico.
 *
 * Duas vistas. A janela inteira, com a linha de fechamento e os marcadores de
 * entrada e saída; e a vista focada numa operação, em candles, com o preço de
 * entrada, o stop e o alvo. Clicar num marcador ou numa linha da tabela abre a
 * segunda.
 */
export default function OperacoesNoPreco({ resultado, serie, foco, onFocar, cores, t, locale }) {
  const { trades, curva, parametros } = resultado
  const comprado = parametros.direcao === TradeDirection.COMPRA
  const operacao = foco !== null ? trades[foco] ?? null : null

  const janelaInteira = useMemo(() => {
    if (operacao || !curva?.length) return null

    // Posição de cada candle da série na curva. A curva pula candles
    // inutilizáveis, então índice da série e posição na curva não coincidem.
    const posicao = new Map(curva.map((p, k) => [p.indice, k]))
    const vazio = () => new Array(curva.length).fill(null)
    const entradas = vazio()
    const ganhos = vazio()
    const perdas = vazio()
    const tradePorPonto = new Map()

    trades.forEach((op, idx) => {
      const pe = posicao.get(op.indiceEntrada)
      const ps = posicao.get(op.indiceSaida)
      if (pe !== undefined) {
        entradas[pe] = op.precoEntrada
        tradePorPonto.set(`e${pe}`, idx)
      }
      if (ps !== undefined) {
        ;(op.retornoLiquido >= 0 ? ganhos : perdas)[ps] = op.precoSaida
        tradePorPonto.set(`s${ps}`, idx)
      }
    })

    return {
      tradePorPonto,
      dados: {
        labels: curva.map((p) => (p.instante ? toLocalChartLabel(p.instante, locale) : '')),
        datasets: [
          {
            label: t('simulationPrice'),
            data: curva.map((p) => p.precoFechamento),
            borderColor: cores.tick,
            backgroundColor: 'transparent',
            borderWidth: 1,
            pointRadius: 0,
            tension: 0,
          },
          {
            label: t('simulationEntries'),
            data: entradas,
            showLine: false,
            pointStyle: 'triangle',
            // Vendido, a entrada aponta para baixo: é a aposta que o triângulo
            // desenha.
            rotation: comprado ? 0 : 180,
            pointRadius: 5,
            pointHoverRadius: 7,
            pointBackgroundColor: cores.accent,
            borderColor: cores.accent,
          },
          {
            label: t('simulationExitsWin'),
            data: ganhos,
            showLine: false,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: cores.alta,
            borderColor: cores.alta,
          },
          {
            label: t('simulationExitsLoss'),
            data: perdas,
            showLine: false,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: cores.baixa,
            borderColor: cores.baixa,
          },
        ],
      },
    }
  }, [operacao, curva, trades, comprado, cores, t, locale])

  const vistaFocada = useMemo(() => {
    if (!operacao || !serie?.length) return null

    const inicio = Math.max(0, operacao.indiceEntrada - MARGEM_FOCO)
    const fim = Math.min(serie.length - 1, operacao.indiceSaida + MARGEM_FOCO)
    const fatia = serie.slice(inicio, fim + 1)
    const velas = fatia.map((s) => velaDe(s.registro))

    // Um traço horizontal que só existe enquanto a posição estava aberta.
    const durante = (valor) =>
      fatia.map((_, k) => {
        const i = inicio + k
        return valor !== null && i >= operacao.indiceEntrada && i <= operacao.indiceSaida ? valor : null
      })
    const soEm = (indice, valor) => fatia.map((_, k) => (inicio + k === indice ? valor : null))

    const direcao = comprado ? 1 : -1
    const stopInicial =
      operacao.stopPercentualAplicado !== null
        ? operacao.precoEntrada * (1 - direcao * (operacao.stopPercentualAplicado / 100))
        : null

    const faixa = faixaDasVelas(velas)
    const extremos = [stopInicial, operacao.precoAlvo, operacao.precoStopFinal].filter(
      (v) => v !== null && v !== undefined && Number.isFinite(v)
    )
    const min = Math.min(faixa?.min ?? Infinity, ...extremos)
    const max = Math.max(faixa?.max ?? -Infinity, ...extremos)

    const traco = (label, valor, cor) => ({
      label,
      data: durante(valor),
      borderColor: cor,
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      borderDash: [4, 3],
      pointRadius: 0,
      spanGaps: false,
    })

    return {
      velas,
      min,
      max,
      dados: {
        labels: fatia.map((s) => toLocalChartLabel(s.registro?.horaReferencia, locale)),
        datasets: [
          // Índice 0: o fechamento. O plugin de candle cancela o desenho desta
          // série e põe as velas no lugar, mas ela continua alimentando eixo e
          // tooltip — é assim que o gráfico de preço do dashboard já funciona.
          {
            label: t('simulationPrice'),
            data: fatia.map((s) => mathUtils.paraNumero(s.registro?.precoFechamento)),
            borderColor: cores.tick,
            backgroundColor: 'transparent',
            pointRadius: 0,
          },
          traco(t('simulationTradeEntry'), operacao.precoEntrada, cores.accent),
          traco(t('simulationStopLine'), stopInicial, cores.baixa),
          traco(t('simulationTargetLine'), operacao.precoAlvo ?? null, cores.alta),
          {
            label: t('simulationTradeExit'),
            data: soEm(operacao.indiceSaida, operacao.precoSaida),
            showLine: false,
            pointRadius: 6,
            pointBackgroundColor: operacao.retornoLiquido >= 0 ? cores.alta : cores.baixa,
            borderColor: cores.legend,
            borderWidth: 1.5,
          },
        ],
      },
    }
  }, [operacao, serie, comprado, cores, t, locale])

  const opcoes = useMemo(() => {
    const base = opcoesBaseGrafico(cores, { formatarY: (v) => mathUtils.formatCurrency(v) })
    if (vistaFocada) {
      const folga = (vistaFocada.max - vistaFocada.min) * 0.05 || 1
      return {
        ...base,
        plugins: {
          ...base.plugins,
          candlestick: {
            enabled: true,
            velas: vistaFocada.velas,
            corAlta: cores.alta,
            corBaixa: cores.baixa,
          },
        },
        scales: {
          ...base.scales,
          // Sugeridos, e não fixos: com `min`/`max` o Chart.js imprime os
          // próprios limites como marcas ("88.328,7"), em vez de números
          // redondos. Os sugeridos garantem que pavios, stop e alvo caibam e
          // deixam o eixo arredondar para fora.
          y: {
            ...base.scales.y,
            suggestedMin: vistaFocada.min - folga,
            suggestedMax: vistaFocada.max + folga,
          },
        },
      }
    }
    return {
      ...base,
      // Hover por ponto, não por índice: com milhares de candles, o modo
      // `index` empilharia o preço e três séries vazias em cada tooltip.
      interaction: { mode: 'nearest', intersect: true },
      onClick: (_evento, elementos) => {
        const alvo = elementos?.find((e) => e.datasetIndex > 0)
        if (!alvo || !janelaInteira) return
        const chave = `${alvo.datasetIndex === 1 ? 'e' : 's'}${alvo.index}`
        const idx = janelaInteira.tradePorPonto.get(chave)
        if (idx !== undefined) onFocar(idx)
      },
    }
  }, [vistaFocada, janelaInteira, cores, onFocar])

  const dados = vistaFocada?.dados ?? janelaInteira?.dados
  if (!dados) return null

  return (
    <div className="simulation-preco">
      <div className="simulation-foco-cabecalho">
        <h3>{t('simulationPriceChart')}</h3>
        {operacao ? (
          <div className="simulation-foco-navegacao">
            <button
              type="button"
              className="pill-toggle"
              disabled={foco === 0}
              onClick={() => onFocar(foco - 1)}
            >
              {t('simulationPrevTrade')}
            </button>
            <button
              type="button"
              className="pill-toggle"
              disabled={foco >= trades.length - 1}
              onClick={() => onFocar(foco + 1)}
            >
              {t('simulationNextTrade')}
            </button>
            <button type="button" className="pill-toggle" onClick={() => onFocar(null)}>
              {t('simulationPriceChartBack')}
            </button>
          </div>
        ) : null}
      </div>
      <p className="correlation-hint">
        {operacao
          ? t('simulationFocusTrade', {
              numero: foco + 1,
              entrada: toLocalChartLabel(operacao.instanteEntrada, locale),
              saida: toLocalChartLabel(operacao.instanteSaida, locale),
              resultado: pct(operacao.retornoLiquido),
            })
          : t('simulationPriceChartHint')}
      </p>
      <div className="simulation-preco-container">
        <Line data={dados} options={opcoes} />
      </div>
    </div>
  )
}
