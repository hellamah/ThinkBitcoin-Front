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
} from 'chart.js'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import useMediaQuery from '@mui/material/useMediaQuery'
import { Joyride, STATUS } from 'react-joyride'

import { useAuth } from '../context/AuthContext'
import { useDashboard } from '../context/DashboardContext'
import useTranslation from '../hooks/useTranslation'
import useChatHub from '../hooks/useChatHub'
import useCoinPrices from '../hooks/useCoinPrices'
import useDashboardData from '../hooks/useDashboardData'
import useDashboardCharts from '../hooks/useDashboardCharts'
import * as mathUtils from '../utils/mathUtils'
import { getTourVisto, setTourVisto } from '../utils/preferences'

// Sub-componentes Refatorados
import DashboardHeader from '../components/dashboard/DashboardHeader'
import PatrimonioCard from '../components/dashboard/PatrimonioCard'
import CoinCarousel from '../components/dashboard/CoinCarousel'
import DashboardFilters from '../components/dashboard/DashboardFilters'
import IntelligencePanel from '../components/dashboard/IntelligencePanel'
import DashboardCharts from '../components/dashboard/DashboardCharts'
import HistoryTable from '../components/dashboard/HistoryTable'
import Terminal from '../components/Terminal'
import ErrorMessage from '../components/ErrorMessage'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
)

ChartJS.defaults.color = '#e0e0e0'
ChartJS.defaults.borderColor = '#333'

export default function Dashboard() {
  const { token, user: usuario, prefs } = useAuth()
  const moedasCarousel = useCoinPrices()
  const { t } = useTranslation()
  const { messages, enviarMensagem, clearMessages, isConnected } = useChatHub()
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
  const [expandedChart, setExpandedChart] = useState(null)
  const [showChat, setShowChat] = useState(false)
  const [moedaChat, setMoedaChat] = useState(null)
  const [currentCorrelationId, setCurrentCorrelationId] = useState(null)

  const hasInitializedPref = useRef(false)

  // ------ tour onboarding (react-joyride v3) ------
  const [tourRodando, setTourRodando] = useState(false)

  // Nota: na react-joyride v3 a prop é `skipBeacon` (não `disableBeacon`) e o
  // handler é `onEvent` (não `callback`). Sem isso o primeiro passo abre um
  // beacon estático preso na tela e o tour nunca é marcado como visto.
  const passosTour = useMemo(() => [
    {
      target: '[data-tour="dash-patrimonio"]',
      title: t('dashboardTour.passo1Titulo') || 'Patrimônio Total',
      content: t('dashboardTour.passo1Descricao') || 'Acompanhe e gerencie seu saldo consolidado.',
      skipBeacon: true,
    },
    {
      target: '[data-tour="dash-carrossel"]',
      title: t('dashboardTour.passo2Titulo') || 'Carrossel de Ativos',
      content: t('dashboardTour.passo2Descricao') || 'Selecione moedas para analisar e inicie um debate com a IA.',
      skipBeacon: true,
    },
    {
      target: '[data-tour="dash-filtros"]',
      title: t('dashboardTour.passo3Titulo') || 'Filtros',
      content: t('dashboardTour.passo3Descricao') || 'Refine por período, intervalo e resultado.',
      skipBeacon: true,
    },
    {
      target: '[data-tour="dash-graficos"]',
      title: t('dashboardTour.passo4Titulo') || 'Gráficos',
      content: t('dashboardTour.passo4Descricao') || 'Compare preço e variação e expanda para ver em detalhe.',
      skipBeacon: true,
    },
    {
      target: '[data-tour="dash-historico"]',
      title: t('dashboardTour.passo5Titulo') || 'Histórico',
      content: t('dashboardTour.passo5Descricao') || 'Veja o histórico de operações filtrado.',
      skipBeacon: true,
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
    dados,
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
    quantidade,
    resultadoFiltro
  })

  // Lógicas do ChatHub
  const handleDebateTrigger = async (sigla) => {
    if (!token) return
    const corrId = crypto.randomUUID?.() || Math.random().toString(36).substring(2, 15)
    setMoedaChat(sigla)
    setShowChat(true)
    setCurrentCorrelationId(corrId)

    try {
      const success = await enviarMensagem(`#analisar ${sigla}`, '', corrId)
      if (!success) throw new Error(!isConnected ? 'Conexão não estabelecida.' : 'Falha no servidor.')
    } catch (err) {
      console.error(err)
      setErro(isConnected ? (t('errorTriggeringDebate') || 'Erro ao iniciar debate com a IA') : 'O chat está offline.')
    }
  }

  const handleChatCommand = async (fullCommand) => {
    await enviarMensagem(fullCommand, '', currentCorrelationId)
  }

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
    return regs[regs.length - 1]
  }, [trendPorMoeda, moedasFiltro])

  // Processamento de Gráficos (Hook Customizado)
  const chartConfig = useDashboardCharts({
    historicosPorMoeda,
    dataInicio,
    dataFim,
    resultadoFiltro,
    normalizacao,
    fearGreedPorMoeda,
    trendPorMoeda
  })

  const ultimoNegociado = useMemo(() => {
    const sigla = moedasFiltro[0]
    const hist = (historicosPorMoeda && sigla) ? (historicosPorMoeda[sigla] || []) : []
    if (!hist.length) return '-'
    const last = hist[hist.length - 1]
    const val = last?.precoFechamento ?? last?.PrecoFechamento ?? last?.valor ?? last?.Valor ?? last?.valorNegociado ?? last?.ValorNegociado ?? 0
    return mathUtils.formatCurrency(val)
  }, [historicosPorMoeda, moedasFiltro])

  const ultimaVariacao = useMemo(() => {
    const sigla = moedasFiltro[0]
    const hist = (historicosPorMoeda && sigla) ? (historicosPorMoeda[sigla] || []) : []
    if (!hist.length) return '-'
    const last = hist[hist.length - 1]
    const val = last?.precoPercentualVariacao ?? last?.PrecoPercentualVariacao ?? last?.variacaoPercentual ?? last?.VariacaoPercentual ?? last?.variacao ?? last?.Variacao ?? 0
    return mathUtils.formatPercent(val)
  }, [historicosPorMoeda, moedasFiltro])

  if (!token) return <Box sx={{ p: 5 }}>Redirecting to login...</Box>

  try {
    return (
      <div className="dashboard-container">
        {/* Tour onboarding — montado apenas enquanto roda para não deixar
            o portal/beacon residual da react-joyride no DOM. */}
        {tourRodando && (
          <Joyride
            steps={passosTour}
            run={tourRodando}
            continuous
            showSkipButton
            showProgress
            onEvent={handleTourCallback}
            locale={{
              back: 'Voltar',
              close: t('dashboardTour.fechar') || 'Entendi!',
              last: t('dashboardTour.fechar') || 'Entendi!',
              next: 'Próximo',
              skip: 'Pular',
            }}
            styles={{
              options: {
                primaryColor: '#ffd700',
                textColor: '#fff',
                backgroundColor: 'rgba(15,15,15,0.97)',
                arrowColor: 'rgba(15,15,15,0.97)',
                zIndex: 9999,
              },
              tooltip: {
                background: 'rgba(15,15,15,0.97)',
                border: '1px solid rgba(255,215,0,0.35)',
                borderRadius: 16,
                color: '#fff',
                boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
              },
              tooltipTitle: { color: '#ffd700', fontWeight: 800, fontSize: '1rem' },
              tooltipContent: { color: 'rgba(255,255,255,0.8)', fontSize: '0.88rem' },
              buttonNext: { background: '#ffd700', color: '#000', fontWeight: 700, borderRadius: '8px' },
              buttonBack: { color: 'rgba(255,255,255,0.6)' },
              buttonSkip: { color: 'rgba(255,255,255,0.4)', fontSize: '0.78rem' },
            }}
          />
        )}

        <DashboardHeader t={t} prefs={prefs} usuario={usuario} />

        <div data-tour="dash-patrimonio">
          <PatrimonioCard token={token} user={usuario} />
        </div>

        <ErrorMessage message={erro} onClose={() => setErro('')} />

        {showChat && (
          <Terminal
            messages={messages}
            onCommand={handleChatCommand}
            onClose={() => setShowChat(false)}
            status={isConnected ? 'CONNECTED' : 'OFFLINE'}
            title={`CHATBOT_${moedaChat || 'GLOBAL'}`}
          />
        )}

        <div data-tour="dash-carrossel">
          <CoinCarousel
            moedasCarousel={moedasCarousel}
            moedasFiltro={moedasFiltro}
            selecionarMoeda={selecionarMoeda}
            handleDebateTrigger={handleDebateTrigger}
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
  } catch (err) {
    console.error('Erro fatal no render do Dashboard:', err)
    return (
      <Box sx={{ p: 5, color: '#ff5252', background: '#0a0a0a', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
        <Typography variant="h5">Ocorreu um erro ao carregar o Dashboard.</Typography>
        <Typography sx={{ mt: 2, opacity: 0.7 }}>{err.message}</Typography>
        <Button variant="outlined" sx={{ mt: 4, color: '#ffd700', borderColor: '#ffd700' }} onClick={() => window.location.reload()}>
          Recarregar Página
        </Button>
      </Box>
    )
  }
}
