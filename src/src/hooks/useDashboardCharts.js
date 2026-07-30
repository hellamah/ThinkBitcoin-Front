import { useMemo } from 'react'
import { useTheme } from '@mui/material/styles'
import * as mathUtils from '../utils/mathUtils'
import { toLocalChartLabel } from '../utils/dateUtils'
import { chartPalette } from '../utils/themeTokens'
import {
  construirVelas,
  faixaDasVelas,
  LARGURA_MAXIMA_CORPO,
  PROPORCAO_CORPO,
} from '../utils/candlestickChart'
import { matrizCorrelacao } from '../utils/correlation'
import { PriceChartMode } from '../utils/enums'

const CORES_SIMPLE = ['#FFD700', '#2196f3', '#4caf50', '#e91e63', '#9c27b0', '#ff9800', '#00bcd4']

export default function useDashboardCharts({
  historicosPorMoeda,
  dataInicio,
  dataFim,
  resultadoFiltro,
  normalizacao,
  fearGreedPorMoeda,
  trendPorMoeda,
  modoPreco = PriceChartMode.LINE
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

    // Só entram no mapa os pontos com leitura real de sentimento. Um timestamp
    // sem dado simplesmente não exibe a linha no tooltip — antes daqui saía um
    // valor aleatório, indistinguível de sentimento medido de verdade.
    timestampsUnicos.forEach(ts => {
      const label = toLocalChartLabel(ts)

      moedasOrdenadas.forEach(sigla => {
        const fg = realFGMap.get(sigla)?.get(ts)
        const tr = realTRMap.get(sigla)?.get(ts)
        if (!fg && !tr) return

        if (!sentimentMap.has(label)) sentimentMap.set(label, new Map())
        const coinMap = sentimentMap.get(label)
        if (!coinMap.has(sigla)) coinMap.set(sigla, {})

        const target = coinMap.get(sigla)
        if (fg) target.fg = fg
        if (tr) target.tr = tr
      })
    })

    // Candles só com uma moeda: sobrepor o OHLC de ativos diferentes no mesmo
    // eixo não produz nada legível.
    const velas = !multi && moedasOrdenadas.length === 1
      ? construirVelas(historicosPorMoeda[moedasOrdenadas[0]], timestampsUnicos)
      : []

    // Reaproveita os arrays de variação já alinhados em timestampsUnicos — a
    // parte cara do cálculo (alinhar as séries) acabou de ser feita acima.
    // Sobre variação, e não sobre preço: ver o cabeçalho de correlation.js.
    const correlacao = multi
      ? matrizCorrelacao(
          datasetsVariacao.map(d => ({ sigla: d.label, valores: d.data }))
        )
      : null

    return {
      dadosGraficoPreco: { labels, datasets: datasetsPreco },
      dadosGraficoVariacao: { labels, datasets: datasetsVariacao },
      multiMoeda: multi,
      velas,
      correlacao,
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

  const modoVela =
    modoPreco === PriceChartMode.CANDLE && chartConfig.velas.length > 0

  // O dataset da linha só carrega os fechamentos, então o eixo Y automático
  // cortaria os pavios.
  const faixaVelas = useMemo(
    () => (modoVela ? faixaDasVelas(chartConfig.velas) : null),
    [modoVela, chartConfig.velas]
  )

  // No modo candle a variação vira barra colorida pela direção, para os dois
  // painéis contarem a mesma história: a barra vermelha do candle vermelho
  // fica na mesma coluna. Como o modo só existe com uma moeda, não há risco de
  // duas séries de barras disputarem o mesmo eixo.
  const dadosVariacao = useMemo(() => {
    const base = chartConfig.dadosGraficoVariacao
    if (!modoVela) return base

    return {
      ...base,
      datasets: base.datasets.map((d) => ({
        ...d,
        // Null é ausência de leitura: a barra não é desenhada, e a cor daquela
        // posição não chega a ser usada.
        backgroundColor: d.data.map((v) =>
          v === null || v === undefined || Number(v) >= 0 ? cores.alta : cores.baixa
        ),
        borderColor: 'transparent',
        borderWidth: 0,
        fill: false,
        // Mesma espessura da vela: categoria ocupando o passo inteiro e a
        // barra ocupando a mesma fração dele que o corpo do candle, com o
        // mesmo teto em px. Sem isto a barra sai ~25% mais larga e os dois
        // painéis, que ficam lado a lado, não parecem a mesma série.
        categoryPercentage: 1,
        barPercentage: PROPORCAO_CORPO,
        maxBarThickness: LARGURA_MAXIMA_CORPO,
      })),
    }
  }, [modoVela, chartConfig.dadosGraficoVariacao, cores])

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
      candlestick: {
        enabled: modoVela,
        velas: chartConfig.velas,
        corAlta: cores.alta,
        corBaixa: cores.baixa
      },
      tooltip: {
        ...baseOpcoes.plugins.tooltip,
        callbacks: {
          label: (ctx) => {
            // OHLC é a razão de existir do modo vela: o fechamento sozinho
            // esconde exatamente o que o candle mostra.
            if (modoVela) {
              const vela = chartConfig.velas[ctx.dataIndex]
              if (vela) {
                const cifra = (v) => `$${Number(v).toLocaleString('en-US')}`
                return [
                  `O: ${cifra(vela.abertura)}`,
                  `H: ${cifra(vela.maior)}`,
                  `L: ${cifra(vela.menor)}`,
                  `C: ${cifra(vela.fechamento)}`
                ]
              }
            }
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
        ...(faixaVelas ? { min: faixaVelas.min, max: faixaVelas.max } : {}),
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

  return {
    ...chartConfig,
    dadosGraficoVariacao: dadosVariacao,
    modoVela,
    opcoesPreco,
    opcoesVariacao,
  }
}
