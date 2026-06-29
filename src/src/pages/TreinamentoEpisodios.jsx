import { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import Paper from '@mui/material/Paper'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TablePagination from '@mui/material/TablePagination'
import TableSortLabel from '@mui/material/TableSortLabel'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Grid from '@mui/material/Grid'
import { MdArrowBack, MdRefresh, MdPsychology, MdTrendingUp, MdEmojiEvents, MdShowChart, MdInsights } from 'react-icons/md'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  TimeScale,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import 'chartjs-adapter-date-fns'
import { ptBR } from 'date-fns/locale'
import zoomPlugin from 'chartjs-plugin-zoom'
import { Line, Bar, Scatter } from 'react-chartjs-2'
import ErrorMessage from '../components/ErrorMessage'
import { apiRequest, TreinamentoEpisodioEndpoint } from '../utils/apiClient'

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, BarElement, TimeScale,
  Title, Tooltip, Legend, Filler, zoomPlugin,
)

const ZOOM_CONFIG = {
  pan: { enabled: true, mode: 'x', modifierKey: null },
  zoom: {
    wheel: { enabled: true, speed: 0.1 },
    pinch: { enabled: true },
    drag: { enabled: false },
    mode: 'x',
  },
  limits: { x: { minRange: 1 } },
}

const COIN_COLORS = {
  BTC: '#F7931A', ETH: '#627EEA', BNB: '#F3BA2F', SOL: '#14F195',
  XRP: '#23292F', ADA: '#0033AD', DOGE: '#C2A633', LTC: '#345D9D',
  LINK: '#2A5ADA',
}
const ACCENT = '#FFD700'

const formatNumber = (value, digits = 4) => {
  if (value === null || value === undefined || Number.isNaN(value)) return '-'
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}
const formatPercent = (value) => {
  if (value === null || value === undefined || Number.isNaN(value)) return '-'
  return `${(Number(value) * 100).toFixed(2)}%`
}
const formatDate = (value) => {
  if (!value) return '-'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString()
}

const movingAverage = (arr, window = 5) => {
  return arr.map((_, i) => {
    const start = Math.max(0, i - window + 1)
    const slice = arr.slice(start, i + 1)
    return slice.reduce((a, b) => a + b, 0) / slice.length
  })
}

const COLUMNS = [
  { id: 'episodio', label: 'Episódio', numeric: true },
  { id: 'dataHora', label: 'Data/Hora', numeric: false },
  { id: 'moeda', label: 'Moeda', numeric: false },
  { id: 'rewardMedio', label: 'Reward Médio', numeric: true },
  { id: 'rewardTotal', label: 'Reward Total', numeric: true },
  { id: 'lossMedia', label: 'Loss Média', numeric: true },
  { id: 'epsilon', label: 'Epsilon', numeric: true },
  { id: 'winRate', label: 'Win Rate', numeric: true },
  { id: 'duracaoSegundos', label: 'Duração (s)', numeric: true },
]

const CHART_BG = 'rgba(255,255,255,0.04)'
const CHART_BORDER = 'rgba(255,255,255,0.08)'

const baseChartOptions = (extra = {}) => {
  const { plugins: extraPlugins, scales: extraScales, ...rest } = extra
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { labels: { color: '#e0e0e0', usePointStyle: true, padding: 12 } },
      tooltip: {
        backgroundColor: 'rgba(15,15,20,0.95)',
        borderColor: 'rgba(255,215,0,0.4)',
        borderWidth: 1,
        titleColor: ACCENT,
        bodyColor: '#fff',
        padding: 10,
      },
      zoom: ZOOM_CONFIG,
      ...(extraPlugins || {}),
    },
    scales: extraScales || {
      x: { ticks: { color: '#aaa', maxRotation: 0, autoSkip: true }, grid: { color: 'rgba(255,255,255,0.05)' } },
      y: { ticks: { color: '#aaa' }, grid: { color: 'rgba(255,255,255,0.05)' } },
    },
    ...rest,
  }
}

function KpiCard({ icon, label, value, sub }) {
  return (
    <Paper
      sx={{
        p: 2.5,
        height: '100%',
        background: 'linear-gradient(135deg, rgba(255,215,0,0.08), rgba(255,255,255,0.03))',
        border: '1px solid rgba(255,215,0,0.15)',
        backdropFilter: 'blur(10px)',
        color: 'white',
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, opacity: 0.85 }}>
        <Box sx={{ color: ACCENT, display: 'flex' }}>{icon}</Box>
        <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: 1, fontSize: 11 }}>
          {label}
        </Typography>
      </Box>
      <Typography variant="h4" sx={{ fontWeight: 700, color: ACCENT, lineHeight: 1.2 }}>
        {value}
      </Typography>
      {sub && <Typography variant="caption" sx={{ opacity: 0.7 }}>{sub}</Typography>}
    </Paper>
  )
}

function ZoomableChartCard({ title, subtitle, height, ChartComp, data, options, plugins }) {
  const ref = useRef(null)
  const reset = () => ref.current?.resetZoom?.()
  return (
    <ChartCard
      title={title}
      subtitle={subtitle}
      height={height}
      action={
        <Button
          size="small"
          onClick={reset}
          startIcon={<MdRefresh size={14} />}
          sx={{ color: 'rgba(255,255,255,0.65)', fontSize: 11, minWidth: 'auto', textTransform: 'none' }}
        >
          reset
        </Button>
      }
    >
      <ChartComp ref={ref} data={data} options={options} plugins={plugins} />
    </ChartCard>
  )
}

function EvolucaoCard({ items, onSelectCoin }) {
  if (!items || items.length === 0) return null
  const sorted = [...items].sort((a, b) => (b.episodios ?? 0) - (a.episodios ?? 0))
  return (
    <Paper sx={{
      p: 2.5,
      background: CHART_BG,
      border: `1px solid ${CHART_BORDER}`,
      backdropFilter: 'blur(10px)',
      color: 'white',
    }}>
      <Box sx={{ mb: 1.5 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Evolução desde o início</Typography>
        <Typography variant="caption" sx={{ opacity: 0.6 }}>
          Comparativo entre o primeiro episódio registrado e o atual, por moeda · clique para filtrar
        </Typography>
      </Box>
      <TableContainer>
        <Table size="small" sx={{ '& td, & th': { color: 'white', borderColor: 'rgba(255,255,255,0.08)' } }}>
          <TableHead>
            <TableRow>
              <TableCell>Moeda</TableCell>
              <TableCell align="right">Episódios</TableCell>
              <TableCell align="right">Reward inicial → atual</TableCell>
              <TableCell align="right">Win rate inicial → atual</TableCell>
              <TableCell align="right">Loss médio</TableCell>
              <TableCell align="right">Última atualização</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sorted.map((r) => {
              const rewardDelta = (r.rewardAtual ?? 0) - (r.rewardInicial ?? 0)
              const wrDelta = (r.winRateAtual ?? 0) - (r.winRateInicial ?? 0)
              const rewardColor = rewardDelta >= 0 ? '#14F195' : '#FF5C7C'
              const wrColor = wrDelta >= 0 ? '#14F195' : '#FF5C7C'
              return (
                <TableRow
                  key={r.moeda}
                  hover
                  onClick={() => onSelectCoin?.(r.moeda)}
                  sx={{ cursor: 'pointer', '&:hover': { background: 'rgba(255,255,255,0.06)' } }}
                >
                  <TableCell>
                    <Chip
                      label={r.moeda}
                      size="small"
                      sx={{
                        background: (COIN_COLORS[r.moeda] || '#888') + '33',
                        color: COIN_COLORS[r.moeda] || 'white',
                        border: `1px solid ${(COIN_COLORS[r.moeda] || '#888')}66`,
                        fontWeight: 600,
                      }}
                    />
                  </TableCell>
                  <TableCell align="right">{r.episodios}</TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
                      <Typography variant="caption" sx={{ opacity: 0.6 }}>{formatNumber(r.rewardInicial, 3)}</Typography>
                      <Typography variant="caption" sx={{ opacity: 0.4 }}>→</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{formatNumber(r.rewardAtual, 3)}</Typography>
                      <Typography variant="caption" sx={{ color: rewardColor, fontWeight: 700, minWidth: 56, textAlign: 'right' }}>
                        {rewardDelta >= 0 ? '+' : ''}{formatNumber(rewardDelta, 3)}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
                      <Typography variant="caption" sx={{ opacity: 0.6 }}>{formatPercent(r.winRateInicial)}</Typography>
                      <Typography variant="caption" sx={{ opacity: 0.4 }}>→</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{formatPercent(r.winRateAtual)}</Typography>
                      <Typography variant="caption" sx={{ color: wrColor, fontWeight: 700, minWidth: 56, textAlign: 'right' }}>
                        {wrDelta >= 0 ? '+' : ''}{(wrDelta * 100).toFixed(2)}pp
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell align="right">{formatNumber(r.lossMedio, 2)}</TableCell>
                  <TableCell align="right">
                    <Typography variant="caption" sx={{ opacity: 0.7 }}>{formatDate(r.dataHoraAtual)}</Typography>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  )
}

function TopEpisodiosCard({ title, subtitle, items, accent, onOpen }) {
  return (
    <Paper sx={{
      p: 2.5,
      background: CHART_BG,
      border: `1px solid ${CHART_BORDER}`,
      backdropFilter: 'blur(10px)',
      color: 'white',
      height: '100%',
    }}>
      <Box sx={{ mb: 1.5 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{title}</Typography>
        {subtitle && <Typography variant="caption" sx={{ opacity: 0.6 }}>{subtitle}</Typography>}
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {items.map((r, idx) => (
          <Box
            key={r.idTreinamentoEpisodio}
            onClick={() => onOpen(r.idTreinamentoEpisodio)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              p: 1,
              borderRadius: 1,
              cursor: 'pointer',
              background: 'rgba(255,255,255,0.03)',
              borderLeft: `3px solid ${accent}`,
              '&:hover': { background: 'rgba(255,255,255,0.07)' },
            }}
          >
            <Typography variant="caption" sx={{ opacity: 0.5, width: 18, textAlign: 'center' }}>#{idx + 1}</Typography>
            <Chip
              label={r.moeda}
              size="small"
              sx={{
                background: (COIN_COLORS[r.moeda] || '#888') + '33',
                color: COIN_COLORS[r.moeda] || 'white',
                border: `1px solid ${(COIN_COLORS[r.moeda] || '#888')}66`,
                fontWeight: 600,
                minWidth: 56,
              }}
            />
            <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 50 }}>#{r.episodio}</Typography>
            <Typography variant="body2" sx={{ color: accent, fontWeight: 600, ml: 'auto' }}>
              {formatNumber(r.rewardMedio, 4)}
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.7, minWidth: 60, textAlign: 'right' }}>
              {formatPercent(r.winRate)}
            </Typography>
          </Box>
        ))}
        {items.length === 0 && (
          <Typography variant="caption" sx={{ opacity: 0.5, py: 2, textAlign: 'center' }}>Sem dados</Typography>
        )}
      </Box>
    </Paper>
  )
}

function ChartCard({ title, subtitle, children, height = { xs: 280, md: 320 }, action }) {
  return (
    <Paper sx={{
      p: 2.5,
      height,
      background: CHART_BG,
      border: `1px solid ${CHART_BORDER}`,
      backdropFilter: 'blur(10px)',
      color: 'white',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5, gap: 1 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{title}</Typography>
          {subtitle && <Typography variant="caption" sx={{ opacity: 0.6 }}>{subtitle}</Typography>}
        </Box>
        {action}
      </Box>
      <Box sx={{ flex: 1, position: 'relative', minHeight: 0 }}>{children}</Box>
    </Paper>
  )
}

function ListView({ items, resumo, serie, loading, error, onRefresh, onOpen, selectedCoins, setSelectedCoins }) {
  const [orderBy, setOrderBy] = useState('episodio')
  const [order, setOrder] = useState('desc')
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(25)

  // Lista de moedas para o filtro vem do RESUMO (fonte de verdade global,
  // independente do filtro server-side atual). Cai pra items se resumo vazio.
  const coinsDisponiveis = useMemo(() => {
    if (resumo && resumo.length > 0) {
      return resumo.map((r) => r.moeda).filter(Boolean).sort()
    }
    const set = new Set(items.map((i) => i.moeda).filter(Boolean))
    return Array.from(set).sort()
  }, [items, resumo])

  // Quando exatamente 1 moeda está selecionada, o servidor já devolveu só ela.
  // Caso contrário (0 ou >1), filtramos client-side.
  const filtered = useMemo(() => {
    if (selectedCoins.length <= 1) return items
    return items.filter((i) => selectedCoins.includes(i.moeda))
  }, [items, selectedCoins])

  const toggleCoin = (coin) => {
    setSelectedCoins((cur) => cur.includes(coin) ? cur.filter((c) => c !== coin) : [...cur, coin])
    setPage(0)
  }

  const kpis = useMemo(() => {
    if (filtered.length === 0) {
      return { total: 0, rewardAvg: 0, winRateAvg: 0, bestCoin: '-' }
    }
    const total = filtered.length
    const rewardAvg = filtered.reduce((acc, r) => acc + (r.rewardMedio ?? 0), 0) / total
    const winRateAvg = filtered.reduce((acc, r) => acc + (r.winRate ?? 0), 0) / total
    const byCoin = filtered.reduce((acc, r) => {
      if (!r.moeda) return acc
      acc[r.moeda] = acc[r.moeda] || { sum: 0, count: 0 }
      acc[r.moeda].sum += r.rewardMedio ?? 0
      acc[r.moeda].count += 1
      return acc
    }, {})
    const bestCoin = Object.entries(byCoin)
      .map(([coin, v]) => ({ coin, avg: v.sum / v.count }))
      .sort((a, b) => b.avg - a.avg)[0]
    return {
      total,
      rewardAvg,
      winRateAvg,
      bestCoin: bestCoin ? `${bestCoin.coin}` : '-',
      bestCoinAvg: bestCoin ? bestCoin.avg : 0,
    }
  }, [filtered])

  // Série temporal ordenada por data/hora ascendente (preserva múltiplos ciclos)
  const timeline = useMemo(() => {
    return [...filtered].sort(
      (a, b) => new Date(a.dataHora).getTime() - new Date(b.dataHora).getTime()
    )
  }, [filtered])

  // Labels mostram "#ep" mas como pode haver duplicação entre ciclos,
  // o tooltip vai diferenciar pelo dataset/contexto.
  const moedaServerFilter = selectedCoins.length === 1 ? selectedCoins[0] : null

  // Se /serie está disponível (1 moeda), usamos os dados suavizados do backend
  // como fonte primária para as séries. Caso contrário, derivamos de timeline.
  const usingSerie = Array.isArray(serie) && serie.length > 0
  const serieSorted = useMemo(() => {
    if (!usingSerie) return []
    return [...serie].sort((a, b) => new Date(a.dataHora).getTime() - new Date(b.dataHora).getTime())
  }, [serie, usingSerie])

  const labels = usingSerie
    ? serieSorted.map((r) => `#${r.episodio}`)
    : timeline.map((r) => `#${r.episodio}`)
  const rewardSeries = usingSerie
    ? serieSorted.map((r) => r.rewardMedio ?? 0)
    : timeline.map((r) => r.rewardMedio ?? 0)
  // Backend já calcula a média móvel; quando não temos serie, calculamos client-side
  const rewardMA = usingSerie
    ? serieSorted.map((r) => r.rewardMedioMediaMovel ?? r.rewardMedio ?? 0)
    : movingAverage(rewardSeries, 5)
  const lossSeries = usingSerie
    ? serieSorted.map((r) => r.lossMedia ?? 0)
    : timeline.map((r) => r.lossMedia ?? 0)
  const epsilonSeries = usingSerie
    ? serieSorted.map((r) => r.epsilon ?? 0)
    : timeline.map((r) => r.epsilon ?? 0)
  const winRateSeries = usingSerie
    ? serieSorted.map((r) => (r.winRateMediaMovel ?? r.winRate ?? 0) * 100)
    : timeline.map((r) => (r.winRate ?? 0) * 100)

  const rewardData = {
    labels,
    datasets: [
      {
        label: 'Reward médio',
        data: rewardSeries,
        borderColor: 'rgba(255,215,0,0.55)',
        backgroundColor: 'rgba(255,215,0,0.10)',
        fill: true,
        tension: 0.35,
        pointRadius: 0,
        borderWidth: 1.5,
      },
      {
        label: 'Média móvel (5)',
        data: rewardMA,
        borderColor: ACCENT,
        backgroundColor: 'transparent',
        borderWidth: 2.5,
        tension: 0.4,
        pointRadius: 0,
      },
    ],
  }

  const lossEpsilonData = {
    labels,
    datasets: [
      {
        label: 'Loss média',
        data: lossSeries,
        borderColor: '#FF5C7C',
        backgroundColor: 'rgba(255,92,124,0.12)',
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        yAxisID: 'y',
        borderWidth: 2,
      },
      {
        label: 'Epsilon',
        data: epsilonSeries,
        borderColor: '#5CB8FF',
        backgroundColor: 'transparent',
        borderWidth: 2,
        tension: 0.3,
        pointRadius: 0,
        yAxisID: 'y1',
        borderDash: [4, 4],
      },
    ],
  }

  const winRateData = {
    labels,
    datasets: [
      {
        label: 'Win rate (%)',
        data: winRateSeries,
        borderColor: '#14F195',
        backgroundColor: 'rgba(20,241,149,0.15)',
        fill: true,
        tension: 0.35,
        pointRadius: 0,
        borderWidth: 2,
      },
    ],
  }

  // Distribuição de ações agregada por moeda
  const acoesPorMoeda = useMemo(() => {
    const agg = {}
    filtered.forEach((r) => {
      if (!r.moeda) return
      agg[r.moeda] = agg[r.moeda] || { hold: 0, compra: 0, venda: 0 }
      agg[r.moeda].hold += r.acoesHold ?? 0
      agg[r.moeda].compra += r.acoesCompra ?? 0
      agg[r.moeda].venda += r.acoesVenda ?? 0
    })
    const moedas = Object.keys(agg).sort()
    return {
      labels: moedas,
      datasets: [
        {
          label: 'Hold',
          data: moedas.map((m) => agg[m].hold),
          backgroundColor: 'rgba(160,160,160,0.85)',
          borderRadius: 4,
        },
        {
          label: 'Compra',
          data: moedas.map((m) => agg[m].compra),
          backgroundColor: 'rgba(20,241,149,0.85)',
          borderRadius: 4,
        },
        {
          label: 'Venda',
          data: moedas.map((m) => agg[m].venda),
          backgroundColor: 'rgba(255,92,124,0.85)',
          borderRadius: 4,
        },
      ],
    }
  }, [filtered])

  // Detecta ciclos: novo ciclo quando o número do episódio CAI (reset do treino)
  // ou quando há um gap temporal grande entre episódios consecutivos.
  const cycles = useMemo(() => {
    if (timeline.length === 0) return []
    if (timeline.length === 1) {
      const t = new Date(timeline[0].dataHora).getTime()
      return [{ start: t, end: t, startEp: timeline[0].episodio, endEp: timeline[0].episodio, count: 1 }]
    }
    const gaps = []
    for (let i = 1; i < timeline.length; i++) {
      const prev = new Date(timeline[i - 1].dataHora).getTime()
      const cur = new Date(timeline[i].dataHora).getTime()
      gaps.push(cur - prev)
    }
    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length
    const gapThreshold = Math.max(60_000, avgGap * 3)
    const result = []
    let startIdx = 0
    for (let i = 1; i < timeline.length; i++) {
      const prev = timeline[i - 1]
      const cur = timeline[i]
      const prevTime = new Date(prev.dataHora).getTime()
      const curTime = new Date(cur.dataHora).getTime()
      const episodeReset = (cur.episodio ?? 0) < (prev.episodio ?? 0)
      const longGap = curTime - prevTime > gapThreshold
      if (episodeReset || longGap) {
        result.push({
          start: new Date(timeline[startIdx].dataHora).getTime(),
          end: prevTime,
          startEp: timeline[startIdx].episodio,
          endEp: prev.episodio,
          count: i - startIdx,
        })
        startIdx = i
      }
    }
    result.push({
      start: new Date(timeline[startIdx].dataHora).getTime(),
      end: new Date(timeline[timeline.length - 1].dataHora).getTime(),
      startEp: timeline[startIdx].episodio,
      endEp: timeline[timeline.length - 1].episodio,
      count: timeline.length - startIdx,
    })
    return result
  }, [timeline])

  // Plugin para desenhar bandas de ciclo no fundo do gráfico de timeline
  const cycleBandsPlugin = useMemo(() => ({
    id: 'cycleBands',
    beforeDatasetsDraw: (chart) => {
      if (cycles.length <= 1) return
      const { ctx, chartArea, scales } = chart
      if (!chartArea || !scales.x) return
      ctx.save()
      cycles.forEach((c, idx) => {
        const color = idx % 2 === 0 ? [255, 215, 0] : [92, 184, 255]
        const x1 = scales.x.getPixelForValue(c.start)
        const x2 = scales.x.getPixelForValue(c.end)
        const w = Math.max(2, x2 - x1)
        // banda
        ctx.fillStyle = `rgba(${color.join(',')},0.18)`
        ctx.fillRect(x1, chartArea.top, w, chartArea.bottom - chartArea.top)
        // borda inicial vertical
        ctx.strokeStyle = `rgba(${color.join(',')},0.5)`
        ctx.lineWidth = 1
        ctx.setLineDash([4, 4])
        ctx.beginPath()
        ctx.moveTo(x1, chartArea.top)
        ctx.lineTo(x1, chartArea.bottom)
        ctx.stroke()
        ctx.setLineDash([])
        // rótulo do ciclo
        ctx.fillStyle = `rgba(${color.join(',')},0.95)`
        ctx.font = 'bold 12px sans-serif'
        ctx.fillText(`Ciclo ${idx + 1} (${c.count} ep.)`, x1 + 6, chartArea.top + 16)
      })
      ctx.restore()
    },
  }), [cycles])

  // Reward acumulado por episódio (soma cumulativa do rewardTotal)
  const cumulativeRewardData = useMemo(() => {
    let acc = 0
    const data = timeline.map((r) => {
      acc += r.rewardTotal ?? 0
      return acc
    })
    return {
      labels,
      datasets: [{
        label: 'Reward acumulado',
        data,
        borderColor: '#A78BFA',
        backgroundColor: 'rgba(167,139,250,0.18)',
        fill: true,
        tension: 0.35,
        pointRadius: 0,
        borderWidth: 2,
      }],
    }
  }, [timeline, labels])

  // Duração por episódio
  const duracaoData = useMemo(() => ({
    labels,
    datasets: [{
      label: 'Duração (s)',
      data: timeline.map((r) => r.duracaoSegundos ?? 0),
      borderColor: '#FFB547',
      backgroundColor: 'rgba(255,181,71,0.15)',
      fill: true,
      tension: 0.3,
      pointRadius: 0,
      borderWidth: 2,
    }],
  }), [timeline, labels])

  // Comparativo por moeda (barras agrupadas: reward médio escalado, win rate %, qty episódios)
  const comparativoMoedaData = useMemo(() => {
    const agg = {}
    filtered.forEach((r) => {
      if (!r.moeda) return
      agg[r.moeda] = agg[r.moeda] || { rewards: [], winRates: [], qty: 0 }
      agg[r.moeda].rewards.push(r.rewardMedio ?? 0)
      agg[r.moeda].winRates.push((r.winRate ?? 0) * 100)
      agg[r.moeda].qty += 1
    })
    const moedas = Object.keys(agg).sort()
    return {
      labels: moedas,
      datasets: [
        {
          label: 'Reward médio (×100)',
          data: moedas.map((m) => {
            const arr = agg[m].rewards
            return (arr.reduce((a, b) => a + b, 0) / arr.length) * 100
          }),
          backgroundColor: 'rgba(255,215,0,0.75)',
          borderRadius: 4,
        },
        {
          label: 'Win rate (%)',
          data: moedas.map((m) => {
            const arr = agg[m].winRates
            return arr.reduce((a, b) => a + b, 0) / arr.length
          }),
          backgroundColor: 'rgba(20,241,149,0.75)',
          borderRadius: 4,
        },
        {
          label: 'Nº episódios',
          data: moedas.map((m) => agg[m].qty),
          backgroundColor: 'rgba(92,184,255,0.75)',
          borderRadius: 4,
        },
      ],
    }
  }, [filtered])

  // Top 5 melhores e piores por reward médio
  const tops = useMemo(() => {
    const arr = [...filtered].sort((a, b) => (b.rewardMedio ?? -Infinity) - (a.rewardMedio ?? -Infinity))
    return {
      best: arr.slice(0, 5),
      worst: arr.slice(-5).reverse(),
    }
  }, [filtered])

  // Linha do tempo: scatter X=dataHora, Y=episódio, ponto colorido por moeda,
  // raio proporcional à duração do treinamento.
  const timelineData = useMemo(() => {
    const byCoin = filtered.reduce((acc, r) => {
      if (!r.moeda || !r.dataHora) return acc
      acc[r.moeda] = acc[r.moeda] || []
      acc[r.moeda].push({
        x: new Date(r.dataHora).getTime(),
        y: r.episodio ?? 0,
        duracao: r.duracaoSegundos ?? 0,
        rewardMedio: r.rewardMedio ?? 0,
        winRate: r.winRate ?? 0,
        id: r.idTreinamentoEpisodio,
      })
      return acc
    }, {})
    const duracoes = filtered.map((r) => r.duracaoSegundos ?? 0)
    const dMin = Math.min(...duracoes)
    const dMax = Math.max(...duracoes)
    const scale = (d) => {
      if (dMax === dMin) return 5
      return 3 + ((d - dMin) / (dMax - dMin)) * 9
    }
    return {
      datasets: Object.entries(byCoin).sort(([a], [b]) => a.localeCompare(b)).map(([coin, pts]) => ({
        label: coin,
        data: pts,
        backgroundColor: (COIN_COLORS[coin] || '#888') + 'CC',
        borderColor: COIN_COLORS[coin] || '#888',
        borderWidth: 1,
        pointRadius: pts.map((p) => scale(p.duracao)),
        pointHoverRadius: pts.map((p) => scale(p.duracao) + 2),
      })),
    }
  }, [filtered])

  const sorted = useMemo(() => {
    const copy = [...filtered]
    copy.sort((a, b) => {
      const av = a[orderBy]
      const bv = b[orderBy]
      if (av === bv) return 0
      const cmp = av > bv ? 1 : -1
      return order === 'asc' ? cmp : -cmp
    })
    return copy
  }, [filtered, orderBy, order])

  const handleSort = (id) => {
    if (orderBy === id) setOrder(order === 'asc' ? 'desc' : 'asc')
    else { setOrderBy(id); setOrder('desc') }
  }

  const pageItems = sorted.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, color: 'white' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <MdPsychology size={28} color={ACCENT} />
          <Box>
            <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>Treinamento de IA</Typography>
            <Typography variant="caption" sx={{ opacity: 0.65 }}>Curva de aprendizado e métricas por episódio</Typography>
          </Box>
        </Box>
        <Button
          variant="outlined"
          startIcon={<MdRefresh />}
          onClick={onRefresh}
          disabled={loading}
          sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.4)' }}
        >
          Atualizar
        </Button>
      </Box>

      {error && <ErrorMessage message={error} />}

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress sx={{ color: ACCENT }} />
        </Box>
      )}

      {!loading && !error && (
        <>
          {/* Filtro de moedas */}
          {coinsDisponiveis.length > 0 && (
            <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography variant="caption" sx={{ opacity: 0.7, mr: 1 }}>FILTRAR POR MOEDA:</Typography>
              {coinsDisponiveis.map((coin) => {
                const active = selectedCoins.includes(coin)
                const color = COIN_COLORS[coin] || '#888'
                return (
                  <Chip
                    key={coin}
                    label={coin}
                    onClick={() => toggleCoin(coin)}
                    size="small"
                    sx={{
                      cursor: 'pointer',
                      background: active ? color : 'rgba(255,255,255,0.08)',
                      color: active ? '#000' : 'white',
                      fontWeight: active ? 700 : 400,
                      border: `1px solid ${active ? color : 'rgba(255,255,255,0.15)'}`,
                      '&:hover': { background: active ? color : 'rgba(255,255,255,0.15)' },
                    }}
                  />
                )
              })}
              {selectedCoins.length > 0 && (
                <Button size="small" onClick={() => setSelectedCoins([])} sx={{ color: 'rgba(255,255,255,0.7)' }}>
                  limpar
                </Button>
              )}
            </Box>
          )}

          {/* KPIs */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid size={{ xs: 6, md: 2.4 }}>
              <KpiCard icon={<MdInsights size={20} />} label="Episódios" value={kpis.total} />
            </Grid>
            <Grid size={{ xs: 6, md: 2.4 }}>
              <KpiCard icon={<MdTrendingUp size={20} />} label="Reward médio" value={formatNumber(kpis.rewardAvg, 3)} sub="média do conjunto" />
            </Grid>
            <Grid size={{ xs: 6, md: 2.4 }}>
              <KpiCard icon={<MdShowChart size={20} />} label="Win rate médio" value={formatPercent(kpis.winRateAvg)} />
            </Grid>
            <Grid size={{ xs: 6, md: 2.4 }}>
              <KpiCard icon={<MdEmojiEvents size={20} />} label="Melhor moeda" value={kpis.bestCoin} sub={kpis.bestCoin !== '-' ? `avg ${formatNumber(kpis.bestCoinAvg, 3)}` : null} />
            </Grid>
            <Grid size={{ xs: 6, md: 2.4 }}>
              <KpiCard icon={<MdPsychology size={20} />} label="Ciclos detectados" value={cycles.length} sub={cycles.length > 0 ? `mais recente: C${cycles.length}` : null} />
            </Grid>
          </Grid>

          {/* Evolução desde o início (vem do /resumo) */}
          {resumo && resumo.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <EvolucaoCard
                items={resumo}
                onSelectCoin={(coin) => setSelectedCoins([coin])}
              />
            </Box>
          )}

          {/* Gráficos */}
          <Box sx={{ mb: 2 }}>
            <ZoomableChartCard
              title="Linha do tempo dos treinamentos"
              subtitle={`Arraste para deslocar · scroll para zoom · ${cycles.length} ciclo${cycles.length === 1 ? '' : 's'} detectado${cycles.length === 1 ? '' : 's'} (faixas verticais)`}
              height={{ xs: 320, md: 420 }}
              ChartComp={Scatter}
              data={timelineData}
              plugins={[cycleBandsPlugin]}
              options={baseChartOptions({
                    scales: {
                      x: {
                        type: 'time',
                        adapters: { date: { locale: ptBR } },
                        time: { tooltipFormat: 'dd/MM HH:mm:ss', displayFormats: { minute: 'HH:mm', hour: 'HH:mm', day: 'dd/MM' } },
                        ticks: { color: '#aaa' },
                        grid: { color: 'rgba(255,255,255,0.05)' },
                      },
                      y: {
                        ticks: { color: '#aaa', precision: 0 },
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        title: { display: true, text: 'Episódio', color: '#aaa' },
                      },
                    },
                    plugins: {
                      legend: { labels: { color: '#e0e0e0', usePointStyle: true, padding: 12 } },
                      tooltip: {
                        backgroundColor: 'rgba(15,15,20,0.95)',
                        borderColor: 'rgba(255,215,0,0.4)',
                        borderWidth: 1,
                        titleColor: ACCENT,
                        bodyColor: '#fff',
                        padding: 10,
                        callbacks: {
                          title: (items) => {
                            const p = items[0]?.raw
                            return p ? `#${p.y} · ${items[0].dataset.label}` : ''
                          },
                          label: (ctx) => {
                            const p = ctx.raw
                            return [
                              `Data: ${new Date(p.x).toLocaleString()}`,
                              `Duração: ${p.duracao.toFixed(1)}s`,
                              `Reward: ${p.rewardMedio.toFixed(4)}`,
                              `Win rate: ${(p.winRate * 100).toFixed(2)}%`,
                            ]
                          },
                        },
                      },
                    },
                  })}
            />
          </Box>

          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid size={{ xs: 12, md: 6 }}>
              <ZoomableChartCard
                title="Curva de aprendizado"
                subtitle={usingSerie
                  ? `Suavização do backend (janela 5) para ${moedaServerFilter} · arraste/scroll`
                  : 'Reward médio por episódio + média móvel (5) · arraste/scroll'}
                ChartComp={Line}
                data={rewardData}
                options={baseChartOptions()}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <ZoomableChartCard
                title="Loss × Epsilon"
                subtitle="Convergência do modelo vs decaimento da exploração · arraste/scroll"
                ChartComp={Line}
                data={lossEpsilonData}
                options={baseChartOptions({
                  scales: {
                    x: { ticks: { color: '#aaa', maxRotation: 0, autoSkip: true }, grid: { color: 'rgba(255,255,255,0.05)' } },
                    y: { type: 'linear', position: 'left', ticks: { color: '#FF5C7C' }, grid: { color: 'rgba(255,255,255,0.05)' }, title: { display: true, text: 'Loss', color: '#FF5C7C' } },
                    y1: { type: 'linear', position: 'right', ticks: { color: '#5CB8FF' }, grid: { drawOnChartArea: false }, title: { display: true, text: 'Epsilon', color: '#5CB8FF' } },
                  },
                })}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <ZoomableChartCard
                title="Win rate"
                subtitle="Percentual de trades vencedores por episódio · arraste/scroll"
                ChartComp={Line}
                data={winRateData}
                options={baseChartOptions({
                  scales: {
                    x: { ticks: { color: '#aaa', maxRotation: 0, autoSkip: true }, grid: { color: 'rgba(255,255,255,0.05)' } },
                    y: { ticks: { color: '#aaa', callback: (v) => `${v}%` }, grid: { color: 'rgba(255,255,255,0.05)' }, min: 0, max: 100 },
                  },
                })}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <ZoomableChartCard
                title="Reward acumulado"
                subtitle="Trajetória global · arraste/scroll"
                ChartComp={Line}
                data={cumulativeRewardData}
                options={baseChartOptions()}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <ZoomableChartCard
                title="Duração por episódio"
                subtitle="Segundos gastos em cada treinamento · arraste/scroll"
                ChartComp={Line}
                data={duracaoData}
                options={baseChartOptions({
                  scales: {
                    x: { ticks: { color: '#aaa', maxRotation: 0, autoSkip: true }, grid: { color: 'rgba(255,255,255,0.05)' } },
                    y: { ticks: { color: '#aaa', callback: (v) => `${v}s` }, grid: { color: 'rgba(255,255,255,0.05)' } },
                  },
                })}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <ChartCard title="Comparativo por moeda" subtitle="Reward médio (×100), win rate e nº de episódios agregados">
                <Bar
                  data={comparativoMoedaData}
                  options={baseChartOptions({
                    scales: {
                      x: { ticks: { color: '#aaa' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                      y: { ticks: { color: '#aaa' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                    },
                  })}
                />
              </ChartCard>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <ChartCard title="Distribuição de ações por moeda" subtitle="Total acumulado de Hold / Compra / Venda">
                <Bar
                  data={acoesPorMoeda}
                  options={baseChartOptions({
                    scales: {
                      x: { stacked: true, ticks: { color: '#aaa' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                      y: { stacked: true, ticks: { color: '#aaa' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                    },
                  })}
                />
              </ChartCard>
            </Grid>
          </Grid>

          {/* Top 5 */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TopEpisodiosCard title="Top 5 melhores" subtitle="Maiores rewards médios" items={tops.best} accent="#14F195" onOpen={onOpen} />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TopEpisodiosCard title="Top 5 piores" subtitle="Menores rewards médios" items={tops.worst} accent="#FF5C7C" onOpen={onOpen} />
            </Grid>
          </Grid>

          {/* Tabela */}
          <Paper sx={{ background: CHART_BG, border: `1px solid ${CHART_BORDER}`, backdropFilter: 'blur(8px)', color: 'white' }}>
            <Box sx={{ p: 2, borderBottom: `1px solid ${CHART_BORDER}` }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Episódios</Typography>
              <Typography variant="caption" sx={{ opacity: 0.6 }}>Clique numa linha para ver detalhes</Typography>
            </Box>
            <TableContainer>
              <Table size="small" sx={{ '& td, & th': { color: 'white', borderColor: 'rgba(255,255,255,0.08)' } }}>
                <TableHead>
                  <TableRow>
                    {COLUMNS.map((col) => (
                      <TableCell key={col.id} align={col.numeric ? 'right' : 'left'} sortDirection={orderBy === col.id ? order : false}>
                        <TableSortLabel
                          active={orderBy === col.id}
                          direction={orderBy === col.id ? order : 'asc'}
                          onClick={() => handleSort(col.id)}
                          sx={{ color: 'white !important', '& .MuiTableSortLabel-icon': { color: 'white !important' } }}
                        >
                          {col.label}
                        </TableSortLabel>
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pageItems.map((row) => (
                    <TableRow
                      key={row.idTreinamentoEpisodio}
                      hover
                      onClick={() => onOpen(row.idTreinamentoEpisodio)}
                      sx={{ cursor: 'pointer', '&:hover': { background: 'rgba(255,255,255,0.06)' } }}
                    >
                      <TableCell align="right">{row.episodio}</TableCell>
                      <TableCell>{formatDate(row.dataHora)}</TableCell>
                      <TableCell>
                        <Chip
                          label={row.moeda}
                          size="small"
                          sx={{
                            background: (COIN_COLORS[row.moeda] || '#888') + '33',
                            color: COIN_COLORS[row.moeda] || 'white',
                            border: `1px solid ${(COIN_COLORS[row.moeda] || '#888')}66`,
                            fontWeight: 600,
                          }}
                        />
                      </TableCell>
                      <TableCell align="right">{formatNumber(row.rewardMedio)}</TableCell>
                      <TableCell align="right">{formatNumber(row.rewardTotal, 2)}</TableCell>
                      <TableCell align="right">{formatNumber(row.lossMedia)}</TableCell>
                      <TableCell align="right">{formatNumber(row.epsilon)}</TableCell>
                      <TableCell align="right">{formatPercent(row.winRate)}</TableCell>
                      <TableCell align="right">{formatNumber(row.duracaoSegundos, 2)}</TableCell>
                    </TableRow>
                  ))}
                  {pageItems.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={COLUMNS.length} align="center" sx={{ py: 4 }}>
                        Nenhum episódio encontrado.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div"
              count={sorted.length}
              page={page}
              onPageChange={(_, p) => setPage(p)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0) }}
              rowsPerPageOptions={[10, 25, 50, 100]}
              sx={{ color: 'white' }}
            />
          </Paper>
        </>
      )}
    </Box>
  )
}

function DetailView({ item, onBack }) {
  if (!item) {
    return (
      <Box sx={{ p: 4, color: 'white' }}>
        <Button startIcon={<MdArrowBack />} onClick={onBack} sx={{ color: 'white', mb: 2 }}>Voltar</Button>
        <Typography>Episódio não encontrado.</Typography>
      </Box>
    )
  }

  const total = (item.acoesHold ?? 0) + (item.acoesCompra ?? 0) + (item.acoesVenda ?? 0)
  const acoesData = {
    labels: ['Hold', 'Compra', 'Venda'],
    datasets: [{
      label: 'Ações',
      data: [item.acoesHold ?? 0, item.acoesCompra ?? 0, item.acoesVenda ?? 0],
      backgroundColor: ['rgba(160,160,160,0.85)', 'rgba(20,241,149,0.85)', 'rgba(255,92,124,0.85)'],
      borderRadius: 6,
    }],
  }

  const fields = [
    ['Episódio', item.episodio],
    ['Moeda', item.moeda],
    ['Data/Hora', formatDate(item.dataHora)],
    ['Reward Médio', formatNumber(item.rewardMedio)],
    ['Reward Total', formatNumber(item.rewardTotal, 2)],
    ['Loss Média', formatNumber(item.lossMedia)],
    ['Epsilon', formatNumber(item.epsilon)],
    ['Win Rate', formatPercent(item.winRate)],
    ['Ações Hold', item.acoesHold],
    ['Ações Compra', item.acoesCompra],
    ['Ações Venda', item.acoesVenda],
    ['Total de Steps', item.totalSteps],
    ['Duração (s)', formatNumber(item.duracaoSegundos, 2)],
    ['ID', item.idTreinamentoEpisodio],
  ]

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, color: 'white' }}>
      <Button startIcon={<MdArrowBack />} onClick={onBack} sx={{ color: 'white', mb: 2 }}>Voltar</Button>
      <Typography variant="h5" sx={{ mb: 1, fontWeight: 700 }}>Episódio #{item.episodio}</Typography>
      <Typography variant="body2" sx={{ mb: 3, opacity: 0.7 }}>
        <Chip
          label={item.moeda}
          size="small"
          sx={{
            background: (COIN_COLORS[item.moeda] || '#888') + '33',
            color: COIN_COLORS[item.moeda] || 'white',
            border: `1px solid ${(COIN_COLORS[item.moeda] || '#888')}66`,
            fontWeight: 600,
            mr: 1,
          }}
        />
        {formatDate(item.dataHora)}
      </Typography>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Paper sx={{ p: 3, background: CHART_BG, border: `1px solid ${CHART_BORDER}`, color: 'white' }}>
            <Grid container spacing={2}>
              {fields.map(([label, value]) => (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={label}>
                  <Typography variant="caption" sx={{ opacity: 0.65, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 10 }}>{label}</Typography>
                  <Typography variant="body1" sx={{ wordBreak: 'break-all', fontWeight: 500 }}>{value ?? '-'}</Typography>
                </Grid>
              ))}
            </Grid>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, md: 5 }}>
          <ChartCard title="Distribuição de ações" subtitle={`Total: ${total} ações`}>
            <Bar data={acoesData} options={baseChartOptions()} />
          </ChartCard>
        </Grid>
      </Grid>
    </Box>
  )
}

export default function TreinamentoEpisodios() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [resumo, setResumo] = useState([])
  const [serie, setSerie] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedCoins, setSelectedCoins] = useState([])
  const [refreshKey, setRefreshKey] = useState(0)

  // Filtro server-side só quando exatamente 1 moeda está selecionada.
  // 0 ou >1 → fetch all e filtramos no client (multi-seleção).
  const moedaServerFilter = selectedCoins.length === 1 ? selectedCoins[0] : null

  // Carrega LIST + RESUMO em paralelo. Refetcha quando moedaServerFilter muda.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    let canceled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [listResp, resumoResp] = await Promise.all([
          apiRequest(TreinamentoEpisodioEndpoint.LIST({ moeda: moedaServerFilter || undefined })),
          apiRequest(TreinamentoEpisodioEndpoint.RESUMO()),
        ])
        if (canceled) return
        const list = Array.isArray(listResp?.resultado)
          ? listResp.resultado
          : (Array.isArray(listResp) ? listResp : [])
        const res = Array.isArray(resumoResp?.resultado)
          ? resumoResp.resultado
          : (Array.isArray(resumoResp) ? resumoResp : [])
        setItems(list)
        setResumo(res)
      } catch (e) {
        if (!canceled) setError(e?.message || 'Falha ao carregar episódios')
      } finally {
        if (!canceled) setLoading(false)
      }
    }
    load()
    return () => { canceled = true }
  }, [moedaServerFilter, refreshKey])

  // /serie só faz sentido com 1 moeda. Cancela quando muda.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!moedaServerFilter) {
      setSerie(null)
      return
    }
    let canceled = false
    apiRequest(TreinamentoEpisodioEndpoint.SERIE({ moeda: moedaServerFilter, janela: 5 }))
      .then((resp) => {
        if (canceled) return
        const data = Array.isArray(resp?.resultado)
          ? resp.resultado
          : (Array.isArray(resp) ? resp : [])
        setSerie(data)
      })
      .catch(() => { if (!canceled) setSerie(null) })
    return () => { canceled = true }
  }, [moedaServerFilter, refreshKey])

  const refresh = () => setRefreshKey((k) => k + 1)

  if (id) {
    const item = items.find((i) => i.idTreinamentoEpisodio === id)
    if (loading && !item) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress sx={{ color: ACCENT }} />
        </Box>
      )
    }
    return <DetailView item={item} onBack={() => navigate('/treinamento-episodios')} />
  }

  return (
    <ListView
      items={items}
      resumo={resumo}
      serie={serie}
      loading={loading}
      error={error}
      onRefresh={refresh}
      onOpen={(rowId) => navigate(`/treinamento-episodios/${rowId}`)}
      selectedCoins={selectedCoins}
      setSelectedCoins={setSelectedCoins}
    />
  )
}
