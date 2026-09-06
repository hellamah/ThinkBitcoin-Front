import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useNavigate, useLocation, useNavigationType } from 'react-router-dom'
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
import { useTheme } from '@mui/material/styles'
import { Joyride, STATUS } from 'react-joyride'
import { readToken } from '../utils/themeTokens'
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
import HeatmapInsights from '../components/heatmap/HeatmapInsights'
import ErrorMessage from '../components/ErrorMessage'
import CoinCarousel from '../components/dashboard/CoinCarousel'
import AlertaPrecoModal from '../components/dashboard/AlertaPrecoModal'
import { useAuth } from '../context/AuthContext'
import { useDashboard } from '../context/DashboardContext'
import useTranslation from '../hooks/useTranslation'
import useCoinPrices from '../hooks/useCoinPrices'
import useAlertasPreco from '../hooks/useAlertasPreco'
import { apiRequest, VariavelExternaEndpoint } from '../utils/apiClient'
import { MapRegion, ExportFormat, MapMetric } from '../utils/enums'
import { formatTooltipData, getRegionForCountry, filterCoinsByCountry, getCountryName } from '../utils/mapUtils'
import { hasCacheValid } from '../utils/cache'
import { idiomaDe } from '../lang'
import { getTourHeatmapVisto, setTourHeatmapVisto } from '../utils/preferences'
import { contarAtivos } from '../utils/alertaPreco'
import { exportarHeatmapDados } from '../utils/exportUtils'

// Componente de Gráfico Nativo à prova de loops no React 19
const NativeGeoChart = ({ data, options, onSelect, onChartReady, language }) => {
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
      // O locale vem de fora, do registro de idiomas — estava cravado em
      // 'pt-BR'. A biblioteca só carrega uma vez por página, então quem troca
      // de idioma sem recarregar mantém o locale da carga inicial: é limitação
      // do loader do Google, não da preferência.
      window.google.charts.load('current', {
        packages: ['geochart'],
        language
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
      if (onChartReady) onChartReady(chart)

      const handleResize = () => {
        chart.draw(dataTable, options)
      }
      window.addEventListener('resize', handleResize)

      return () => {
        window.removeEventListener('resize', handleResize)
        if (onChartReady) onChartReady(null)
        chart.clearChart()
      }
    } catch (err) {
      console.error('[NativeGeoChart] Erro ao desenhar gráfico:', err)
    }
  }, [loaded, data, options, onSelect, onChartReady])

  return (
    <div 
      ref={containerRef} 
      style={{ width: '100%', height: '100%', minHeight: options.height || '400px' }} 
    />
  )
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------
export default function GeoHeatmapView() {
  const { palette } = useTheme()
  const { token, user: usuario, prefs } = useAuth()
  const { refreshTrigger, moedaSelecionada, setMoedaSelecionada } = useDashboard()
  const { t } = useTranslation()
  const { moedas: moedasCarousel, erro: erroMoedas, setErro: setErroMoedas } = useCoinPrices()

  const {
    alertas,
    carregando: carregandoAlertas,
    temAcesso: temAcessoAlertas,
    criar: criarAlerta,
    excluir: excluirAlerta,
  } = useAlertasPreco(usuario)
  const [modalAlertasAberto, setModalAlertasAberto] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const navigationType = useNavigationType()

  // ------ estados de dados ------
  // Registros crus da API; a matriz do Google Charts é derivada por useMemo,
  // o que permite alternar a métrica do mapa sem novo fetch.
  const [heatmapRaw, setHeatmapRaw] = useState(null)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [dadosDoCacheAtivo, setDadosDoCacheAtivo] = useState(false)

  // ------ estados de UI ------
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200)
  const [paisSelecionado, setPaisSelecionado] = useState(() => {
    if (typeof window === 'undefined') return null
    const qPais = new URLSearchParams(window.location.search).get('pais')
    return qPais ? qPais.toUpperCase() : null
  })
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
  const [metricaMapa, setMetricaMapa] = useState(() => {
    if (typeof window === 'undefined') return MapMetric.LIDERANCA
    const params = new URLSearchParams(window.location.search)
    const qMetrica = params.get('metrica')
    return Object.values(MapMetric).includes(qMetrica) ? qMetrica : MapMetric.LIDERANCA
  })
  // Instância viva do GeoChart, usada para exportar o mapa como PNG.
  const chartInstanceRef = useRef(null)
  const handleChartReady = useCallback((chart) => { chartInstanceRef.current = chart }, [])

  // Nomes de países no idioma preferido do usuário (Intl.DisplayNames).
  // O locale vem do registro: enquanto era um ternário entre 'en' e 'pt', todo
  // idioma acrescentado depois caía calado em português neste ponto.
  const localeIdioma = idiomaDe(prefs?.idioma).intl
  const nomePais = useCallback((code) => getCountryName(code, localeIdioma), [localeIdioma])

  // ------ estados de notificação ------
  const [snackbarAberto, setSnackbarAberto] = useState(false)
  const [snackbarMensagem, setSnackbarMensagem] = useState('')
  const [snackbarSeveridade, setSnackbarSeveridade] = useState('success')

  // ------ estados de exportação ------
  const [anchorExportar, setAnchorExportar] = useState(null)
  const exportarAberto = Boolean(anchorExportar)

  // ------ tour onboarding ------
  const [tourRodando, setTourRodando] = useState(false)
  const refIntervalos = useRef(null)
  const refAcoesTopo = useRef(null)
  const refZoom = useRef(null)
  const refInteligencia = useRef(null)

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

    if (qMoeda) {
      const match = moedasCarousel.find(m =>
        String(m.simbolo).toUpperCase() === String(qMoeda).toUpperCase()
      )
      if (match && match.simbolo !== moedaSelecionada) {
        setMoedaSelecionada(match.simbolo)
      }
    }
    if (qIntervalo && ['1h', '24h', '1m'].includes(qIntervalo) && qIntervalo !== intervaloMapa) {
      setIntervaloMapa(qIntervalo)
    }
    if (qRegiao && Object.values(MapRegion).includes(qRegiao) && qRegiao !== regionSelecionada) {
      setRegionSelecionada(qRegiao)
    }

    // Leitura única: uma vez com o carrossel carregado, este efeito nunca mais
    // roda. Sem isso, uma URL inicial sem `moeda` deixava o efeito armado e ele
    // revertia a primeira troca de moeda feita pelo usuário (tela "piscando").
    queryLidaRef.current = true
  }, [moedasCarousel, location.search, moedaSelecionada, intervaloMapa, regionSelecionada, setMoedaSelecionada])

  // ---------------------------------------------------------------------------
  // Sincroniza a URL -> Estado apenas quando o usuário navegar no histórico
  // (Voltar/Avançar). O gate por navigationType === 'POP' + dependência apenas
  // em location.key é essencial: sem ele, este efeito rodava a cada mudança de
  // estado e revertia a seleção feita no carrossel enquanto o efeito de
  // Estado -> URL empurrava na direção contrária (tela alternando em loop).
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (navigationType !== 'POP') return

    const params = new URLSearchParams(location.search)
    const qMoeda = params.get('moeda')
    if (qMoeda) {
      const match = moedasCarousel?.find(m =>
        String(m.simbolo).toUpperCase() === String(qMoeda).toUpperCase()
      )
      if (match) setMoedaSelecionada(match.simbolo)
    }
    const qIntervalo = params.get('intervalo')
    if (qIntervalo && ['1h', '24h', '1m'].includes(qIntervalo)) setIntervaloMapa(qIntervalo)
    const qRegiao = params.get('regiao')
    if (qRegiao && Object.values(MapRegion).includes(qRegiao)) setRegionSelecionada(qRegiao)
    const qPais = params.get('pais')
    setPaisSelecionado(qPais ? qPais.toUpperCase() : null)
    const qMetrica = params.get('metrica')
    setMetricaMapa(Object.values(MapMetric).includes(qMetrica) ? qMetrica : MapMetric.LIDERANCA)
    // Roda uma única vez por navegação (location.key); os valores atuais de
    // estado não entram nas dependências de propósito — setState idêntico faz
    // bail-out no React, e reagir a estado aqui recriaria o loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigationType, location.key, moedasCarousel])

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
    const qPais = params.get('pais')
    const qMetrica = params.get('metrica')

    if (
      qMoeda !== moedaSelecionada ||
      qIntervalo !== intervaloMapa ||
      qRegiao !== regionSelecionada ||
      (qPais || null) !== paisSelecionado ||
      (qMetrica || MapMetric.LIDERANCA) !== metricaMapa
    ) {
      const newParams = new URLSearchParams()
      newParams.set('moeda', moedaSelecionada)
      newParams.set('intervalo', intervaloMapa)
      newParams.set('regiao', regionSelecionada)
      if (paisSelecionado) newParams.set('pais', paisSelecionado)
      if (metricaMapa !== MapMetric.LIDERANCA) newParams.set('metrica', metricaMapa)
      navigate(`?${newParams.toString()}`, { replace: true })
    }
  }, [moedaSelecionada, intervaloMapa, regionSelecionada, paisSelecionado, metricaMapa, navigate, location.pathname, location.search])

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

  // Matriz do Google Charts derivada dos registros crus + métrica selecionada.
  // Alternar Liderança × Intensidade redesenha o mapa sem novo fetch.
  const heatmapData = useMemo(() => {
    if (!heatmapRaw?.length) return null

    const valorItem = (item) => {
      const lider = Number(item.frequenciaLideranca ?? item.FrequenciaLideranca ?? 0)
      const intens = Number(item.mediaIntensidade ?? item.MediaIntensidade ?? 0)
      return metricaMapa === MapMetric.INTENSIDADE ? (intens || lider) : (lider || intens)
    }

    // Participações relativas do top 5
    const top5List = heatmapRaw.map(item => ({
      countryCode: String(item.geoTop1Code || item.GeoTop1Code).toUpperCase(),
      val: valorItem(item),
    })).sort((a, b) => b.val - a.val).slice(0, 5)

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

    // Variação de preço do ativo selecionado (dado real do carrossel) — a API
    // do heatmap não traz variação/volume por país.
    const moedaAtual = moedasCarousel?.find(m => m.simbolo === moedaSelecionada)
    const variacaoMoeda = typeof moedaAtual?.variacao === 'number' ? moedaAtual.variacao : null

    const tooltipLabels = {
      participacao: t('heatmap.participacaoTop5'),
      lideranca: t('heatmap.liderancaBuscas'),
      intensidade: t('heatmap.intensidadeMedia'),
      variacao: t('heatmap.variacao'),
    }

    const chartData = [
      [
        'Country',
        metricaMapa === MapMetric.INTENSIDADE
          ? (t('heatmap.metricaIntensidade') || 'Intensidade média')
          : (t('heatmap.metricaLideranca') || 'Liderança de buscas'),
        { role: 'tooltip', type: 'string', p: { html: true } }
      ]
    ]

    heatmapRaw.forEach(item => {
      const countryCode = String(item.geoTop1Code || item.GeoTop1Code).toUpperCase()
      const extras = {
        variacao24h: variacaoMoeda,
        lideranca: item.frequenciaLideranca ?? item.FrequenciaLideranca ?? null,
        intensidade: item.mediaIntensidade ?? item.MediaIntensidade ?? null,
      }
      const tooltipHtml = formatTooltipData(
        nomePais(countryCode),
        moedaSelecionada,
        sharesMap[countryCode] || 0,
        extras,
        tooltipLabels
      )
      chartData.push([{ v: countryCode, f: '' }, valorItem(item), tooltipHtml])
    })

    return chartData.length > 1 ? chartData : null
  }, [heatmapRaw, metricaMapa, moedasCarousel, moedaSelecionada, nomePais, t])

  const heatmapDataRef = useRef(heatmapData)
  useEffect(() => {
    heatmapDataRef.current = heatmapData
  }, [heatmapData])

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
  const moedaSelObj = useMemo(() =>
    moedasCarousel?.find(m => m.simbolo === moedaSelecionada) || null,
    [moedasCarousel, moedaSelecionada])

  const moedaId = moedaSelObj?.id || null

  // `silencioso` recarrega sem exibir skeleton — usado pelo auto-refresh
  // quando o cache expira com a aba aberta.
  const carregarHeatmap = useCallback(async (forceRefresh = false, silencioso = false) => {
    if (!token || !moedaSelecionada) return
    if (!moedaId && (!moedasCarousel || moedasCarousel.length === 0)) return // Aguarda o carrossel carregar

    const chaveCache = `heatmap_${moedaSelecionada}_${intervaloMapa}`

    // Sinaliza se o dado será carregado do cache (caso exista)
    const temNoCache = !forceRefresh && hasCacheValid(chaveCache)
    setDadosDoCacheAtivo(temNoCache)

    if (!silencioso) setLoading(true)
    setErro('')
    try {
      // O backend real não conhece `intervalo`: o recorte temporal é feito por
      // dataInicio/dataFim. O `intervalo` continua na URL apenas para o mock.
      const horasPorIntervalo = { '1h': 1, '24h': 24, '1m': 24 * 30 }
      const agora = new Date()
      const inicio = new Date(agora.getTime() - (horasPorIntervalo[intervaloMapa] || 24) * 60 * 60 * 1000)

      const params = new URLSearchParams()
      if (moedaId) params.set('idMoeda', moedaId)
      params.set('dataInicio', inicio.toISOString())
      params.set('dataFim', agora.toISOString())
      params.set('intervalo', intervaloMapa)
      const url = `${VariavelExternaEndpoint.TREND_HEATMAP}?${params.toString()}`
      const response = await apiRequest(url, {
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

      setHeatmapRaw(rawData?.length > 0 ? rawData : null)
    } catch (err) {
      console.error('Erro ao carregar Heatmap', err)
      setErro(t('heatmap.erroCarregar') || 'Não foi possível carregar os dados geográficos no momento.')
    } finally {
      setLoading(false)
    }
  }, [token, moedaSelecionada, moedaId, moedasCarousel?.length, intervaloMapa, t])

  useEffect(() => { carregarHeatmap() }, [carregarHeatmap, refreshTrigger])

  // Auto-refresh: quando o cache de 5 min expira com a aba visível, recarrega
  // silenciosamente (sem skeleton) para manter o mapa vivo.
  useEffect(() => {
    const id = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return
      if (!moedaSelecionada) return
      const chave = `heatmap_${moedaSelecionada}_${intervaloMapa}`
      if (!hasCacheValid(chave)) {
        setDadosDoCacheAtivo(false)
        carregarHeatmap(false, true)
      }
    }, 60_000)
    return () => clearInterval(id)
  }, [moedaSelecionada, intervaloMapa, carregarHeatmap])

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
      .catch(() => mostrarSnackbar(t('heatmap.erroCopiarLink') || 'Não foi possível copiar o link', 'error'))
  }

  const handleAbrirExportar = (event) => setAnchorExportar(event.currentTarget)
  const handleFecharExportar = () => setAnchorExportar(null)

  const handleExportar = (formato) => {
    handleFecharExportar()

    // PNG: usa a imagem rasterizada da instância viva do GeoChart.
    if (formato === ExportFormat.PNG) {
      const uri = chartInstanceRef.current?.getImageURI?.()
      if (!uri) {
        mostrarSnackbar(t('heatmap.exportarPNGErro') || 'Não foi possível gerar a imagem do mapa.', 'error')
        return
      }
      const link = document.createElement('a')
      link.href = uri
      link.download = `heatmap_${moedaSelecionada}_${intervaloMapa}.png`
      link.click()
      mostrarSnackbar(`PNG — ${t('heatmap.exportacaoConcluida') || 'exportação concluída!'}`)
      return
    }

    // `nomePais` vai junto para o arquivo sair com o nome do país no idioma da
    // tela; sem ele a coluna "País" carregava o código ISO cru.
    exportarHeatmapDados(heatmapData, moedaSelecionada, intervaloMapa, formato, nomePais)
    mostrarSnackbar(`${formato.toUpperCase()} — ${t('heatmap.exportacaoConcluida') || 'exportação concluída!'}`)
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

  // NAO REMOVER SEM DECIDIR: o lint acusa `chartEvents` como nao usado, e esta
  // certo — nada o consome. Mas ele carrega o handler de `select` do Google
  // Charts, ou seja, clicar num pais no mapa nunca foi ligado. Apagar faria o
  // lint passar e apagaria a unica pista de que a feature ficou pela metade.
  // Ligar ou remover de vez e decisao de produto, nao de faxina.
  // Excecao deliberada, e a unica do repositorio: a nota acima explica por que
  // isto fica. Sem o disable, um achado que decidimos PRESERVAR travaria o gate
  // de lint no CI — e a saida seria apagar a pista, que e o oposto do que a nota
  // pede. Quando a decisao for tomada, o disable sai junto.
  // eslint-disable-next-line no-unused-vars
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

  // O GeoChart pinta atributos SVG via JS: precisa de cor resolvida, var() não
  // funciona aqui. Os tons de "sem dado" e a rampa da escala também invertem —
  // no claro, o cinza-chumbo original virava uma mancha preta sobre o mapa.
  const chartOptions = useMemo(() => {
    const claro = palette.mode === 'light'
    return {
      backgroundColor: 'transparent',
      datalessRegionColor: claro ? '#e4e6ea' : '#1a1a1a',
      defaultColor: claro ? '#d8dbe0' : '#252525',
      colorAxis: {
        colors: claro
          ? ['#f2e6c2', '#c9a227', '#6f5400']
          : ['#282208', '#cca92c', '#ffd700'],
      },
      legend: { textStyle: { color: readToken('--text-secondary'), fontSize: 12, fontName: 'Outfit' } },
      keepAspectRatio: true,
      region: regionSelecionada,
      tooltip: { isHtml: true, trigger: 'focus' },
    }
  }, [regionSelecionada, palette.mode])

  const optionsFinal = useMemo(() => ({
    ...chartOptions,
    height: chartHeight
  }), [chartOptions, chartHeight])

  // ---------------------------------------------------------------------------
  // Tour Onboarding (react-joyride)
  // ---------------------------------------------------------------------------
  // Nota: react-joyride v3 — `skipBeacon`, `showProgress`, cores e ações dos
  // botões são configurados via prop `options` (não existem `showSkipButton`,
  // `showProgress` nem `styles.options` de nível superior como na v2), e o
  // handler de eventos é `onEvent` (não `callback`).
  const passosTour = useMemo(() => [
    {
      target: '[data-tour="carrossel"]',
      title: t('heatmap.tourPasso1Titulo') || 'Carrossel de Ativos',
      content: t('heatmap.tourPasso1Descricao') || 'Selecione o ativo que deseja visualizar.',
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
  ], [t])

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

  if (!token) return <Box sx={{ p: 5 }}>{t('redirectingToLogin')}</Box>

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
        /* Superfície e texto por token. Cravados em rgba(15,15,15,0.97) e #fff
           o balão do tour ficava escuro nos dois temas, enquanto title/content
           abaixo vêm de --accent-ink e --text-secondary: no modo claro isso era
           texto quase preto sobre fundo quase preto, e o tour inteiro sumia. */
        .react-joyride__tooltip {
          background: var(--surface-overlay) !important;
          border: 1px solid var(--accent-a30) !important;
          border-radius: 16px !important;
          color: var(--text-secondary) !important;
          font-family: 'Outfit', sans-serif !important;
          box-shadow: 0 20px 60px var(--scrim-strong) !important;
        }
        .react-joyride__tooltip button { font-family: 'Outfit', sans-serif !important; }
      `}} />

      {/* Tour Onboarding — montado apenas enquanto roda para não deixar
          o portal/beacon residual da react-joyride no DOM. */}
      {tourRodando && (
      <Joyride
        steps={passosTour}
        run={tourRodando}
        continuous
        onEvent={handleTourCallback}
        locale={{
          back: 'Voltar',
          close: t('heatmap.tourFechar') || 'Entendi!',
          last: t('heatmap.tourFechar') || 'Entendi!',
          next: 'Próximo',
          nextWithProgress: 'Próximo ({current} de {total})',
          skip: 'Pular',
        }}
        options={{
          // Sem beacon: o tooltip abre direto em cada passo.
          skipBeacon: true,
          buttons: ['back', 'close', 'skip', 'primary'],
          showProgress: true,
          // O ✕ dispensa o tour inteiro (status "skipped" marca como visto);
          // o default 'close' da v3 avançaria para o próximo passo.
          closeButtonAction: 'skip',
          // Clique no overlay e tecla ESC não avançam por acidente.
          overlayClickAction: false,
          dismissKeyAction: false,
          // `primaryColor` sai de readToken, e não como `var(--accent)`: a
          // react-joyride passa este valor por hexToRGB para montar o fundo do
          // beacon, e hex é o único formato que aquele parser entende — com
          // `var()` ele devolve lista vazia e produz um `rgba(, 0.2)` que o
          // navegador descarta. Os demais viram estilo inline direto, onde
          // `var()` resolve sozinho e ainda acompanha a troca de tema sem
          // depender de re-render.
          primaryColor: readToken('--accent'),
          // Também por token: o fundo já vinha de --surface-overlay, mas texto
          // e seta estavam cravados no escuro. No tema claro davam branco sobre
          // branco e uma seta preta apontando para um balão branco.
          textColor: 'var(--text-secondary)',
          backgroundColor: 'var(--surface-overlay)',
          arrowColor: 'var(--surface-overlay)',
          zIndex: 9999,
        }}
        styles={{
          tooltipTitle: { color: 'var(--accent-ink)', fontWeight: 800, fontSize: '1rem' },
          tooltipContent: { color: 'var(--text-secondary)', fontSize: '0.88rem' },
          buttonPrimary: { backgroundColor: 'var(--accent)', color: 'var(--text-on-accent)', fontWeight: 700, borderRadius: '8px' },
          buttonBack: { color: 'var(--text-muted)' },
          buttonSkip: { color: 'var(--text-faint)', fontSize: '0.78rem' },
        }}
      />
      )}

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
            border: '1px solid var(--accent-a30)',
            color: 'var(--text-primary)',
          }}
        >
          {snackbarMensagem}
        </Alert>
      </Snackbar>

      <DashboardHeader
        t={t}
        prefs={prefs}
        usuario={usuario}
        title={t('nav.heatmap') || 'Geopolítica'}
        onAbrirAlertas={() => setModalAlertasAberto(true)}
        alertasAtivos={contarAtivos(alertas)}
        alertasBloqueados={!temAcessoAlertas}
      />

      <AlertaPrecoModal
        visible={modalAlertasAberto}
        onClose={() => setModalAlertasAberto(false)}
        moedas={moedasCarousel}
        moedaInicial={moedaSelecionada}
        alertas={alertas}
        carregando={carregandoAlertas}
        onCriar={criarAlerta}
        onExcluir={excluirAlerta}
        notificacoesLigadas={!!prefs?.notificacoes}
      />
      <ErrorMessage message={erro} onClose={() => setErro('')} />
      <ErrorMessage message={erroMoedas} onClose={() => setErroMoedas('')} />

      {/* Carrossel de Ativos */}
      <div data-tour="carrossel">
        <CoinCarousel
          moedasCarousel={moedasExibidas}
          moedasFiltro={moedasFiltro}
          selecionarMoeda={selecionarMoeda}
          t={t}
          isMobile={false}
          isHeatmap={true}
        />
      </div>

      <section className="panel" style={{ marginTop: '20px', minHeight: '550px', backdropFilter: 'blur(16px)', backgroundColor: 'var(--surface-panel)' }}>

        {/* Cabeçalho do painel */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, flexDirection: { xs: 'column', sm: 'row' }, gap: 2, mb: 4 }}>
          <Box>
            <Typography variant="h4" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1.5, fontFamily: 'Outfit, sans-serif', fontWeight: 800, color: 'var(--accent-ink)' }}>
              <MdPublic /> {t('globalHotspot') || 'Geopolítica de Mercado'}
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.7, fontSize: '0.95rem' }}>
              {t('heatmap.descricao') || 'Mapeamento global do interesse de busca pelo ativo, destacando as regiões que atualmente lideram a narrativa de mercado.'}
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
                    setHeatmapRaw(null)
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Seletor de métrica do mapa: liderança × intensidade (sem refetch) */}
            <div className="interval-selector-mini" data-tour="metrica">
              {[
                { label: t('heatmap.metricaLiderancaCurta') || 'Liderança', value: MapMetric.LIDERANCA, hint: t('heatmap.metricaLideranca') || 'Nº de vezes que o país liderou as buscas' },
                { label: t('heatmap.metricaIntensidadeCurta') || 'Intensidade', value: MapMetric.INTENSIDADE, hint: t('heatmap.metricaIntensidade') || 'Intensidade média de busca (0-100)' },
              ].map((opt) => (
                <Tooltip key={opt.value} title={opt.hint} arrow>
                  <button
                    className={`interval-btn-mini ${metricaMapa === opt.value ? 'active' : ''}`}
                    onClick={() => setMetricaMapa(opt.value)}
                  >
                    {opt.label}
                  </button>
                </Tooltip>
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
                    color: 'var(--accent-ink)',
                    borderColor: 'var(--accent-a30)',
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
                    color: 'var(--accent-ink)',
                    borderColor: 'var(--accent-a30)',
                    textTransform: 'none',
                    fontFamily: 'Outfit, sans-serif',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    '&:hover': {
                      background: 'rgba(255,215,0,0.06)',
                      borderColor: 'var(--color-primary)',
                    },
                    '&.Mui-disabled': {
                      borderColor: 'var(--border-strong)',
                      color: 'var(--text-faint)',
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
                    backgroundColor: 'var(--surface-overlay)',
                    border: '1px solid var(--accent-a30)',
                    borderRadius: '12px',
                    backdropFilter: 'blur(16px)',
                    boxShadow: '0 12px 40px var(--scrim-strong)',
                    mt: 0.5,
                  }
                }}
              >
                <MenuItem
                  onClick={() => handleExportar(ExportFormat.CSV)}
                  sx={{ color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif', fontSize: '0.88rem', '&:hover': { backgroundColor: 'var(--accent-a08)' } }}
                >
                  📄 {t('heatmap.exportarCSV') || 'Exportar CSV'}
                </MenuItem>
                <MenuItem
                  onClick={() => handleExportar(ExportFormat.JSON)}
                  sx={{ color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif', fontSize: '0.88rem', '&:hover': { backgroundColor: 'var(--accent-a08)' } }}
                >
                  🗂 {t('heatmap.exportarJSON') || 'Exportar JSON'}
                </MenuItem>
                <MenuItem
                  onClick={() => handleExportar(ExportFormat.PNG)}
                  sx={{ color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif', fontSize: '0.88rem', '&:hover': { backgroundColor: 'var(--accent-a08)' } }}
                >
                  🖼 {t('heatmap.exportarPNG') || 'Exportar PNG'}
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
                    color: 'var(--text-faint)',
                    minWidth: 'auto',
                    p: '6px',
                    '&:hover': { color: 'var(--accent-ink)', background: 'rgba(255,215,0,0.06)' }
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
              backgroundColor: 'var(--accent-a05)',
              border: '1px solid var(--accent-a15)',
              borderRadius: '20px',
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              fontFamily: 'Outfit, sans-serif',
            }}>
              ⚡ {t('heatmap.cacheAtivo') || 'Dados em cache (< 5 min)'}
              {/* O onClick estava no <svg> do ícone: o único jeito de forçar
                  a releitura era clicar num desenho, que nem o teclado alcança
                  nem o leitor de tela anuncia. */}
              <button
                type="button"
                className="botao-nu"
                aria-label={t('heatmap.forcarAtualizacao')}
                title={t('heatmap.forcarAtualizacao')}
                style={{ display: 'inline-flex', opacity: 0.6 }}
                onClick={() => {
                  setDadosDoCacheAtivo(false)
                  setHeatmapRaw(null)
                  carregarHeatmap(true)
                }}
              >
                <MdRefresh size={13} />
              </button>
            </Box>
          </Fade>
        )}

        {/* Banner de filtro por país */}
        {paisSelecionado && (
          <Box sx={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            backgroundColor: 'var(--accent-a08)', border: '1px solid var(--accent-a30)',
            borderRadius: '12px', px: 2, py: 1, mb: 3, backdropFilter: 'blur(8px)',
            animation: 'fadeIn 0.4s ease'
          }}>
            <Typography variant="body2" sx={{ color: 'var(--text-primary)', fontSize: '0.88rem', fontFamily: 'Outfit, sans-serif' }}>
              🔍 {t('heatmap.filtrandoPor') || 'Exibindo ativos cuja busca é liderada por:'} <strong>{nomePais(paisSelecionado)}</strong>
            </Typography>
            <Button
              size="small"
              onClick={() => { setPaisSelecionado(null); setRegionSelecionada(MapRegion.WORLD) }}
              startIcon={<MdClose />}
              sx={{
                color: 'var(--accent-ink)', textTransform: 'none', fontWeight: 'bold', fontSize: '0.8rem',
                '&:hover': { background: 'rgba(255, 215, 0, 0.12)' }
              }}
            >
              {t('heatmap.limparFiltro') || 'Limpar Filtro'}
            </Button>
          </Box>
        )}

        {/* Barra de Zoom Regional */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 3, alignItems: 'center' }} data-tour="zoom" ref={refZoom}>
          <Typography variant="caption" sx={{ color: 'var(--text-muted)', mr: 1, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
            {t('heatmap.zoomGeografico') || 'Zoom Geográfico:'}
          </Typography>
          {Object.entries(MapRegion).map(([key, value]) => {
            const isSelected = regionSelecionada === value
            const isActive = activeRegions.has(value)
            const label = {
              WORLD: t('heatmap.regiaoMundo') || 'Mundo',
              AMERICAS: t('heatmap.regiaoAmericas') || 'Américas',
              EUROPE: t('heatmap.regiaoEuropa') || 'Europa',
              ASIA: t('heatmap.regiaoAsia') || 'Ásia',
              AFRICA: t('heatmap.regiaoAfrica') || 'África',
              OCEANIA: t('heatmap.regiaoOceania') || 'Oceania',
            }[key]
            return (
              // Filtro de região do mapa: um dos controles principais da tela, e
              // era um <Box> com onClick. `disabled` substitui a guarda de
              // `if (!isActive) return`, que deixava a pílula clicável e inerte
              // — o navegador agora avisa antes do clique, em vez de engolir.
              <Box
                key={key}
                component="button"
                type="button"
                className="botao-nu"
                disabled={!isActive}
                aria-pressed={isSelected}
                onClick={() => {
                  setRegionSelecionada(value)
                  if (paisSelecionado) {
                    const countryRegion = getRegionForCountry(paisSelecionado)
                    if (countryRegion !== value && value !== MapRegion.WORLD) setPaisSelecionado(null)
                  }
                }}
                sx={{
                  px: 2, py: 0.6, borderRadius: '20px', fontSize: '0.78rem', fontWeight: 600,
                  cursor: isActive ? 'pointer' : 'not-allowed', fontFamily: 'Outfit, sans-serif',
                  background: isSelected ? 'var(--color-primary)' : 'var(--surface-fill)',
                  color: isSelected ? 'var(--text-on-accent)' : (isActive ? 'var(--text-secondary)' : 'var(--text-faint)'),
                  border: '1px solid', borderColor: isSelected ? 'var(--color-primary)' : (isActive ? 'var(--surface-fill-strong)' : 'var(--border-subtle)'),
                  opacity: isActive ? 1 : 0.45,
                  boxShadow: isSelected ? '0 0 12px var(--accent-a30)' : 'none',
                  transition: 'all 0.3s cubic-bezier(0.165, 0.84, 0.44, 1)',
                  '&:hover': isActive ? {
                    background: isSelected ? 'var(--color-primary)' : 'var(--surface-fill-strong)',
                    borderColor: isSelected ? 'var(--color-primary)' : 'var(--accent-a30)',
                    color: isSelected ? 'var(--text-on-accent)' : 'var(--text-primary)'
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
              <Skeleton variant="rounded" width="100%" height={450} sx={{ backgroundColor: 'var(--surface-hover)', borderRadius: '16px' }} />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Skeleton variant="text" width="60%" height={32} sx={{ backgroundColor: 'var(--surface-hover)' }} />
                <Skeleton variant="text" width="90%" height={20} sx={{ backgroundColor: 'var(--surface-hover)' }} />
                {[...Array(5)].map((_, i) => (
                  <Box key={i} sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
                    <Skeleton variant="text" width="80%" height={22} sx={{ backgroundColor: 'var(--surface-hover)' }} />
                    <Skeleton variant="rounded" width="100%" height={6} sx={{ backgroundColor: 'var(--surface-hover)', borderRadius: '3px' }} />
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
                  backgroundColor: 'var(--surface-panel)',
                  border: '1px solid var(--border)',
                  boxShadow: '0 12px 40px var(--scrim)', p: 2, backdropFilter: 'blur(8px)',
                  position: 'relative', transition: 'all 0.4s cubic-bezier(0.165, 0.84, 0.44, 1)',
                  '&:hover': { transform: 'translateY(-4px)', borderColor: 'var(--color-primary)', boxShadow: '0 18px 48px var(--scrim-strong), 0 0 20px var(--accent-a08)' }
                }}>
                  <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: chartHeight }}>
                    <NativeGeoChart
                      data={heatmapData}
                      options={optionsFinal}
                      onSelect={handleChartSelect}
                      onChartReady={handleChartReady}
                      language={localeIdioma}
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
                    backgroundColor: 'var(--surface-panel)',
                    border: '1px solid var(--border)',
                    borderRadius: '16px', p: 3,
                    boxShadow: '0 12px 40px var(--scrim)',
                    backdropFilter: 'blur(12px)',
                    transition: 'all 0.4s cubic-bezier(0.165, 0.84, 0.44, 1)',
                    '&:hover': { transform: 'translateY(-4px)', borderColor: 'var(--color-primary)', boxShadow: '0 18px 48px var(--scrim-strong), 0 0 20px var(--accent-a08)' }
                  }}
                >
                  <Typography variant="h6" sx={{ color: 'var(--accent-ink)', fontWeight: 800, fontFamily: 'Outfit, sans-serif', fontSize: '1.05rem', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                    {t('heatmap.centralInteligencia') || 'Central de Inteligência'}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.6, fontSize: '0.85rem', lineHeight: 1.4 }}>
                    {t('heatmap.centralDescricao') || 'Nível de aceleração e dominância de busca de narrativas por região geográfica para a moeda selecionada'} ({moedaSelecionada}).
                  </Typography>

                  {/* Pulso da narrativa + concentração geográfica + Fear & Greed
                      (dados do /trend e /fear-greed já carregados pelo carrossel) */}
                  <HeatmapInsights trend={moedaSelObj?.trend} fear={moedaSelObj?.fear} t={t} />

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 2 }}>
                    {topRegioes.length > 0 ? (
                      topRegioes.map((reg, idx) => (
                        <Box
                          key={reg.country}
                          component="button"
                          type="button"
                          className="botao-nu"
                          aria-pressed={paisSelecionado === reg.country}
                          onClick={() => handleCountryClick(reg.country)}
                          sx={{
                            display: 'flex', flexDirection: 'column', alignItems: 'stretch',
                            width: '100%', textAlign: 'left', gap: 0.8, cursor: 'pointer',
                            p: 1.2, borderRadius: '8px',
                            transition: 'all 0.2s cubic-bezier(0.165, 0.84, 0.44, 1)',
                            background: paisSelecionado === reg.country ? 'rgba(255, 215, 0, 0.04)' : 'transparent',
                            border: '1px solid',
                            borderLeft: paisSelecionado === reg.country ? '4px solid var(--color-primary)' : '1px solid transparent',
                            borderColor: paisSelecionado === reg.country ? 'var(--accent-a30)' : 'transparent',
                            '&:hover': { backgroundColor: 'var(--surface-subtle)' }
                          }}
                        >
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                              <Box sx={{
                                width: '26px', height: '26px', borderRadius: '50%',
                                background: paisSelecionado === reg.country ? 'var(--color-primary)' : 'var(--accent-a08)',
                                border: '1px solid var(--accent-a30)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.75rem', fontWeight: 800,
                                color: paisSelecionado === reg.country ? 'var(--text-on-accent)' : 'var(--color-primary)',
                                fontFamily: 'Outfit, sans-serif'
                              }}>
                                {idx + 1}
                              </Box>
                              <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.88rem', fontFamily: 'Outfit, sans-serif' }}>
                                {nomePais(reg.country)}
                              </Typography>
                            </Box>
                            <Typography variant="body2" sx={{ fontWeight: 700, color: 'var(--accent-ink)', fontSize: '0.88rem', fontFamily: 'Share Tech Mono, monospace' }}>
                              {reg.displayVal}%
                            </Typography>
                          </Box>
                          <LinearProgress
                            variant="determinate"
                            value={reg.displayVal}
                            sx={{
                              height: '5px', borderRadius: '3px',
                              backgroundColor: 'var(--surface-subtle)',
                              '& .MuiLinearProgress-bar': {
                                background: 'linear-gradient(90deg, #cca92c 0%, var(--accent) 100%)',
                                borderRadius: '3px',
                                boxShadow: '0 0 6px var(--accent-a30)'
                              }
                            }}
                          />
                        </Box>
                      ))
                    ) : (
                      <Box sx={{ p: 4, textAlign: 'center', opacity: 0.4 }}>
                        <Typography variant="body2" sx={{ fontStyle: 'italic' }}>{t('heatmap.aguardandoDados') || 'Aguardando dados geográficos...'}</Typography>
                      </Box>
                    )}
                  </Box>
                </Box>
              </Grid>
            </Grid>
          </Fade>
        ) : (
          <Box sx={{ p: 6, textAlign: 'center', opacity: 0.5, backgroundColor: 'var(--surface-panel)', borderRadius: '16px', border: '1px solid var(--border)' }}>
            <MdAnalytics size={48} style={{ color: 'var(--accent-ink)', marginBottom: '12px' }} />
            <Typography sx={{ fontFamily: 'Outfit, sans-serif' }}>{t('heatmap.semDados') || 'Dados de mapa não disponíveis para o ativo selecionado no período.'}</Typography>
          </Box>
        )}
      </section>
    </div>
  )
}
