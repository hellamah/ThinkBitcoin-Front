import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import Grid from '@mui/material/Grid'
import LinearProgress from '@mui/material/LinearProgress'
import Button from '@mui/material/Button'
import Fade from '@mui/material/Fade'
import Skeleton from '@mui/material/Skeleton'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Tooltip from '@mui/material/Tooltip'
import { Joyride, STATUS } from 'react-joyride'
import {
  MdPublic,
  MdAnalytics,
  MdClose,
  MdFileDownload,
  MdShare,
  MdTour,
  MdRefresh,
} from 'react-icons/md'

import DashboardHeader from '../components/dashboard/DashboardHeader'
import ErrorMessage from '../components/ErrorMessage'
import CoinCarousel from '../components/dashboard/CoinCarousel'
import { useAuth } from '../context/AuthContext'
import { useDashboard } from '../context/DashboardContext'
import useTranslation from '../hooks/useTranslation'
import useCoinPrices from '../hooks/useCoinPrices'
import { apiRequest, VariavelExternaEndpoint } from '../utils/apiClient'
import { MapRegion, ExportFormat } from '../utils/enums'
import { formatTooltipData, getRegionForCountry, filterCoinsByCountry } from '../utils/mapUtils'
import { hasCacheValid } from '../utils/cache'
import { getTourHeatmapVisto, setTourHeatmapVisto } from '../utils/preferences'
import { exportarHeatmapDados } from '../utils/exportUtils'

// Componente de Gráfico Nativo à prova de loops no React 19
const NativeGeoChart = ({ data, options, onSelect }) => {
  const containerRef = useRef(null)
  const [loaded, setLoaded] = useState(false)

  // 1. Efeito para carregar a biblioteca Google Charts de forma assíncrona e segura
  useEffect(() => {
    let active = true

    const checkLoaded = () => {
      if (window.google && window.google.visualization && window.google.visualization.GeoChart) {
        if (active) setLoaded(true)
        return true
      }
      return false
    }

    if (checkLoaded()) return

    const loadLibrary = () => {
      window.google.charts.load('current', {
        packages: ['geochart'],
        language: 'pt-BR'
      })
      window.google.charts.setOnLoadCallback(() => {
        if (active) setLoaded(true)
      })
    }

    if (!window.google || !window.google.charts) {
      let script = document.querySelector('script[src="https://www.gstatic.com/charts/loader.js"]')
      if (!script) {
        script = document.createElement('script')
        script.src = 'https://www.gstatic.com/charts/loader.js'
        script.async = true
        document.body.appendChild(script)
      }
      
      const handleLoad = () => {
        if (window.google && window.google.charts) {
          loadLibrary()
        }
      }
      script.addEventListener('load', handleLoad)
      return () => {
        active = false
        script.removeEventListener('load', handleLoad)
      }
    } else {
      loadLibrary()
      return () => {
        active = false
      }
    }
  }, [])

  // 2. Efeito para desenhar o gráfico e gerenciar eventos de forma robusta
  useEffect(() => {
    if (!loaded || !data || !containerRef.current) return

    try {
      const dataTable = window.google.visualization.arrayToDataTable(data)
      const chart = new window.google.visualization.GeoChart(containerRef.current)

      if (onSelect) {
        window.google.visualization.events.addListener(chart, 'select', () => {
          const selection = chart.getSelection()
          if (selection && selection.length > 0) {
            onSelect(selection[0].row)
            chart.setSelection([])
          }
        })
      }

      chart.draw(dataTable, options)
      
      const handleResize = () => {
        chart.draw(dataTable, options)
      }
      window.addEventListener('resize', handleResize)

      return () => {
        window.removeEventListener('resize', handleResize)
        chart.clearChart()
      }
    } catch (err) {
      console.error('[NativeGeoChart] Erro ao desenhar gráfico:', err)
    }
  }, [loaded, data, options, onSelect])

  return (
    <div 
      ref={containerRef} 
      style={{ width: '100%', height: '100%', minHeight: options.height || '400px' }} 
    />
  )
}

// ---------------------------------------------------------------------------
// Mapa de códigos ISO para nomes de países em PT-BR
// ---------------------------------------------------------------------------
const getCountryName = (code) => {
  const countries = {
    US: 'Estados Unidos', DE: 'Alemanha', CH: 'Suíça', BR: 'Brasil',
    CA: 'Canadá', GB: 'Reino Unido', FR: 'França', JP: 'Japão',
    CN: 'China', IN: 'Índia', RU: 'Rússia', AU: 'Austrália',
    NO: 'Noruega', SE: 'Suécia', NL: 'Holanda', SG: 'Singapura',
    IT: 'Itália', ES: 'Espanha', ZA: 'África do Sul', NG: 'Nigéria',
    EG: 'Egito', KE: 'Quênia', GH: 'Gana', MA: 'Marrocos',
    NZ: 'Nova Zelândia', KR: 'Coreia do Sul', MX: 'México',
    AR: 'Argentina', CO: 'Colômbia',
  }
  return countries[String(code).toUpperCase()] || code
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------
export default function GeoHeatmapView() {
  const { token, user: usuario, prefs } = useAuth()
  const { refreshTrigger, moedaSelecionada, setMoedaSelecionada } = useDashboard()
  const { t } = useTranslation()
  const moedasCarousel = useCoinPrices()
  const navigate = useNavigate()
  const location = useLocation()

  // ------ estados de dados ------
  const [heatmapData, setHeatmapData] = useState(null)
  const heatmapDataRef = useRef(heatmapData)
  useEffect(() => {
    heatmapDataRef.current = heatmapData
  }, [heatmapData])
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [dadosDoCacheAtivo, setDadosDoCacheAtivo] = useState(false)

  // ------ estados de UI ------
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200)
  const [paisSelecionado, setPaisSelecionado] = useState(null)
  const [regionSelecionada, setRegionSelecionada] = useState(() => {
    if (typeof window === 'undefined') return MapRegion.WORLD
    const params = new URLSearchParams(window.location.search)
    const qRegiao = params.get('regiao')
    return Object.values(MapRegion).includes(qRegiao) ? qRegiao : MapRegion.WORLD
  })
  const [intervaloMapa, setIntervaloMapa] = useState(() => {
    if (typeof window === 'undefined') return '24h'
    const params = new URLSearchParams(window.location.search)
    const qIntervalo = params.get('intervalo')
    return ['1h', '24h', '1m'].includes(qIntervalo) ? qIntervalo : '24h'
  })

  // ------ estados de notificação ------
  const [snackbarAberto, setSnackbarAberto] = useState(false)
  const [snackbarMensagem, setSnackbarMensagem] = useState('')
  const [snackbarSeveridade, setSnackbarSeveridade] = useState('success')

  // ------ estados de exportação ------
  const [anchorExportar, setAnchorExportar] = useState(null)
  const exportarAberto = Boolean(anchorExportar)

  // ------ tour onboarding ------
  const [tourRodando, setTourRodando] = useState(false)
  const refCarousel = useRef(null)
  const refIntervalos = useRef(null)
  const refAcoesTopo = useRef(null)
  const refZoom = useRef(null)
  const refInteligencia = useRef(null)

  const moedasCarouselRef = useRef(moedasCarousel)
  useEffect(() => {
    moedasCarouselRef.current = moedasCarousel
  }, [moedasCarousel])

  const queryLidaRef = useRef(false)

  // ---------------------------------------------------------------------------
  // Resize handler com debounce de 150ms para evitar gargalos com SVG
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let timeoutId = null
    const handleResize = () => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => setWindowWidth(window.innerWidth), 150)
    }
    window.addEventListener('resize', handleResize)
    return () => { window.removeEventListener('resize', handleResize); clearTimeout(timeoutId) }
  }, [])

  const chartHeight = useMemo(() => {
    if (windowWidth < 600) return '280px'
    if (windowWidth < 960) return '360px'
    return '450px'
  }, [windowWidth])

  // ---------------------------------------------------------------------------
  // Leitura de query-string para restaurar estado (moeda, intervalo, região)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (queryLidaRef.current || !moedasCarousel?.length) return

    const params = new URLSearchParams(location.search)
    const qMoeda = params.get('moeda')
    const qIntervalo = params.get('intervalo')
    const qRegiao = params.get('regiao')

    let inicializouAlgo = false

    if (qMoeda) {
      const match = moedasCarousel.find(m =>
        String(m.simbolo).toUpperCase() === String(qMoeda).toUpperCase()
      )
      if (match && match.simbolo !== moedaSelecionada) {
        setMoedaSelecionada(match.simbolo)
        inicializouAlgo = true
      }
    }
    if (qIntervalo && ['1h', '24h', '1m'].includes(qIntervalo)) {
      if (qIntervalo !== intervaloMapa) {
        setIntervaloMapa(qIntervalo)
        inicializouAlgo = true
      }
    }
    if (qRegiao && Object.values(MapRegion).includes(qRegiao)) {
      if (qRegiao !== regionSelecionada) {
        setRegionSelecionada(qRegiao)
        inicializouAlgo = true
      }
    }

    if (inicializouAlgo || qMoeda) {
      queryLidaRef.current = true
    }
  }, [moedasCarousel, location.search, moedaSelecionada, intervaloMapa, regionSelecionada, setMoedaSelecionada])

  // ---------------------------------------------------------------------------
  // Sincroniza a URL -> Estado apenas quando o usuário navegar no histórico (Voltar/Avançar)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const qMoeda = params.get('moeda')
    if (qMoeda && qMoeda !== moedaSelecionada) {
      const match = moedasCarousel?.find(m =>
        String(m.simbolo).toUpperCase() === String(qMoeda).toUpperCase()
      )
      if (match) setMoedaSelecionada(match.simbolo)
    }
  }, [location.search, moedaSelecionada, moedasCarousel, setMoedaSelecionada])

  // ---------------------------------------------------------------------------
  // Sincroniza query-string ao mudar o estado (permite link compartilhável)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!location.pathname.startsWith('/heatmap')) return
    if (!moedaSelecionada) return

    const params = new URLSearchParams(location.search)
    const qMoeda = params.get('moeda')
    const qIntervalo = params.get('intervalo')
    const qRegiao = params.get('regiao')

    if (qMoeda !== moedaSelecionada || qIntervalo !== intervaloMapa || qRegiao !== regionSelecionada) {
      const newParams = new URLSearchParams()
      newParams.set('moeda', moedaSelecionada)
      newParams.set('intervalo', intervaloMapa)
      newParams.set('regiao', regionSelecionada)
      navigate(`?${newParams.toString()}`, { replace: true })
    }
  }, [moedaSelecionada, intervaloMapa, regionSelecionada, navigate, location.pathname, location.search])

  // ---------------------------------------------------------------------------
  // Inicialização da moeda selecionada baseada nas preferências do usuário
  // ---------------------------------------------------------------------------
  useEffect(() => {
    // Se há moeda informada na query-string, ela tem prioridade total e não inicializamos preferences
    const params = new URLSearchParams(location.search)
    if (params.get('moeda')) return

    if (!token || !moedasCarousel?.length || moedaSelecionada) return
    const moedaProp = prefs?.siglaMoedaPreferida || prefs?.moedaPreferida
    let initialized = false
    if (moedaProp) {
      const match = moedasCarousel.find(m =>
        m.simbolo && String(m.simbolo).toUpperCase() === String(moedaProp).toUpperCase().trim()
      )
      if (match) { setMoedaSelecionada(match.simbolo); initialized = true }
    }
    if (!initialized) {
      const btc = moedasCarousel.find(m => m.simbolo === 'BTC') || moedasCarousel[0]
      if (btc) setMoedaSelecionada(btc.simbolo)
    }
  }, [prefs, token, moedasCarousel, moedaSelecionada, setMoedaSelecionada, location.search])

  // ---------------------------------------------------------------------------
  // Derivados
  // ---------------------------------------------------------------------------
  const moedasFiltro = useMemo(() =>
    moedaSelecionada ? [moedaSelecionada] : [], [moedaSelecionada])

  const topRegioes = useMemo(() => {
    if (!heatmapData || heatmapData.length <= 1) return []
    const items = heatmapData.slice(1)
      .map(([countryCell, val]) => {
        const country = typeof countryCell === 'object' ? countryCell.v : countryCell
        return { country, val: Number(val) }
      })
      .sort((a, b) => b.val - a.val)
      .slice(0, 5)

    const totalSum = items.reduce((acc, curr) => acc + curr.val, 0)
    if (totalSum === 0) return items.map(item => ({ ...item, displayVal: 0 }))

    let calculatedItems = items.map(item => ({
      ...item,
      displayVal: Math.round((item.val / totalSum) * 100)
    }))
    const currentSum = calculatedItems.reduce((acc, curr) => acc + curr.displayVal, 0)
    const diff = 100 - currentSum
    if (diff !== 0 && calculatedItems.length > 0) calculatedItems[0].displayVal += diff
    return calculatedItems
  }, [heatmapData])

  const moedasExibidas = useMemo(() => {
    const filtered = filterCoinsByCountry(paisSelecionado, moedasCarousel)
    const filteredCopy = [...filtered]
    if (moedaSelecionada && !filteredCopy.find(m => m.simbolo === moedaSelecionada)) {
      const match = moedasCarousel?.find(m => m.simbolo === moedaSelecionada)
      if (match) filteredCopy.push(match)
    }
    return filteredCopy
  }, [paisSelecionado, moedasCarousel, moedaSelecionada])

  // Identifica dinamicamente quais regiões têm dados para habilitar botões de zoom
  const activeRegions = useMemo(() => {
    const active = new Set([MapRegion.WORLD])
    if (heatmapData && heatmapData.length > 1) {
      heatmapData.slice(1).forEach(([countryCell]) => {
        const countryCode = typeof countryCell === 'object' ? countryCell.v : countryCell
        const region = getRegionForCountry(countryCode)
        if (region) active.add(region)
      })
    }
    return active
  }, [heatmapData])

  // ---------------------------------------------------------------------------
  // Carregamento do Heatmap com suporte a cache
  // ---------------------------------------------------------------------------
  const moedaId = useMemo(() => {
    const moeda = moedasCarousel?.find(m => m.simbolo === moedaSelecionada)
    return moeda?.id || null
  }, [moedasCarousel, moedaSelecionada])

  const carregarHeatmap = useCallback(async (forceRefresh = false) => {
    if (!token || !moedaSelecionada) return
    if (!moedaId && (!moedasCarousel || moedasCarousel.length === 0)) return // Aguarda o carrossel carregar

    const chaveCache = `heatmap_${moedaSelecionada}_${intervaloMapa}`
    
    // Sinaliza se o dado será carregado do cache (caso exista)
    const temNoCache = !forceRefresh && hasCacheValid(chaveCache)
    setDadosDoCacheAtivo(temNoCache)

    setLoading(true)
    setErro('')
    try {
      const idMoedaParam = moedaId ? `?idMoeda=${moedaId}` : ''
      const sep = idMoedaParam ? '&' : '?'
      const url = `${VariavelExternaEndpoint.TREND_HEATMAP}${idMoedaParam}${sep}intervalo=${intervaloMapa}`
      const response = await apiRequest(url, {
        headers: { Authorization: `Bearer ${token}` },
        useCache: true,
        cacheKey: chaveCache,
        ttl: 5 * 60 * 1000,
        forceRefresh
      })

      let rawData = []
      if (response?.resultado) {
        rawData = Array.isArray(response.resultado) ? response.resultado : (response.resultado.registros || [])
      } else if (Array.isArray(response)) {
        rawData = response
      }

      // Calcula participações relativas do top 5
      const top5List = rawData.map(item => {
        const countryCode = String(item.geoTop1Code || item.GeoTop1Code).toUpperCase()
        const val = Number(item.frequenciaLideranca || item.FrequenciaLideranca || item.mediaIntensidade || item.MediaIntensidade || 0)
        return { countryCode, val }
      }).sort((a, b) => b.val - a.val).slice(0, 5)

      const totalSum = top5List.reduce((acc, curr) => acc + curr.val, 0)
      const sharesMap = {}
      if (totalSum > 0) {
        let sumShares = 0
        top5List.forEach(item => {
          const share = Math.round((item.val / totalSum) * 100)
          sharesMap[item.countryCode] = share
          sumShares += share
        })
        const diff = 100 - sumShares
        if (diff !== 0 && top5List.length > 0) sharesMap[top5List[0].countryCode] += diff
      }

      // Converte para o formato Google Charts com Tooltips HTML enriquecidos
      const chartData = [
        [
          'Country',
          t('marketInterest') || 'Interesse Global (Dominância)',
          { role: 'tooltip', type: 'string', p: { html: true } }
        ]
      ]

      if (rawData?.length > 0) {
        rawData.forEach(item => {
          const countryCode = String(item.geoTop1Code || item.GeoTop1Code).toUpperCase()
          const val = item.frequenciaLideranca || item.FrequenciaLideranca || item.mediaIntensidade || item.MediaIntensidade || 0
          const normalizedPercent = sharesMap[countryCode] || 0

          // Dados extras para o tooltip enriquecido
          const extras = {
            variacao24h: item.variacao24h ?? item.Variacao24h,
            volume: item.volume ?? item.Volume,
          }

          const tooltipHtml = formatTooltipData(
            getCountryName(countryCode),
            moedaSelecionada,
            normalizedPercent,
            extras
          )
          chartData.push([
            { v: countryCode, f: '' },
            val,
            tooltipHtml
          ])
        })
      }

      const resultado = chartData.length > 1 ? chartData : null
      setHeatmapData(resultado)
    } catch (err) {
      console.error('Erro ao carregar Heatmap', err)
      setErro('Não foi possível carregar os dados geográficos no momento.')
    } finally {
      setLoading(false)
    }
  }, [token, moedaSelecionada, moedaId, moedasCarousel?.length, intervaloMapa, t])

  useEffect(() => { carregarHeatmap() }, [carregarHeatmap, refreshTrigger])

  // ---------------------------------------------------------------------------
  // Handlers de UI
  // ---------------------------------------------------------------------------
  const selecionarMoeda = (simbolo) => setMoedaSelecionada(simbolo)

  const handleCountryClick = useCallback((countryCode) => {
    setPaisSelecionado(prev => {
      if (prev === countryCode) {
        setRegionSelecionada(MapRegion.WORLD)
        return null
      } else {
        const region = getRegionForCountry(countryCode)
        setRegionSelecionada(region)
        return countryCode
      }
    })
  }, [])

  const mostrarSnackbar = (mensagem, severidade = 'success') => {
    setSnackbarMensagem(mensagem)
    setSnackbarSeveridade(severidade)
    setSnackbarAberto(true)
  }

  const handleCompartilhar = () => {
    const url = window.location.href
    navigator.clipboard.writeText(url)
      .then(() => mostrarSnackbar(t('heatmap.linkCopiado') || 'Link copiado!'))
      .catch(() => mostrarSnackbar('Não foi possível copiar o link', 'error'))
  }

  const handleAbrirExportar = (event) => setAnchorExportar(event.currentTarget)
  const handleFecharExportar = () => setAnchorExportar(null)

  const handleExportar = (formato) => {
    exportarHeatmapDados(heatmapData, moedaSelecionada, intervaloMapa, formato)
    handleFecharExportar()
    mostrarSnackbar(`Exportação ${formato.toUpperCase()} concluída!`)
  }

  // ---------------------------------------------------------------------------
  // Eventos do gráfico
  // ---------------------------------------------------------------------------
  const handleChartSelect = useCallback((row) => {
    const currentData = heatmapDataRef.current
    if (currentData?.[row + 1]) {
      const countryCell = currentData[row + 1][0]
      const countryCode = typeof countryCell === 'object' ? countryCell.v : countryCell
      handleCountryClick(countryCode)
    }
  }, [handleCountryClick])

  const chartEvents = useMemo(() => [
    {
      eventName: 'select',
      callback: ({ chartWrapper }) => {
        const chart = chartWrapper.getChart()
        const selection = chart.getSelection()
        if (selection.length > 0) {
          const row = selection[0].row
          handleChartSelect(row)
          // Limpa seleção para evitar coloração cinza padrão do Google Charts
          chart.setSelection([])
        }
      }
    }
  ], [handleChartSelect])

  const chartOptions = useMemo(() => ({
    backgroundColor: 'transparent',
    datalessRegionColor: '#1a1a1a',
    defaultColor: '#252525',
    colorAxis: { colors: ['#282208', '#cca92c', '#ffd700'] },
    keepAspectRatio: true,
    region: regionSelecionada,
    tooltip: { isHtml: true, trigger: 'focus' }
  }), [regionSelecionada])

  const optionsFinal = useMemo(() => ({
    ...chartOptions,
    height: chartHeight
  }), [chartOptions, chartHeight])

  // ---------------------------------------------------------------------------
  // Tour Onboarding (react-joyride)
  // ---------------------------------------------------------------------------
  const passosTour = useMemo(() => [
    {
      target: '[data-tour="carrossel"]',
      title: t('heatmap.tourPasso1Titulo') || 'Carrossel de Ativos',
      content: t('heatmap.tourPasso1Descricao') || 'Selecione o ativo que deseja visualizar.',
      disableBeacon: true,
    },
    {
      target: '[data-tour="intervalos"]',
      title: t('heatmap.tourPasso2Titulo') || 'Filtro de Intervalo',
      content: t('heatmap.tourPasso2Descricao') || 'Alterne entre 1H, 1D e 1M.',
    },
    {
      target: '[data-tour="acoes-topo"]',
      title: t('heatmap.tourPasso3Titulo') || 'Exportar e Compartilhar',
      content: t('heatmap.tourPasso3Descricao') || 'Baixe os dados ou compartilhe o link.',
    },
    {
      target: '[data-tour="zoom"]',
      title: t('heatmap.tourPasso4Titulo') || 'Zoom Geográfico',
      content: t('heatmap.tourPasso4Descricao') || 'Clique em uma região para dar zoom.',
    },
    {
      target: '[data-tour="inteligencia"]',
      title: t('heatmap.tourPasso5Titulo') || 'Central de Inteligência',
      content: t('heatmap.tourPasso5Descricao') || 'Top 5 países. Clique para filtrar o carrossel.',
    },
  ], [])

  // Inicia o tour automaticamente na primeira visita
  useEffect(() => {
    if (!getTourHeatmapVisto() && heatmapData) {
      const timer = setTimeout(() => setTourRodando(true), 800)
      return () => clearTimeout(timer)
    }
  }, [heatmapData])

  const handleTourCallback = (data) => {
    const { status } = data
    if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status)) {
      setTourRodando(false)
      setTourHeatmapVisto()
    }
  }

  if (!token) return <Box sx={{ p: 5 }}>Redirecionando para login...</Box>

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="dashboard-container">
      {/* Estilos do tooltip do Google Charts e do tour */}
      <style dangerouslySetInnerHTML={{__html: `
        .google-visualization-tooltip {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          padding: 0 !important;
          pointer-events: none !important;
        }
        .__floater__open { z-index: 9999 !important; }
        .react-joyride__tooltip {
          background: rgba(15,15,15,0.97) !important;
          border: 1px solid rgba(255,215,0,0.35) !important;
          border-radius: 16px !important;
          color: #fff !important;
          font-family: 'Outfit', sans-serif !important;
          box-shadow: 0 20px 60px rgba(0,0,0,0.8) !important;
        }
        .react-joyride__tooltip button { font-family: 'Outfit', sans-serif !important; }
      `}} />

      {/* Tour Onboarding */}
      <Joyride
        steps={passosTour}
        run={tourRodando}
        continuous
        showSkipButton
        showProgress
        callback={handleTourCallback}
        locale={{
          back: 'Voltar',
          close: t('heatmap.tourFechar') || 'Entendi!',
          last: t('heatmap.tourFechar') || 'Entendi!',
          next: 'Próximo',
          skip: 'Pular',
        }}
        styles={{
          options: {
            primaryColor: '#ffd700',
            textColor: '#fff',
            backgroundColor: 'rgba(15,15,15,0.97)',
            zIndex: 9999,
          },
          tooltipTitle: { color: '#ffd700', fontWeight: 800, fontSize: '1rem' },
          tooltipContent: { color: 'rgba(255,255,255,0.8)', fontSize: '0.88rem' },
          buttonNext: { background: '#ffd700', color: '#000', fontWeight: 700, borderRadius: '8px' },
          buttonBack: { color: 'rgba(255,255,255,0.6)' },
          buttonSkip: { color: 'rgba(255,255,255,0.4)', fontSize: '0.78rem' },
        }}
      />

      {/* Notificações (snackbar) */}
      <Snackbar
        open={snackbarAberto}
        autoHideDuration={3000}
        onClose={() => setSnackbarAberto(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbarAberto(false)}
          severity={snackbarSeveridade}
          variant="filled"
          sx={{
            fontFamily: 'Outfit, sans-serif',
            background: snackbarSeveridade === 'success' ? 'rgba(20,20,20,0.97)' : undefined,
            border: '1px solid rgba(255,215,0,0.3)',
            color: '#fff',
          }}
        >
          {snackbarMensagem}
        </Alert>
      </Snackbar>

      <DashboardHeader t={t} prefs={prefs} usuario={usuario} title={t('nav.heatmap') || 'Geopolítica'} />
      <ErrorMessage message={erro} onClose={() => setErro('')} />

      {/* Carrossel de Ativos */}
      <div data-tour="carrossel">
        <CoinCarousel
          moedasCarousel={moedasExibidas}
          moedasFiltro={moedasFiltro}
          selecionarMoeda={selecionarMoeda}
          handleDebateTrigger={() => {}}
          t={t}
          isMobile={false}
          isHeatmap={true}
        />
      </div>

      <section className="panel" style={{ marginTop: '20px', minHeight: '550px', backdropFilter: 'blur(16px)', background: 'rgba(20, 20, 20, 0.45)' }}>

        {/* Cabeçalho do painel */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, flexDirection: { xs: 'column', sm: 'row' }, gap: 2, mb: 4 }}>
          <Box>
            <Typography variant="h4" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1.5, fontFamily: 'Outfit, sans-serif', fontWeight: 800, color: 'var(--color-primary)' }}>
              <MdPublic /> {t('globalHotspot') || 'Geopolítica de Mercado'}
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.7, fontSize: '0.95rem' }}>
              Mapeamento global do interesse de busca pelo ativo, destacando as regiões que atualmente lideram a narrativa de mercado.
            </Typography>
          </Box>

          {/* Ações: Intervalo | Compartilhar | Exportar | Tour */}
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center', flexShrink: 0 }}>
            {/* Seletor de intervalo */}
            <div className="interval-selector-mini" data-tour="intervalos" ref={refIntervalos}>
              {[
                { label: '1H', value: '1h' },
                { label: '1D', value: '24h' },
                { label: '1M', value: '1m' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  className={`interval-btn-mini ${intervaloMapa === opt.value ? 'active' : ''}`}
                  onClick={() => {
                    setIntervaloMapa(opt.value)
                    // Limpa cache ao mudar intervalo para forçar reload
                    setDadosDoCacheAtivo(false)
                    setHeatmapData(null)
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Botões de ação */}
            <Box sx={{ display: 'flex', gap: 1 }} data-tour="acoes-topo" ref={refAcoesTopo}>
              {/* Compartilhar */}
              <Tooltip title={t('heatmap.compartilhar') || 'Compartilhar'} arrow>
                <Button
                  id="btn-compartilhar"
                  variant="outlined"
                  size="small"
                  onClick={handleCompartilhar}
                  startIcon={<MdShare />}
                  sx={{
                    color: 'var(--color-primary)',
                    borderColor: 'rgba(255,215,0,0.3)',
                    textTransform: 'none',
                    fontFamily: 'Outfit, sans-serif',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    '&:hover': {
                      background: 'rgba(255,215,0,0.06)',
                      borderColor: 'var(--color-primary)',
                    }
                  }}
                >
                  {t('heatmap.compartilhar') || 'Compartilhar'}
                </Button>
              </Tooltip>

              {/* Exportar */}
              <Tooltip title={t('heatmap.exportar') || 'Exportar Dados'} arrow>
                <Button
                  id="btn-exportar"
                  variant="outlined"
                  size="small"
                  onClick={handleAbrirExportar}
                  startIcon={<MdFileDownload />}
                  disabled={!heatmapData}
                  sx={{
                    color: 'var(--color-primary)',
                    borderColor: 'rgba(255,215,0,0.3)',
                    textTransform: 'none',
                    fontFamily: 'Outfit, sans-serif',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    '&:hover': {
                      background: 'rgba(255,215,0,0.06)',
                      borderColor: 'var(--color-primary)',
                    },
                    '&.Mui-disabled': {
                      borderColor: 'rgba(255,255,255,0.1)',
                      color: 'rgba(255,255,255,0.2)',
                    }
                  }}
                >
                  {t('heatmap.exportar') || 'Exportar'}
                </Button>
              </Tooltip>
              <Menu
                anchorEl={anchorExportar}
                open={exportarAberto}
                onClose={handleFecharExportar}
                PaperProps={{
                  sx: {
                    background: 'rgba(15,15,15,0.97)',
                    border: '1px solid rgba(255,215,0,0.25)',
                    borderRadius: '12px',
                    backdropFilter: 'blur(16px)',
                    boxShadow: '0 12px 40px rgba(0,0,0,0.7)',
                    mt: 0.5,
                  }
                }}
              >
                <MenuItem
                  onClick={() => handleExportar(ExportFormat.CSV)}
                  sx={{ color: '#fff', fontFamily: 'Outfit, sans-serif', fontSize: '0.88rem', '&:hover': { background: 'rgba(255,215,0,0.08)' } }}
                >
                  📄 {t('heatmap.exportarCSV') || 'Exportar CSV'}
                </MenuItem>
                <MenuItem
                  onClick={() => handleExportar(ExportFormat.JSON)}
                  sx={{ color: '#fff', fontFamily: 'Outfit, sans-serif', fontSize: '0.88rem', '&:hover': { background: 'rgba(255,215,0,0.08)' } }}
                >
                  🗂 {t('heatmap.exportarJSON') || 'Exportar JSON'}
                </MenuItem>
              </Menu>

              {/* Tour */}
              <Tooltip title={t('heatmap.tourIniciar') || 'Ver tour'} arrow>
                <Button
                  id="btn-tour"
                  variant="text"
                  size="small"
                  onClick={() => setTourRodando(true)}
                  sx={{
                    color: 'rgba(255,255,255,0.4)',
                    minWidth: 'auto',
                    p: '6px',
                    '&:hover': { color: 'var(--color-primary)', background: 'rgba(255,215,0,0.06)' }
                  }}
                >
                  <MdTour size={18} />
                </Button>
              </Tooltip>
            </Box>
          </Box>
        </Box>

        {/* Badge de cache ativo */}
        {dadosDoCacheAtivo && (
          <Fade in>
            <Box sx={{
              display: 'inline-flex', alignItems: 'center', gap: 0.8,
              px: 1.5, py: 0.5, mb: 2,
              background: 'rgba(255,215,0,0.05)',
              border: '1px solid rgba(255,215,0,0.15)',
              borderRadius: '20px',
              fontSize: '0.75rem',
              color: 'rgba(255,255,255,0.5)',
              fontFamily: 'Outfit, sans-serif',
            }}>
              ⚡ {t('heatmap.cacheAtivo') || 'Dados em cache (< 5 min)'}
              <MdRefresh
                size={13}
                style={{ cursor: 'pointer', opacity: 0.6 }}
                onClick={() => {
                  setDadosDoCacheAtivo(false)
                  setHeatmapData(null)
                  carregarHeatmap(true)
                }}
              />
            </Box>
          </Fade>
        )}

        {/* Banner de filtro por país */}
        {paisSelecionado && (
          <Box sx={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'rgba(255, 215, 0, 0.08)', border: '1px solid rgba(255, 215, 0, 0.25)',
            borderRadius: '12px', px: 2, py: 1, mb: 3, backdropFilter: 'blur(8px)',
            animation: 'fadeIn 0.4s ease'
          }}>
            <Typography variant="body2" sx={{ color: '#fff', fontSize: '0.88rem', fontFamily: 'Outfit, sans-serif' }}>
              🔍 Filtrando carrossel de ativos mais populares em: <strong>{getCountryName(paisSelecionado)}</strong>
            </Typography>
            <Button
              size="small"
              onClick={() => { setPaisSelecionado(null); setRegionSelecionada(MapRegion.WORLD) }}
              startIcon={<MdClose />}
              sx={{
                color: 'var(--color-primary)', textTransform: 'none', fontWeight: 'bold', fontSize: '0.8rem',
                '&:hover': { background: 'rgba(255, 215, 0, 0.12)' }
              }}
            >
              Limpar Filtro
            </Button>
          </Box>
        )}

        {/* Barra de Zoom Regional */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 3, alignItems: 'center' }} data-tour="zoom" ref={refZoom}>
          <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.5)', mr: 1, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
            Zoom Geográfico:
          </Typography>
          {Object.entries(MapRegion).map(([key, value]) => {
            const isSelected = regionSelecionada === value
            const isActive = activeRegions.has(value)
            const label = { WORLD: 'Mundo', AMERICAS: 'Américas', EUROPE: 'Europa', ASIA: 'Ásia', AFRICA: 'África', OCEANIA: 'Oceania' }[key]
            return (
              <Box
                key={key}
                onClick={() => {
                  if (!isActive) return
                  setRegionSelecionada(value)
                  if (paisSelecionado) {
                    const countryRegion = getRegionForCountry(paisSelecionado)
                    if (countryRegion !== value && value !== MapRegion.WORLD) setPaisSelecionado(null)
                  }
                }}
                sx={{
                  px: 2, py: 0.6, borderRadius: '20px', fontSize: '0.78rem', fontWeight: 600,
                  cursor: isActive ? 'pointer' : 'not-allowed', fontFamily: 'Outfit, sans-serif',
                  background: isSelected ? 'var(--color-primary)' : 'rgba(255, 255, 255, 0.04)',
                  color: isSelected ? '#000' : (isActive ? 'rgba(255, 255, 255, 0.7)' : 'rgba(255, 255, 255, 0.2)'),
                  border: '1px solid', borderColor: isSelected ? 'var(--color-primary)' : (isActive ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.02)'),
                  opacity: isActive ? 1 : 0.45,
                  boxShadow: isSelected ? '0 0 12px rgba(255, 215, 0, 0.25)' : 'none',
                  transition: 'all 0.3s cubic-bezier(0.165, 0.84, 0.44, 1)',
                  '&:hover': isActive ? {
                    background: isSelected ? 'var(--color-primary)' : 'rgba(255, 255, 255, 0.08)',
                    borderColor: isSelected ? 'var(--color-primary)' : 'rgba(255, 215, 0, 0.3)',
                    color: isSelected ? '#000' : '#fff'
                  } : {}
                }}
              >
                {label}
              </Box>
            )
          })}
        </Box>

        {/* Conteúdo principal */}
        {loading ? (
          // Skeletons para melhor UX durante carregamento
          <Grid container spacing={4}>
            <Grid size={{ xs: 12, md: 8 }}>
              <Skeleton variant="rounded" width="100%" height={450} sx={{ bgcolor: 'rgba(255,255,255,0.04)', borderRadius: '16px' }} />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Skeleton variant="text" width="60%" height={32} sx={{ bgcolor: 'rgba(255,255,255,0.04)' }} />
                <Skeleton variant="text" width="90%" height={20} sx={{ bgcolor: 'rgba(255,255,255,0.04)' }} />
                {[...Array(5)].map((_, i) => (
                  <Box key={i} sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
                    <Skeleton variant="text" width="80%" height={22} sx={{ bgcolor: 'rgba(255,255,255,0.04)' }} />
                    <Skeleton variant="rounded" width="100%" height={6} sx={{ bgcolor: 'rgba(255,255,255,0.04)', borderRadius: '3px' }} />
                  </Box>
                ))}
              </Box>
            </Grid>
          </Grid>
        ) : heatmapData ? (
          <Fade in={!loading} timeout={500}>
            <Grid container spacing={4}>
              {/* Mapa Coroplético */}
              <Grid size={{ xs: 12, md: 8 }}>
                <Box sx={{
                  height: { xs: 'auto', md: '100%' }, display: 'flex', flexDirection: 'column',
                  borderRadius: '16px', overflow: 'hidden',
                  background: 'rgba(10, 10, 10, 0.45)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  boxShadow: '0 12px 40px rgba(0,0,0,0.6)', p: 2, backdropFilter: 'blur(8px)',
                  position: 'relative', transition: 'all 0.4s cubic-bezier(0.165, 0.84, 0.44, 1)',
                  '&:hover': { transform: 'translateY(-4px)', borderColor: 'var(--color-primary)', boxShadow: '0 18px 48px rgba(0,0,0,0.7), 0 0 20px rgba(255, 215, 0, 0.08)' }
                }}>
                  <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: chartHeight }}>
                    <NativeGeoChart
                      data={heatmapData}
                      options={optionsFinal}
                      onSelect={handleChartSelect}
                    />
                  </Box>
                </Box>
              </Grid>

              {/* Painel de Inteligência */}
              <Grid size={{ xs: 12, md: 4 }}>
                <Box
                  data-tour="inteligencia"
                  ref={refInteligencia}
                  sx={{
                    display: 'flex', flexDirection: 'column', gap: 2,
                    height: { xs: 'auto', md: '100%' },
                    background: 'rgba(12, 12, 12, 0.65)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: '16px', p: 3,
                    boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
                    backdropFilter: 'blur(12px)',
                    transition: 'all 0.4s cubic-bezier(0.165, 0.84, 0.44, 1)',
                    '&:hover': { transform: 'translateY(-4px)', borderColor: 'var(--color-primary)', boxShadow: '0 18px 48px rgba(0,0,0,0.7), 0 0 20px rgba(255, 215, 0, 0.08)' }
                  }}
                >
                  <Typography variant="h6" sx={{ color: 'var(--color-primary)', fontWeight: 800, fontFamily: 'Outfit, sans-serif', fontSize: '1.05rem', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                    Central de Inteligência
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.6, fontSize: '0.85rem', lineHeight: 1.4 }}>
                    Nível de aceleração e dominância de busca de narrativas por região geográfica para a moeda selecionada ({moedaSelecionada}).
                  </Typography>

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 2 }}>
                    {topRegioes.length > 0 ? (
                      topRegioes.map((reg, idx) => (
                        <Box
                          key={reg.country}
                          onClick={() => handleCountryClick(reg.country)}
                          sx={{
                            display: 'flex', flexDirection: 'column', gap: 0.8, cursor: 'pointer',
                            p: 1.2, borderRadius: '8px',
                            transition: 'all 0.2s cubic-bezier(0.165, 0.84, 0.44, 1)',
                            background: paisSelecionado === reg.country ? 'rgba(255, 215, 0, 0.04)' : 'transparent',
                            border: '1px solid',
                            borderLeft: paisSelecionado === reg.country ? '4px solid var(--color-primary)' : '1px solid transparent',
                            borderColor: paisSelecionado === reg.country ? 'rgba(255, 215, 0, 0.25)' : 'transparent',
                            '&:hover': { background: 'rgba(255, 255, 255, 0.03)' }
                          }}
                        >
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                              <Box sx={{
                                width: '26px', height: '26px', borderRadius: '50%',
                                background: paisSelecionado === reg.country ? 'var(--color-primary)' : 'rgba(255, 215, 0, 0.08)',
                                border: '1px solid rgba(255, 215, 0, 0.25)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.75rem', fontWeight: 800,
                                color: paisSelecionado === reg.country ? '#000' : 'var(--color-primary)',
                                fontFamily: 'Outfit, sans-serif'
                              }}>
                                {idx + 1}
                              </Box>
                              <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#fff', fontSize: '0.88rem', fontFamily: 'Outfit, sans-serif' }}>
                                {getCountryName(reg.country)}
                              </Typography>
                            </Box>
                            <Typography variant="body2" sx={{ fontWeight: 700, color: 'var(--color-primary)', fontSize: '0.88rem', fontFamily: 'Share Tech Mono, monospace' }}>
                              {reg.displayVal}%
                            </Typography>
                          </Box>
                          <LinearProgress
                            variant="determinate"
                            value={reg.displayVal}
                            sx={{
                              height: '5px', borderRadius: '3px',
                              background: 'rgba(255,255,255,0.03)',
                              '& .MuiLinearProgress-bar': {
                                background: 'linear-gradient(90deg, #cca92c 0%, #ffd700 100%)',
                                borderRadius: '3px',
                                boxShadow: '0 0 6px rgba(255, 215, 0, 0.35)'
                              }
                            }}
                          />
                        </Box>
                      ))
                    ) : (
                      <Box sx={{ p: 4, textAlign: 'center', opacity: 0.4 }}>
                        <Typography variant="body2" sx={{ fontStyle: 'italic' }}>Aguardando dados geográficos...</Typography>
                      </Box>
                    )}
                  </Box>
                </Box>
              </Grid>
            </Grid>
          </Fade>
        ) : (
          <Box sx={{ p: 6, textAlign: 'center', opacity: 0.5, background: 'rgba(10, 10, 10, 0.3)', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <MdAnalytics size={48} style={{ color: 'var(--color-primary)', marginBottom: '12px' }} />
            <Typography sx={{ fontFamily: 'Outfit, sans-serif' }}>Dados de mapa não disponíveis para o ativo selecionado no período.</Typography>
          </Box>
        )}
      </section>
    </div>
  )
}
