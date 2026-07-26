import React, { useState, useEffect, useRef, useMemo } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import Box from '@mui/material/Box'
import useMediaQuery from '@mui/material/useMediaQuery'
import { Joyride, STATUS } from 'react-joyride'

import { useAuth } from '../context/AuthContext'
import { useDashboard } from '../context/DashboardContext'
import useTranslation from '../hooks/useTranslation'
import useCoinPrices from '../hooks/useCoinPrices'
import useDashboardData from '../hooks/useDashboardData'
import useDashboardCharts from '../hooks/useDashboardCharts'
import useMarketAnalytics from '../hooks/useMarketAnalytics'
import * as mathUtils from '../utils/mathUtils'
import { getTourVisto, setTourVisto } from '../utils/preferences'
import { candlestickPlugin } from '../utils/candlestickChart'
import { PriceChartMode } from '../utils/enums'

// Sub-componentes Refatorados
import DashboardHeader from '../components/dashboard/DashboardHeader'
import PatrimonioCard from '../components/dashboard/PatrimonioCard'
import CoinCarousel from '../components/dashboard/CoinCarousel'
import DashboardFilters from '../components/dashboard/DashboardFilters'
import IntelligencePanel from '../components/dashboard/IntelligencePanel'
import AnalyticsPanel from '../components/dashboard/AnalyticsPanel'
import PeriodStatsPanel from '../components/dashboard/PeriodStatsPanel'
import DashboardCharts from '../components/dashboard/DashboardCharts'
import HistoryTable from '../components/dashboard/HistoryTable'
import ErrorMessage from '../components/ErrorMessage'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  // Inerte enquanto options.plugins.candlestick.enabled for falso, então não
  // interfere no gráfico de variação nem no modo linha.
  candlestickPlugin,
)

ChartJS.defaults.color = '#e0e0e0'
ChartJS.defaults.borderColor = '#333'

export default function Dashboard() {
  const { token, user: usuario, prefs } = useAuth()
  const { moedas: moedasCarousel, erro: erroMoedas, setErro: setErroMoedas } = useCoinPrices()
  const { t } = useTranslation()
  const isMobile = useMediaQuery('(max-width:600px)')

  const {
    dataInicio, setDataInicio,
    dataFim, setDataFim,
    resultadoFiltro, setResultadoFiltro,
    intervalo, setIntervalo,
    pagina, setPagina,
    quantidade, setQuantidade,
    moedaSelecionada, setMoedaSelecionada
  } = useDashboard()

  const [moedasFiltro, setMoedasFiltro] = useState([]) 

  // Estados Visuais Locais
  const [normalizacao, setNormalizacao] = useState('base100')
  const [modoPreco, setModoPreco] = useState(PriceChartMode.LINE)
  const [expandedChart, setExpandedChart] = useState(null)

  const hasInitializedPref = useRef(false)

  // ------ tour onboarding (react-joyride v3) ------
  const [tourRodando, setTourRodando] = useState(false)

  // Nota: react-joyride v3 — `skipBeacon`, `showProgress`, cores e ações dos
  // botões são configurados via prop `options` (não existem `showSkipButton`,
  // `showProgress` nem `styles.options` de nível superior como na v2), e o
  // handler de eventos é `onEvent` (não `callback`).
  const passosTour = useMemo(() => [
    {
      target: '[data-tour="dash-patrimonio"]',
      title: t('dashboardTour.passo1Titulo') || 'Patrimônio Total',
      content: t('dashboardTour.passo1Descricao') || 'Acompanhe e gerencie seu saldo consolidado.',
    },
    {
      target: '[data-tour="dash-carrossel"]',
      title: t('dashboardTour.passo2Titulo') || 'Carrossel de Ativos',
      content: t('dashboardTour.passo2Descricao') || 'Selecione uma ou mais moedas para analisar.',
    },
    {
      target: '[data-tour="dash-filtros"]',
      title: t('dashboardTour.passo3Titulo') || 'Filtros',
      content: t('dashboardTour.passo3Descricao') || 'Refine por período, intervalo e resultado.',
    },
    {
      target: '[data-tour="dash-graficos"]',
      title: t('dashboardTour.passo4Titulo') || 'Gráficos',
      content: t('dashboardTour.passo4Descricao') || 'Compare preço e variação e expanda para ver em detalhe.',
    },
    {
      target: '[data-tour="dash-historico"]',
      title: t('dashboardTour.passo5Titulo') || 'Histórico',
      content: t('dashboardTour.passo5Descricao') || 'Veja o histórico de operações filtrado.',
    },
  ], [t])

  // Inicia o tour automaticamente na primeira visita, após os dados carregarem.
  useEffect(() => {
    if (!token || getTourVisto('dashboard') || !moedasCarousel?.length) return
    const timer = setTimeout(() => setTourRodando(true), 800)
    return () => clearTimeout(timer)
  }, [token, moedasCarousel])

  const handleTourCallback = (data) => {
    const { status } = data
    if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status)) {
      setTourRodando(false)
      setTourVisto('dashboard')
    }
  }

  // Fechar modal com a tecla Esc
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') setExpandedChart(null)
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [])

  // Inicializa a moeda preferida
  useEffect(() => {
    try {
      if (!token || hasInitializedPref.current || !moedasCarousel?.length) return

      const moedaProp =
        prefs?.siglaMoedaPreferida ||
        prefs?.SiglaMoedaPreferida ||
        prefs?.idMoedaPreferida ||
        prefs?.IdMoedaPreferida ||
        prefs?.moedaPreferida ||
        prefs?.MoedaPreferida

      let initialized = false
      if (moedaProp) {
        const match = moedasCarousel.find(m =>
          (m.id && String(m.id) === String(moedaProp)) ||
          (m.simbolo && String(m.simbolo).toUpperCase() === String(moedaProp).toUpperCase().trim())
        )
        if (match) {
          setMoedasFiltro([match.simbolo])
          setMoedaSelecionada(match.simbolo)
          initialized = true
        }
      }

      if (!initialized && moedasCarousel.length > 0) {
        const btc = moedasCarousel.find(m => m.simbolo === 'BTC') || moedasCarousel[0]
        if (btc) {
          setMoedasFiltro([btc.simbolo])
          setMoedaSelecionada(btc.simbolo)
          initialized = true
        }
      }

      if (initialized) hasInitializedPref.current = true
    } catch (err) {
      console.error('Erro na inicialização:', err)
    }
  }, [prefs, token, moedasCarousel, setMoedaSelecionada])

  // Hook customizado para carregar os dados
  const {
    historicosPorMoeda,
    fearGreedPorMoeda,
    trendPorMoeda,
    totalPaginas,
    historicoMoeda,
    erro,
    setErro
  } = useDashboardData({
    token,
    moedasCarousel,
    moedasFiltro,
    dataInicio,
    dataFim,
    intervalo,
    pagina,
    quantidade
  })

  const selecionarMoeda = (simbolo) => {
    const isSelecionada = moedasFiltro.includes(simbolo)
    const novasMoedas = isSelecionada ? moedasFiltro.filter(s => s !== simbolo) : [...moedasFiltro, simbolo]
    setMoedasFiltro(novasMoedas)
    setMoedaSelecionada(novasMoedas.length === 1 ? novasMoedas[0] : null)
    setPagina(1)
  }

  // Filtragem local
  const historicoFiltrado = useMemo(() => {
    let registros = []

    if (moedasFiltro.length === 1) {
      registros = (historicoMoeda?.registros || []).map(r => ({ ...r, sigla: moedasFiltro[0] }))
    } else if (moedasFiltro.length > 1) {
      moedasFiltro.forEach(sigla => {
        const hist = historicosPorMoeda[sigla] || []
        hist.forEach(r => {
          registros.push({ ...r, sigla })
        })
      })
      registros.sort((a, b) => {
        const tA = new Date(a.horaReferencia ?? a.HoraReferencia ?? a.dataHora ?? a.DataHora).getTime()
        const tB = new Date(b.horaReferencia ?? b.HoraReferencia ?? b.dataHora ?? b.DataHora).getTime()
        return tB - tA
      })
    }

    if (dataInicio || dataFim) {
      const dInicio = dataInicio ? new Date(dataInicio).getTime() : null
      const dFim = dataFim ? new Date(dataFim.includes('T') ? dataFim : `${dataFim}T23:59:59`).getTime() : null
      registros = registros.filter(r => {
        const time = new Date(r.horaReferencia ?? r.HoraReferencia ?? r.dataHora ?? r.DataHora).getTime()
        if (dInicio && time < dInicio) return false
        if (dFim && time > dFim) return false
        return true
      })
    }
    if (resultadoFiltro && resultadoFiltro !== 'ALL') {
      registros = registros.filter(r => {
        const v = r.precoPercentualVariacao ?? r.PrecoPercentualVariacao ?? r.variacaoPercentual ?? r.VariacaoPercentual ?? 0
        return resultadoFiltro === 'WIN' ? v > 0 : v < 0
      })
    }
    return registros
  }, [historicoMoeda, historicosPorMoeda, moedasFiltro, dataInicio, dataFim, resultadoFiltro])

  const trendAtual = useMemo(() => {
    const sigla = moedasFiltro[0]
    if (!sigla || !trendPorMoeda[sigla]) return null
    const regs = trendPorMoeda[sigla]
    if (!Array.isArray(regs) || regs.length === 0) return null
    return regs[0]
  }, [trendPorMoeda, moedasFiltro])

  // Fluxo de ordens, volatilidade e sentimento: tudo derivado dos dados que já
  // foram carregados acima, sem nenhuma requisição adicional.
  const analytics = useMarketAnalytics({
    historicosPorMoeda,
    fearGreedPorMoeda,
    moedasFiltro
  })

  // Processamento de Gráficos (Hook Customizado)
  const chartConfig = useDashboardCharts({
    historicosPorMoeda,
    dataInicio,
    dataFim,
    resultadoFiltro,
    normalizacao,
    fearGreedPorMoeda,
    trendPorMoeda,
    modoPreco
  })

  // As consultas usam ordemAsc=false, então o backend devolve da leitura mais
  // recente para a mais antiga: o registro atual é o índice 0, não o último.
  const ultimoNegociado = useMemo(() => {
    const sigla = moedasFiltro[0]
    const hist = (historicosPorMoeda && sigla) ? (historicosPorMoeda[sigla] || []) : []
    if (!hist.length) return '-'
    const last = hist[0]
    const val = last?.precoFechamento ?? last?.PrecoFechamento ?? last?.valor ?? last?.Valor ?? last?.valorNegociado ?? last?.ValorNegociado ?? 0
    return mathUtils.formatCurrency(val)
  }, [historicosPorMoeda, moedasFiltro])

  const ultimaVariacao = useMemo(() => {
    const sigla = moedasFiltro[0]
    const hist = (historicosPorMoeda && sigla) ? (historicosPorMoeda[sigla] || []) : []
    if (!hist.length) return '-'
    const last = hist[0]
    const val = last?.precoPercentualVariacao ?? last?.PrecoPercentualVariacao ?? last?.variacaoPercentual ?? last?.VariacaoPercentual ?? last?.variacao ?? last?.Variacao ?? 0
    return mathUtils.formatPercent(val)
  }, [historicosPorMoeda, moedasFiltro])

  if (!token) return <Box sx={{ p: 5 }}>Redirecting to login...</Box>

  // Erros de renderização são capturados pelo ErrorBoundary montado no App.
  return (
      <div className="dashboard-container">
        {/* Tour onboarding — montado apenas enquanto roda para não deixar
            o portal/beacon residual da react-joyride no DOM. */}
        {tourRodando && (
          <Joyride
            steps={passosTour}
            run={tourRodando}
            continuous
            onEvent={handleTourCallback}
            locale={{
              back: 'Voltar',
              close: t('dashboardTour.fechar') || 'Entendi!',
              last: t('dashboardTour.fechar') || 'Entendi!',
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
              primaryColor: '#ffd700',
              textColor: '#fff',
              backgroundColor: 'var(--surface-overlay)',
              arrowColor: 'rgba(15,15,15,0.97)',
              zIndex: 9999,
            }}
            styles={{
              tooltip: {
                border: '1px solid var(--accent-a30)',
                borderRadius: 16,
                boxShadow: '0 20px 60px var(--scrim-strong)',
              },
              tooltipTitle: { color: 'var(--accent-ink)', fontWeight: 800, fontSize: '1rem' },
              tooltipContent: { color: 'var(--text-secondary)', fontSize: '0.88rem' },
              buttonPrimary: { backgroundColor: 'var(--accent)', color: 'var(--text-on-accent)', fontWeight: 700, borderRadius: '8px' },
              buttonBack: { color: 'var(--text-muted)' },
              buttonSkip: { color: 'var(--text-faint)', fontSize: '0.78rem' },
            }}
          />
        )}

        <DashboardHeader t={t} prefs={prefs} usuario={usuario} />

        <div data-tour="dash-patrimonio">
          <PatrimonioCard token={token} user={usuario} />
        </div>

        <ErrorMessage message={erro} onClose={() => setErro('')} />
        <ErrorMessage message={erroMoedas} onClose={() => setErroMoedas('')} />

        <div data-tour="dash-carrossel">
          <CoinCarousel
            moedasCarousel={moedasCarousel}
            moedasFiltro={moedasFiltro}
            selecionarMoeda={selecionarMoeda}
            t={t}
            isMobile={isMobile}
          />
        </div>

        <div data-tour="dash-filtros">
          <DashboardFilters t={t} />
        </div>

        <div data-tour="dash-graficos">
        <DashboardCharts
          multiMoeda={chartConfig.multiMoeda}
          normalizacao={normalizacao}
          setNormalizacao={setNormalizacao}
          modoPreco={modoPreco}
          setModoPreco={setModoPreco}
          temVelas={chartConfig.velas.length > 0}
          expandedChart={expandedChart}
          setExpandedChart={setExpandedChart}
          dadosNegociados={chartConfig.dadosGraficoPreco}
          dadosVariacao={chartConfig.dadosGraficoVariacao}
          opcoesPreco={chartConfig.opcoesPreco}
          opcoesVariacao={chartConfig.opcoesVariacao}
          ultimoNegociado={ultimoNegociado}
          ultimaVariacao={ultimaVariacao}
          trendAtual={trendAtual}
          t={t}
        />
        </div>

        <PeriodStatsPanel desempenho={analytics?.desempenho} t={t} />

        <AnalyticsPanel analytics={analytics} t={t} />

        {moedasFiltro.length === 1 && trendAtual && (
          <IntelligencePanel trendAtual={trendAtual} t={t} />
        )}

        <div data-tour="dash-historico">
          <HistoryTable
            historicoMoeda={historicoMoeda}
            historicoFiltrado={historicoFiltrado}
            moedasFiltro={moedasFiltro}
            totalPaginas={totalPaginas}
            pagina={pagina}
            setPagina={setPagina}
            t={t}
          />
        </div>
      </div>
  )
}
