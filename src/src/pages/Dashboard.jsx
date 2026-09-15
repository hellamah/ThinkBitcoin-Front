import React, { useState, useEffect, useRef, useMemo } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import useMediaQuery from '@mui/material/useMediaQuery'

import { useAuth } from '../context/AuthContext'
import { useDashboard } from '../context/DashboardContext'
import useTranslation from '../hooks/useTranslation'
import useCoinPrices from '../hooks/useCoinPrices'
import useAlertasPreco from '../hooks/useAlertasPreco'
import useDashboardData from '../hooks/useDashboardData'
import useDashboardCharts from '../hooks/useDashboardCharts'
import useStrategySimulation from '../hooks/useStrategySimulation'
import useHistoryPage from '../hooks/useHistoryPage'
import useMarketAnalytics from '../hooks/useMarketAnalytics'
import * as mathUtils from '../utils/mathUtils'
import { calcularLimites } from '../utils/marketStats'
import { compararMoedas } from '../utils/marketAnalytics'
import { analisarSinais } from '../utils/signalLab'
import { getTourVisto, setTourVisto } from '../utils/preferences'
import { contarAtivos } from '../utils/alertaPreco'
import { candlestickPlugin } from '../utils/candlestickChart'
import { Normalization, PriceChartMode, SecondaryChart } from '../utils/enums'

// Sub-componentes Refatorados
import DashboardHeader from '../components/dashboard/DashboardHeader'
import PatrimonioCard from '../components/dashboard/PatrimonioCard'
import CoinCarousel from '../components/dashboard/CoinCarousel'
import AlertaPrecoModal from '../components/dashboard/AlertaPrecoModal'
import DashboardFilters from '../components/dashboard/DashboardFilters'
import IntelligencePanel from '../components/dashboard/IntelligencePanel'
import AnalyticsPanel from '../components/dashboard/AnalyticsPanel'
import PeriodStatsPanel from '../components/dashboard/PeriodStatsPanel'
import CorrelationMatrix from '../components/dashboard/CorrelationMatrix'
import CoinComparisonPanel from '../components/dashboard/CoinComparisonPanel'
import SignalLabPanel from '../components/dashboard/SignalLabPanel'
import SimulationPanel from '../components/dashboard/SimulationPanel'
import DashboardCharts from '../components/dashboard/DashboardCharts'
import HistoryTable from '../components/dashboard/HistoryTable'
import ErrorMessage from '../components/ErrorMessage'
import TourGuiado from '../components/TourGuiadoSobDemanda'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  // Barras da variação no modo candle.
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  // Inerte enquanto options.plugins.candlestick.enabled for falso, então não
  // interfere no gráfico de variação nem no modo linha.
  candlestickPlugin,
)

// Aqui havia duas linhas mexendo no `ChartJS.defaults` global, no import.
//
// `defaults.color` era morto: todo gráfico do produto já define a cor dos
// ticks e da legenda a partir do `chartPalette()`. Verificado trocando o valor
// por magenta e contando os pixels — nenhum.
//
// `defaults.borderColor` NÃO era: ele desenhava a linha dos eixos de todos os
// gráficos, em '#333' cravado, enquanto o resto do desenho seguia o tema. E o
// alcance dependia da navegação, porque este módulo é carregado sob demanda:
// a tela de treinamento desenhava os eixos de uma cor quando aberta direto e
// de outra depois de alguém passar por aqui. Estado global mutado no import de
// uma rota preguiçosa não fica na rota.
//
// A cor do eixo agora sai do `chartPalette().borda` junto das demais, no
// `scales.*.border` de cada gráfico.

export default function Dashboard() {
  const { token, user: usuario, prefs } = useAuth()
  const { moedas: moedasCarousel, erro: erroMoedas, setErro: setErroMoedas } = useCoinPrices()
  const { t, idioma } = useTranslation()
  const isMobile = useMediaQuery('(max-width:600px)')

  const {
    dataInicio,
    dataFim,
    resultadoFiltro,
    intervalo,
    pagina, setPagina,
    quantidade,
    moedaSelecionada,
    setMoedaSelecionada
  } = useDashboard()

  const {
    alertas,
    carregando: carregandoAlertas,
    erro: erroAlertas,
    temAcesso: temAcessoAlertas,
    criar: criarAlerta,
    excluir: excluirAlerta,
  } = useAlertasPreco(usuario)
  const [modalAlertasAberto, setModalAlertasAberto] = useState(false)

  const [moedasFiltro, setMoedasFiltro] = useState([]) 

  // Estados Visuais Locais
  const [normalizacao, setNormalizacao] = useState(Normalization.BASE_100)
  const [modoPreco, setModoPreco] = useState(PriceChartMode.LINE)
  const [painelSecundario, setPainelSecundario] = useState(SecondaryChart.VARIATION)
  const [horizonteSinal, setHorizonteSinal] = useState(1)
  const [expandedChart, setExpandedChart] = useState(null)

  const hasInitializedPref = useRef(false)

  // ------ tour onboarding (moldura em components/TourGuiado) ------
  const [tourRodando, setTourRodando] = useState(false)

  const passosTour = useMemo(() => [
    {
      target: '[data-tour="dash-patrimonio"]',
      title: t('dashboardTour.passo1Titulo'),
      content: t('dashboardTour.passo1Descricao'),
    },
    {
      target: '[data-tour="dash-carrossel"]',
      title: t('dashboardTour.passo2Titulo'),
      content: t('dashboardTour.passo2Descricao'),
    },
    {
      target: '[data-tour="dash-filtros"]',
      title: t('dashboardTour.passo3Titulo'),
      content: t('dashboardTour.passo3Descricao'),
    },
    {
      target: '[data-tour="dash-graficos"]',
      title: t('dashboardTour.passo4Titulo'),
      content: t('dashboardTour.passo4Descricao'),
    },
    // A simulação vem antes do histórico porque é essa a ordem na tela — o
    // Joyride rola até cada alvo, e um passo fora de ordem faria a página
    // saltar para trás no meio do tour.
    //
    // Só entra com uma moeda selecionada, que é a condição de o painel existir.
    // A verificação é sobre o ESTADO, não sobre o DOM: no primeiro render nada
    // está montado ainda, e um `querySelector` aqui filtraria o tour inteiro.
    ...(moedasFiltro.length === 1
      ? [{
          target: '[data-tour="dash-simulacao"]',
          title: t('dashboardTour.passo5Titulo'),
          content: t('dashboardTour.passo5Descricao'),
        }]
      : []),
    {
      target: '[data-tour="dash-historico"]',
      title: t('dashboardTour.passo6Titulo'),
      content: t('dashboardTour.passo6Descricao'),
    },
  ], [t, moedasFiltro.length])

  // Inicia o tour automaticamente na primeira visita, após os dados carregarem.
  useEffect(() => {
    if (!token || getTourVisto('dashboard') || !moedasCarousel?.length) return
    const timer = setTimeout(() => setTourRodando(true), 800)
    return () => clearTimeout(timer)
  }, [token, moedasCarousel])

  const encerrarTour = () => {
    setTourRodando(false)
    setTourVisto('dashboard')
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
    cobertura,
    erro,
    setErro
  } = useDashboardData({
    token,
    moedasCarousel,
    moedasFiltro,
    dataInicio,
    dataFim,
    intervalo,
    quantidade
  })

  // A página da tabela tem busca própria. Enquanto ela saía da mesma requisição
  // dos painéis, navegar no histórico trocava a série analisada por gráficos,
  // laboratório de sinais e matriz de correlação. Ver utils/useHistoryPage.js.
  //
  // Só no modo de moeda única, que é a única condição em que o controle de
  // paginação aparece.
  const {
    registros: paginaHistorico,
    totalPaginas,
  } = useHistoryPage({
    token,
    sigla: moedasFiltro.length === 1 ? moedasFiltro[0] : null,
    dataInicio,
    dataFim,
    pagina,
    quantidade,
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
      registros = paginaHistorico.map(r => ({ ...r, sigla: moedasFiltro[0] }))
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
  }, [paginaHistorico, historicosPorMoeda, moedasFiltro, dataInicio, dataFim, resultadoFiltro])

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
    moedasFiltro,
    // Recorta as leituras de PERÍODO à janela escolhida. As de estado — fluxo,
    // volatilidade, ATR, VWAP — seguem usando a série inteira, que é onde a
    // margem de aquecimento serve.
    aPartirDe: dataInicio || null
  })

  // Régua de anomalia por moeda. Sai da série completa (historicosPorMoeda), e
  // não da página exibida: volume de BTC e de DOGE não se comparam, e limites
  // tirados de 20 linhas mudariam a cada troca de página.
  const limitesPorMoeda = useMemo(() => {
    const limites = {}
    Object.keys(historicosPorMoeda || {}).forEach(sigla => {
      const l = calcularLimites(historicosPorMoeda[sigla])
      if (l) limites[sigla] = l
    })
    return limites
  }, [historicosPorMoeda])

  // Desfecho dos sinais. Só faz sentido com uma moeda: misturar os retornos de
  // ativos diferentes numa mesma taxa não descreve nenhum deles.
  const analiseSinais = useMemo(() => {
    if (moedasFiltro.length !== 1) return null
    // `aPartirDe` recorta o período ANALISADO. A série carregada traz alguns
    // dias a mais só para aquecer Bollinger e RSI; sem o recorte, o painel
    // media esses candles junto e anunciava mais amostras do que o filtro da
    // tela pediu.
    return analisarSinais(historicosPorMoeda?.[moedasFiltro[0]], {
      horizonte: horizonteSinal,
      aPartirDe: dataInicio || null,
    })
  }, [historicosPorMoeda, moedasFiltro, horizonteSinal, dataInicio])

  // ------ simulação de estratégia ------
  //
  // Restrita a uma moeda, como o laboratório: misturar ativos numa única curva
  // de capital não descreve carteira nenhuma. Toda a fiação — série própria de
  // 180 dias, corte de validação, ranking, régua aleatória, URL e diário — mora
  // no hook; aqui só se decide se há uma moeda para simular.
  const siglaSimulacao = moedasFiltro.length === 1 ? moedasFiltro[0] : null
  const simulacaoEstrategia = useStrategySimulation({ token, sigla: siglaSimulacao, t, idioma })

  // Processamento de Gráficos (Hook Customizado)
  const chartConfig = useDashboardCharts({
    historicosPorMoeda,
    dataInicio,
    dataFim,
    resultadoFiltro,
    normalizacao,
    fearGreedPorMoeda,
    trendPorMoeda,
    modoPreco,
    t,
    // As datas do eixo seguem o idioma escolhido, como o texto ao lado delas.
    locale: idioma.intl
  })

  const comparativo = useMemo(
    () => compararMoedas(historicosPorMoeda, moedasFiltro, dataInicio || null),
    [historicosPorMoeda, moedasFiltro, dataInicio]
  )

  // As consultas usam ordemAsc=false, então o backend devolve da leitura mais
  // recente para a mais antiga: o registro atual é o índice 0, não o último.
  //
  // No modo comparativo estes dois valores não são exibidos: eram do primeiro
  // da lista, sem dizer de qual moeda, e em dólar enquanto o gráfico está
  // normalizado — três números diferentes na tela para a mesma coisa.
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

  // Erros de renderização são capturados pelo ErrorBoundary montado no App.
  return (
      <div className="dashboard-container">
        {/* Tour onboarding — montado apenas enquanto roda para não deixar
            o portal/beacon residual da react-joyride no DOM. */}
        {tourRodando && <TourGuiado passos={passosTour} onEncerrar={encerrarTour} />}

        <DashboardHeader
          t={t}
          prefs={prefs}
          usuario={usuario}
          onAbrirAlertas={() => setModalAlertasAberto(true)}
          alertasAtivos={contarAtivos(alertas)}
          alertasBloqueados={!temAcessoAlertas}
        />

        <AlertaPrecoModal
          visible={modalAlertasAberto}
          onClose={() => setModalAlertasAberto(false)}
          moedas={moedasCarousel}
          moedaInicial={moedasFiltro[0] || moedaSelecionada}
          alertas={alertas}
          carregando={carregandoAlertas}
          erro={erroAlertas}
          onCriar={criarAlerta}
          onExcluir={excluirAlerta}
          notificacoesLigadas={!!prefs?.notificacoes}
        />

        <div data-tour="dash-patrimonio">
          <PatrimonioCard token={token} user={usuario} />
        </div>

        {/* Os hooks guardam a chave; a tradução acontece aqui, que é onde o `t`
            existe. O de dados vem com valores para interpolar. */}
        <ErrorMessage
          message={erro ? t(erro.chave, erro.valores) : ''}
          onClose={() => setErro('')}
        />
        <ErrorMessage message={t(erroMoedas)} onClose={() => setErroMoedas('')} />

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
          locale={idioma.intl}
          multiMoeda={chartConfig.multiMoeda}
          normalizacao={normalizacao}
          setNormalizacao={setNormalizacao}
          modoPreco={modoPreco}
          setModoPreco={setModoPreco}
          painelSecundario={painelSecundario}
          setPainelSecundario={setPainelSecundario}
          temVelas={chartConfig.velas.length > 0}
          modoVela={chartConfig.modoVela}
          expandedChart={expandedChart}
          setExpandedChart={setExpandedChart}
          dadosNegociados={chartConfig.dadosGraficoPreco}
          dadosVariacao={chartConfig.dadosGraficoVariacao}
          dadosVolume={chartConfig.dadosGraficoVolume}
          opcoesPreco={chartConfig.opcoesPreco}
          opcoesVariacao={chartConfig.opcoesVariacao}
          opcoesVolume={chartConfig.opcoesVolume}
          ultimoNegociado={ultimoNegociado}
          ultimaVariacao={ultimaVariacao}
          volumeAtual={chartConfig.volumeAtual}
          cobertura={cobertura}
          trendAtual={trendAtual}
          t={t}
        />
        </div>

        <PeriodStatsPanel desempenho={analytics?.desempenho} t={t} />

        <AnalyticsPanel analytics={analytics} t={t} />

        <CoinComparisonPanel comparativo={comparativo} t={t} />

        <CorrelationMatrix correlacao={chartConfig.correlacao} t={t} />

        <SignalLabPanel
          analise={analiseSinais}
          horizonte={horizonteSinal}
          setHorizonte={setHorizonteSinal}
          t={t}
        />

        {siglaSimulacao && (
          <div data-tour="dash-simulacao">
          <SimulationPanel {...simulacaoEstrategia} t={t} locale={idioma.intl} />
          </div>
        )}

        {moedasFiltro.length === 1 && trendAtual && (
          <IntelligencePanel trendAtual={trendAtual} t={t} />
        )}

        <div data-tour="dash-historico">
          <HistoryTable
            historicoFiltrado={historicoFiltrado}
            moedasFiltro={moedasFiltro}
            limitesPorMoeda={limitesPorMoeda}
            totalPaginas={totalPaginas}
            pagina={pagina}
            setPagina={setPagina}
            t={t}
            locale={idioma.intl}
          />
        </div>
      </div>
  )
}
