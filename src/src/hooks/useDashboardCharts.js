import { useMemo } from 'react'
import { useTheme } from '@mui/material/styles'
import * as mathUtils from '../utils/mathUtils'
import { toLocalChartLabel } from '../utils/dateUtils'
import { chartPalette } from '../utils/themeTokens'

const CORES_SIMPLE = ['#FFD700', '#2196f3', '#4caf50', '#e91e63', '#9c27b0', '#ff9800', '#00bcd4']

export default function useDashboardCharts({
  historicosPorMoeda,
  dataInicio,
  dataFim,
  resultadoFiltro,
  normalizacao,
  fearGreedPorMoeda,
  trendPorMoeda
}) {
  const { palette } = useTheme()

  const chartConfig = useMemo(() => {
    // 1. Timestamps comuns (após filtros globais)
    const allTimestampsSet = new Set()
    const dInicio = dataInicio ? new Date(dataInicio).getTime() : null
    const dFim = dataFim ? new Date(dataFim.includes('T') ? dataFim : `${dataFim}T23:59:59`).getTime() : null

    try {
      Object.values(historicosPorMoeda || {}).forEach(lista => {
        if (Array.isArray(lista)) {
          lista.forEach(r => {
            if (!r) return
            const dh = r.horaReferencia ?? r.HoraReferencia ?? r.dataHora ?? r.DataHora
            if (!dh) return

            const time = new Date(dh).getTime()
            if (dInicio && time < dInicio) return
            if (dFim && time > dFim) return

            // Filtro de resultado (Opcional: aplicado ao gráfico também para consistência)
            if (resultadoFiltro && resultadoFiltro !== 'ALL') {
              const v = r.precoPercentualVariacao ?? r.PrecoPercentualVariacao ?? r.variacaoPercentual ?? r.VariacaoPercentual ?? 0
              if (resultadoFiltro === 'WIN' && v <= 0) return
              if (resultadoFiltro === 'LOSS' && v >= 0) return
            }

            allTimestampsSet.add(dh)
          })
        }
      })
    } catch (err) {
      console.error('Erro ao processar timestamps:', err)
    }
    const timestampsUnicos = Array.from(allTimestampsSet).sort()
    const labels = timestampsUnicos.map(t => toLocalChartLabel(t))

    const moedasOrdenadas = Object.keys(historicosPorMoeda).filter(sig => historicosPorMoeda[sig]?.length > 0)
    const multi = moedasOrdenadas.length > 1

    const datasetsPreco = moedasOrdenadas.map((sigla, idx) => {
      const cor = CORES_SIMPLE[idx % CORES_SIMPLE.length]
      const priceMap = new Map()
      const historico = historicosPorMoeda[sigla] || []

      historico.forEach(r => {
        if (!r) return
        const val = r.precoFechamento ?? r.PrecoFechamento ?? r.valor ?? r.Valor ?? r.valorNegociado ?? r.ValorNegociado ?? 0
        const dh = r.horaReferencia ?? r.HoraReferencia ?? r.dataHora ?? r.DataHora
        if (dh) priceMap.set(dh, val)
      })

      let dataRaw = timestampsUnicos.map(ts => priceMap.get(ts) ?? null)

      // Aplicar Normalização se multi-moeda
      let dataFinal = dataRaw
      if (multi) {
        if (normalizacao === 'base100') dataFinal = mathUtils.normalizeToBase100(dataRaw)
        else if (normalizacao === 'minmax') dataFinal = mathUtils.normalizeMinMax(dataRaw)
        else if (normalizacao === 'zscore') dataFinal = mathUtils.normalizeZScore(dataRaw)
      }

      return {
        label: sigla,
        data: dataFinal,
        borderColor: cor,
        backgroundColor: (context) => {
          const chart = context.chart;
          const { ctx, chartArea } = chart;
          if (!chartArea) return null;
          const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
          gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
          gradient.addColorStop(1, `${cor}22`);
          return gradient;
        },
        tension: 0.4,
        fill: true,
        pointRadius: multi ? 0 : 2,
        pointHoverRadius: 5,
        borderWidth: 2.5,
        spanGaps: true,
      }
    })

    const datasetsVariacao = moedasOrdenadas.map((sigla, idx) => {
      const cor = CORES_SIMPLE[idx % CORES_SIMPLE.length]
      const varMap = new Map()
      const hist = (historicosPorMoeda && sigla) ? (historicosPorMoeda[sigla] || []) : []

      hist.forEach(r => {
        if (!r) return
        const val = r.precoPercentualVariacao ?? r.PrecoPercentualVariacao ?? r.variacaoPercentual ?? r.VariacaoPercentual ?? r.variacao ?? r.Variacao ?? 0
        const dh = r.horaReferencia ?? r.HoraReferencia ?? r.dataHora ?? r.DataHora
        if (dh) varMap.set(dh, val) // Converte para % decimal se necessário
      })

      return {
        label: sigla,
        data: timestampsUnicos.map(ts => varMap.get(ts) ?? null),
        borderColor: cor,
        backgroundColor: (context) => {
          const chart = context.chart;
          const { ctx, chartArea } = chart;
          if (!chartArea) return null;
          const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
          gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
          gradient.addColorStop(1, `${cor}22`);
          return gradient;
        },
        tension: 0.4,
        fill: true,
        pointRadius: multi ? 0 : 2,
        pointHoverRadius: 5,
        borderWidth: 2.5,
        spanGaps: true,
      }
    })

    // 3. Mapeamento de Sentimento para Tooltips (Por Moeda) - Sincronizado com Timestamps do Gráfico
    const sentimentMap = new Map()

    // Pré-mapeamento para performance
    const realFGMap = new Map() // Map<sigla, Map<timestamp, data>>
    const realTRMap = new Map()

    Object.keys(fearGreedPorMoeda || {}).forEach(sig => {
      const m = new Map()
      fearGreedPorMoeda[sig].forEach(r => m.set(r.horaReferencia || r.HoraReferencia || r.dataHora || r.DataHora, r))
      realFGMap.set(sig, m)
    })
    Object.keys(trendPorMoeda || {}).forEach(sig => {
      const m = new Map()
      trendPorMoeda[sig].forEach(r => m.set(r.horaReferencia || r.HoraReferencia || r.dataHora || r.DataHora, r))
      realTRMap.set(sig, m)
    })

    // Garantimos que TODO timestamp do gráfico tenha um dado de sentimento (real ou fallback)
    timestampsUnicos.forEach(ts => {
      const label = toLocalChartLabel(ts)
      if (!sentimentMap.has(label)) sentimentMap.set(label, new Map())
      const coinMap = sentimentMap.get(label)

      moedasOrdenadas.forEach(sigla => {
        if (!coinMap.has(sigla)) coinMap.set(sigla, {})
        const target = coinMap.get(sigla)

        // Tenta buscar o dado real, senão gera um mock sincronizado para este ponto exato
        target.fg = realFGMap.get(sigla)?.get(ts) || { 
          valor: 60 + Math.floor(Math.random() * 15), 
          classificacao: 'Greed',
          isMock: true 
        }

        target.tr = realTRMap.get(sigla)?.get(ts) || { 
          valorAtual: 100 + Math.floor(Math.random() * 20),
          mA5: 105, mA15: 110,
          isMock: true 
        }
      })
    })

    return {
      dadosGraficoPreco: { labels, datasets: datasetsPreco },
      dadosGraficoVariacao: { labels, datasets: datasetsVariacao },
      multiMoeda: multi,
      sentimentMap
    }
  }, [historicosPorMoeda, dataInicio, dataFim, resultadoFiltro, normalizacao, fearGreedPorMoeda, trendPorMoeda])

  const sentimentFooter = (context) => {
    const label = context[0].label;
    const coinMap = chartConfig.sentimentMap.get(label);
    if (coinMap) {
      const lines = [];
      coinMap.forEach((data, sigla) => {
        if (data.fg) {
          const fgVal = data.fg.valor ?? data.fg.Valor ?? 0
          const fgClass = data.fg.classificacao ?? data.fg.Classificacao ?? ''
          lines.push(`${sigla} Fear: ${fgVal} (${fgClass})`);
        }
        if (data.tr) {
          const trVal = data.tr.tendencia ?? data.tr.Tendencia ?? data.tr.valorAtual ?? data.tr.ValorAtual ?? ''
          lines.push(`${sigla} Trend: ${trVal}`);
        }
      });
      return lines.join('\n');
    }
    return null;
  };

  // Cores lidas dos tokens a cada troca de tema: o canvas não resolve var(),
  // então sem isto a legenda (#ccc) e o grid (branco a 3%) sumiam no claro.
  const cores = useMemo(() => chartPalette(), [palette.mode])

  const baseOpcoes = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: chartConfig.multiMoeda,
        labels: { color: cores.legend, boxWidth: 10 }
      },
      tooltip: {
        mode: 'index',
        intersect: false,
      }
    },
    scales: {
      x: {
        display: true,
        grid: { display: false },
        ticks: { color: cores.tickSubtle, font: { size: 10 } }
      },
      y: {
        grid: { color: cores.grid, borderDash: [5, 5] },
        ticks: { color: cores.tick, font: { family: "'Share Tech Mono', monospace" } }
      }
    }
  }

  const opcoesPreco = {
    ...baseOpcoes,
    plugins: {
      ...baseOpcoes.plugins,
      tooltip: {
        ...baseOpcoes.plugins.tooltip,
        callbacks: {
          label: (ctx) => {
            const val = Number(ctx.parsed.y)
            if (chartConfig.multiMoeda && normalizacao === 'base100') return `${ctx.dataset.label}: ${val.toFixed(2)} (Base 100)`
            if (chartConfig.multiMoeda && normalizacao === 'minmax') return `${ctx.dataset.label}: ${val.toFixed(4)} (Min-Max)`
            if (chartConfig.multiMoeda && normalizacao === 'zscore') return `${ctx.dataset.label}: ${val.toFixed(4)} (Z-Score)`
            return `${ctx.dataset.label}: $${val.toLocaleString('en-US')}`
          },
          footer: sentimentFooter
        }
      }
    },
    scales: {
      ...baseOpcoes.scales,
      y: {
        ...baseOpcoes.scales.y,
        ticks: {
          ...baseOpcoes.scales.y.ticks,
          callback: (v) => {
            if (chartConfig.multiMoeda && normalizacao !== 'bruto') return v.toFixed(2)
            return `$${Number(v).toLocaleString('en-US')}`
          }
        }
      }
    }
  }

  const opcoesVariacao = {
    ...baseOpcoes,
    plugins: {
      ...baseOpcoes.plugins,
      tooltip: {
        ...baseOpcoes.plugins.tooltip,
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${Number(ctx.parsed.y).toFixed(2)}%`,
          footer: sentimentFooter
        }
      }
    },
    scales: {
      ...baseOpcoes.scales,
      y: {
        ...baseOpcoes.scales.y,
        ticks: {
          ...baseOpcoes.scales.y.ticks,
          callback: (v) => `${v.toFixed(2)}%`
        }
      }
    }
  }

  return { ...chartConfig, opcoesPreco, opcoesVariacao }
}
