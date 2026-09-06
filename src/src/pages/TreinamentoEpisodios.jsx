import { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
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
// O eixo de tempo do scatter estava cravado em pt-BR: o mês vinha em português
// e a data em ordem brasileira, independentemente do idioma escolhido na tela.
// Os cinco entram estaticamente porque são ~2 KB cada e o gráfico não pode
// esperar um import dinâmico para desenhar o primeiro quadro.
import { ptBR, enUS, es, fr, it } from 'date-fns/locale'
import zoomPlugin from 'chartjs-plugin-zoom'
import { Line, Bar, Scatter, Doughnut, Radar } from 'react-chartjs-2'
import { useTheme } from '@mui/material/styles'
import ErrorMessage from '../components/ErrorMessage'
import { apiRequest, TreinamentoEpisodioEndpoint, MarketEndpoint, VariavelExternaEndpoint } from '../utils/apiClient'
import { toUTCISO, padraoDeDataCurta } from '../utils/dateUtils'
import { readToken } from '../utils/themeTokens'
import useTranslation from '../hooks/useTranslation'

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

// Paleta categórica validada (OKLCH L 0,48–0,67, croma ≥ 0,10, ΔE ≥ piso entre
// vizinhos sob simulação de daltonismo, contraste ≥ 3:1 no tema escuro). As cores
// de marca originais eram ilegíveis no fundo escuro: XRP quase preto, ADA/LINK/LTC
// azuis-escuros iguais e BNB/DOGE/PAXG dourados iguais.
const COIN_COLORS = {
  BTC: '#A35303', ETH: '#7C8AE1', BNB: '#A89207', SOL: '#17A478',
  XRP: '#0E8BA8', ADA: '#966CD7', DOGE: '#79953E', LTC: '#419BD4',
  LINK: '#3065CC', PAXG: '#8E710F',
}
// Forma do ponto por moeda no scatter: segundo canal além da cor (daltonismo).
// Cada forma emparelha uma cor quente com uma fria.
const COIN_POINT_STYLES = {
  BTC: 'circle', XRP: 'circle',
  ETH: 'rect', PAXG: 'rect',
  BNB: 'triangle', LINK: 'triangle',
  SOL: 'rectRot', ADA: 'rectRot',
  DOGE: 'rectRounded', LTC: 'rectRounded',
}
const coinPointStyle = (coin) => COIN_POINT_STYLES[coin] || 'circle'
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
const hoverBg = (dk) => dk ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
const subtleBg = (dk) => dk ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
const subtleBorder = (dk) => dk ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'
const textPrimary = (dk) => dk ? '#fff' : '#202020'
const textSecondary = (dk) => dk ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)'
const gradientEnd = (dk) => dk ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'
const gaugeTrack = (dk) => dk ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'

// Cor da moeda: usa a cor de marca quando existe; senão gera um HEX estável a
// partir do nome (moedas que só aparecem ao carregar janelas antigas, ex.: PAXG).
// Retorna sempre HEX de 6 dígitos para permitir sufixo de alpha (ex.: +'33').
// Escurece uma cor hex por um fator (0-1). As cores de marca das moedas são
// tons médios: ótimas como preenchimento, mas reprovam em contraste quando
// viram texto sobre fundo claro (LTC #419BD4 sobre o chip dá 2.2:1).
const escurecer = (hex, fator) => {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
  const ch = (shift) => Math.round(((n >> shift) & 0xff) * fator)
  const to2 = (v) => v.toString(16).padStart(2, '0')
  return `#${to2(ch(16))}${to2(ch(8))}${to2(ch(0))}`
}

const coinColor = (coin) => {
  if (COIN_COLORS[coin]) return COIN_COLORS[coin]
  if (!coin) return '#888888'
  let h = 0
  for (let i = 0; i < coin.length; i++) h = (h * 31 + coin.charCodeAt(i)) >>> 0
  const ch = (shift) => 80 + ((h >> shift) % 150) // faixa 80–229: nem escuro, nem estourado
  const hex = (n) => n.toString(16).padStart(2, '0')
  return `#${hex(ch(0))}${hex(ch(8))}${hex(ch(16))}`
}

// Cor da moeda para uso como TEXTO — no tema claro precisa escurecer.
// Preenchimentos, bordas e séries de gráfico continuam usando coinColor().
const coinInk = (coin, dk) => (dk ? coinColor(coin) : escurecer(coinColor(coin), 0.55))

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
const formatDate = (value, locale) => {
  if (!value) return '-'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString(locale)
}

// Locale do date-fns por código de idioma, para o adaptador de tempo do
// Chart.js. Fica aqui, e não no registro de idiomas, porque é dependência de
// biblioteca de gráfico: o lang/index.js não deve passar a importar date-fns
// só porque uma tela desenha um eixo temporal.
const LOCALE_DATE_FNS = Object.freeze({ pt: ptBR, en: enUS, es, fr, it })

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

const getColumns = (t) => [
  { id: 'episodio', label: t('treinamento.colEpisode'), numeric: true },
  { id: 'dataHora', label: t('treinamento.colDateTime'), numeric: false },
  { id: 'moeda', label: t('treinamento.colCoin'), numeric: false },
  { id: 'versaoModelo', label: t('treinamento.colVersion'), numeric: false },
  { id: 'rewardMedio', label: t('treinamento.colRewardAvg'), numeric: true },
  { id: 'rewardTotal', label: t('treinamento.colRewardTotal'), numeric: true },
  { id: 'lossMedia', label: t('treinamento.colLossAvg'), numeric: true },
  { id: 'epsilon', label: t('treinamento.colEpsilon'), numeric: true },
  { id: 'winRate', label: t('treinamento.colWinRate'), numeric: true },
  { id: 'duracaoSegundos', label: t('treinamento.colDuration'), numeric: true },
]

const xTicks = (dk) => ({ color: tickColor(dk), maxRotation: 0, autoSkip: true, maxTicksLimit: 10 })

// Mostra "#ep · data/hora" no título do tooltip quando o dataset expõe `metaDates`.
// É fábrica, e não o callback direto: o Chart.js chama o callback com o contexto
// dele, não com o nosso, então o locale só chega aqui por fechamento — montado
// junto das opções, onde ele existe.
const tooltipTitleWithDate = (locale) => (its) => {
  if (!its || its.length === 0) return ''
  const first = its[0]
  const d = first.chart?.data?.metaDates?.[first.dataIndex]
  if (!d) return first.label ?? ''
  const dt = new Date(d)
  return Number.isNaN(dt.getTime()) ? first.label : `${first.label} · ${dt.toLocaleString(locale)}`
}

const baseChartOptions = (dk, extra = {}, locale = undefined) => {
  const { plugins: extraPlugins, scales: extraScales, ...rest } = extra
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { labels: { color: legendColor(dk), usePointStyle: true, padding: 12 } },
      tooltip: {
        backgroundColor: tooltipBg(dk),
        borderColor: readToken('--accent-a40'),
        borderWidth: 1,
        titleColor: ACCENT,
        bodyColor: tooltipBody(dk),
        padding: 10,
        callbacks: { title: tooltipTitleWithDate(locale) },
      },
      zoom: ZOOM_CONFIG,
      ...(extraPlugins || {}),
    },
    scales: extraScales || {
      x: { ticks: xTicks(dk), grid: { color: gridColor(dk) } },
      y: { ticks: { color: tickColor(dk) }, grid: { color: gridColor(dk) } },
    },
    ...rest,
  }
}

function KpiCard({ icon, label, value, sub }) {
  const { palette } = useTheme()
  const dk = palette.mode === 'dark'
  return (
    <Paper
      sx={{
        p: 2.5,
        height: '100%',
        background: `linear-gradient(135deg, rgba(255,215,0,0.08), ${gradientEnd(dk)})`,
        border: '1px solid var(--accent-a15)',
        backdropFilter: 'blur(10px)',
        color: textPrimary(dk),
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, opacity: 0.85 }}>
        <Box sx={{ color: ACCENT_DOM, display: 'flex' }}>{icon}</Box>
        <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: 1, fontSize: 11 }}>
          {label}
        </Typography>
      </Box>
      <Typography variant="h4" sx={{ fontWeight: 700, color: ACCENT_DOM, lineHeight: 1.2 }}>
        {value}
      </Typography>
      {sub && <Typography variant="caption" sx={{ opacity: 0.7 }}>{sub}</Typography>}
    </Paper>
  )
}

function ZoomableChartCard({ title, subtitle, height, ChartComp, data, options, plugins, onReset, resetRange, chartRef }) {
  const { palette } = useTheme()
  const dk = palette.mode === 'dark'
  const { t } = useTranslation()
  const localRef = useRef(null)
  const ref = chartRef || localRef
  const reset = () => {
    const chart = ref.current
    const range = resetRange?.()
    if (chart && range && typeof chart.zoomScale === 'function') {
      chart.zoomScale('x', range, 'default')
    } else {
      chart?.resetZoom?.()
    }
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
          sx={{ color: textSecondary(dk), fontSize: 11, minWidth: 'auto', textTransform: 'none' }}
        >
          {t('treinamento.reset')}
        </Button>
      }
    >
      <ChartComp ref={ref} data={data} options={options} plugins={plugins} />
    </ChartCard>
  )
}

function EvolucaoCard({ items, onSelectCoin }) {
  const { palette } = useTheme()
  const dk = palette.mode === 'dark'
  const { t, idioma } = useTranslation()
  if (!items || items.length === 0) return null
  const sorted = [...items].sort((a, b) => (b.episodios ?? 0) - (a.episodios ?? 0))
  return (
    <Paper sx={{
      p: 2.5,
      background: chartBg(dk),
      border: `1px solid ${chartBorder(dk)}`,
      backdropFilter: 'blur(10px)',
      color: textPrimary(dk),
    }}>
      <Box sx={{ mb: 1.5 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{t('treinamento.evolutionTitle')}</Typography>
        <Typography variant="caption" sx={{ opacity: 0.6 }}>
          {t('treinamento.evolutionSubtitle')}
        </Typography>
      </Box>
      <TableContainer>
        <Table size="small" sx={{ '& td, & th': { color: textPrimary(dk), borderColor: chartBorder(dk) } }}>
          <TableHead>
            <TableRow>
              <TableCell>{t('treinamento.colCoin')}</TableCell>
              <TableCell align="right">{t('treinamento.colEpisodes')}</TableCell>
              <TableCell align="right">{t('treinamento.colRewardRange')}</TableCell>
              <TableCell align="right">{t('treinamento.colWinRateRange')}</TableCell>
              <TableCell align="right">{t('treinamento.colAvgLoss')}</TableCell>
              <TableCell align="right">{t('treinamento.colLastUpdate')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sorted.map((r) => {
              const rewardDelta = (r.rewardAtual ?? 0) - (r.rewardInicial ?? 0)
              const wrDelta = (r.winRateAtual ?? 0) - (r.winRateInicial ?? 0)
              const rewardColor = rewardDelta >= 0 ? 'var(--perf-up)' : 'var(--perf-down)'
              const wrColor = wrDelta >= 0 ? 'var(--perf-up)' : 'var(--perf-down)'
              return (
                <TableRow
                  key={r.moeda}
                  hover
                  onClick={() => onSelectCoin?.(r.moeda)}
                  sx={{ cursor: 'pointer', '&:hover': { background: hoverBg(dk) } }}
                >
                  {/* A linha inteira continua clicável para o mouse, mas <tr>
                      não pode virar botão sem quebrar a semântica da tabela: o
                      alvo do teclado passa a ser o chip da moeda, que já é o
                      nome natural da ação ("filtrar por ADA"). Com `onClick` o
                      Chip do MUI vira um botão de verdade, focável e ativável
                      por Enter e espaço. */}
                  <TableCell>
                    <Chip
                      label={r.moeda}
                      size="small"
                      clickable
                      onClick={() => onSelectCoin?.(r.moeda)}
                      sx={{
                        background: coinColor(r.moeda) + '33',
                        color: coinInk(r.moeda, dk),
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
                    <Typography variant="caption" sx={{ opacity: 0.7 }}>{formatDate(r.dataHoraAtual, idioma.intl)}</Typography>
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
  const { palette } = useTheme()
  const dk = palette.mode === 'dark'
  const { t } = useTranslation()
  return (
    <Paper sx={{
      p: 2.5,
      background: chartBg(dk),
      border: `1px solid ${chartBorder(dk)}`,
      backdropFilter: 'blur(10px)',
      color: textPrimary(dk),
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
            component="button"
            type="button"
            className="botao-nu"
            onClick={() => onOpen(r.idTreinamentoEpisodio)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              width: '100%',
              textAlign: 'left',
              gap: 1.5,
              p: 1,
              borderRadius: 1,
              cursor: 'pointer',
              background: dk ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
              borderLeft: `3px solid ${accent}`,
              '&:hover': { background: hoverBg(dk) },
            }}
          >
            <Typography variant="caption" sx={{ opacity: 0.5, width: 18, textAlign: 'center' }}>#{idx + 1}</Typography>
            <Chip
              label={r.moeda}
              size="small"
              sx={{
                background: coinColor(r.moeda) + '33',
                color: coinInk(r.moeda, dk),
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
          <Typography variant="caption" sx={{ opacity: 0.5, py: 2, textAlign: 'center' }}>{t('treinamento.noData')}</Typography>
        )}
      </Box>
    </Paper>
  )
}

function ChartCard({ title, subtitle, children, height = { xs: 280, md: 320 }, action }) {
  const { palette } = useTheme()
  const dk = palette.mode === 'dark'
  return (
    <Paper sx={{
      p: 2.5,
      height,
      background: chartBg(dk),
      border: `1px solid ${chartBorder(dk)}`,
      backdropFilter: 'blur(10px)',
      color: textPrimary(dk),
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
  const { palette } = useTheme()
  const dk = palette.mode === 'dark'
  const { t, idioma } = useTranslation()
  const columns = useMemo(() => getColumns(t), [t])
  const [orderBy, setOrderBy] = useState('episodio')
  const [order, setOrder] = useState('desc')
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(25)

  // Throttle por frame: onPan/onZoom disparam dezenas de vezes por gesto e cada
  // setVisibleRange recalcula KPIs, curvas e tabela — sem isso o pan engasga.
  const rangeRafRef = useRef(null)
  const handleRangeChange = useCallback((chart) => {
    if (rangeRafRef.current) return
    rangeRafRef.current = requestAnimationFrame(() => {
      rangeRafRef.current = null
      const { min, max } = chart.scales.x
      setVisibleRange({ min, max })
    })
  }, [setVisibleRange])
  useEffect(() => () => cancelAnimationFrame(rangeRafRef.current), [])

  // Range do botão "reset": ancora na última janela de 4h COM DADOS, não no
  // horário de abertura da tela (que fica obsoleto com a aba aberta há horas).
  const latestDataMs = useMemo(() => {
    let max = null
    for (const r of items) {
      const t = new Date(r.dataHora).getTime()
      if (!Number.isNaN(t) && (max === null || t > max)) max = t
    }
    return max
  }, [items])
  // Janela padrão: a última HORA com dados (+ folga de 5min à direita)
  const scatterResetRange = useCallback(() => (
    latestDataMs != null ? { min: latestDataMs - ONE_HOUR_MS, max: latestDataMs + 5 * 60 * 1000 } : null
  ), [latestDataMs])

  // Reset sincroniza a janela dos demais gráficos com a mesma faixa do scatter
  // (antes limpava pra null = "tudo", divergindo do que o scatter mostrava).
  const resetVisibleRange = useCallback(() => {
    setVisibleRange(scatterResetRange() ?? { min: null, max: null })
  }, [scatterResetRange, setVisibleRange])

  // Ref do scatter usada pelo botão "reset" (foca a última hora COM DADOS).
  // Não fazemos auto-zoom imperativo no carregamento: o scatter abre mostrando
  // TODA a linha do tempo carregada (o Chart.js ajusta o eixo à extensão dos
  // dados). Tentar estreitar via zoomScale num efeito era frágil — o react-chartjs-2
  // reatribui options/data e reseta o zoom do plugin, e o StrictMode remonta o
  // gráfico, deixando o scatter numa janela vazia/desalinhada no primeiro load.
  const timelineChartRef = useRef(null)

  // Opções memoizadas e SEM min/max fixo no eixo x: quem controla a janela é o
  // chartjs-plugin-zoom (via zoomScale no botão reset e no pan/zoom do usuário).
  // Fixar min/max aqui fazia cada chart.update() re-aplicar a janela e sobrescrever
  // o zoom; e, quando esse min/max era o [agora-1h, agora] do mount, o scatter abria
  // numa janela vazia sempre que o último episódio era mais antigo que 1h.
  // Ordem de dia e mes no eixo, derivada do idioma uma vez so.
  const dataCurta = useMemo(() => padraoDeDataCurta(idioma.intl), [idioma.intl])

  const scatterOptions = useMemo(() => baseChartOptions(dk, {
    scales: {
      x: {
        type: 'time',
        // Locale e ordem dos campos vêm do idioma escolhido. Cravados em pt-BR
        // e em `dd/MM`, o eixo dizia `04/01` para todo mundo — 1º de abril para
        // uns, 4 de janeiro para outros, sem nada na tela desempatando.
        adapters: { date: { locale: LOCALE_DATE_FNS[idioma.codigo] ?? ptBR } },
        time: {
          tooltipFormat: `${dataCurta} HH:mm:ss`,
          displayFormats: { minute: 'HH:mm', hour: 'HH:mm', day: dataCurta },
        },
        ticks: { color: tickColor(dk), maxRotation: 0, autoSkip: true, maxTicksLimit: 8 },
        grid: { color: gridColor(dk) },
      },
      y: {
        ticks: { color: tickColor(dk), precision: 0 },
        grid: { color: gridColor(dk) },
        title: { display: true, text: t('treinamento.episode'), color: tickColor(dk) },
      },
    },
    interaction: { mode: 'nearest', intersect: true },
    plugins: {
      legend: { labels: { color: legendColor(dk), usePointStyle: true, padding: 12 } },
      tooltip: {
        backgroundColor: tooltipBg(dk),
        borderColor: readToken('--accent-a40'),
        borderWidth: 1,
        titleColor: ACCENT,
        bodyColor: tooltipBody(dk),
        padding: 10,
        callbacks: {
          title: (its) => {
            const p = its[0]?.raw
            return p ? `#${p.y} · ${its[0].dataset.label}` : ''
          },
          label: (ctx) => {
            const p = ctx.raw
            return [
              `${t('treinamento.scatterDate')}: ${new Date(p.x).toLocaleString(idioma.intl)}`,
              ...(p.versaoModelo ? [`${t('treinamento.scatterVersion')}: ${p.versaoModelo}`] : []),
              `${t('treinamento.scatterDuration')}: ${p.duracao.toFixed(1)}s`,
              `${t('treinamento.scatterReward')}: ${p.rewardMedio.toFixed(4)}`,
              `${t('treinamento.scatterWinRate')}: ${(p.winRate * 100).toFixed(2)}%`,
            ]
          },
        },
      },
      zoom: {
        ...ZOOM_CONFIG,
        // mínimo de 10min: com a janela padrão de 1h ainda dá pra aproximar
        limits: { x: { minRange: 10 * 60 * 1000, maxRange: FIVE_HOURS_MS } },
        zoom: { ...ZOOM_CONFIG.zoom, onZoom: ({ chart }) => handleRangeChange(chart) },
        pan: { ...ZOOM_CONFIG.pan, onPan: ({ chart }) => handleRangeChange(chart) },
      },
    },
  }, idioma.intl), [handleRangeChange, dk, t, idioma.codigo, idioma.intl, dataCurta])

  const defaultChartOptions = useMemo(() => baseChartOptions(dk, {}, idioma.intl), [dk, idioma.intl])
  const lossEpsilonOptions = useMemo(() => baseChartOptions(dk, {
    scales: {
      x: { ticks: xTicks(dk), grid: { color: gridColor(dk) } },
      y: { type: 'linear', position: 'left', beginAtZero: true, ticks: { color: '#FF5C7C' }, grid: { color: gridColor(dk) }, title: { display: true, text: 'Loss', color: '#FF5C7C' } },
      y1: { type: 'linear', position: 'right', min: 0, max: 1, ticks: { color: '#5CB8FF' }, grid: { drawOnChartArea: false }, title: { display: true, text: 'Epsilon', color: '#5CB8FF' } },
    },
  }, idioma.intl), [dk, idioma.intl])
  const winRateOptions = useMemo(() => baseChartOptions(dk, {
    scales: {
      x: { ticks: xTicks(dk), grid: { color: gridColor(dk) } },
      y: { ticks: { color: tickColor(dk), callback: (v) => `${v}%` }, grid: { color: gridColor(dk) }, min: 0, suggestedMax: 60 },
    },
  }, idioma.intl), [dk, idioma.intl])
  const duracaoOptions = useMemo(() => baseChartOptions(dk, {
    scales: {
      x: { ticks: { color: tickColor(dk), maxRotation: 0, autoSkip: true }, grid: { color: gridColor(dk) } },
      y: { ticks: { color: tickColor(dk), callback: (v) => `${v}s` }, grid: { color: gridColor(dk) } },
    },
  }, idioma.intl), [dk, idioma.intl])
  const comparativoOptions = useMemo(() => baseChartOptions(dk, {
    scales: {
      x: { ticks: { color: tickColor(dk) }, grid: { color: gridColor(dk) } },
      y: { ticks: { color: tickColor(dk) }, grid: { color: gridColor(dk) } },
    },
  }, idioma.intl), [dk, idioma.intl])
  const acoesOptions = useMemo(() => baseChartOptions(dk, {
    scales: {
      x: { stacked: true, ticks: { color: tickColor(dk) }, grid: { color: gridColor(dk) } },
      y: { stacked: true, ticks: { color: tickColor(dk) }, grid: { color: gridColor(dk) } },
    },
  }, idioma.intl), [dk, idioma.intl])

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
        label: t('treinamento.avgReward'),
        data: rewardSeries,
        borderColor: 'rgba(255,215,0,0.55)',
        backgroundColor: 'rgba(255,215,0,0.10)',
        fill: true,
        tension: 0.35,
        pointRadius: 0,
        borderWidth: 1.5,
      },
      {
        label: t('treinamento.movingAvg'),
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
        label: t('treinamento.lossLabel'),
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
        label: t('treinamento.epsilon'),
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
        label: t('treinamento.winRatePercent'),
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
          label: t('treinamento.hold'),
          data: moedas.map((m) => agg[m].hold),
          backgroundColor: 'rgba(160,160,160,0.85)',
          borderRadius: 4,
        },
        {
          label: t('treinamento.buy'),
          data: moedas.map((m) => agg[m].compra),
          backgroundColor: 'rgba(20,241,149,0.85)',
          borderRadius: 4,
        },
        {
          label: t('treinamento.sell'),
          data: moedas.map((m) => agg[m].venda),
          backgroundColor: 'rgba(255,92,124,0.85)',
          borderRadius: 4,
        },
      ],
    }
  }, [visibleFiltered, t])

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
    // O sinal forte de novo ciclo é o reset da numeração; o gap temporal só cobre
    // retomadas sem reset. Piso de 30min: com média×3 qualquer episódio lento
    // (>60s) virava um "ciclo" espúrio. Mediana em vez de média porque os gaps
    // entre ciclos reais distorcem a média pra cima.
    const sortedGaps = [...gaps].sort((a, b) => a - b)
    const medianGap = sortedGaps[Math.floor(sortedGaps.length / 2)] ?? 0
    const gapThreshold = Math.max(30 * 60_000, medianGap * 12)
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

  // Plugin para desenhar bandas de ciclo no fundo do gráfico de timeline.
  // Tudo recortado à área de plotagem (sem clip, as bandas pintavam por cima dos
  // eixos ao arrastar) e com preenchimento sutil pra não competir com os pontos.
  const cycleBandsPlugin = useMemo(() => ({
    id: 'cycleBands',
    beforeDatasetsDraw: (chart) => {
      if (cycles.length <= 1) return
      const { ctx, chartArea, scales } = chart
      if (!chartArea || !scales.x) return
      const { left, right, top, bottom } = chartArea
      ctx.save()
      ctx.beginPath()
      ctx.rect(left, top, right - left, bottom - top)
      ctx.clip()
      ctx.font = 'bold 11px sans-serif'
      cycles.forEach((c, idx) => {
        const color = idx % 2 === 0 ? '255,215,0' : '92,184,255'
        const x1 = scales.x.getPixelForValue(c.start)
        const x2 = scales.x.getPixelForValue(c.end)
        if (x2 < left || x1 > right) return
        ctx.fillStyle = `rgba(${color},0.07)`
        ctx.fillRect(x1, top, Math.max(2, x2 - x1), bottom - top)
        // fronteiras de início e fim
        ctx.strokeStyle = `rgba(${color},0.4)`
        ctx.lineWidth = 1
        ctx.setLineDash([4, 4])
        ctx.beginPath()
        ctx.moveTo(x1, top)
        ctx.lineTo(x1, bottom)
        ctx.moveTo(x2, top)
        ctx.lineTo(x2, bottom)
        ctx.stroke()
        ctx.setLineDash([])
        // rótulo preso à borda visível (acompanha o pan) e omitido se não couber
        const label = t('treinamento.cycleLabel', { num: idx + 1, count: c.count })
        const lx = Math.max(x1, left) + 6
        if (lx + ctx.measureText(label).width <= Math.min(x2, right) - 6) {
          ctx.fillStyle = `rgba(${color},0.9)`
          ctx.fillText(label, lx, top + 14)
        }
      })
      ctx.restore()
    },
  }), [cycles, t])

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
        label: t('treinamento.cumulativeLabel'),
        data,
        borderColor: '#A78BFA',
        backgroundColor: 'rgba(167,139,250,0.18)',
        fill: true,
        tension: 0.35,
        pointRadius: 0,
        borderWidth: 2,
      }],
    }
  }, [visibleTimeline, t])

  // Duração por episódio
  const duracaoData = useMemo(() => ({
    labels: visibleTimeline.map((r) => `#${r.episodio}`),
    metaDates: visibleTimeline.map((r) => r.dataHora),
    datasets: [{
      label: t('treinamento.durationLabel'),
      data: visibleTimeline.map((r) => r.duracaoSegundos ?? 0),
      borderColor: '#FFB547',
      backgroundColor: 'rgba(255,181,71,0.15)',
      fill: true,
      tension: 0.3,
      pointRadius: 0,
      borderWidth: 2,
    }],
  }), [visibleTimeline, t])

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
          label: t('treinamento.rewardAvg100'),
          data: moedas.map((m) => {
            const arr = agg[m].rewards
            return (arr.reduce((a, b) => a + b, 0) / arr.length) * 100
          }),
          backgroundColor: 'rgba(255,215,0,0.75)',
          borderRadius: 4,
        },
        {
          label: t('treinamento.winRatePercent'),
          data: moedas.map((m) => {
            const arr = agg[m].winRates
            return arr.reduce((a, b) => a + b, 0) / arr.length
          }),
          backgroundColor: 'rgba(20,241,149,0.75)',
          borderRadius: 4,
        },
        {
          label: t('treinamento.numEpisodes'),
          data: moedas.map((m) => agg[m].qty),
          backgroundColor: 'rgba(92,184,255,0.75)',
          borderRadius: 4,
        },
      ],
    }
  }, [visibleFiltered, t])

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
    const byCoin = {}
    // min/max em laço: Math.min(...arr) estoura a pilha com dezenas de milhares
    // de episódios carregados via pan.
    let dMin = Infinity
    let dMax = -Infinity
    for (const r of filtered) {
      if (!r.moeda || !r.dataHora) continue
      const duracao = r.duracaoSegundos ?? 0
      if (duracao < dMin) dMin = duracao
      if (duracao > dMax) dMax = duracao
      ;(byCoin[r.moeda] = byCoin[r.moeda] || []).push({
        x: new Date(r.dataHora).getTime(),
        y: r.episodio ?? 0,
        duracao,
        rewardMedio: r.rewardMedio ?? 0,
        winRate: r.winRate ?? 0,
        versaoModelo: r.versaoModelo ?? null,
        id: r.idTreinamentoEpisodio,
      })
    }
    // Raio 4–9px: mínimo pra forma do ponto ser legível, máximo antes de os
    // pontos densos virarem uma "corda" contínua.
    const scale = (d) => (dMax === dMin ? 5 : 4 + ((d - dMin) / (dMax - dMin)) * 5)
    // Anel da cor da superfície separa pontos sobrepostos entre si
    const ring = dk ? 'rgba(18,18,24,0.9)' : 'rgba(255,255,255,0.9)'
    return {
      datasets: Object.entries(byCoin).sort(([a], [b]) => a.localeCompare(b)).map(([coin, pts]) => ({
        label: coin,
        data: pts,
        backgroundColor: coinColor(coin) + 'E6',
        borderColor: ring,
        borderWidth: 1.5,
        pointStyle: coinPointStyle(coin),
        pointRadius: pts.map((p) => scale(p.duracao)),
        pointHoverRadius: pts.map((p) => scale(p.duracao) + 2),
      })),
    }
  }, [filtered, dk])

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

  // Faixa horária visível no scatter, exibida no subtítulo (deixa claro que os
  // demais gráficos, KPIs e tabela seguem essa janela)
  const fmtHM = (ms) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const visibleWindowLabel = visibleRange.min != null && visibleRange.max != null
    ? `${fmtHM(visibleRange.min)}–${fmtHM(visibleRange.max)}`
    : null

  return (
    <div className="dashboard-container">
      <Box sx={{ p: { xs: 2, md: 4 }, color: textPrimary(dk) }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <MdPsychology size={28} color={ACCENT_DOM} />
          <Box>
            <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>{t('treinamento.title')}</Typography>
            <Typography variant="caption" sx={{ opacity: 0.65 }}>{t('treinamento.subtitle')}</Typography>
          </Box>
        </Box>
        <Button
          variant="outlined"
          startIcon={<MdRefresh />}
          onClick={onRefresh}
          disabled={loading}
          sx={{ color: textPrimary(dk), borderColor: subtleBorder(dk) }}
        >
          {t('treinamento.refresh')}
        </Button>
      </Box>

      {error && <ErrorMessage message={error} />}

      {loadingRange && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, opacity: 0.8 }}>
          <CircularProgress size={14} sx={{ color: ACCENT_DOM }} />
          <Typography variant="caption" sx={{ color: ACCENT_DOM }}>{t('treinamento.loadingRange')}</Typography>
        </Box>
      )}

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress sx={{ color: ACCENT_DOM }} />
        </Box>
      )}

      {!loading && !error && (
        <>
          {/* Filtro de moedas */}
          {coinsDisponiveis.length > 0 && (
            <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography variant="caption" sx={{ opacity: 0.7, mr: 1 }}>{t('treinamento.filterByCoin')}</Typography>
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
                      background: active ? color : subtleBg(dk),
                      color: active ? '#000' : textPrimary(dk),
                      fontWeight: active ? 700 : 400,
                      border: `1px solid ${active ? color : subtleBorder(dk)}`,
                      '&:hover': { background: active ? color : subtleBorder(dk) },
                    }}
                  />
                )
              })}
              {selectedCoins.length > 0 && (
                <Button size="small" onClick={() => setSelectedCoins([])} sx={{ color: textSecondary(dk) }}>
                  {t('treinamento.clear')}
                </Button>
              )}
            </Box>
          )}

          {/* Filtro de versão do modelo (server-side) */}
          {versoesDisponiveis.length > 0 && (
            <Box sx={{ mb: 3, mt: -1.5, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography variant="caption" sx={{ opacity: 0.7, mr: 1 }} title={t('treinamento.modelVersionTooltip')}>{t('treinamento.modelVersion')}</Typography>
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
                      background: active ? '#A78BFA' : subtleBg(dk),
                      color: active ? '#000' : textPrimary(dk),
                      fontWeight: active ? 700 : 400,
                      border: `1px solid ${active ? '#A78BFA' : subtleBorder(dk)}`,
                      '&:hover': { background: active ? '#A78BFA' : subtleBorder(dk) },
                    }}
                  />
                )
              })}
              {selectedVersao && (
                <Button size="small" onClick={() => setSelectedVersao(null)} sx={{ color: textSecondary(dk) }}>
                  {t('treinamento.clear')}
                </Button>
              )}
            </Box>
          )}

          {/* KPIs */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid size={{ xs: 6, md: 2.4 }}>
              <KpiCard icon={<MdInsights size={20} />} label={t('treinamento.episodes')} value={kpis.total} />
            </Grid>
            <Grid size={{ xs: 6, md: 2.4 }}>
              <KpiCard icon={<MdTrendingUp size={20} />} label={t('treinamento.avgReward')} value={formatNumber(kpis.rewardAvg, 3)} sub={t('treinamento.setAverage')} />
            </Grid>
            <Grid size={{ xs: 6, md: 2.4 }}>
              <KpiCard icon={<MdShowChart size={20} />} label={t('treinamento.avgWinRate')} value={formatPercent(kpis.winRateAvg)} />
            </Grid>
            <Grid size={{ xs: 6, md: 2.4 }}>
              <KpiCard icon={<MdEmojiEvents size={20} />} label={t('treinamento.bestCoin')} value={kpis.bestCoin} sub={kpis.bestCoin !== '-' ? `avg ${formatNumber(kpis.bestCoinAvg, 3)}` : null} />
            </Grid>
            <Grid size={{ xs: 6, md: 2.4 }}>
              <KpiCard icon={<MdPsychology size={20} />} label={t('treinamento.detectedCycles')} value={cycles.length} sub={cycles.length > 0 ? t('treinamento.mostRecent', { num: cycles.length }) : null} />
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
              title={t('treinamento.timelineTitle')}
              subtitle={`${t('treinamento.dragScrollZoom')} · ${t('treinamento.cyclesDetected', { count: cycles.length })} · ${t('treinamento.followsWindow')}${visibleWindowLabel ? `: ${visibleWindowLabel}` : ''}`}
              height={{ xs: 320, md: 420 }}
              ChartComp={Scatter}
              data={timelineData}
              plugins={[cycleBandsPlugin]}
              onReset={resetVisibleRange}
              resetRange={scatterResetRange}
              options={scatterOptions}
              chartRef={timelineChartRef}
            />
          </Box>

          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid size={{ xs: 12, md: 6 }}>
              <ZoomableChartCard
                title={t('treinamento.learningCurve')}
                subtitle={usingSerie
                  ? t('treinamento.backendSmoothing', { coin: moedaServerFilter })
                  : t('treinamento.rewardPerEpMA')}
                ChartComp={Line}
                data={rewardData}
                options={defaultChartOptions}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <ZoomableChartCard
                title={t('treinamento.lossEpsilon')}
                subtitle={t('treinamento.lossEpsilonSub')}
                ChartComp={Line}
                data={lossEpsilonData}
                options={lossEpsilonOptions}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <ZoomableChartCard
                title={t('treinamento.winRate')}
                subtitle={t('treinamento.winRateSub')}
                ChartComp={Line}
                data={winRateData}
                options={winRateOptions}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <ZoomableChartCard
                title={t('treinamento.cumulativeReward')}
                subtitle={t('treinamento.cumulativeSub')}
                ChartComp={Line}
                data={cumulativeRewardData}
                options={defaultChartOptions}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <ZoomableChartCard
                title={t('treinamento.durationPerEp')}
                subtitle={t('treinamento.durationSub')}
                ChartComp={Line}
                data={duracaoData}
                options={duracaoOptions}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <ChartCard title={t('treinamento.coinComparison')} subtitle={t('treinamento.coinCompSub')}>
                <Bar
                  data={comparativoMoedaData}
                  options={comparativoOptions}
                />
              </ChartCard>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <ChartCard title={t('treinamento.actionDist')} subtitle={t('treinamento.actionDistSub')}>
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
              <TopEpisodiosCard title={t('treinamento.top5Best')} subtitle={t('treinamento.highestRewards')} items={tops.best} accent="var(--perf-up)" onOpen={onOpen} />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TopEpisodiosCard title={t('treinamento.top5Worst')} subtitle={t('treinamento.lowestRewards')} items={tops.worst} accent="var(--perf-down)" onOpen={onOpen} />
            </Grid>
          </Grid>

          {/* Tabela */}
          <Paper sx={{ background: chartBg(dk), border: `1px solid ${chartBorder(dk)}`, backdropFilter: 'blur(8px)', color: textPrimary(dk) }}>
            <Box sx={{ p: 2, borderBottom: `1px solid ${chartBorder(dk)}` }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{t('treinamento.tableTitle')}</Typography>
              <Typography variant="caption" sx={{ opacity: 0.6 }}>{t('treinamento.tableSubtitle')}</Typography>
            </Box>
            <TableContainer>
              <Table size="small" sx={{ '& td, & th': { color: textPrimary(dk), borderColor: chartBorder(dk) } }}>
                <TableHead>
                  <TableRow>
                    {columns.map((col) => (
                      <TableCell key={col.id} align={col.numeric ? 'right' : 'left'} sortDirection={orderBy === col.id ? order : false}>
                        <TableSortLabel
                          active={orderBy === col.id}
                          direction={orderBy === col.id ? order : 'asc'}
                          onClick={() => handleSort(col.id)}
                          sx={{ color: `${textPrimary(dk)} !important`, '& .MuiTableSortLabel-icon': { color: `${textPrimary(dk)} !important` } }}
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
                      sx={{ cursor: 'pointer', '&:hover': { background: hoverBg(dk) } }}
                    >
                      {/* Mesmo caso da tabela de evolução: a linha segue
                          clicável para o mouse, e o número do episódio vira o
                          botão que o teclado alcança. */}
                      <TableCell align="right">
                        <Box
                          component="button"
                          type="button"
                          className="botao-nu"
                          aria-label={t('treinamento.abrirEpisodio', { episodio: row.episodio })}
                          onClick={() => onOpen(row.idTreinamentoEpisodio)}
                          sx={{ color: 'var(--accent-ink)', fontWeight: 600 }}
                        >
                          {row.episodio}
                        </Box>
                      </TableCell>
                      <TableCell>{formatDate(row.dataHora, idioma.intl)}</TableCell>
                      <TableCell>
                        <Chip
                          label={row.moeda}
                          size="small"
                          sx={{
                            background: coinColor(row.moeda) + '33',
                            color: coinInk(row.moeda, dk),
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
                      <TableCell colSpan={columns.length} align="center" sx={{ py: 4 }}>
                        {t('treinamento.noEpisodes')}
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
              sx={{ color: textPrimary(dk) }}
            />
          </Paper>
        </>
      )}
      </Box>
    </div>
  )
}

// O episodio pedido pela URL nao existe na lista carregada. Vive fora do
// DetailView de proposito: la a mensagem ficava atras de um `return` antecipado,
// ANTES dos quinze hooks do componente, e React exige a mesma ordem de hooks em
// todo render. Quem decide qual dos dois renderizar e quem ja tem o item em maos.
function EpisodioNaoEncontrado({ onBack }) {
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
function DetailView({ item, allItems, onBack, onNavigate }) {
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
              `${t('treinamento.scatterWinRate')}: ${formatPercent(ep.winRate)}`,
              `${t('treinamento.radarLoss')}: ${formatNumber(ep.lossMedia)}`,
              `${t('treinamento.scatterDuration')}: ${formatNumber(ep.duracaoSegundos, 1)}s`,
            ].join('\n')
          },
        },
      },
    },
    scales: {
      x: { ticks: { color: tickColor(dk), maxRotation: 0, autoSkip: true }, grid: { color: gridColor(dk) } },
      y: { ticks: { color: tickColor(dk) }, grid: { color: gridColor(dk) } },
    },
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
        label: t('treinamento.price', { coin: item.moeda }),
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
    scales: {
      x: {
        type: 'time',
        // Segundo eixo de tempo da tela, com a mesma correção do scatter.
        adapters: { date: { locale: LOCALE_DATE_FNS[idioma.codigo] ?? ptBR } },
        time: {
          tooltipFormat: `${dataCurtaDetalhe} HH:mm:ss`,
          displayFormats: { minute: 'HH:mm', hour: 'HH:mm' },
        },
        ticks: xTicks(dk),
        grid: { color: gridColor(dk) },
      },
      y: { ticks: { color: tickColor(dk) }, grid: { color: gridColor(dk) } },
    },
    // Este `useMemo` devolve um objeto literal, não uma chamada de
    // `baseChartOptions`: o locale entra pelas referências acima, não por
    // argumento.
  }), [dk, idioma.codigo, dataCurtaDetalhe])

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
                background: coinColor(item.moeda) + '33',
                color: coinInk(item.moeda, dk),
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
            <Typography variant="body2" sx={{ opacity: 0.7 }}>{formatDate(item.dataHora, idioma.intl)}</Typography>
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
                  background: coinColor(item.moeda) + '15',
                  color: coinInk(item.moeda, dk),
                  border: `1px solid ${coinColor(item.moeda)}30`,
                  fontWeight: 500,
                  fontSize: 11,
                  '& .MuiChip-icon': { color: coinInk(item.moeda, dk) },
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
              <Typography variant="h5" sx={{ fontWeight: 700, color: ACCENT, lineHeight: 1.2 }}>{formatNumber(item.rewardMedio)}</Typography>
              <Typography variant="caption" sx={{ color: deltaColor(rewardDelta), fontWeight: 600 }}>
                {deltaSign(rewardDelta)}{formatNumber(rewardDelta)} {t('treinamento.vsWindowAvg')}
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
                <Typography variant="h5" sx={{ fontWeight: 700, color: winRateGaugeColor, lineHeight: 1.2 }}>{formatPercent(item.winRate)}</Typography>
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
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#FF5C7C', lineHeight: 1.2 }}>{formatNumber(item.lossMedia)}</Typography>
              <Typography variant="caption" sx={{ color: deltaColor(lossDelta, true), fontWeight: 600 }}>
                {deltaSign(lossDelta)}{formatNumber(lossDelta)} {t('treinamento.vsWindowAvg')}
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
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#5CB8FF', lineHeight: 1.2 }}>{formatNumber(item.epsilon)}</Typography>
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
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#FFB547', lineHeight: 1.2 }}>{formatNumber(item.duracaoSegundos, 1)}s</Typography>
              <Typography variant="caption" sx={{ color: deltaColor(duracaoDelta, true), fontWeight: 600 }}>
                {deltaSign(duracaoDelta)}{formatNumber(duracaoDelta, 1)}s {t('treinamento.vsWindowAvg')}
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
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#A78BFA', lineHeight: 1.2 }}>{formatNumber(eficiencia, 6)}</Typography>
              <Typography variant="caption" sx={{ color: deltaColor(eficienciaDelta), fontWeight: 600 }}>
                {deltaSign(eficienciaDelta)}{formatNumber(eficienciaDelta, 6)} {t('treinamento.vsWindowAvg')}
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
                  [t('treinamento.dateTime'), formatDate(item.dataHora, idioma.intl), null, null],
                  [t('treinamento.rewardTotal'), formatNumber(item.rewardTotal, 2), { color: (item.rewardTotal ?? 0) >= 0 ? '#14F195' : '#FF5C7C' }, null],
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
                    [t('treinamento.priceRange'), `${formatNumber(mercadoStats.precoMin, mercadoStats.digits)} – ${formatNumber(mercadoStats.precoMax, mercadoStats.digits)}`, null],
                    ...(mercadoStats.dominanciaCompradora != null
                      ? [[t('treinamento.buyerDominance'), `${mercadoStats.dominanciaCompradora.toFixed(1)}%`, mercadoStats.dominanciaCompradora >= 50 ? '#14F195' : '#FF5C7C']]
                      : []),
                    ...(mercadoStats.longShort != null
                      ? [[t('treinamento.longShortAvg'), formatNumber(mercadoStats.longShort, 2), null]]
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
                  #{prevItem.episodio} ({formatDate(prevItem.dataHora, idioma.intl)}) → #{item.episodio} ({formatDate(item.dataHora, idioma.intl)})
                </Typography>
              </Box>
              <Grid container spacing={2}>
                {[
                  { label: t('treinamento.rewardMedio'), prev: prevItem.rewardMedio, curr: item.rewardMedio, fmt: (v) => formatNumber(v), inverted: false, key: 'reward' },
                  { label: t('treinamento.winRate'), prev: prevItem.winRate, curr: item.winRate, fmt: (v) => formatPercent(v), inverted: false, key: 'winrate' },
                  { label: t('treinamento.lossLabel'), prev: prevItem.lossMedia, curr: item.lossMedia, fmt: (v) => formatNumber(v), inverted: true, key: 'loss' },
                  { label: t('treinamento.epsilon'), prev: prevItem.epsilon, curr: item.epsilon, fmt: (v) => formatNumber(v), inverted: true, key: 'epsilon' },
                  { label: t('treinamento.durationLabel'), prev: prevItem.duracaoSegundos, curr: item.duracaoSegundos, fmt: (v) => formatNumber(v, 1), inverted: true, key: 'duration' },
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
                          {d >= 0 ? '▲' : '▼'} {deltaSign(d)}{key === 'winrate' ? `${(d * 100).toFixed(2)}pp` : formatNumber(d, key === 'duration' ? 1 : 4)}
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
  const { t } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()
  // Filtros persistidos na URL (?moedas=BTC,ETH&versao=x): sobrevivem a refresh,
  // geram link compartilhável e atravessam a navegação lista ⇄ detalhe.
  const [searchParams, setSearchParams] = useSearchParams()
  const [items, setItems] = useState([])
  const [resumo, setResumo] = useState([])
  const [serie, setSerie] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadingRange, setLoadingRange] = useState(false)
  const [error, setError] = useState(null)
  const [selectedCoins, setSelectedCoins] = useState(() =>
    (searchParams.get('moedas') || '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean))
  const [selectedVersao, setSelectedVersao] = useState(() => searchParams.get('versao') || null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [visibleRange, setVisibleRange] = useState({ min: null, max: null })
  // Buckets (janelas de 4h) já buscados, identificados pelo timestamp de início
  const fetchedBucketsRef = useRef(new Set())
  const genRef = useRef(0)       // invalida fetches de gerações antigas (troca de filtro/refresh)
  const inflightRef = useRef(0)  // conta buscas de janela em andamento

  const moedaServerFilter = selectedCoins.length === 1 ? selectedCoins[0] : null

  const filterQuery = useCallback((extra = {}) => {
    const p = new URLSearchParams()
    if (selectedCoins.length > 0) p.set('moedas', selectedCoins.join(','))
    if (selectedVersao) p.set('versao', selectedVersao)
    Object.entries(extra).forEach(([k, v]) => { if (v) p.set(k, v) })
    return p.toString()
  }, [selectedCoins, selectedVersao])

  // Mantém a URL da lista espelhando os filtros (replace pra não poluir o histórico)
  useEffect(() => {
    if (id) return
    const qs = filterQuery()
    if (qs !== searchParams.toString()) setSearchParams(qs, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, filterQuery])

  // Carga inicial em grupos de 4h: descobre o episódio mais recente e carrega as
  // duas janelas de 4h mais recentes. Refetcha quando filtro ou refresh muda.
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
        const buckets = [bucketAtual - FOUR_HOURS_MS, bucketAtual]

        // Deep link de detalhe (?dt=dataHora do episódio): garante que a janela
        // do episódio também seja carregada, mesmo sendo antiga.
        const dtParam = searchParams.get('dt')
        const alvoMs = dtParam ? new Date(dtParam).getTime() : NaN
        if (!Number.isNaN(alvoMs)) {
          const bucketAlvo = bucketStartOf(alvoMs)
          for (const b of [bucketAlvo - FOUR_HOURS_MS, bucketAlvo]) {
            if (!buckets.includes(b)) buckets.push(b)
          }
        }

        const janelas = await Promise.all(
          buckets.map((b) => fetchWindow(moedaServerFilter, selectedVersao, b, b + FOUR_HOURS_MS))
        )
        if (canceled) return
        buckets.forEach((b) => fetchedBucketsRef.current.add(b))
        setItems(mergeItems(janelas[0], janelas.slice(1).flat()))
      } catch (e) {
        if (!canceled) setError(e?.message || t('treinamento.loadError'))
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

  // Polling leve: a cada 60s busca só o bucket de 4h atual e mescla, mantendo
  // KPIs e curvas vivos durante um treino ativo. Pausa com a aba em segundo plano.
  useEffect(() => {
    const gen = genRef.current
    const tick = async () => {
      if (document.hidden) return
      const bucket = bucketStartOf(Date.now())
      try {
        const novos = await fetchWindow(moedaServerFilter, selectedVersao, bucket, bucket + FOUR_HOURS_MS)
        if (genRef.current !== gen) return
        fetchedBucketsRef.current.add(bucket)
        setItems((prev) => mergeItems(prev, novos))
      } catch { /* silencioso: próxima rodada tenta de novo */ }
    }
    const intervalId = setInterval(tick, 60_000)
    return () => clearInterval(intervalId)
  }, [moedaServerFilter, selectedVersao, refreshKey])

  // /serie só faz sentido com 1 moeda. Cancela quando muda.
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

  // Navegações levam filtros junto e, no detalhe, a data do episódio (?dt=)
  // pra permitir recarregar/compartilhar o link mesmo de episódios antigos.
  const openEpisodio = useCallback((epId) => {
    const alvo = items.find((i) => i.idTreinamentoEpisodio === epId)
    const qs = filterQuery({ dt: alvo?.dataHora })
    navigate(`/treinamento-episodios/${epId}${qs ? `?${qs}` : ''}`)
  }, [items, filterQuery, navigate])

  if (id) {
    const item = items.find((i) => i.idTreinamentoEpisodio === id)
    if (loading && !item) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress sx={{ color: ACCENT }} />
        </Box>
      )
    }
    const voltarParaLista = () => {
      const qs = filterQuery()
      navigate(`/treinamento-episodios${qs ? `?${qs}` : ''}`)
    }
    if (!item) {
      return <EpisodioNaoEncontrado onBack={voltarParaLista} />
    }
    return (
      <DetailView
        item={item}
        allItems={items}
        onBack={voltarParaLista}
        onNavigate={openEpisodio}
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
      onOpen={openEpisodio}
      selectedCoins={selectedCoins}
      setSelectedCoins={setSelectedCoins}
      selectedVersao={selectedVersao}
      setSelectedVersao={setSelectedVersao}
      visibleRange={visibleRange}
      setVisibleRange={setVisibleRange}
    />
  )
}
