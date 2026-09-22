import { useEffect, useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Grid from '@mui/material/Grid'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import { MdArrowBack, MdArrowForward, MdPsychology, MdTrendingUp, MdTrendingDown, MdEmojiEvents, MdShowChart, MdTimer, MdCompareArrows, MdLeaderboard, MdSpeed } from 'react-icons/md'
import { Line, Doughnut, Radar } from 'react-chartjs-2'
import useTranslation from '../../hooks/useTranslation'
import { apiRequest, MarketEndpoint, VariavelExternaEndpoint } from '../../utils/apiClient'
import { toUTCISO, padraoDeDataCurta } from '../../utils/dateUtils'
import { readToken } from '../../utils/themeTokens'
import { LOCALE_DATE_FNS, comBordaDeEixo } from './graficos'
import { corDaMoeda, formatarData, formatarNumero, formatarPercentual, tintaDaMoeda } from './formato'

// Detalhe de um episódio (/treinamento-episodios/:id). Veio da página como
// estava; a revisão de layout desta tela ainda não passou por aqui.

const ACCENT = '#FFD700'
// Versão para DOM/CSS: escurece no tema claro (canvas do Chart.js não
// resolve var(), por isso ACCENT continua literal para os gráficos).
const ACCENT_DOM = 'var(--accent-ink)'

const chartBg = (dk) => dk ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'
const chartBorder = (dk) => dk ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
const gridColor = (dk) => dk ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'
const tickColor = (dk) => dk ? '#aaa' : '#666'
const legendColor = (dk) => dk ? '#e0e0e0' : '#333'
const tooltipBg = (dk) => dk ? 'rgba(15,15,20,0.95)' : 'rgba(255,255,255,0.95)'
const tooltipBody = (dk) => dk ? '#fff' : '#333'
const subtleBg = (dk) => dk ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
const subtleBorder = (dk) => dk ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'
const textPrimary = (dk) => dk ? '#fff' : '#202020'
const gradientEnd = (dk) => dk ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'
const gaugeTrack = (dk) => dk ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'
const xTicks = (dk) => ({ color: tickColor(dk), maxRotation: 0, autoSkip: true, maxTicksLimit: 10 })

// O episodio pedido pela URL nao existe na lista carregada. Vive fora do
// DetailView de proposito: la a mensagem ficava atras de um `return` antecipado,
// ANTES dos quinze hooks do componente, e React exige a mesma ordem de hooks em
// todo render. Quem decide qual dos dois renderizar e quem ja tem o item em maos.
export function EpisodioNaoEncontrado({ onBack }) {
  const { palette } = useTheme()
  const dk = palette.mode === 'dark'
  const { t } = useTranslation()
  return (
    <Box sx={{ p: 4, color: textPrimary(dk) }}>
      <Button startIcon={<MdArrowBack />} onClick={onBack} sx={{ color: textPrimary(dk), mb: 2 }}>{t('treinamento.back')}</Button>
      <Typography>{t('treinamento.notFound')}</Typography>
    </Box>
  )
}

// Recebe `item` sempre preenchido — ver EpisodioNaoEncontrado.
export default function DetalheEpisodio({ item, allItems, onBack, onNavigate }) {
  const { palette } = useTheme()
  const dk = palette.mode === 'dark'
  const { t, idioma } = useTranslation()

  // ── Dados da mesma moeda ──
  const sameCoinItems = useMemo(() =>
    (allItems || [])
      .filter((i) => i.moeda === item.moeda)
      .sort((a, b) => new Date(a.dataHora).getTime() - new Date(b.dataHora).getTime()),
    [allItems, item.moeda]
  )

  const coinAvg = useMemo(() => {
    if (sameCoinItems.length === 0) return { reward: 0, loss: 0, winRate: 0, epsilon: 0, duracao: 0 }
    const n = sameCoinItems.length
    return {
      reward: sameCoinItems.reduce((s, r) => s + (r.rewardMedio ?? 0), 0) / n,
      loss: sameCoinItems.reduce((s, r) => s + (r.lossMedia ?? 0), 0) / n,
      winRate: sameCoinItems.reduce((s, r) => s + (r.winRate ?? 0), 0) / n,
      epsilon: sameCoinItems.reduce((s, r) => s + (r.epsilon ?? 0), 0) / n,
      duracao: sameCoinItems.reduce((s, r) => s + (r.duracaoSegundos ?? 0), 0) / n,
    }
  }, [sameCoinItems])

  // ── Navegação prev/next ──
  const currentIndex = sameCoinItems.findIndex((i) => i.idTreinamentoEpisodio === item.idTreinamentoEpisodio)
  const prevItem = currentIndex > 0 ? sameCoinItems[currentIndex - 1] : null
  const nextItem = currentIndex < sameCoinItems.length - 1 ? sameCoinItems[currentIndex + 1] : null

  // ── Ranking (posição entre todos os items por reward) ──
  const ranking = useMemo(() => {
    const sorted = [...(allItems || [])].sort((a, b) => (b.rewardMedio ?? -Infinity) - (a.rewardMedio ?? -Infinity))
    const pos = sorted.findIndex((i) => i.idTreinamentoEpisodio === item.idTreinamentoEpisodio)
    return { position: pos >= 0 ? pos + 1 : null, total: sorted.length }
  }, [allItems, item.idTreinamentoEpisodio])

  const rankingCoin = useMemo(() => {
    const sorted = [...sameCoinItems].sort((a, b) => (b.rewardMedio ?? -Infinity) - (a.rewardMedio ?? -Infinity))
    const pos = sorted.findIndex((i) => i.idTreinamentoEpisodio === item.idTreinamentoEpisodio)
    return { position: pos >= 0 ? pos + 1 : null, total: sorted.length }
  }, [sameCoinItems, item.idTreinamentoEpisodio])

  // ── Ações Doughnut ──
  const totalAcoes = (item.acoesHold ?? 0) + (item.acoesCompra ?? 0) + (item.acoesVenda ?? 0)
  const doughnutData = {
    labels: [t('treinamento.hold'), t('treinamento.buy'), t('treinamento.sell')],
    datasets: [{
      data: [item.acoesHold ?? 0, item.acoesCompra ?? 0, item.acoesVenda ?? 0],
      backgroundColor: ['rgba(160,160,160,0.85)', 'rgba(20,241,149,0.85)', 'rgba(255,92,124,0.85)'],
      borderColor: ['rgba(160,160,160,1)', 'rgba(20,241,149,1)', 'rgba(255,92,124,1)'],
      borderWidth: 2,
      hoverOffset: 8,
    }],
  }
  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '65%',
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: legendColor(dk), usePointStyle: true, padding: 16, font: { size: 12 } },
      },
      tooltip: {
        backgroundColor: tooltipBg(dk),
        borderColor: readToken('--accent-a40'),
        borderWidth: 1,
        titleColor: ACCENT,
        bodyColor: tooltipBody(dk),
        padding: 10,
        callbacks: {
          label: (ctx) => {
            const pct = totalAcoes > 0 ? ((ctx.raw / totalAcoes) * 100).toFixed(1) : 0
            return ` ${ctx.label}: ${ctx.raw} (${pct}%)`
          },
        },
      },
    },
  }

  // ── Radar: episódio vs média da moeda ──
  const radarData = useMemo(() => {
    // Normalizar cada métrica no intervalo [0, 1] em relação ao range da moeda
    const metrics = [
      { label: t('treinamento.reward'), key: 'rewardMedio', higher: true },
      { label: t('treinamento.winRate'), key: 'winRate', higher: true },
      { label: t('treinamento.radarDuration'), key: 'duracaoSegundos', higher: false },
      { label: t('treinamento.epsilon'), key: 'epsilon', higher: false },
      { label: t('treinamento.radarLoss'), key: 'lossMedia', higher: false },
    ]
    const normalize = (key) => {
      if (sameCoinItems.length < 2) return { val: 0.5, avg: 0.5 }
      const vals = sameCoinItems.map((r) => r[key] ?? 0)
      const min = Math.min(...vals)
      const max = Math.max(...vals)
      const range = max - min || 1
      return {
        val: ((item[key] ?? 0) - min) / range,
        avg: (coinAvg[key === 'rewardMedio' ? 'reward' : key === 'lossMedia' ? 'loss' : key] - min) / range,
      }
    }
    const itemVals = metrics.map((m) => normalize(m.key).val * 100)
    const avgVals = metrics.map((m) => normalize(m.key).avg * 100)
    return {
      labels: metrics.map((m) => m.label),
      datasets: [
        {
          label: t('treinamento.episodeNum', { num: item.episodio }),
          data: itemVals,
          borderColor: ACCENT,
          backgroundColor: readToken('--accent-a15'),
          borderWidth: 2,
          pointBackgroundColor: ACCENT,
          pointRadius: 4,
        },
        {
          label: t('treinamento.avgCoin', { coin: item.moeda }),
          data: avgVals,
          borderColor: 'rgba(92,184,255,0.8)',
          backgroundColor: 'rgba(92,184,255,0.08)',
          borderWidth: 2,
          borderDash: [4, 4],
          pointBackgroundColor: '#5CB8FF',
          pointRadius: 3,
        },
      ],
    }
  }, [item, sameCoinItems, coinAvg, t])

  const radarOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      r: {
        angleLines: { color: dk ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' },
        grid: { color: chartBorder(dk) },
        pointLabels: { color: legendColor(dk), font: { size: 12 } },
        ticks: { display: false },
        suggestedMin: 0,
        suggestedMax: 100,
      },
    },
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: legendColor(dk), usePointStyle: true, padding: 16 },
      },
      tooltip: {
        backgroundColor: tooltipBg(dk),
        borderColor: readToken('--accent-a40'),
        borderWidth: 1,
        titleColor: ACCENT,
        bodyColor: tooltipBody(dk),
        padding: 10,
        callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${ctx.raw.toFixed(1)}%` },
      },
    },
  }

  // ── Mini-timeline: últimos 20 episódios da mesma moeda ──
  const miniTimeline = useMemo(() => {
    const idx = sameCoinItems.findIndex((i) => i.idTreinamentoEpisodio === item.idTreinamentoEpisodio)
    if (idx < 0) return sameCoinItems.slice(-20)
    const start = Math.max(0, idx - 10)
    const end = Math.min(sameCoinItems.length, idx + 11)
    return sameCoinItems.slice(start, end)
  }, [sameCoinItems, item.idTreinamentoEpisodio])

  const miniTimelineData = useMemo(() => ({
    labels: miniTimeline.map((r) => `#${r.episodio}`),
    datasets: [
      {
        label: t('treinamento.avgReward'),
        data: miniTimeline.map((r) => r.rewardMedio ?? 0),
        borderColor: miniTimeline.map((r) =>
          r.idTreinamentoEpisodio === item.idTreinamentoEpisodio ? ACCENT : 'rgba(255,215,0,0.5)'
        ),
        backgroundColor: miniTimeline.map((r) =>
          r.idTreinamentoEpisodio === item.idTreinamentoEpisodio ? ACCENT : 'rgba(255,215,0,0.15)'
        ),
        borderWidth: miniTimeline.map((r) =>
          r.idTreinamentoEpisodio === item.idTreinamentoEpisodio ? 3 : 1.5
        ),
        pointRadius: miniTimeline.map((r) =>
          r.idTreinamentoEpisodio === item.idTreinamentoEpisodio ? 7 : 3
        ),
        pointBackgroundColor: miniTimeline.map((r) =>
          r.idTreinamentoEpisodio === item.idTreinamentoEpisodio ? ACCENT : 'rgba(255,215,0,0.5)'
        ),
        tension: 0.3,
        fill: false,
      },
    ],
  }), [miniTimeline, item.idTreinamentoEpisodio, t])

  const miniTimelineOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: tooltipBg(dk),
        borderColor: readToken('--accent-a40'),
        borderWidth: 1,
        titleColor: ACCENT,
        bodyColor: tooltipBody(dk),
        padding: 10,
        callbacks: {
          afterLabel: (ctx) => {
            const ep = miniTimeline[ctx.dataIndex]
            if (!ep) return ''
            return [
              `${t('treinamento.scatterWinRate')}: ${formatarPercentual(ep.winRate)}`,
              `${t('treinamento.radarLoss')}: ${formatarNumero(ep.lossMedia)}`,
              `${t('treinamento.scatterDuration')}: ${formatarNumero(ep.duracaoSegundos, 1)}s`,
            ].join('\n')
          },
        },
      },
    },
    scales: comBordaDeEixo({
      x: { ticks: { color: tickColor(dk), maxRotation: 0, autoSkip: true }, grid: { color: gridColor(dk) } },
      y: { ticks: { color: tickColor(dk) }, grid: { color: gridColor(dk) } },
    }, dk),
  }), [miniTimeline, dk, t])

  // ── Contexto de mercado: candles da moeda em torno do episódio ──
  // Janela: [início do episódio − 30min, fim + 30min]. O endpoint espera UTC ISO.
  const MERCADO_MARGEM_MS = 30 * 60 * 1000
  const epFimMs = new Date(item.dataHora).getTime()
  const epInicioMs = epFimMs - (item.duracaoSegundos ?? 0) * 1000
  const [mercado, setMercado] = useState(null)
  const [sentimento, setSentimento] = useState(null) // { fear, trend } — registro mais próximo do fim do episódio
  useEffect(() => {
    if (!item.moeda || Number.isNaN(epFimMs)) { setMercado(null); setSentimento(null); return undefined }
    let canceled = false
    // Sentimento (fear-greed/trend) costuma ter granularidade maior que preço:
    // busca numa janela ampla e escolhe o registro mais próximo do episódio.
    const dataInicio = toUTCISO(new Date(epInicioMs - 12 * 60 * 60 * 1000))
    const dataFim = toUTCISO(new Date(epFimMs + 12 * 60 * 60 * 1000))

    // Janela curta primeiro; se a base não tiver granularidade suficiente
    // (menos de 2 pontos), amplia para ±12h pra ainda dar contexto.
    const MARGEM_AMPLA_MS = 12 * 60 * 60 * 1000
    const fetchValor = (margemMs) =>
      apiRequest(MarketEndpoint.COIN_VALUE(item.moeda.toLowerCase(), {
        dataInicio: toUTCISO(new Date(epInicioMs - margemMs)),
        dataFim: toUTCISO(new Date(epFimMs + margemMs)),
        quantidade: 500,
        ordemAsc: true,
      })).then((resp) => {
        const regs = resp?.resultado?.registros
        // Ordena aqui em vez de confiar no `ordemAsc`: a variação do período
        // lê o primeiro e o último fechamento, e com a resposta vindo do mais
        // recente para o mais antigo (é o que o modo demo faz) o sinal saía
        // invertido — alta virava queda.
        return Array.isArray(regs)
          ? [...regs].sort((a, b) => new Date(a.horaReferencia).getTime() - new Date(b.horaReferencia).getTime())
          : []
      })
    fetchValor(MERCADO_MARGEM_MS)
      .then(async (regs) => {
        if (regs.length >= 2) return { registros: regs, margemHoras: 0.5 }
        return { registros: await fetchValor(MARGEM_AMPLA_MS), margemHoras: 12 }
      })
      .then((res) => { if (!canceled) setMercado(res) })
      .catch(() => { if (!canceled) setMercado({ registros: [], margemHoras: 0.5 }) })

    // Fear & Greed e Trend exigem idMoeda: resolve a sigla via /moedas.
    // São complementares — qualquer falha só oculta os indicadores.
    const maisProximo = (regs) => {
      const lista = Array.isArray(regs) ? regs : []
      const comHora = lista.filter((r) => r.horaReferencia)
      if (comHora.length === 0) return lista[0] ?? null
      return comHora.reduce((best, r) =>
        Math.abs(new Date(r.horaReferencia).getTime() - epFimMs) <
        Math.abs(new Date(best.horaReferencia).getTime() - epFimMs) ? r : best)
    }
    apiRequest(MarketEndpoint.COIN_LIST)
      .then((resp) => {
        const moedas = Array.isArray(resp?.resultado) ? resp.resultado : []
        const idMoeda = moedas.find((m) => (m.sigla || '').toUpperCase() === item.moeda.toUpperCase())?.id
        if (!idMoeda) return null
        const qs = `idMoeda=${idMoeda}&dataInicio=${encodeURIComponent(dataInicio)}&dataFim=${encodeURIComponent(dataFim)}&quantidade=100&ordemAsc=false`
        return Promise.all([
          apiRequest(`${VariavelExternaEndpoint.FEAR_GREED}?${qs}`).catch(() => null),
          apiRequest(`${VariavelExternaEndpoint.TREND}?${qs}`).catch(() => null),
        ])
      })
      .then((results) => {
        if (canceled || !results) return
        const [fearResp, trendResp] = results
        setSentimento({
          fear: maisProximo(fearResp?.resultado?.registros),
          trend: maisProximo(trendResp?.resultado?.registros),
        })
      })
      .catch(() => { if (!canceled) setSentimento(null) })
    return () => { canceled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.idTreinamentoEpisodio])

  const mercadoRegistros = mercado?.registros ?? []
  const mercadoStats = useMemo(() => {
    if (mercadoRegistros.length === 0) return null
    const closes = mercadoRegistros.map((r) => r.precoFechamento ?? 0).filter((v) => v > 0)
    if (closes.length === 0) return null
    const first = closes[0]
    const last = closes[closes.length - 1]
    const avg = (key) => {
      const vals = mercadoRegistros.map((r) => r[key]).filter((v) => v != null)
      return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null
    }
    return {
      variacao: first > 0 ? (last - first) / first : 0,
      precoMin: Math.min(...closes),
      precoMax: Math.max(...closes),
      precoAtual: last,
      // casas decimais suficientes pra moedas de preço baixo (ex.: DOGE ~0,16)
      digits: last >= 100 ? 2 : last >= 1 ? 3 : 5,
      dominanciaCompradora: avg('dominanciaCompradoraPercentual'),
      longShort: avg('longShortRatio'),
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mercado])

  const mercadoChartData = useMemo(() => {
    if (mercadoRegistros.length === 0) return null
    return {
      datasets: [{
        label: t('treinamento.price', { coin: item.moeda }),
        data: mercadoRegistros
          .filter((r) => r.horaReferencia && r.precoFechamento != null)
          .map((r) => ({ x: new Date(r.horaReferencia).getTime(), y: r.precoFechamento })),
        borderColor: corDaMoeda(item.moeda),
        backgroundColor: corDaMoeda(item.moeda) + '22',
        fill: true,
        tension: 0.25,
        pointRadius: 0,
        borderWidth: 2,
      }],
    }
  // `mercadoRegistros` fica DE FORA de proposito: e `mercado?.registros ?? []`,
  // ou seja, um array novo a cada render. Lista-lo desfaria o memo — ele
  // recomputaria sempre. Quem de fato muda e `mercado`, que ja esta aqui.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mercado, item.moeda, t])

  // Faixa destacando o período em que o episódio rodou
  const episodioBandPlugin = useMemo(() => ({
    id: 'episodioBand',
    beforeDatasetsDraw: (chart) => {
      const { ctx, chartArea, scales } = chart
      if (!chartArea || !scales.x) return
      const x1 = scales.x.getPixelForValue(epInicioMs)
      const x2 = scales.x.getPixelForValue(epFimMs)
      ctx.save()
      ctx.fillStyle = 'rgba(255,215,0,0.10)'
      ctx.fillRect(x1, chartArea.top, Math.max(2, x2 - x1), chartArea.bottom - chartArea.top)
      ctx.strokeStyle = 'rgba(255,215,0,0.5)'
      ctx.setLineDash([4, 4])
      ctx.strokeRect(x1, chartArea.top, Math.max(2, x2 - x1), chartArea.bottom - chartArea.top)
      ctx.restore()
    },
  }), [epInicioMs, epFimMs])

  const dataCurtaDetalhe = useMemo(() => padraoDeDataCurta(idioma.intl), [idioma.intl])

  // O candle é horário: o último fecha na virada da hora, e um episódio que
  // rodou depois dela ficava além do fim do eixo — a faixa do período do
  // treinamento, que é o ponto do gráfico, simplesmente não aparecia. O eixo
  // passa a cobrir os dados E o episódio, com folga dos dois lados.
  const eixoMercado = useMemo(() => {
    const xs = mercadoRegistros
      .map((r) => new Date(r.horaReferencia).getTime())
      .filter((x) => Number.isFinite(x))
    if (xs.length === 0 || Number.isNaN(epFimMs)) return {}
    const folga = Math.max(5 * 60 * 1000, (epFimMs - epInicioMs) * 0.5)
    return {
      min: Math.min(Math.min(...xs), epInicioMs - folga),
      max: Math.max(Math.max(...xs), epFimMs + folga),
    }
  // Mesmo motivo do memo acima: `mercado` é quem muda, não o array derivado.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mercado, epInicioMs, epFimMs])

  const mercadoChartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: tooltipBg(dk),
        borderColor: readToken('--accent-a40'),
        borderWidth: 1,
        titleColor: ACCENT,
        bodyColor: tooltipBody(dk),
        padding: 10,
      },
    },
    scales: comBordaDeEixo({
      x: {
        type: 'time',
        min: eixoMercado.min,
        max: eixoMercado.max,
        // Locale e ordem dos campos vêm do idioma escolhido, não de pt-BR fixo.
        adapters: { date: { locale: LOCALE_DATE_FNS[idioma.codigo] ?? LOCALE_DATE_FNS.pt } },
        time: {
          tooltipFormat: `${dataCurtaDetalhe} HH:mm:ss`,
          displayFormats: { minute: 'HH:mm', hour: 'HH:mm' },
        },
        ticks: xTicks(dk),
        grid: { color: gridColor(dk) },
      },
      y: { ticks: { color: tickColor(dk) }, grid: { color: gridColor(dk) } },
    }, dk),
    // Este `useMemo` devolve um objeto literal, não uma chamada de
    // `baseChartOptions`: o locale e a borda do eixo entram pelas referências
    // acima, não por argumento.
  }), [dk, idioma.codigo, dataCurtaDetalhe, eixoMercado])

  // ── Delta helpers ──
  const delta = (val, avg) => {
    if (avg === 0 && val === 0) return 0
    return val - avg
  }
  const deltaColor = (d, inverted = false) => {
    const positive = inverted ? d <= 0 : d >= 0
    return positive ? 'var(--perf-up)' : 'var(--perf-down)'
  }
  const deltaSign = (d) => d >= 0 ? '+' : ''

  // ── Win rate visual gauge ──
  const winRatePct = (item.winRate ?? 0) * 100
  const winRateGaugeColor = winRatePct >= 50 ? 'var(--perf-up)' : winRatePct >= 35 ? 'var(--perf-warn)' : 'var(--perf-down)'

  // ── Deltas para KPIs ──
  const rewardDelta = delta(item.rewardMedio ?? 0, coinAvg.reward)
  const lossDelta = delta(item.lossMedia ?? 0, coinAvg.loss)
  const winRateDelta = delta(item.winRate ?? 0, coinAvg.winRate)
  const duracaoDelta = delta(item.duracaoSegundos ?? 0, coinAvg.duracao)

  // ── Eficiência (reward / duração) ──
  const eficiencia = (item.duracaoSegundos ?? 0) > 0 ? (item.rewardMedio ?? 0) / (item.duracaoSegundos ?? 1) : 0
  const eficienciaAvg = coinAvg.duracao > 0 ? coinAvg.reward / coinAvg.duracao : 0
  const eficienciaDelta = delta(eficiencia, eficienciaAvg)

  return (
    <div className="dashboard-container">
      <Box sx={{ p: { xs: 2, md: 4 }, color: textPrimary(dk) }}>
        {/* ── Header com navegação ── */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1, flexWrap: 'wrap', gap: 1 }}>
          <Button startIcon={<MdArrowBack />} onClick={onBack} sx={{ color: textPrimary(dk) }}>{t('treinamento.back')}</Button>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              size="small"
              startIcon={<MdArrowBack size={14} />}
              disabled={!prevItem}
              onClick={() => onNavigate(prevItem.idTreinamentoEpisodio)}
              sx={{ color: textPrimary(dk), borderColor: subtleBorder(dk), fontSize: 12 }}
              variant="outlined"
            >
              {t('treinamento.previous')}
            </Button>
            <Button
              size="small"
              endIcon={<MdArrowForward size={14} />}
              disabled={!nextItem}
              onClick={() => onNavigate(nextItem.idTreinamentoEpisodio)}
              sx={{ color: textPrimary(dk), borderColor: subtleBorder(dk), fontSize: 12 }}
              variant="outlined"
            >
              {t('treinamento.next')}
            </Button>
          </Box>
        </Box>

        {/* ── Título e badge ── */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
            <MdPsychology size={28} color={ACCENT_DOM} />
            <Typography variant="h5" sx={{ fontWeight: 700 }}>{t('treinamento.episodeNum', { num: item.episodio })}</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Chip
              label={item.moeda}
              size="small"
              sx={{
                background: corDaMoeda(item.moeda) + '33',
                color: tintaDaMoeda(item.moeda, dk),
                border: `1px solid ${corDaMoeda(item.moeda)}66`,
                fontWeight: 600,
              }}
            />
            {item.versaoModelo && (
              <Chip
                label={item.versaoModelo}
                size="small"
                sx={{
                  background: 'rgba(167,139,250,0.15)',
                  color: '#A78BFA',
                  border: '1px solid rgba(167,139,250,0.3)',
                  fontWeight: 500,
                  fontSize: 11,
                }}
              />
            )}
            <Typography variant="body2" sx={{ opacity: 0.7 }}>{formatarData(item.dataHora, idioma.intl)}</Typography>
            {ranking.position && (
              <Chip
                icon={<MdLeaderboard size={14} />}
                label={t('treinamento.rankGeneral', { pos: ranking.position, total: ranking.total })}
                size="small"
                sx={{
                  background: 'rgba(167,139,250,0.15)',
                  color: '#A78BFA',
                  border: '1px solid rgba(167,139,250,0.3)',
                  fontWeight: 500,
                  fontSize: 11,
                  '& .MuiChip-icon': { color: '#A78BFA' },
                }}
              />
            )}
            {rankingCoin.position && (
              <Chip
                icon={<MdEmojiEvents size={14} />}
                label={t('treinamento.rankCoin', { pos: rankingCoin.position, total: rankingCoin.total, coin: item.moeda })}
                size="small"
                sx={{
                  background: corDaMoeda(item.moeda) + '15',
                  color: tintaDaMoeda(item.moeda, dk),
                  border: `1px solid ${corDaMoeda(item.moeda)}30`,
                  fontWeight: 500,
                  fontSize: 11,
                  '& .MuiChip-icon': { color: tintaDaMoeda(item.moeda, dk) },
                }}
              />
            )}
          </Box>
        </Box>

        {/* ── KPIs com delta ── */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid size={{ xs: 6, sm: 4, md: 2 }}>
            <Paper sx={{
              p: 2, height: '100%',
              background: `linear-gradient(135deg, rgba(255,215,0,0.08), ${gradientEnd(dk)})`,
              border: '1px solid var(--accent-a15)',
              backdropFilter: 'blur(10px)', color: textPrimary(dk),
              display: 'flex', flexDirection: 'column', gap: 0.5,
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, opacity: 0.85 }}>
                <MdTrendingUp size={16} color={ACCENT} />
                <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: 0.8, fontSize: 10 }}>{t('treinamento.rewardMedio')}</Typography>
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 700, color: ACCENT, lineHeight: 1.2 }}>{formatarNumero(item.rewardMedio)}</Typography>
              <Typography variant="caption" sx={{ color: deltaColor(rewardDelta), fontWeight: 600 }}>
                {deltaSign(rewardDelta)}{formatarNumero(rewardDelta)} {t('treinamento.vsWindowAvg')}
              </Typography>
            </Paper>
          </Grid>
          <Grid size={{ xs: 6, sm: 4, md: 2 }}>
            <Paper sx={{
              p: 2, height: '100%',
              background: `linear-gradient(135deg, rgba(20,241,149,0.08), ${gradientEnd(dk)})`,
              border: '1px solid rgba(20,241,149,0.15)',
              backdropFilter: 'blur(10px)', color: textPrimary(dk),
              display: 'flex', flexDirection: 'column', gap: 0.5,
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, opacity: 0.85 }}>
                <MdShowChart size={16} color="#14F195" />
                <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: 0.8, fontSize: 10 }}>{t('treinamento.winRate')}</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                <Typography variant="h5" sx={{ fontWeight: 700, color: winRateGaugeColor, lineHeight: 1.2 }}>{formatarPercentual(item.winRate)}</Typography>
              </Box>
              <Box sx={{ width: '100%', height: 4, borderRadius: 2, background: gaugeTrack(dk), mt: 0.5 }}>
                <Box sx={{ width: `${Math.min(100, winRatePct)}%`, height: '100%', borderRadius: 2, background: winRateGaugeColor, transition: 'width 0.5s ease' }} />
              </Box>
              <Typography variant="caption" sx={{ color: deltaColor(winRateDelta), fontWeight: 600 }}>
                {deltaSign(winRateDelta)}{(winRateDelta * 100).toFixed(2)}pp {t('treinamento.vsWindowAvg')}
              </Typography>
            </Paper>
          </Grid>
          <Grid size={{ xs: 6, sm: 4, md: 2 }}>
            <Paper sx={{
              p: 2, height: '100%',
              background: `linear-gradient(135deg, rgba(255,92,124,0.08), ${gradientEnd(dk)})`,
              border: '1px solid rgba(255,92,124,0.15)',
              backdropFilter: 'blur(10px)', color: textPrimary(dk),
              display: 'flex', flexDirection: 'column', gap: 0.5,
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, opacity: 0.85 }}>
                <MdTrendingDown size={16} color="#FF5C7C" />
                <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: 0.8, fontSize: 10 }}>{t('treinamento.lossMedia')}</Typography>
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#FF5C7C', lineHeight: 1.2 }}>{formatarNumero(item.lossMedia)}</Typography>
              <Typography variant="caption" sx={{ color: deltaColor(lossDelta, true), fontWeight: 600 }}>
                {deltaSign(lossDelta)}{formatarNumero(lossDelta)} {t('treinamento.vsWindowAvg')}
              </Typography>
            </Paper>
          </Grid>
          <Grid size={{ xs: 6, sm: 4, md: 2 }}>
            <Paper sx={{
              p: 2, height: '100%',
              background: `linear-gradient(135deg, rgba(92,184,255,0.08), ${gradientEnd(dk)})`,
              border: '1px solid rgba(92,184,255,0.15)',
              backdropFilter: 'blur(10px)', color: textPrimary(dk),
              display: 'flex', flexDirection: 'column', gap: 0.5,
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, opacity: 0.85 }}>
                <MdSpeed size={16} color="#5CB8FF" />
                <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: 0.8, fontSize: 10 }}>{t('treinamento.epsilon')}</Typography>
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#5CB8FF', lineHeight: 1.2 }}>{formatarNumero(item.epsilon)}</Typography>
              <Box sx={{ width: '100%', height: 4, borderRadius: 2, background: gaugeTrack(dk), mt: 0.5 }}>
                <Box sx={{ width: `${Math.min(100, (item.epsilon ?? 0) * 100)}%`, height: '100%', borderRadius: 2, background: '#5CB8FF', transition: 'width 0.5s ease' }} />
              </Box>
              <Typography variant="caption" sx={{ opacity: 0.6 }}>{t('treinamento.exploration')}</Typography>
            </Paper>
          </Grid>
          <Grid size={{ xs: 6, sm: 4, md: 2 }}>
            <Paper sx={{
              p: 2, height: '100%',
              background: `linear-gradient(135deg, rgba(255,181,71,0.08), ${gradientEnd(dk)})`,
              border: '1px solid rgba(255,181,71,0.15)',
              backdropFilter: 'blur(10px)', color: textPrimary(dk),
              display: 'flex', flexDirection: 'column', gap: 0.5,
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, opacity: 0.85 }}>
                <MdTimer size={16} color="#FFB547" />
                <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: 0.8, fontSize: 10 }}>{t('treinamento.duration')}</Typography>
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#FFB547', lineHeight: 1.2 }}>{formatarNumero(item.duracaoSegundos, 1)}s</Typography>
              <Typography variant="caption" sx={{ color: deltaColor(duracaoDelta, true), fontWeight: 600 }}>
                {deltaSign(duracaoDelta)}{formatarNumero(duracaoDelta, 1)}s {t('treinamento.vsWindowAvg')}
              </Typography>
            </Paper>
          </Grid>
          <Grid size={{ xs: 6, sm: 4, md: 2 }}>
            <Paper sx={{
              p: 2, height: '100%',
              background: `linear-gradient(135deg, rgba(167,139,250,0.08), ${gradientEnd(dk)})`,
              border: '1px solid rgba(167,139,250,0.15)',
              backdropFilter: 'blur(10px)', color: textPrimary(dk),
              display: 'flex', flexDirection: 'column', gap: 0.5,
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, opacity: 0.85 }}>
                <MdCompareArrows size={16} color="#A78BFA" />
                <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: 0.8, fontSize: 10 }}>{t('treinamento.efficiency')}</Typography>
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#A78BFA', lineHeight: 1.2 }}>{formatarNumero(eficiencia, 6)}</Typography>
              <Typography variant="caption" sx={{ color: deltaColor(eficienciaDelta), fontWeight: 600 }}>
                {deltaSign(eficienciaDelta)}{formatarNumero(eficienciaDelta, 6)} {t('treinamento.vsWindowAvg')}
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.5, fontSize: 9 }}>{t('treinamento.rewardPerSecond')}</Typography>
            </Paper>
          </Grid>
        </Grid>

        {/* ── Gráficos: Radar + Doughnut ── */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid size={{ xs: 12, md: 5 }}>
            <Paper sx={{
              p: 2.5, height: { xs: 340, md: 380 },
              background: chartBg(dk), border: `1px solid ${chartBorder(dk)}`,
              backdropFilter: 'blur(10px)', color: textPrimary(dk),
              display: 'flex', flexDirection: 'column',
            }}>
              <Box sx={{ mb: 1 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{t('treinamento.episodeProfile')}</Typography>
                <Typography variant="caption" sx={{ opacity: 0.6 }}>
                  {t('treinamento.profileSubtitle', { coin: item.moeda })}
                </Typography>
              </Box>
              <Box sx={{ flex: 1, position: 'relative', minHeight: 0 }}>
                <Radar data={radarData} options={radarOptions} />
              </Box>
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3.5 }}>
            <Paper sx={{
              p: 2.5, height: { xs: 340, md: 380 },
              background: chartBg(dk), border: `1px solid ${chartBorder(dk)}`,
              backdropFilter: 'blur(10px)', color: textPrimary(dk),
              display: 'flex', flexDirection: 'column',
            }}>
              <Box sx={{ mb: 1 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{t('treinamento.actionDistDetail')}</Typography>
                <Typography variant="caption" sx={{ opacity: 0.6 }}>
                  {t('treinamento.actionDistTotal', { acoes: totalAcoes, steps: item.totalSteps ?? '-' })}
                </Typography>
              </Box>
              <Box sx={{ flex: 1, position: 'relative', minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Doughnut data={doughnutData} options={doughnutOptions} />
              </Box>
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3.5 }}>
            <Paper sx={{
              p: 2.5, height: { xs: 340, md: 380 },
              background: chartBg(dk), border: `1px solid ${chartBorder(dk)}`,
              backdropFilter: 'blur(10px)', color: textPrimary(dk),
              display: 'flex', flexDirection: 'column',
            }}>
              <Box sx={{ mb: 1.5 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{t('treinamento.fullDetails')}</Typography>
                <Typography variant="caption" sx={{ opacity: 0.6 }}>{t('treinamento.allFields')}</Typography>
              </Box>
              <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                {[
                  [t('treinamento.episode'), `#${item.episodio}`, null, null],
                  [t('treinamento.modelVersionLabel'), item.versaoModelo ?? '-', { color: '#A78BFA' }, null],
                  [t('treinamento.dateTime'), formatarData(item.dataHora, idioma.intl), null, null],
                  [t('treinamento.rewardTotal'), formatarNumero(item.rewardTotal, 2), { color: (item.rewardTotal ?? 0) >= 0 ? '#14F195' : '#FF5C7C' }, null],
                  [t('treinamento.actionsHold'), item.acoesHold ?? 0, { color: 'rgba(160,160,160,0.9)' }, totalAcoes > 0 ? `${(((item.acoesHold ?? 0) / totalAcoes) * 100).toFixed(1)}%` : null],
                  [t('treinamento.actionsBuy'), item.acoesCompra ?? 0, { color: '#14F195' }, totalAcoes > 0 ? `${(((item.acoesCompra ?? 0) / totalAcoes) * 100).toFixed(1)}%` : null],
                  [t('treinamento.actionsSell'), item.acoesVenda ?? 0, { color: '#FF5C7C' }, totalAcoes > 0 ? `${(((item.acoesVenda ?? 0) / totalAcoes) * 100).toFixed(1)}%` : null],
                  [t('treinamento.totalSteps'), item.totalSteps ?? '-', null, null],
                ].map(([label, value, style, extra]) => (
                  <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, py: 0.25, borderBottom: `1px solid ${chartBorder(dk)}` }}>
                    <Typography variant="caption" sx={{ opacity: 0.65, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 10, whiteSpace: 'nowrap' }}>{label}</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, minWidth: 0 }}>
                      <Typography variant="body2" noWrap sx={{ fontWeight: 600, ...style }}>{value}</Typography>
                      {extra && <Typography variant="caption" sx={{ opacity: 0.5, fontSize: 10 }}>({extra})</Typography>}
                    </Box>
                  </Box>
                ))}
                <Box sx={{ pt: 1 }}>
                  <Typography variant="caption" sx={{ opacity: 0.4, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 9 }}>ID</Typography>
                  <Typography variant="caption" noWrap sx={{ opacity: 0.5, display: 'block', fontSize: 10 }} title={item.idTreinamentoEpisodio}>
                    {item.idTreinamentoEpisodio}
                  </Typography>
                </Box>
              </Box>
            </Paper>
          </Grid>
        </Grid>

        {/* ── Mini-timeline ── */}
        {miniTimeline.length > 1 && (
          <Box sx={{ mb: 3 }}>
            <Paper sx={{
              p: 2.5, height: { xs: 280, md: 320 },
              background: chartBg(dk), border: `1px solid ${chartBorder(dk)}`,
              backdropFilter: 'blur(10px)', color: textPrimary(dk),
              display: 'flex', flexDirection: 'column',
            }}>
              <Box sx={{ mb: 1 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{t('treinamento.temporalContext')}</Typography>
                <Typography variant="caption" sx={{ opacity: 0.6 }}>
                  {t('treinamento.neighborEpisodes', { coin: item.moeda })}
                </Typography>
              </Box>
              <Box sx={{ flex: 1, position: 'relative', minHeight: 0 }}>
                <Line data={miniTimelineData} options={miniTimelineOptions} />
              </Box>
            </Paper>
          </Box>
        )}

        {/* ── Contexto de mercado (preço da moeda em torno do episódio) ── */}
        {mercadoChartData && mercadoStats && (
          <Box sx={{ mb: 3 }}>
            <Paper sx={{
              p: 2.5,
              background: chartBg(dk), border: `1px solid ${chartBorder(dk)}`,
              backdropFilter: 'blur(10px)', color: textPrimary(dk),
            }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{t('treinamento.marketContext')}</Typography>
                  <Typography variant="caption" sx={{ opacity: 0.6 }}>
                    {t('treinamento.marketSubtitle', { coin: item.moeda, range: mercado?.margemHoras === 12 ? '12h' : '30min' })}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 2.5, flexWrap: 'wrap' }}>
                  {[
                    [t('treinamento.periodVariation'), `${mercadoStats.variacao >= 0 ? '+' : ''}${(mercadoStats.variacao * 100).toFixed(2)}%`, mercadoStats.variacao >= 0 ? '#14F195' : '#FF5C7C'],
                    [t('treinamento.priceRange'), `${formatarNumero(mercadoStats.precoMin, mercadoStats.digits)} – ${formatarNumero(mercadoStats.precoMax, mercadoStats.digits)}`, null],
                    ...(mercadoStats.dominanciaCompradora != null
                      ? [[t('treinamento.buyerDominance'), `${mercadoStats.dominanciaCompradora.toFixed(1)}%`, mercadoStats.dominanciaCompradora >= 50 ? '#14F195' : '#FF5C7C']]
                      : []),
                    ...(mercadoStats.longShort != null
                      ? [[t('treinamento.longShortAvg'), formatarNumero(mercadoStats.longShort, 2), null]]
                      : []),
                    ...(sentimento?.fear?.valor != null
                      ? [[
                          t('treinamento.fearGreed'),
                          `${sentimento.fear.valor}${sentimento.fear.classificacao ? ` · ${sentimento.fear.classificacao}` : ''}`,
                          sentimento.fear.valor >= 55 ? '#14F195' : sentimento.fear.valor >= 45 ? '#FFB547' : '#FF5C7C',
                        ]]
                      : []),
                    ...(sentimento?.trend?.valorAtual != null
                      ? [[
                          t('treinamento.trendSearch'),
                          `${sentimento.trend.valorAtual}${sentimento.trend.delta15 != null ? ` (${sentimento.trend.delta15 >= 0 ? '▲' : '▼'}${Math.abs(sentimento.trend.delta15)} /15min)` : ''}`,
                          sentimento.trend.delta15 != null ? (sentimento.trend.delta15 >= 0 ? '#14F195' : '#FF5C7C') : null,
                        ]]
                      : []),
                    ...(sentimento?.trend?.geoTop1Code
                      ? [[t('treinamento.topRegion'), sentimento.trend.geoTop1Code, null]]
                      : []),
                  ].map(([label, value, color]) => (
                    <Box key={label} sx={{ textAlign: 'right' }}>
                      <Typography variant="caption" sx={{ opacity: 0.6, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 9, display: 'block' }}>{label}</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: color || textPrimary(dk) }}>{value}</Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
              <Box sx={{ height: { xs: 220, md: 260 }, position: 'relative' }}>
                <Line data={mercadoChartData} options={mercadoChartOptions} plugins={[episodioBandPlugin]} />
              </Box>
            </Paper>
          </Box>
        )}

        {/* ── Comparação lado a lado com episódio anterior ── */}
        {prevItem && (
          <Box sx={{ mb: 3 }}>
            <Paper sx={{
              p: 2.5,
              background: chartBg(dk), border: `1px solid ${chartBorder(dk)}`,
              backdropFilter: 'blur(10px)', color: textPrimary(dk),
            }}>
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{t('treinamento.prevComparison')}</Typography>
                <Typography variant="caption" sx={{ opacity: 0.6 }}>
                  #{prevItem.episodio} ({formatarData(prevItem.dataHora, idioma.intl)}) → #{item.episodio} ({formatarData(item.dataHora, idioma.intl)})
                </Typography>
              </Box>
              <Grid container spacing={2}>
                {[
                  { label: t('treinamento.rewardMedio'), prev: prevItem.rewardMedio, curr: item.rewardMedio, fmt: (v) => formatarNumero(v), inverted: false, key: 'reward' },
                  { label: t('treinamento.winRate'), prev: prevItem.winRate, curr: item.winRate, fmt: (v) => formatarPercentual(v), inverted: false, key: 'winrate' },
                  { label: t('treinamento.lossLabel'), prev: prevItem.lossMedia, curr: item.lossMedia, fmt: (v) => formatarNumero(v), inverted: true, key: 'loss' },
                  { label: t('treinamento.epsilon'), prev: prevItem.epsilon, curr: item.epsilon, fmt: (v) => formatarNumero(v), inverted: true, key: 'epsilon' },
                  { label: t('treinamento.durationLabel'), prev: prevItem.duracaoSegundos, curr: item.duracaoSegundos, fmt: (v) => formatarNumero(v, 1), inverted: true, key: 'duration' },
                ].map(({ label, prev, curr, fmt, inverted, key }) => {
                  const d = (curr ?? 0) - (prev ?? 0)
                  return (
                    <Grid size={{ xs: 6, sm: 4, md: 2.4 }} key={key}>
                      <Box sx={{ textAlign: 'center', p: 1.5, borderRadius: 1, background: subtleBg(dk) }}>
                        <Typography variant="caption" sx={{ opacity: 0.65, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 10, display: 'block', mb: 0.5 }}>{label}</Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                          <Typography variant="body2" sx={{ opacity: 0.5 }}>{fmt(prev)}</Typography>
                          <Typography variant="caption" sx={{ opacity: 0.3 }}>→</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{fmt(curr)}</Typography>
                        </Box>
                        <Typography variant="caption" sx={{ color: deltaColor(d, inverted), fontWeight: 700, fontSize: 12 }}>
                          {d >= 0 ? '▲' : '▼'} {deltaSign(d)}{key === 'winrate' ? `${(d * 100).toFixed(2)}pp` : formatarNumero(d, key === 'duration' ? 1 : 4)}
                        </Typography>
                      </Box>
                    </Grid>
                  )
                })}
              </Grid>
            </Paper>
          </Box>
        )}

      </Box>
    </div>
  )
}
