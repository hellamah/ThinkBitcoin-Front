import { useMemo } from 'react'
import { useTheme } from '@mui/material/styles'
import * as mathUtils from '../utils/mathUtils'
import { toLocalChartLabel } from '../utils/dateUtils'
import { chartPalette } from '../utils/themeTokens'
import {
  construirVelas,
  faixaDasVelas,
  MAX_BODY_WIDTH,
  BODY_RATIO,
} from '../utils/candlestickChart'
import { construirVolumes, estiloDasBarras } from '../utils/volumeChart'
import { resumirVwap } from '../utils/vwap'
import { calcularBollinger } from '../utils/oscillators'
import { matrizCorrelacao } from '../utils/correlation'
import { Normalization, PriceChartMode } from '../utils/enums'

const CORES_SIMPLE = ['#FFD700', '#2196f3', '#4caf50', '#e91e63', '#9c27b0', '#ff9800', '#00bcd4']

// Fração mínima do gráfico que a banda precisa cobrir para valer a pena
// desenhá-la. Metade é o suficiente para o formato ser legível.
const COBERTURA_MINIMA_BANDA = 0.5

export default function useDashboardCharts({
  historicosPorMoeda,
  dataInicio,
  dataFim,
  resultadoFiltro,
  normalizacao,
  fearGreedPorMoeda,
  trendPorMoeda,
  modoPreco = PriceChartMode.LINE,
  t = (chave) => chave
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
        if (normalizacao === Normalization.BASE_100) dataFinal = mathUtils.normalizeToBase100(dataRaw)
        else if (normalizacao === Normalization.MIN_MAX) dataFinal = mathUtils.normalizeMinMax(dataRaw)
        else if (normalizacao === Normalization.Z_SCORE) dataFinal = mathUtils.normalizeZScore(dataRaw)
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

    // Volume acompanha as velas: mesmo eixo, mesma condição de moeda única.
    const volumes = velas.length > 0
      ? construirVolumes(historicosPorMoeda[moedasOrdenadas[0]], timestampsUnicos)
      : []
    const medianaVolume = mathUtils.median(volumes)

    // VWAP acompanha o preço no mesmo eixo, então só faz sentido com moeda
    // única — média ponderada de ativos diferentes não descreve nenhum deles.
    //
    // É calculado só sobre os instantes que o gráfico exibe. Como o VWAP é
    // acumulado, incluir candles que os filtros removeram deslocaria a linha
    // inteira em relação aos pontos desenhados ao lado dela.
    const noEixo = new Set(timestampsUnicos)
    const registrosNoEixo = velas.length > 0
      ? (historicosPorMoeda[moedasOrdenadas[0]] || []).filter((r) =>
          noEixo.has(r?.horaReferencia ?? r?.dataHora)
        )
      : []

    const vwap = registrosNoEixo.length > 0 ? resumirVwap(registrosNoEixo) : null

    // Bandas calculadas sobre a série INTEIRA e depois recortadas na janela.
    //
    // Bollinger é média móvel de 20 períodos, então calcular só sobre o que
    // está desenhado gasta 20 dos 21 candles visíveis apenas para produzir o
    // primeiro valor — a banda aparecia nos dois últimos pontos e parecia
    // estática. Com o histórico anterior o indicador chega aquecido no
    // primeiro ponto do gráfico, que é como plataforma de trade faz.
    //
    // Diferente do VWAP, que é ancorado no início da janela por definição e
    // por isso continua sendo calculado só sobre ela.
    const serieCompleta = [...(historicosPorMoeda[moedasOrdenadas[0]] || [])].reverse()
    const bandasCompletas = velas.length > 0 ? calcularBollinger(serieCompleta) : []

    const bandaPorInstante = new Map()
    serieCompleta.forEach((r, i) => {
      const ts = r?.horaReferencia ?? r?.dataHora
      if (ts) bandaPorInstante.set(ts, bandasCompletas[i] ?? null)
    })

    const bandasNoEixo = velas.length > 0
      ? timestampsUnicos.map((ts) => bandaPorInstante.get(ts) ?? null)
      : []

    // Banda que cobre um pedaço pequeno do gráfico não se lê: no filtro de 7d
    // são 21 candles, e Bollinger(20) só produz valor nos dois últimos. O
    // traço aparecia colado na borda direita, parecia estático e não dizia
    // nada. Melhor não desenhar do que desenhar um toco.
    const cobertura = bandasNoEixo.length > 0
      ? bandasNoEixo.filter(Boolean).length / bandasNoEixo.length
      : 0
    const bandas = cobertura >= COBERTURA_MINIMA_BANDA ? bandasNoEixo : []

    // Reaproveita os arrays de variação já alinhados em timestampsUnicos — a
    // parte cara do cálculo (alinhar as séries) acabou de ser feita acima.
    // Sobre variação, e não sobre preço: ver o cabeçalho de correlation.js.
    const correlacao = multi
      ? matrizCorrelacao(
          datasetsVariacao.map(d => ({ sigla: d.label, valores: d.data }))
        )
      : null

    // A linha do VWAP entra DEPOIS da série de preço: o plugin de candle
    // cancela o desenho do índice 0, então a sobreposição precisa vir a
    // seguir para sobreviver ao modo vela.
    const sobreposicao = (label, dados, extra = {}) => ({
      label,
      data: dados,
      borderWidth: 1.5,
      pointRadius: 0,
      pointHoverRadius: 0,
      fill: false,
      tension: 0,
      spanGaps: true,
      ...extra,
    })

    // A banda superior preenche até a inferior, desenhando o envelope. Só as
    // duas extremas: a linha do meio é a média móvel simples, e o VWAP já
    // ocupa esse papel visual com uma leitura mais informativa.
    const temBandas = bandas.some(Boolean)
    const datasetsComVwap = [
      ...datasetsPreco,
      ...(vwap ? [sobreposicao('VWAP', vwap.serie, {
        borderColor: '#9c27b0',
        borderDash: [6, 4],
      })] : []),
      ...(temBandas ? [
        sobreposicao(t('bollingerUpper'), bandas.map((b) => b?.superior ?? null), {
          borderColor: 'rgba(33,150,243,0.55)',
          fill: '+1',
          backgroundColor: 'rgba(33,150,243,0.06)',
        }),
        sobreposicao(t('bollingerLower'), bandas.map((b) => b?.inferior ?? null), {
          borderColor: 'rgba(33,150,243,0.55)',
        }),
      ] : []),
    ]

    return {
      dadosGraficoPreco: { labels, datasets: datasetsComVwap },
      dadosGraficoVariacao: { labels, datasets: datasetsVariacao },
      multiMoeda: multi,
      velas,
      volumes,
      medianaVolume,
      vwap,
      correlacao,
      sentimentMap
    }
  }, [historicosPorMoeda, dataInicio, dataFim, resultadoFiltro, normalizacao, fearGreedPorMoeda, trendPorMoeda, t])

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
  const faixaVelas = useMemo(() => {
    if (!modoVela) return null

    const faixa = faixaDasVelas(chartConfig.velas)
    if (!faixa) return null

    // As bandas de Bollinger costumam ultrapassar máxima e mínima dos candles.
    // Como o eixo Y é forçado aqui, sem alargar a faixa elas sairiam cortadas
    // justamente nos pontos em que interessam.
    const extremos = (chartConfig.dadosGraficoPreco?.datasets || [])
      .slice(1)
      .flatMap((d) => d.data)
      .filter((v) => Number.isFinite(v))

    if (extremos.length === 0) return faixa

    return {
      min: Math.min(faixa.min, ...extremos),
      max: Math.max(faixa.max, ...extremos),
    }
  }, [modoVela, chartConfig.velas, chartConfig.dadosGraficoPreco])

  // Volume não depende de como o preço está desenhado: é o assunto do segundo
  // painel, escolhido no seletor próprio dele. Existe sempre que há moeda
  // única, tanto em linha quanto em candles.
  const dadosVolume = useMemo(() => {
    const { volumes, velas, medianaVolume } = chartConfig
    if (!volumes || volumes.length === 0) return null

    const estilo = estiloDasBarras(volumes, velas, medianaVolume, {
      corAlta: cores.alta,
      corBaixa: cores.baixa,
      corDestaque: cores.legend,
    })

    return {
      labels: chartConfig.dadosGraficoVariacao.labels,
      datasets: [{
        label: t('volume'),
        data: volumes,
        backgroundColor: estilo.fundo,
        borderColor: estilo.borda,
        borderWidth: estilo.espessura,
        // Mesma espessura da vela: categoria ocupando o passo inteiro e a
        // barra ocupando a mesma fração dele que o corpo do candle, com o
        // mesmo teto em px. Os dois painéis ficam lado a lado e qualquer
        // divergência de largura salta aos olhos.
        categoryPercentage: 1,
        barPercentage: BODY_RATIO,
        maxBarThickness: MAX_BODY_WIDTH,
      }],
    }
  }, [chartConfig, cores, t])

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
            // VWAP e bandas são datasets no mesmo eixo; sem isto o bloco OHLC
            // sairia repetido a cada série sob o cursor.
            if (ctx.datasetIndex > 0 && !chartConfig.multiMoeda) {
              return `${ctx.dataset.label}: $${Number(ctx.parsed.y).toLocaleString('en-US')}`
            }

            // OHLC é a razão de existir do modo vela: o fechamento sozinho
            // esconde exatamente o que o candle mostra.
            if (modoVela && ctx.datasetIndex === 0) {
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
            if (chartConfig.multiMoeda && normalizacao === Normalization.BASE_100) return `${ctx.dataset.label}: ${val.toFixed(2)} (Base 100)`
            if (chartConfig.multiMoeda && normalizacao === Normalization.MIN_MAX) return `${ctx.dataset.label}: ${val.toFixed(4)} (Min-Max)`
            if (chartConfig.multiMoeda && normalizacao === Normalization.Z_SCORE) return `${ctx.dataset.label}: ${val.toFixed(4)} (Z-Score)`
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
            if (chartConfig.multiMoeda && normalizacao !== Normalization.RAW) return v.toFixed(2)
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

  const opcoesVolume = {
    ...baseOpcoes,
    plugins: {
      ...baseOpcoes.plugins,
      legend: { display: false },
      tooltip: {
        ...baseOpcoes.plugins.tooltip,
        callbacks: {
          label: (ctx) => {
            const v = Number(ctx.parsed.y)
            const linhas = [`${t('volume')}: ${mathUtils.formatCompact(v)}`]
            // A razão contra a mediana é o que diz se o volume foi alto; o
            // número absoluto sozinho não tem régua.
            const mediana = chartConfig.medianaVolume
            if (Number.isFinite(mediana) && mediana > 0) {
              linhas.push(t('volumeVsMedian', { razao: (v / mediana).toFixed(1) }))
            }
            return linhas
          },
          footer: sentimentFooter
        }
      }
    },
    scales: {
      ...baseOpcoes.scales,
      y: {
        ...baseOpcoes.scales.y,
        beginAtZero: true,
        ticks: {
          ...baseOpcoes.scales.y.ticks,
          callback: (v) => mathUtils.formatCompact(v)
        }
      }
    }
  }

  // Última leitura da série alinhada, que é cronológica: o volume do candle
  // mais recente.
  const volumeAtual = useMemo(() => {
    const lista = chartConfig.volumes || []
    for (let i = lista.length - 1; i >= 0; i--) {
      if (Number.isFinite(lista[i])) return mathUtils.formatCompact(lista[i])
    }
    return '-'
  }, [chartConfig.volumes])

  return {
    ...chartConfig,
    modoVela,
    dadosGraficoVolume: dadosVolume,
    volumeAtual,
    opcoesPreco,
    opcoesVariacao,
    opcoesVolume,
  }
}
