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

import { useAuth } from '../context/AuthContext'
import useTranslation from '../hooks/useTranslation'
import useChatHub from '../hooks/useChatHub'
import useCoinPrices from '../hooks/useCoinPrices'
import useDashboardData from '../hooks/useDashboardData'
import useDashboardCharts from '../hooks/useDashboardCharts'
import * as mathUtils from '../utils/mathUtils'

// Sub-componentes Refatorados
import DashboardHeader from '../components/dashboard/DashboardHeader'
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

  // Filtros Globais da Tela
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [moedasFiltro, setMoedasFiltro] = useState([]) 
  const [resultadoFiltro, setResultadoFiltro] = useState('ALL')
  const [intervalo, setIntervalo] = useState('1m')
  const [pagina, setPagina] = useState(1)
  const [quantidade, setQuantidade] = useState(20)

  // Estados Visuais Locais
  const [normalizacao, setNormalizacao] = useState('base100')
  const [expandedChart, setExpandedChart] = useState(null)
  const [showChat, setShowChat] = useState(false)
  const [moedaChat, setMoedaChat] = useState(null)
  const [currentCorrelationId, setCurrentCorrelationId] = useState(null)

  const hasInitializedPref = useRef(false)

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
          initialized = true
        }
      }

      if (!initialized && moedasCarousel.length > 0) {
        const btc = moedasCarousel.find(m => m.simbolo === 'BTC') || moedasCarousel[0]
        if (btc) {
          setMoedasFiltro([btc.simbolo])
          initialized = true
        }
      }

      if (initialized) hasInitializedPref.current = true
    } catch (err) {
      console.error('Erro na inicialização:', err)
    }
  }, [prefs, token, moedasCarousel])

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
    setMoedasFiltro(prev => prev.includes(simbolo) ? prev.filter(s => s !== simbolo) : [...prev, simbolo])
    setPagina(1)
    setDataInicio('')
    setDataFim('')
    setIntervalo('1m')
    setResultadoFiltro('ALL')
  }

  // Filtragem local
  const historicoFiltrado = useMemo(() => {
    let registros = historicoMoeda?.registros || []
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
  }, [historicoMoeda, dataInicio, dataFim, resultadoFiltro])

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
        <DashboardHeader t={t} prefs={prefs} usuario={usuario} />

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

        <CoinCarousel 
          moedasCarousel={moedasCarousel}
          moedasFiltro={moedasFiltro}
          selecionarMoeda={selecionarMoeda}
          handleDebateTrigger={handleDebateTrigger}
          t={t}
          isMobile={isMobile}
        />

        <DashboardFilters 
          dataInicio={dataInicio} setDataInicio={setDataInicio}
          dataFim={dataFim} setDataFim={setDataFim}
          resultadoFiltro={resultadoFiltro} setResultadoFiltro={setResultadoFiltro}
          intervalo={intervalo} setIntervalo={setIntervalo}
          setPagina={setPagina} setQuantidade={setQuantidade}
          t={t}
        />

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
          t={t}
        />

        {moedasFiltro.length === 1 && trendAtual && (
          <IntelligencePanel trendAtual={trendAtual} t={t} />
        )}

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
