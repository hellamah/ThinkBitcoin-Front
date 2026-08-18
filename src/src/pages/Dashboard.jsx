import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
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
import Box from '@mui/material/Box'
import useMediaQuery from '@mui/material/useMediaQuery'
import { Joyride, STATUS } from 'react-joyride'

import { useAuth } from '../context/AuthContext'
import { useDashboard } from '../context/DashboardContext'
import useTranslation from '../hooks/useTranslation'
import useCoinPrices from '../hooks/useCoinPrices'
import useDashboardData from '../hooks/useDashboardData'
import useDashboardCharts from '../hooks/useDashboardCharts'
import useSimulationData from '../hooks/useSimulationData'
import useHistoryPage from '../hooks/useHistoryPage'
import useMarketAnalytics from '../hooks/useMarketAnalytics'
import * as mathUtils from '../utils/mathUtils'
import { calcularLimites } from '../utils/marketStats'
import { compararMoedas } from '../utils/marketAnalytics'
import { analisarSinais, montarSerieDeSinais } from '../utils/signalLab'
import { simular, dividirParaValidacao, compararEstrategias, CUSTO_PADRAO_PERCENTUAL } from '../utils/backtest'
import { getTourVisto, setTourVisto } from '../utils/preferences'
import { candlestickPlugin } from '../utils/candlestickChart'
import { Normalization, PriceChartMode, SecondaryChart, StopMode, TradeDirection } from '../utils/enums'

// Sub-componentes Refatorados
import DashboardHeader from '../components/dashboard/DashboardHeader'
import PatrimonioCard from '../components/dashboard/PatrimonioCard'
import CoinCarousel from '../components/dashboard/CoinCarousel'
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

ChartJS.defaults.color = '#e0e0e0'
ChartJS.defaults.borderColor = '#333'

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
    setMoedaSelecionada
  } = useDashboard()

  const [moedasFiltro, setMoedasFiltro] = useState([]) 

  // Estados Visuais Locais
  const [normalizacao, setNormalizacao] = useState(Normalization.BASE_100)
  const [modoPreco, setModoPreco] = useState(PriceChartMode.LINE)
  const [painelSecundario, setPainelSecundario] = useState(SecondaryChart.VARIATION)
  const [horizonteSinal, setHorizonteSinal] = useState(1)
  const [expandedChart, setExpandedChart] = useState(null)

  // Parâmetros da simulação. Ficam aqui, e não no DashboardContext, porque não
  // são filtro: nenhum outro painel os consulta e nenhuma requisição depende
  // deles. Levá-los ao contexto global faria toda a tela reagir a um ajuste que
  // só interessa a um painel.
  const [paramsSimulacao, setParamsSimulacao] = useState({
    direcao: TradeDirection.COMPRA,
    saidaPorTempo: 5,
    modoStop: StopMode.PERCENTUAL,
    stopPercentual: null,
    alvoPercentual: null,
    custoPercentual: CUSTO_PADRAO_PERCENTUAL,
    sinalEntrada: null,
  })

  const alterarParamSimulacao = useCallback((nome, valor) => {
    setParamsSimulacao((atual) => ({ ...atual, [nome]: valor }))
  }, [])

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
          title: t('dashboardTour.passo5Titulo') || 'Simulação de Estratégia',
          content: t('dashboardTour.passo5Descricao') || 'Teste uma regra de entrada e veja o que ela teria rendido.',
        }]
      : []),
    {
      target: '[data-tour="dash-historico"]',
      title: t('dashboardTour.passo6Titulo') || 'Histórico',
      content: t('dashboardTour.passo6Descricao') || 'Veja o histórico de operações filtrado.',
    },
  ], [t, moedasFiltro.length])

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
  // de capital não descreve carteira nenhuma.
  //
  // A série NÃO é a do dashboard. Ela é buscada à parte, numa janela de 180
  // dias, porque a do dashboard é curta demais para a amostra fechar e é a
  // resposta paginada — que a tabela de histórico troca por baixo de todos os
  // painéis. Ver utils/simulationWindow.js.
  const siglaSimulacao = moedasFiltro.length === 1 ? moedasFiltro[0] : null

  const {
    registros: serieSimulacao,
    aPartirDe: inicioSimulacao,
    carregando: carregandoSimulacao,
    erro: erroSimulacao,
  } = useSimulationData({ token, sigla: siglaSimulacao })

  // A série de sinais é montada UMA vez por série de candles, e todo o resto do
  // painel a recebe pronta. Antes ela era remontada cinco vezes a cada troca de
  // parâmetro — pelo seletor, pela simulação, pelas duas pontas do holdout e
  // pelo ranking — sobre exatamente os mesmos candles. Medido em 4.392 candles:
  // ~15 ms cada, ~77 ms de trabalho idêntico por clique.
  //
  // Como só depende da série, ela sobrevive a qualquer ajuste de parâmetro.
  const serieDeSinaisSimulacao = useMemo(
    () => (serieSimulacao?.length ? montarSerieDeSinais(serieSimulacao) : null),
    [serieSimulacao]
  )

  // O seletor oferece os sinais presentes na SÉRIE DA SIMULAÇÃO, não na do
  // laboratório: são janelas diferentes, e um sinal que existe em 180 dias pode
  // não existir nos 7 que o laboratório analisa. Oferecer o vocabulário inteiro
  // faria o usuário escolher "marubozu", receber "nenhuma operação" e não ter
  // como saber se a estratégia é ruim ou se o sinal simplesmente não ocorreu.
  const sinaisDisponiveis = useMemo(() => {
    if (!serieDeSinaisSimulacao) return []
    const presentes = new Set()
    serieDeSinaisSimulacao.forEach(({ sinais }) => sinais.forEach((s) => presentes.add(s)))
    // Ordenado pelo RÓTULO traduzido, não pela chave. Pela chave, `marubozu`
    // vinha antes de `martelo` numa lista que exibe "Martelo" antes de
    // "Marubozu"; em inglês é pior, porque a chave `estrela` cai no meio das de
    // "d" enquanto o rótulo é "Shooting Star". `localeCompare` no idioma
    // corrente, que é quem sabe onde o acento entra na ordem.
    //
    // Não é só cosmético: quando a escolha do usuário deixa de existir na
    // janela, o painel cai no PRIMEIRO da lista. Ordenando pelo rótulo, esse
    // primeiro passa a ser o que ele vê no topo do seletor.
    return [...presentes].sort((a, b) =>
      t(`signal_${a}`).localeCompare(t(`signal_${b}`), idioma.intl)
    )
  }, [serieDeSinaisSimulacao, t, idioma])

  // A escolha do usuário pode deixar de existir ao trocar de moeda ou período.
  // Cair no primeiro disponível mantém o painel útil em vez de vazio.
  const sinalEntrada = sinaisDisponiveis.includes(paramsSimulacao.sinalEntrada)
    ? paramsSimulacao.sinalEntrada
    : sinaisDisponiveis[0] ?? null

  // O corte de validação não depende de parâmetro nenhum: é função da série e da
  // janela. Fica à parte para o holdout e o ranking usarem o MESMO corte, em vez
  // de cada um recortar o seu — e para a série de sinais do trecho de ajuste,
  // que é outro array e portanto precisa da sua, ser montada uma vez só.
  const corteSimulacao = useMemo(() => {
    if (!serieSimulacao) return null
    const corte = dividirParaValidacao(serieSimulacao, undefined, {
      aPartirDe: inicioSimulacao,
    })
    if (!corte) return null
    return { ...corte, serieDeSinaisAjuste: montarSerieDeSinais(corte.registrosAjuste) }
  }, [serieSimulacao, inicioSimulacao])

  // Os parâmetros de SAÍDA, sem o sinal de entrada. O ranking roda a mesma regra
  // de saída sobre todos os sinais, então ele não depende de qual está
  // selecionado — e memoizá-lo sobre o objeto inteiro fazia clicar num nome da
  // tabela, que é o que o próprio rodapé convida a fazer, recalcular catorze
  // estratégias para produzir a tabela idêntica.
  const {
    direcao: direcaoSimulacao,
    saidaPorTempo,
    modoStop,
    stopPercentual,
    alvoPercentual,
    custoPercentual,
  } = paramsSimulacao

  // `aPartirDe` vem da janela da simulação, não do filtro do dashboard: é o que
  // separa os candles de aquecimento do período que de fato vira operação.
  const opcoesSaidaSimulacao = useMemo(
    () => ({
      direcao: direcaoSimulacao,
      saidaPorTempo,
      modoStop,
      stopPercentual,
      alvoPercentual,
      custoPercentual,
      aPartirDe: inicioSimulacao,
    }),
    [
      direcaoSimulacao,
      saidaPorTempo,
      modoStop,
      stopPercentual,
      alvoPercentual,
      custoPercentual,
      inicioSimulacao,
    ]
  )

  const opcoesSimulacao = useMemo(
    () => ({ ...opcoesSaidaSimulacao, sinalEntrada }),
    [opcoesSaidaSimulacao, sinalEntrada]
  )

  const simulacao = useMemo(
    () =>
      serieSimulacao && sinalEntrada
        ? simular(serieSimulacao, {
            ...opcoesSimulacao,
            serieDeSinais: serieDeSinaisSimulacao,
          })
        : null,
    [serieSimulacao, sinalEntrada, opcoesSimulacao, serieDeSinaisSimulacao]
  )

  // Corte de validação: o usuário ajusta os parâmetros olhando o trecho de
  // ajuste, e a coluna de validação mostra como aquilo se sai no pedaço que ele
  // não usou para escolher. Sem isso, testar dez combinações e ficar com a
  // melhor é sobreajuste com aparência de método.
  const holdout = useMemo(() => {
    if (!corteSimulacao || !sinalEntrada) return null

    return {
      ajuste: simular(corteSimulacao.registrosAjuste, {
        ...opcoesSimulacao,
        serieDeSinais: corteSimulacao.serieDeSinaisAjuste,
      }),
      // A validação recebe a série inteira e só abre posição depois do corte:
      // assim os indicadores de janela móvel chegam aquecidos ao primeiro
      // candle validado. Sendo a série inteira, a série de sinais dela serve.
      validacao: simular(corteSimulacao.registrosValidacao, {
        ...opcoesSimulacao,
        aPartirDe: corteSimulacao.aPartirDeValidacao,
        serieDeSinais: serieDeSinaisSimulacao,
      }),
    }
  }, [corteSimulacao, sinalEntrada, opcoesSimulacao, serieDeSinaisSimulacao])

  // Ranking de todas as estratégias sobre a MESMA série e os mesmos parâmetros
  // de saída. Responde a pergunta que o painel de uma estratégia só não
  // responde: entre os sinais disponíveis, qual sobrou melhor que não fazer
  // nada.
  const comparativoEstrategias = useMemo(() => {
    if (!serieSimulacao) return null
    return compararEstrategias(serieSimulacao, {
      ...opcoesSaidaSimulacao,
      serieDeSinais: serieDeSinaisSimulacao,
      serieDeSinaisAjuste: corteSimulacao?.serieDeSinaisAjuste ?? null,
    })
  }, [serieSimulacao, opcoesSaidaSimulacao, serieDeSinaisSimulacao, corteSimulacao])

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
    t
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
          <SimulationPanel
            resultado={simulacao}
            ajuste={holdout?.ajuste ?? null}
            validacao={holdout?.validacao ?? null}
            parametros={{ ...paramsSimulacao, sinalEntrada }}
            onParametro={alterarParamSimulacao}
            sinaisDisponiveis={sinaisDisponiveis}
            comparativo={comparativoEstrategias}
            carregando={carregandoSimulacao}
            erro={erroSimulacao}
            t={t}
          />
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
          />
        </div>
      </div>
  )
}
