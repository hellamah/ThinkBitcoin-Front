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
import { MdArrowBack, MdArrowForward, MdRefresh, MdPsychology, MdTrendingUp, MdTrendingDown, MdEmojiEvents, MdShowChart, MdInsights, MdTimer, MdCompareArrows, MdLeaderboard, MdSpeed } from 'react-icons/md'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  RadialLinearScale,
  TimeScale,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import 'chartjs-adapter-date-fns'
import { ptBR } from 'date-fns/locale'
import zoomPlugin from 'chartjs-plugin-zoom'
import { Line, Bar, Scatter, Doughnut, Radar } from 'react-chartjs-2'
import ErrorMessage from '../components/ErrorMessage'
import { apiRequest, TreinamentoEpisodioEndpoint, MarketEndpoint, VariavelExternaEndpoint } from '../utils/apiClient'
import { toUTCISO } from '../utils/dateUtils'

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, BarElement,
  ArcElement, RadialLinearScale, TimeScale,
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
  LINK: '#2A5ADA', PAXG: '#DBB43E',
}
const ACCENT = '#FFD700'

// Cor da moeda: usa a cor de marca quando existe; senão gera um HEX estável a
// partir do nome (moedas que só aparecem ao carregar janelas antigas, ex.: PAXG).
// Retorna sempre HEX de 6 dígitos para permitir sufixo de alpha (ex.: +'33').
const coinColor = (coin) => {
  if (COIN_COLORS[coin]) return COIN_COLORS[coin]
  if (!coin) return '#888888'
  let h = 0
  for (let i = 0; i < coin.length; i++) h = (h * 31 + coin.charCodeAt(i)) >>> 0
  const ch = (shift) => 80 + ((h >> shift) % 150) // faixa 80–229: nem escuro, nem estourado
  const hex = (n) => n.toString(16).padStart(2, '0')
  return `#${hex(ch(0))}${hex(ch(8))}${hex(ch(16))}`
}

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

// Backend aceita ISO 8601 sem timezone (ex.: 2026-07-01T16:00:00), casando com o
// formato de dataHora retornado. Componentes LOCAIS para bater com o eixo do gráfico.
const pad2 = (n) => String(n).padStart(2, '0')
const formatBackendDateTime = (ts) => {
  const d = new Date(ts)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
}

// As consultas trabalham em grupos (janelas) de 4 horas, alinhados à hora local.
const ONE_HOUR_MS = 60 * 60 * 1000
const FOUR_HOURS_MS = 4 * 60 * 60 * 1000
const FIVE_HOURS_MS = 5 * 60 * 60 * 1000

// Range inicial estável para o scatter (calculado uma vez no carregamento do módulo).
// Valores no nível do módulo garantem que scatterOptions nunca mude de referência,
// preservando o estado de zoom/pan do chartjs-plugin-zoom entre re-renders.
const _SCATTER_INIT_MAX = Date.now()
const _SCATTER_INIT_MIN = _SCATTER_INIT_MAX - FOUR_HOURS_MS
const bucketStartOf = (ts) => {
  const d = new Date(ts)
  d.setHours(Math.floor(d.getHours() / 4) * 4, 0, 0, 0)
  return d.getTime()
}

const extractLista = (resp) =>
  Array.isArray(resp?.resultado?.lista) ? resp.resultado.lista
    : Array.isArray(resp?.resultado) ? resp.resultado
      : []

// Busca TODOS os episódios de uma janela [inicioMs, fimMs), paginando se preciso.
const fetchWindow = async (moeda, versaoModelo, inicioMs, fimMs) => {
  const QTD = 1000
  const params = (pagina) => ({
    moeda: moeda || undefined,
    versaoModelo: versaoModelo || undefined,
    dataInicio: formatBackendDateTime(inicioMs),
    dataFim: formatBackendDateTime(fimMs),
    quantidade: QTD,
    pagina,
    ordenarAscendente: false,
  })
  const first = await apiRequest(TreinamentoEpisodioEndpoint.LIST(params(1)))
  let all = extractLista(first)
  const totalPaginas = first?.resultado?.totalPaginas ?? 1
  if (totalPaginas > 1) {
    const rest = await Promise.all(
      Array.from({ length: totalPaginas - 1 }, (_, i) =>
        apiRequest(TreinamentoEpisodioEndpoint.LIST(params(i + 2)))
      )
    )
    for (const r of rest) all = all.concat(extractLista(r))
  }
  return all
}

const mergeItems = (prev, novos) => {
  if (!novos || novos.length === 0) return prev
  const ids = new Set(prev.map((i) => i.idTreinamentoEpisodio))
  const add = novos.filter((i) => !ids.has(i.idTreinamentoEpisodio))
  return add.length > 0 ? [...prev, ...add] : prev
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
  { id: 'versaoModelo', label: 'Versão', numeric: false },
  { id: 'rewardMedio', label: 'Reward Médio', numeric: true },
  { id: 'rewardTotal', label: 'Reward Total', numeric: true },
  { id: 'lossMedia', label: 'Loss Média', numeric: true },
  { id: 'epsilon', label: 'Epsilon', numeric: true },
  { id: 'winRate', label: 'Win Rate', numeric: true },
  { id: 'duracaoSegundos', label: 'Duração (s)', numeric: true },
]

const CHART_BG = 'rgba(255,255,255,0.04)'
const CHART_BORDER = 'rgba(255,255,255,0.08)'

const X_TICKS = { color: '#aaa', maxRotation: 0, autoSkip: true, maxTicksLimit: 10 }

// Mostra "#ep · data/hora" no título do tooltip quando o dataset expõe `metaDates`
const tooltipTitleWithDate = (its) => {
  if (!its || its.length === 0) return ''
  const first = its[0]
  const d = first.chart?.data?.metaDates?.[first.dataIndex]
  if (!d) return first.label ?? ''
  const dt = new Date(d)
  return Number.isNaN(dt.getTime()) ? first.label : `${first.label} · ${dt.toLocaleString()}`
}

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
        callbacks: { title: tooltipTitleWithDate },
      },
      zoom: ZOOM_CONFIG,
      ...(extraPlugins || {}),
    },
    scales: extraScales || {
      x: { ticks: X_TICKS, grid: { color: 'rgba(255,255,255,0.05)' } },
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

function ZoomableChartCard({ title, subtitle, height, ChartComp, data, options, plugins, onReset }) {
  const ref = useRef(null)
  const reset = () => {
    ref.current?.resetZoom?.()
    onReset?.()
  }
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
                        background: coinColor(r.moeda) + '33',
                        color: coinColor(r.moeda),
                        border: `1px solid ${coinColor(r.moeda)}66`,
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
                background: coinColor(r.moeda) + '33',
                color: coinColor(r.moeda),
                border: `1px solid ${coinColor(r.moeda)}66`,
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

function ListView({ items, resumo, serie, loading, loadingRange, error, onRefresh, onOpen, selectedCoins, setSelectedCoins, selectedVersao, setSelectedVersao, visibleRange, setVisibleRange }) {
  const [orderBy, setOrderBy] = useState('episodio')
  const [order, setOrder] = useState('desc')
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(25)

  const handleRangeChange = useCallback((chart) => {
    const { min, max } = chart.scales.x
    setVisibleRange({ min, max })
  }, [setVisibleRange])

  const resetVisibleRange = useCallback(() => setVisibleRange({ min: null, max: null }), [setVisibleRange])

  // Opções memoizadas: o react-chartjs-2 reaplica `options` (Object.assign) a cada
  // mudança de referência, sobrescrevendo scales.x.min/max que o plugin de zoom usa —
  // o que reseta zoom/pan a cada re-render. Mantê-las estáveis preserva o zoom.
  const scatterOptions = useMemo(() => baseChartOptions({
    scales: {
      x: {
        type: 'time',
        adapters: { date: { locale: ptBR } },
        time: { tooltipFormat: 'dd/MM HH:mm:ss', displayFormats: { minute: 'HH:mm', hour: 'HH:mm', day: 'dd/MM' } },
        min: _SCATTER_INIT_MIN,
        max: _SCATTER_INIT_MAX,
        ticks: { color: '#aaa' },
        grid: { color: 'rgba(255,255,255,0.05)' },
      },
      y: {
        ticks: { color: '#aaa', precision: 0 },
        grid: { color: 'rgba(255,255,255,0.05)' },
        title: { display: true, text: 'Episódio', color: '#aaa' },
      },
    },
    interaction: { mode: 'nearest', intersect: true },
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
          title: (its) => {
            const p = its[0]?.raw
            return p ? `#${p.y} · ${its[0].dataset.label}` : ''
          },
          label: (ctx) => {
            const p = ctx.raw
            return [
              `Data: ${new Date(p.x).toLocaleString()}`,
              ...(p.versaoModelo ? [`Versão: ${p.versaoModelo}`] : []),
              `Duração: ${p.duracao.toFixed(1)}s`,
              `Reward: ${p.rewardMedio.toFixed(4)}`,
              `Win rate: ${(p.winRate * 100).toFixed(2)}%`,
            ]
          },
        },
      },
      zoom: {
        ...ZOOM_CONFIG,
        limits: { x: { minRange: ONE_HOUR_MS, maxRange: FIVE_HOURS_MS } },
        zoom: { ...ZOOM_CONFIG.zoom, onZoom: ({ chart }) => handleRangeChange(chart) },
        pan: { ...ZOOM_CONFIG.pan, onPan: ({ chart }) => handleRangeChange(chart) },
      },
    },
  }), [handleRangeChange])

  const defaultChartOptions = useMemo(() => baseChartOptions(), [])
  const lossEpsilonOptions = useMemo(() => baseChartOptions({
    scales: {
      x: { ticks: X_TICKS, grid: { color: 'rgba(255,255,255,0.05)' } },
      y: { type: 'linear', position: 'left', beginAtZero: true, ticks: { color: '#FF5C7C' }, grid: { color: 'rgba(255,255,255,0.05)' }, title: { display: true, text: 'Loss', color: '#FF5C7C' } },
      y1: { type: 'linear', position: 'right', min: 0, max: 1, ticks: { color: '#5CB8FF' }, grid: { drawOnChartArea: false }, title: { display: true, text: 'Epsilon', color: '#5CB8FF' } },
    },
  }), [])
  const winRateOptions = useMemo(() => baseChartOptions({
    scales: {
      x: { ticks: X_TICKS, grid: { color: 'rgba(255,255,255,0.05)' } },
      y: { ticks: { color: '#aaa', callback: (v) => `${v}%` }, grid: { color: 'rgba(255,255,255,0.05)' }, min: 0, suggestedMax: 60 },
    },
  }), [])
  const duracaoOptions = useMemo(() => baseChartOptions({
    scales: {
      x: { ticks: { color: '#aaa', maxRotation: 0, autoSkip: true }, grid: { color: 'rgba(255,255,255,0.05)' } },
      y: { ticks: { color: '#aaa', callback: (v) => `${v}s` }, grid: { color: 'rgba(255,255,255,0.05)' } },
    },
  }), [])
  const comparativoOptions = useMemo(() => baseChartOptions({
    scales: {
      x: { ticks: { color: '#aaa' }, grid: { color: 'rgba(255,255,255,0.05)' } },
      y: { ticks: { color: '#aaa' }, grid: { color: 'rgba(255,255,255,0.05)' } },
    },
  }), [])
  const acoesOptions = useMemo(() => baseChartOptions({
    scales: {
      x: { stacked: true, ticks: { color: '#aaa' }, grid: { color: 'rgba(255,255,255,0.05)' } },
      y: { stacked: true, ticks: { color: '#aaa' }, grid: { color: 'rgba(255,255,255,0.05)' } },
    },
  }), [])

  // Lista de moedas para o filtro vem do RESUMO (fonte de verdade global,
  // independente do filtro server-side atual). Cai pra items se resumo vazio.
  const coinsDisponiveis = useMemo(() => {
    if (resumo && resumo.length > 0) {
      return resumo.map((r) => r.moeda).filter(Boolean).sort()
    }
    const set = new Set(items.map((i) => i.moeda).filter(Boolean))
    return Array.from(set).sort()
  }, [items, resumo])

  // Versões de modelo vistas nos dados carregados. Com filtro ativo o servidor
  // só devolve a versão selecionada, então a mantemos sempre presente na lista.
  const versoesDisponiveis = useMemo(() => {
    const set = new Set(items.map((i) => i.versaoModelo).filter(Boolean))
    if (selectedVersao) set.add(selectedVersao)
    return Array.from(set).sort()
  }, [items, selectedVersao])

  // Quando exatamente 1 moeda está selecionada, o servidor já devolveu só ela.
  // Caso contrário (0 ou >1), filtramos client-side.
  const filtered = useMemo(() => {
    if (selectedCoins.length <= 1) return items
    return items.filter((i) => selectedCoins.includes(i.moeda))
  }, [items, selectedCoins])

  // Janela visível do scatter: o scatter é o "mapa" (mostra tudo, `filtered`);
  // KPIs, barras, top 5, tabela e gráficos de linha refletem só o que está à vista.
  const visibleFiltered = useMemo(() => {
    if (visibleRange.min == null && visibleRange.max == null) return filtered
    return filtered.filter((r) => {
      const t = new Date(r.dataHora).getTime()
      return (visibleRange.min == null || t >= visibleRange.min) &&
             (visibleRange.max == null || t <= visibleRange.max)
    })
  }, [filtered, visibleRange])

  const toggleCoin = (coin) => {
    setSelectedCoins((cur) => cur.includes(coin) ? cur.filter((c) => c !== coin) : [...cur, coin])
    setPage(0)
  }

  const kpis = useMemo(() => {
    if (visibleFiltered.length === 0) {
      return { total: 0, rewardAvg: 0, winRateAvg: 0, bestCoin: '-' }
    }
    const total = visibleFiltered.length
    const rewardAvg = visibleFiltered.reduce((acc, r) => acc + (r.rewardMedio ?? 0), 0) / total
    const winRateAvg = visibleFiltered.reduce((acc, r) => acc + (r.winRate ?? 0), 0) / total
    const byCoin = visibleFiltered.reduce((acc, r) => {
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
  }, [visibleFiltered])

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

  const visibleTimeline = useMemo(() => {
    if (visibleRange.min == null && visibleRange.max == null) return timeline
    return timeline.filter((r) => {
      const t = new Date(r.dataHora).getTime()
      return (visibleRange.min == null || t >= visibleRange.min) &&
             (visibleRange.max == null || t <= visibleRange.max)
    })
  }, [timeline, visibleRange])

  const visibleSerieSorted = useMemo(() => {
    if (!usingSerie) return []
    if (visibleRange.min == null && visibleRange.max == null) return serieSorted
    return serieSorted.filter((r) => {
      const t = new Date(r.dataHora).getTime()
      return (visibleRange.min == null || t >= visibleRange.min) &&
             (visibleRange.max == null || t <= visibleRange.max)
    })
  }, [serieSorted, usingSerie, visibleRange])

  const activeTimeline = usingSerie ? visibleSerieSorted : visibleTimeline

  const labels = activeTimeline.map((r) => `#${r.episodio}`)
  const labelDates = activeTimeline.map((r) => r.dataHora)
  const rewardSeries = usingSerie
    ? visibleSerieSorted.map((r) => r.rewardMedio ?? 0)
    : visibleTimeline.map((r) => r.rewardMedio ?? 0)
  // Backend já calcula a média móvel; quando não temos serie, calculamos client-side
  const rewardMA = usingSerie
    ? visibleSerieSorted.map((r) => r.rewardMedioMediaMovel ?? r.rewardMedio ?? 0)
    : movingAverage(rewardSeries, 5)
  const lossSeries = usingSerie
    ? visibleSerieSorted.map((r) => r.lossMedia ?? 0)
    : visibleTimeline.map((r) => r.lossMedia ?? 0)
  const epsilonSeries = usingSerie
    ? visibleSerieSorted.map((r) => r.epsilon ?? 0)
    : visibleTimeline.map((r) => r.epsilon ?? 0)
  const winRateSeries = usingSerie
    ? visibleSerieSorted.map((r) => (r.winRateMediaMovel ?? r.winRate ?? 0) * 100)
    : visibleTimeline.map((r) => (r.winRate ?? 0) * 100)

  const rewardData = {
    labels,
    metaDates: labelDates,
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
    metaDates: labelDates,
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
    metaDates: labelDates,
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
    visibleFiltered.forEach((r) => {
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
  }, [visibleFiltered])

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
    const data = visibleTimeline.map((r) => {
      acc += r.rewardTotal ?? 0
      return acc
    })
    const tlLabels = visibleTimeline.map((r) => `#${r.episodio}`)
    return {
      labels: tlLabels,
      metaDates: visibleTimeline.map((r) => r.dataHora),
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
  }, [visibleTimeline])

  // Duração por episódio
  const duracaoData = useMemo(() => ({
    labels: visibleTimeline.map((r) => `#${r.episodio}`),
    metaDates: visibleTimeline.map((r) => r.dataHora),
    datasets: [{
      label: 'Duração (s)',
      data: visibleTimeline.map((r) => r.duracaoSegundos ?? 0),
      borderColor: '#FFB547',
      backgroundColor: 'rgba(255,181,71,0.15)',
      fill: true,
      tension: 0.3,
      pointRadius: 0,
      borderWidth: 2,
    }],
  }), [visibleTimeline])

  // Comparativo por moeda (barras agrupadas: reward médio escalado, win rate %, qty episódios)
  const comparativoMoedaData = useMemo(() => {
    const agg = {}
    visibleFiltered.forEach((r) => {
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
  }, [visibleFiltered])

  // Top 5 melhores e piores por reward médio (dentro da janela visível)
  const tops = useMemo(() => {
    const arr = [...visibleFiltered].sort((a, b) => (b.rewardMedio ?? -Infinity) - (a.rewardMedio ?? -Infinity))
    return {
      best: arr.slice(0, 5),
      worst: arr.slice(-5).reverse(),
    }
  }, [visibleFiltered])

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
        versaoModelo: r.versaoModelo ?? null,
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
        backgroundColor: coinColor(coin) + 'CC',
        borderColor: coinColor(coin),
        borderWidth: 1,
        pointRadius: pts.map((p) => scale(p.duracao)),
        pointHoverRadius: pts.map((p) => scale(p.duracao) + 2),
      })),
    }
  }, [filtered])

  const sorted = useMemo(() => {
    const copy = [...visibleFiltered]
    copy.sort((a, b) => {
      const av = a[orderBy]
      const bv = b[orderBy]
      if (av === bv) return 0
      const cmp = av > bv ? 1 : -1
      return order === 'asc' ? cmp : -cmp
    })
    return copy
  }, [visibleFiltered, orderBy, order])

  const handleSort = (id) => {
    if (orderBy === id) setOrder(order === 'asc' ? 'desc' : 'asc')
    else { setOrderBy(id); setOrder('desc') }
  }

  const pageItems = sorted.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)

  return (
    <div className="dashboard-container">
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

      {loadingRange && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, opacity: 0.8 }}>
          <CircularProgress size={14} sx={{ color: ACCENT }} />
          <Typography variant="caption" sx={{ color: ACCENT }}>Buscando dados do período…</Typography>
        </Box>
      )}

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
                const color = coinColor(coin)
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

          {/* Filtro de versão do modelo (server-side) */}
          {versoesDisponiveis.length > 0 && (
            <Box sx={{ mb: 3, mt: -1.5, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography variant="caption" sx={{ opacity: 0.7, mr: 1 }}>VERSÃO DO MODELO:</Typography>
              {versoesDisponiveis.map((versao) => {
                const active = selectedVersao === versao
                return (
                  <Chip
                    key={versao}
                    label={versao}
                    onClick={() => { setSelectedVersao(active ? null : versao); setPage(0) }}
                    size="small"
                    sx={{
                      cursor: 'pointer',
                      background: active ? '#A78BFA' : 'rgba(255,255,255,0.08)',
                      color: active ? '#000' : 'white',
                      fontWeight: active ? 700 : 400,
                      border: `1px solid ${active ? '#A78BFA' : 'rgba(255,255,255,0.15)'}`,
                      '&:hover': { background: active ? '#A78BFA' : 'rgba(255,255,255,0.15)' },
                    }}
                  />
                )
              })}
              {selectedVersao && (
                <Button size="small" onClick={() => setSelectedVersao(null)} sx={{ color: 'rgba(255,255,255,0.7)' }}>
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
              onReset={resetVisibleRange}
              options={scatterOptions}
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
                options={defaultChartOptions}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <ZoomableChartCard
                title="Loss × Epsilon"
                subtitle="Convergência do modelo vs decaimento da exploração · arraste/scroll"
                ChartComp={Line}
                data={lossEpsilonData}
                options={lossEpsilonOptions}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <ZoomableChartCard
                title="Win rate"
                subtitle="Percentual de trades vencedores por episódio · arraste/scroll"
                ChartComp={Line}
                data={winRateData}
                options={winRateOptions}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <ZoomableChartCard
                title="Reward acumulado"
                subtitle="Trajetória global · arraste/scroll"
                ChartComp={Line}
                data={cumulativeRewardData}
                options={defaultChartOptions}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <ZoomableChartCard
                title="Duração por episódio"
                subtitle="Segundos gastos em cada treinamento · arraste/scroll"
                ChartComp={Line}
                data={duracaoData}
                options={duracaoOptions}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <ChartCard title="Comparativo por moeda" subtitle="Reward médio (×100), win rate e nº de episódios agregados">
                <Bar
                  data={comparativoMoedaData}
                  options={comparativoOptions}
                />
              </ChartCard>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <ChartCard title="Distribuição de ações por moeda" subtitle="Total acumulado de Hold / Compra / Venda">
                <Bar
                  data={acoesPorMoeda}
                  options={acoesOptions}
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
                            background: coinColor(row.moeda) + '33',
                            color: coinColor(row.moeda),
                            border: `1px solid ${coinColor(row.moeda)}66`,
                            fontWeight: 600,
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" sx={{ opacity: 0.8 }}>{row.versaoModelo ?? '-'}</Typography>
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
    </div>
  )
}

function DetailView({ item, allItems, onBack, onNavigate }) {
  if (!item) {
    return (
      <Box sx={{ p: 4, color: 'white' }}>
        <Button startIcon={<MdArrowBack />} onClick={onBack} sx={{ color: 'white', mb: 2 }}>Voltar</Button>
        <Typography>Episódio não encontrado.</Typography>
      </Box>
    )
  }

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
    labels: ['Hold', 'Compra', 'Venda'],
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
        labels: { color: '#e0e0e0', usePointStyle: true, padding: 16, font: { size: 12 } },
      },
      tooltip: {
        backgroundColor: 'rgba(15,15,20,0.95)',
        borderColor: 'rgba(255,215,0,0.4)',
        borderWidth: 1,
        titleColor: ACCENT,
        bodyColor: '#fff',
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
      { label: 'Reward', key: 'rewardMedio', higher: true },
      { label: 'Win Rate', key: 'winRate', higher: true },
      { label: 'Duração', key: 'duracaoSegundos', higher: false },
      { label: 'Epsilon', key: 'epsilon', higher: false },
      { label: 'Loss', key: 'lossMedia', higher: false },
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
          label: `Episódio #${item.episodio}`,
          data: itemVals,
          borderColor: ACCENT,
          backgroundColor: 'rgba(255,215,0,0.15)',
          borderWidth: 2,
          pointBackgroundColor: ACCENT,
          pointRadius: 4,
        },
        {
          label: `Média ${item.moeda}`,
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
  }, [item, sameCoinItems, coinAvg])

  const radarOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      r: {
        angleLines: { color: 'rgba(255,255,255,0.1)' },
        grid: { color: 'rgba(255,255,255,0.08)' },
        pointLabels: { color: '#e0e0e0', font: { size: 12 } },
        ticks: { display: false },
        suggestedMin: 0,
        suggestedMax: 100,
      },
    },
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: '#e0e0e0', usePointStyle: true, padding: 16 },
      },
      tooltip: {
        backgroundColor: 'rgba(15,15,20,0.95)',
        borderColor: 'rgba(255,215,0,0.4)',
        borderWidth: 1,
        titleColor: ACCENT,
        bodyColor: '#fff',
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
        label: 'Reward médio',
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
  }), [miniTimeline, item.idTreinamentoEpisodio])

  const miniTimelineOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(15,15,20,0.95)',
        borderColor: 'rgba(255,215,0,0.4)',
        borderWidth: 1,
        titleColor: ACCENT,
        bodyColor: '#fff',
        padding: 10,
        callbacks: {
          afterLabel: (ctx) => {
            const ep = miniTimeline[ctx.dataIndex]
            if (!ep) return ''
            return [
              `Win rate: ${formatPercent(ep.winRate)}`,
              `Loss: ${formatNumber(ep.lossMedia)}`,
              `Duração: ${formatNumber(ep.duracaoSegundos, 1)}s`,
            ].join('\n')
          },
        },
      },
    },
    scales: {
      x: { ticks: { color: '#aaa', maxRotation: 0, autoSkip: true }, grid: { color: 'rgba(255,255,255,0.05)' } },
      y: { ticks: { color: '#aaa' }, grid: { color: 'rgba(255,255,255,0.05)' } },
    },
  }), [miniTimeline])

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
        return Array.isArray(regs) ? regs : []
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
        label: `Preço ${item.moeda}`,
        data: mercadoRegistros
          .filter((r) => r.horaReferencia && r.precoFechamento != null)
          .map((r) => ({ x: new Date(r.horaReferencia).getTime(), y: r.precoFechamento })),
        borderColor: coinColor(item.moeda),
        backgroundColor: coinColor(item.moeda) + '22',
        fill: true,
        tension: 0.25,
        pointRadius: 0,
        borderWidth: 2,
      }],
    }
  }, [mercado, item.moeda])

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

  const mercadoChartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(15,15,20,0.95)',
        borderColor: 'rgba(255,215,0,0.4)',
        borderWidth: 1,
        titleColor: ACCENT,
        bodyColor: '#fff',
        padding: 10,
      },
    },
    scales: {
      x: {
        type: 'time',
        adapters: { date: { locale: ptBR } },
        time: { tooltipFormat: 'dd/MM HH:mm:ss', displayFormats: { minute: 'HH:mm', hour: 'HH:mm' } },
        ticks: { color: '#aaa', maxRotation: 0, autoSkip: true, maxTicksLimit: 10 },
        grid: { color: 'rgba(255,255,255,0.05)' },
      },
      y: { ticks: { color: '#aaa' }, grid: { color: 'rgba(255,255,255,0.05)' } },
    },
  }), [])

  // ── Delta helpers ──
  const delta = (val, avg) => {
    if (avg === 0 && val === 0) return 0
    return val - avg
  }
  const deltaColor = (d, inverted = false) => {
    const positive = inverted ? d <= 0 : d >= 0
    return positive ? '#14F195' : '#FF5C7C'
  }
  const deltaSign = (d) => d >= 0 ? '+' : ''

  // ── Win rate visual gauge ──
  const winRatePct = (item.winRate ?? 0) * 100
  const winRateGaugeColor = winRatePct >= 50 ? '#14F195' : winRatePct >= 35 ? '#FFB547' : '#FF5C7C'

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
      <Box sx={{ p: { xs: 2, md: 4 }, color: 'white' }}>
        {/* ── Header com navegação ── */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1, flexWrap: 'wrap', gap: 1 }}>
          <Button startIcon={<MdArrowBack />} onClick={onBack} sx={{ color: 'white' }}>Voltar</Button>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              size="small"
              startIcon={<MdArrowBack size={14} />}
              disabled={!prevItem}
              onClick={() => onNavigate(prevItem.idTreinamentoEpisodio)}
              sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.3)', fontSize: 12 }}
              variant="outlined"
            >
              Anterior
            </Button>
            <Button
              size="small"
              endIcon={<MdArrowForward size={14} />}
              disabled={!nextItem}
              onClick={() => onNavigate(nextItem.idTreinamentoEpisodio)}
              sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.3)', fontSize: 12 }}
              variant="outlined"
            >
              Próximo
            </Button>
          </Box>
        </Box>

        {/* ── Título e badge ── */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
            <MdPsychology size={28} color={ACCENT} />
            <Typography variant="h5" sx={{ fontWeight: 700 }}>Episódio #{item.episodio}</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Chip
              label={item.moeda}
              size="small"
              sx={{
                background: coinColor(item.moeda) + '33',
                color: coinColor(item.moeda),
                border: `1px solid ${coinColor(item.moeda)}66`,
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
            <Typography variant="body2" sx={{ opacity: 0.7 }}>{formatDate(item.dataHora)}</Typography>
            {ranking.position && (
              <Chip
                icon={<MdLeaderboard size={14} />}
                label={`#${ranking.position} de ${ranking.total} geral`}
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
                label={`#${rankingCoin.position} de ${rankingCoin.total} em ${item.moeda}`}
                size="small"
                sx={{
                  background: coinColor(item.moeda) + '15',
                  color: coinColor(item.moeda),
                  border: `1px solid ${coinColor(item.moeda)}30`,
                  fontWeight: 500,
                  fontSize: 11,
                  '& .MuiChip-icon': { color: coinColor(item.moeda) },
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
              background: 'linear-gradient(135deg, rgba(255,215,0,0.08), rgba(255,255,255,0.03))',
              border: '1px solid rgba(255,215,0,0.15)',
              backdropFilter: 'blur(10px)', color: 'white',
              display: 'flex', flexDirection: 'column', gap: 0.5,
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, opacity: 0.85 }}>
                <MdTrendingUp size={16} color={ACCENT} />
                <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: 0.8, fontSize: 10 }}>Reward Médio</Typography>
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 700, color: ACCENT, lineHeight: 1.2 }}>{formatNumber(item.rewardMedio)}</Typography>
              <Typography variant="caption" sx={{ color: deltaColor(rewardDelta), fontWeight: 600 }}>
                {deltaSign(rewardDelta)}{formatNumber(rewardDelta)} vs média
              </Typography>
            </Paper>
          </Grid>
          <Grid size={{ xs: 6, sm: 4, md: 2 }}>
            <Paper sx={{
              p: 2, height: '100%',
              background: 'linear-gradient(135deg, rgba(20,241,149,0.08), rgba(255,255,255,0.03))',
              border: '1px solid rgba(20,241,149,0.15)',
              backdropFilter: 'blur(10px)', color: 'white',
              display: 'flex', flexDirection: 'column', gap: 0.5,
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, opacity: 0.85 }}>
                <MdShowChart size={16} color="#14F195" />
                <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: 0.8, fontSize: 10 }}>Win Rate</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                <Typography variant="h5" sx={{ fontWeight: 700, color: winRateGaugeColor, lineHeight: 1.2 }}>{formatPercent(item.winRate)}</Typography>
              </Box>
              <Box sx={{ width: '100%', height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.1)', mt: 0.5 }}>
                <Box sx={{ width: `${Math.min(100, winRatePct)}%`, height: '100%', borderRadius: 2, background: winRateGaugeColor, transition: 'width 0.5s ease' }} />
              </Box>
              <Typography variant="caption" sx={{ color: deltaColor(winRateDelta), fontWeight: 600 }}>
                {deltaSign(winRateDelta)}{(winRateDelta * 100).toFixed(2)}pp vs média
              </Typography>
            </Paper>
          </Grid>
          <Grid size={{ xs: 6, sm: 4, md: 2 }}>
            <Paper sx={{
              p: 2, height: '100%',
              background: 'linear-gradient(135deg, rgba(255,92,124,0.08), rgba(255,255,255,0.03))',
              border: '1px solid rgba(255,92,124,0.15)',
              backdropFilter: 'blur(10px)', color: 'white',
              display: 'flex', flexDirection: 'column', gap: 0.5,
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, opacity: 0.85 }}>
                <MdTrendingDown size={16} color="#FF5C7C" />
                <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: 0.8, fontSize: 10 }}>Loss Média</Typography>
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#FF5C7C', lineHeight: 1.2 }}>{formatNumber(item.lossMedia)}</Typography>
              <Typography variant="caption" sx={{ color: deltaColor(lossDelta, true), fontWeight: 600 }}>
                {deltaSign(lossDelta)}{formatNumber(lossDelta)} vs média
              </Typography>
            </Paper>
          </Grid>
          <Grid size={{ xs: 6, sm: 4, md: 2 }}>
            <Paper sx={{
              p: 2, height: '100%',
              background: 'linear-gradient(135deg, rgba(92,184,255,0.08), rgba(255,255,255,0.03))',
              border: '1px solid rgba(92,184,255,0.15)',
              backdropFilter: 'blur(10px)', color: 'white',
              display: 'flex', flexDirection: 'column', gap: 0.5,
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, opacity: 0.85 }}>
                <MdSpeed size={16} color="#5CB8FF" />
                <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: 0.8, fontSize: 10 }}>Epsilon</Typography>
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#5CB8FF', lineHeight: 1.2 }}>{formatNumber(item.epsilon)}</Typography>
              <Box sx={{ width: '100%', height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.1)', mt: 0.5 }}>
                <Box sx={{ width: `${Math.min(100, (item.epsilon ?? 0) * 100)}%`, height: '100%', borderRadius: 2, background: '#5CB8FF', transition: 'width 0.5s ease' }} />
              </Box>
              <Typography variant="caption" sx={{ opacity: 0.6 }}>exploração</Typography>
            </Paper>
          </Grid>
          <Grid size={{ xs: 6, sm: 4, md: 2 }}>
            <Paper sx={{
              p: 2, height: '100%',
              background: 'linear-gradient(135deg, rgba(255,181,71,0.08), rgba(255,255,255,0.03))',
              border: '1px solid rgba(255,181,71,0.15)',
              backdropFilter: 'blur(10px)', color: 'white',
              display: 'flex', flexDirection: 'column', gap: 0.5,
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, opacity: 0.85 }}>
                <MdTimer size={16} color="#FFB547" />
                <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: 0.8, fontSize: 10 }}>Duração</Typography>
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#FFB547', lineHeight: 1.2 }}>{formatNumber(item.duracaoSegundos, 1)}s</Typography>
              <Typography variant="caption" sx={{ color: deltaColor(duracaoDelta, true), fontWeight: 600 }}>
                {deltaSign(duracaoDelta)}{formatNumber(duracaoDelta, 1)}s vs média
              </Typography>
            </Paper>
          </Grid>
          <Grid size={{ xs: 6, sm: 4, md: 2 }}>
            <Paper sx={{
              p: 2, height: '100%',
              background: 'linear-gradient(135deg, rgba(167,139,250,0.08), rgba(255,255,255,0.03))',
              border: '1px solid rgba(167,139,250,0.15)',
              backdropFilter: 'blur(10px)', color: 'white',
              display: 'flex', flexDirection: 'column', gap: 0.5,
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, opacity: 0.85 }}>
                <MdCompareArrows size={16} color="#A78BFA" />
                <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: 0.8, fontSize: 10 }}>Eficiência</Typography>
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#A78BFA', lineHeight: 1.2 }}>{formatNumber(eficiencia, 6)}</Typography>
              <Typography variant="caption" sx={{ color: deltaColor(eficienciaDelta), fontWeight: 600 }}>
                {deltaSign(eficienciaDelta)}{formatNumber(eficienciaDelta, 6)} vs média
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.5, fontSize: 9 }}>reward / segundo</Typography>
            </Paper>
          </Grid>
        </Grid>

        {/* ── Gráficos: Radar + Doughnut ── */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid size={{ xs: 12, md: 5 }}>
            <Paper sx={{
              p: 2.5, height: { xs: 340, md: 380 },
              background: CHART_BG, border: `1px solid ${CHART_BORDER}`,
              backdropFilter: 'blur(10px)', color: 'white',
              display: 'flex', flexDirection: 'column',
            }}>
              <Box sx={{ mb: 1 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Perfil do episódio</Typography>
                <Typography variant="caption" sx={{ opacity: 0.6 }}>
                  Comparação normalizada vs média de {item.moeda}
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
              background: CHART_BG, border: `1px solid ${CHART_BORDER}`,
              backdropFilter: 'blur(10px)', color: 'white',
              display: 'flex', flexDirection: 'column',
            }}>
              <Box sx={{ mb: 1 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Distribuição de ações</Typography>
                <Typography variant="caption" sx={{ opacity: 0.6 }}>Total: {totalAcoes} ações em {item.totalSteps ?? '-'} steps</Typography>
              </Box>
              <Box sx={{ flex: 1, position: 'relative', minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Doughnut data={doughnutData} options={doughnutOptions} />
              </Box>
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3.5 }}>
            <Paper sx={{
              p: 2.5, height: { xs: 340, md: 380 },
              background: CHART_BG, border: `1px solid ${CHART_BORDER}`,
              backdropFilter: 'blur(10px)', color: 'white',
              display: 'flex', flexDirection: 'column',
            }}>
              <Box sx={{ mb: 1.5 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Detalhes completos</Typography>
                <Typography variant="caption" sx={{ opacity: 0.6 }}>Todos os campos do episódio</Typography>
              </Box>
              <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                {[
                  ['Episódio', `#${item.episodio}`, null, null],
                  ['Versão do modelo', item.versaoModelo ?? '-', { color: '#A78BFA' }, null],
                  ['Data/Hora', formatDate(item.dataHora), null, null],
                  ['Reward Total', formatNumber(item.rewardTotal, 2), { color: (item.rewardTotal ?? 0) >= 0 ? '#14F195' : '#FF5C7C' }, null],
                  ['Ações Hold', item.acoesHold ?? 0, { color: 'rgba(160,160,160,0.9)' }, totalAcoes > 0 ? `${(((item.acoesHold ?? 0) / totalAcoes) * 100).toFixed(1)}%` : null],
                  ['Ações Compra', item.acoesCompra ?? 0, { color: '#14F195' }, totalAcoes > 0 ? `${(((item.acoesCompra ?? 0) / totalAcoes) * 100).toFixed(1)}%` : null],
                  ['Ações Venda', item.acoesVenda ?? 0, { color: '#FF5C7C' }, totalAcoes > 0 ? `${(((item.acoesVenda ?? 0) / totalAcoes) * 100).toFixed(1)}%` : null],
                  ['Total Steps', item.totalSteps ?? '-', null, null],
                ].map(([label, value, style, extra]) => (
                  <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, py: 0.25, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
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
              background: CHART_BG, border: `1px solid ${CHART_BORDER}`,
              backdropFilter: 'blur(10px)', color: 'white',
              display: 'flex', flexDirection: 'column',
            }}>
              <Box sx={{ mb: 1 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Contexto temporal</Typography>
                <Typography variant="caption" sx={{ opacity: 0.6 }}>
                  Episódios vizinhos de {item.moeda} · ponto destacado = episódio atual
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
              background: CHART_BG, border: `1px solid ${CHART_BORDER}`,
              backdropFilter: 'blur(10px)', color: 'white',
            }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Contexto de mercado</Typography>
                  <Typography variant="caption" sx={{ opacity: 0.6 }}>
                    Preço de {item.moeda} ±{mercado?.margemHoras === 12 ? '12h' : '30min'} do episódio · faixa amarela = período do treinamento
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 2.5, flexWrap: 'wrap' }}>
                  {[
                    ['Variação no período', `${mercadoStats.variacao >= 0 ? '+' : ''}${(mercadoStats.variacao * 100).toFixed(2)}%`, mercadoStats.variacao >= 0 ? '#14F195' : '#FF5C7C'],
                    ['Faixa de preço', `${formatNumber(mercadoStats.precoMin, mercadoStats.digits)} – ${formatNumber(mercadoStats.precoMax, mercadoStats.digits)}`, null],
                    ...(mercadoStats.dominanciaCompradora != null
                      ? [['Dominância compradora', `${mercadoStats.dominanciaCompradora.toFixed(1)}%`, mercadoStats.dominanciaCompradora >= 50 ? '#14F195' : '#FF5C7C']]
                      : []),
                    ...(mercadoStats.longShort != null
                      ? [['Long/Short médio', formatNumber(mercadoStats.longShort, 2), null]]
                      : []),
                    ...(sentimento?.fear?.valor != null
                      ? [[
                          'Fear & Greed',
                          `${sentimento.fear.valor}${sentimento.fear.classificacao ? ` · ${sentimento.fear.classificacao}` : ''}`,
                          sentimento.fear.valor >= 55 ? '#14F195' : sentimento.fear.valor >= 45 ? '#FFB547' : '#FF5C7C',
                        ]]
                      : []),
                    ...(sentimento?.trend?.valorAtual != null
                      ? [[
                          'Trend (busca)',
                          `${sentimento.trend.valorAtual}${sentimento.trend.delta15 != null ? ` (${sentimento.trend.delta15 >= 0 ? '▲' : '▼'}${Math.abs(sentimento.trend.delta15)} /15min)` : ''}`,
                          sentimento.trend.delta15 != null ? (sentimento.trend.delta15 >= 0 ? '#14F195' : '#FF5C7C') : null,
                        ]]
                      : []),
                    ...(sentimento?.trend?.geoTop1Code
                      ? [['Top região', sentimento.trend.geoTop1Code, null]]
                      : []),
                  ].map(([label, value, color]) => (
                    <Box key={label} sx={{ textAlign: 'right' }}>
                      <Typography variant="caption" sx={{ opacity: 0.6, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 9, display: 'block' }}>{label}</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: color || 'white' }}>{value}</Typography>
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
              background: CHART_BG, border: `1px solid ${CHART_BORDER}`,
              backdropFilter: 'blur(10px)', color: 'white',
            }}>
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Comparação com episódio anterior</Typography>
                <Typography variant="caption" sx={{ opacity: 0.6 }}>
                  #{prevItem.episodio} ({formatDate(prevItem.dataHora)}) → #{item.episodio} ({formatDate(item.dataHora)})
                </Typography>
              </Box>
              <Grid container spacing={2}>
                {[
                  { label: 'Reward Médio', prev: prevItem.rewardMedio, curr: item.rewardMedio, fmt: (v) => formatNumber(v), inverted: false },
                  { label: 'Win Rate', prev: prevItem.winRate, curr: item.winRate, fmt: (v) => formatPercent(v), inverted: false },
                  { label: 'Loss Média', prev: prevItem.lossMedia, curr: item.lossMedia, fmt: (v) => formatNumber(v), inverted: true },
                  { label: 'Epsilon', prev: prevItem.epsilon, curr: item.epsilon, fmt: (v) => formatNumber(v), inverted: true },
                  { label: 'Duração (s)', prev: prevItem.duracaoSegundos, curr: item.duracaoSegundos, fmt: (v) => formatNumber(v, 1), inverted: true },
                ].map(({ label, prev, curr, fmt, inverted }) => {
                  const d = (curr ?? 0) - (prev ?? 0)
                  return (
                    <Grid size={{ xs: 6, sm: 4, md: 2.4 }} key={label}>
                      <Box sx={{ textAlign: 'center', p: 1.5, borderRadius: 1, background: 'rgba(255,255,255,0.03)' }}>
                        <Typography variant="caption" sx={{ opacity: 0.65, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 10, display: 'block', mb: 0.5 }}>{label}</Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                          <Typography variant="body2" sx={{ opacity: 0.5 }}>{fmt(prev)}</Typography>
                          <Typography variant="caption" sx={{ opacity: 0.3 }}>→</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{fmt(curr)}</Typography>
                        </Box>
                        <Typography variant="caption" sx={{ color: deltaColor(d, inverted), fontWeight: 700, fontSize: 12 }}>
                          {d >= 0 ? '▲' : '▼'} {deltaSign(d)}{label === 'Win Rate' ? `${(d * 100).toFixed(2)}pp` : formatNumber(d, label === 'Duração (s)' ? 1 : 4)}
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

export default function TreinamentoEpisodios() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [resumo, setResumo] = useState([])
  const [serie, setSerie] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadingRange, setLoadingRange] = useState(false)
  const [error, setError] = useState(null)
  const [selectedCoins, setSelectedCoins] = useState([])
  const [selectedVersao, setSelectedVersao] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [visibleRange, setVisibleRange] = useState({ min: null, max: null })
  // Buckets (janelas de 4h) já buscados, identificados pelo timestamp de início
  const fetchedBucketsRef = useRef(new Set())
  const genRef = useRef(0)       // invalida fetches de gerações antigas (troca de filtro/refresh)
  const inflightRef = useRef(0)  // conta buscas de janela em andamento

  const moedaServerFilter = selectedCoins.length === 1 ? selectedCoins[0] : null

  // Carga inicial em grupos de 4h: descobre o episódio mais recente e carrega as
  // duas janelas de 4h mais recentes. Refetcha quando filtro ou refresh muda.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    let canceled = false
    genRef.current += 1
    fetchedBucketsRef.current.clear()
    inflightRef.current = 0
    setVisibleRange({ min: null, max: null })
    setLoadingRange(false)
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [probeResp, resumoResp] = await Promise.all([
          apiRequest(TreinamentoEpisodioEndpoint.LIST({ moeda: moedaServerFilter || undefined, versaoModelo: selectedVersao || undefined, quantidade: 1, ordenarAscendente: false })),
          apiRequest(TreinamentoEpisodioEndpoint.RESUMO({ versaoModelo: selectedVersao || undefined })),
        ])
        if (canceled) return
        const res = Array.isArray(resumoResp?.resultado)
          ? resumoResp.resultado
          : (Array.isArray(resumoResp) ? resumoResp : [])
        setResumo(res)

        const maisRecente = extractLista(probeResp)[0]
        if (!maisRecente) { setItems([]); return }

        const bucketAtual = bucketStartOf(new Date(maisRecente.dataHora).getTime())
        const inicio = bucketAtual - FOUR_HOURS_MS      // janela anterior
        const fim = bucketAtual + FOUR_HOURS_MS          // fim da janela atual
        const dados = await fetchWindow(moedaServerFilter, selectedVersao, inicio, fim)
        if (canceled) return
        fetchedBucketsRef.current.add(bucketAtual)
        fetchedBucketsRef.current.add(bucketAtual - FOUR_HOURS_MS)
        setItems(dados)
      } catch (e) {
        if (!canceled) setError(e?.message || 'Falha ao carregar episódios')
      } finally {
        if (!canceled) setLoading(false)
      }
    }
    load()
    return () => { canceled = true }
  }, [moedaServerFilter, selectedVersao, refreshKey])

  // Ao navegar o scatter (pan/zoom), carrega as janelas de 4h visíveis ainda não
  // buscadas. Cada bucket é buscado uma única vez; tudo que chega é mesclado.
  useEffect(() => {
    const { min, max } = visibleRange
    if (min == null || max == null) return

    const buckets = []
    for (let b = bucketStartOf(min); b <= bucketStartOf(max); b += FOUR_HOURS_MS) {
      if (!fetchedBucketsRef.current.has(b)) buckets.push(b)
    }
    if (buckets.length === 0) return

    // marca já pra não refazer em eventos repetidos de pan/zoom
    buckets.forEach((b) => fetchedBucketsRef.current.add(b))
    const gen = genRef.current
    inflightRef.current += buckets.length
    setLoadingRange(true)

    Promise.all(buckets.map((b) => fetchWindow(moedaServerFilter, selectedVersao, b, b + FOUR_HOURS_MS)))
      .then((results) => {
        if (genRef.current !== gen) return   // filtro/refresh mudou → descarta
        setItems((prev) => mergeItems(prev, results.flat()))
      })
      .catch(() => {
        // libera os buckets pra permitir nova tentativa
        if (genRef.current === gen) buckets.forEach((b) => fetchedBucketsRef.current.delete(b))
      })
      .finally(() => {
        inflightRef.current = Math.max(0, inflightRef.current - buckets.length)
        if (inflightRef.current === 0) setLoadingRange(false)
      })
  }, [visibleRange, moedaServerFilter, selectedVersao])

  // /serie só faz sentido com 1 moeda. Cancela quando muda.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!moedaServerFilter) {
      setSerie(null)
      return
    }
    let canceled = false
    apiRequest(TreinamentoEpisodioEndpoint.SERIE({ moeda: moedaServerFilter, versaoModelo: selectedVersao || undefined, janela: 5 }))
      .then((resp) => {
        if (canceled) return
        const data = Array.isArray(resp?.resultado)
          ? resp.resultado
          : (Array.isArray(resp) ? resp : [])
        setSerie(data)
      })
      .catch(() => { if (!canceled) setSerie(null) })
    return () => { canceled = true }
  }, [moedaServerFilter, selectedVersao, refreshKey])

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
    return (
      <DetailView
        item={item}
        allItems={items}
        onBack={() => navigate('/treinamento-episodios')}
        onNavigate={(navId) => navigate(`/treinamento-episodios/${navId}`)}
      />
    )
  }

  return (
    <ListView
      items={items}
      resumo={resumo}
      serie={serie}
      loading={loading}
      loadingRange={loadingRange}
      error={error}
      onRefresh={refresh}
      onOpen={(rowId) => navigate(`/treinamento-episodios/${rowId}`)}
      selectedCoins={selectedCoins}
      setSelectedCoins={setSelectedCoins}
      selectedVersao={selectedVersao}
      setSelectedVersao={setSelectedVersao}
      visibleRange={visibleRange}
      setVisibleRange={setVisibleRange}
    />
  )
}
