import { useState, useEffect, useMemo, useRef } from 'react'
import { apiRequest, MarketEndpoint, VariavelExternaEndpoint } from '../utils/apiClient'
import { toUTCISO } from '../utils/dateUtils'
import { useDashboard } from '../context/DashboardContext'

// Quantos dias de candles são buscados antes do período escolhido, só para
// aquecer os indicadores de janela móvel. Três dias cobrem 72 candles na
// cadência horária do backend — folga sobre os 20 que Bollinger exige.
const DIAS_DE_AQUECIMENTO = 3

// Esta é a série de ANÁLISE, e ela é sempre a primeira página. Não é uma escolha
// de conveniência: quem consome daqui — gráficos, laboratório de sinais, matriz
// de correlação, `cobertura` — precisa olhar sempre o MESMO trecho do período
// escolhido. Enquanto `pagina` era estado global e entrava aqui, clicar na
// página 2 da tabela de histórico trocava a série dos três painéis e recalculava
// o aviso de corte, sem nenhuma relação aparente para quem estava navegando.
//
// A tabela pagina por conta própria, em `useHistoryPage`. São dois trabalhos
// diferentes — analisar quer a janela estável, navegar quer uma página de cada
// vez — e estavam numa requisição só.
//
// O valor vai explícito, e não omitido: o parâmetro é obrigatório do lado da
// API, que responde 400 para `Pagina < 1`.
const PAGINA_DA_ANALISE = 1

export default function useDashboardData({
  token,
  moedasCarousel,
  moedasFiltro,
  dataInicio,
  dataFim,
  intervalo,
  quantidade
}) {
  const { refreshTrigger } = useDashboard()
  const [historicosPorMoeda, setHistoricosPorMoeda] = useState({})
  const [fearGreedPorMoeda, setFearGreedPorMoeda] = useState({})
  const [trendPorMoeda, setTrendPorMoeda] = useState({})
  const [loadingSentiment, setLoadingSentiment] = useState(false)

  // Quanto do período pedido realmente chegou. `quantidade` é um teto sobre a
  // janela, então pedir 12 dias de candles horários (278) e receber 100 é o
  // comportamento normal da API — o que não pode é a tela omitir o corte.
  const [cobertura, setCobertura] = useState(null)
  const [erro, setErro] = useState('')

  const filterSummaryRef = useRef('')

  // Limpa erro automaticamente após 10 segundos
  useEffect(() => {
    if (erro) {
      const timer = setTimeout(() => {
        setErro('')
      }, 10000)
      return () => clearTimeout(timer)
    }
  }, [erro])

  // `moedasCarousel` troca de referência a cada atualização de preços; usá-lo
  // direto como dependência refazia todas as consultas do dashboard. O mapa
  // sigla->id é memoizado pelo conteúdo (pares sigla:id), que só muda de fato
  // quando a lista de moedas muda.
  const chaveMapaMoedas = (moedasCarousel ?? [])
    .map((m) => `${m.simbolo}:${m.id}`)
    .join('|')
  const siglaParaIdMap = useMemo(() => {
    const map = new Map()
    moedasCarousel?.forEach((m) => {
      const sig = (m.simbolo || '').toLowerCase()
      if (sig && m.id) map.set(sig, m.id)
    })
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveMapaMoedas])

  useEffect(() => {
    let controller = new AbortController()

    const carregarDashboardData = async () => {
      if (!token) return

      setErro('')
      const signal = controller.signal

      setLoadingSentiment(true)

      const commonParams = new URLSearchParams()
      // Pede alguns dias ANTES do período escolhido. Indicadores de janela
      // móvel — Bollinger de 20, RSI de 14 — precisam de candles anteriores ao
      // primeiro ponto desenhado, senão a banda só começa no meio do gráfico.
      //
      // Estes candles extras não aparecem em lugar nenhum: tanto o gráfico
      // (useDashboardCharts) quanto a tabela (Dashboard) refiltram por data no
      // front. Servem só para o indicador chegar aquecido.
      if (dataInicio) {
        const inicio = new Date(dataInicio.includes('T') ? dataInicio : `${dataInicio}T00:00:00`)
        inicio.setDate(inicio.getDate() - DIAS_DE_AQUECIMENTO)
        commonParams.append('dataInicio', toUTCISO(inicio))
      }
      if (dataFim) commonParams.append('dataFim', dataFim.includes('T') ? dataFim : toUTCISO(new Date(`${dataFim}T23:59:59`)))
      // `intervalo` NÃO vai na query. A assinatura de ObterValorMoeda no
      // backend não tem esse parâmetro, então o ASP.NET o descartava em
      // silêncio — parâmetro morto sugerindo um contrato que não existe.
      //
      // Ele nunca foi para o servidor de verdade: serve só para o
      // DashboardContext calcular dataInicio e dataFim, que são o que a API
      // realmente lê.
      commonParams.append('pagina', PAGINA_DA_ANALISE)
      if (quantidade) commonParams.append('quantidade', quantidade)
      commonParams.append('ordemAsc', 'false')
      const queryString = commonParams.toString() ? `?${commonParams.toString()}` : ''

      const currentFilterKey = `${intervalo}-${dataInicio}-${dataFim}-${quantidade}`
      const isSameFilter = filterSummaryRef.current === currentFilterKey
      filterSummaryRef.current = currentFilterKey

      if (!isSameFilter) {
        setHistoricosPorMoeda({})
      }

      const promessasMoedas = moedasFiltro.map(async (sigla) => {
        if (!sigla || sigla === 'Ativo') return null

        const idMoeda = siglaParaIdMap.get(sigla.toLowerCase())
        const urlPreco = `${MarketEndpoint.COIN_VALUE(sigla.toLowerCase())}${queryString}`

        const pPreco = apiRequest(urlPreco, { signal })

        // Sentimento é complementar: se a API falhar, os painéis ficam vazios
        // em vez de exibir dados inventados como se fossem reais.
        const pFear = idMoeda
          ? apiRequest(`${VariavelExternaEndpoint.FEAR_GREED}${queryString}${queryString ? '&' : '?'}idMoeda=${idMoeda}`, { signal }).catch(() => null)
          : Promise.resolve(null)

        const pTrend = idMoeda
          ? apiRequest(`${VariavelExternaEndpoint.TREND}${queryString}${queryString ? '&' : '?'}idMoeda=${idMoeda}`, { signal }).catch(() => null)
          : Promise.resolve(null)

        try {
          const [resPreco, resFear, resTrend] = await Promise.all([pPreco, pFear, pTrend])

          return {
            sigla,
            preco: resPreco?.resultado ?? resPreco,
            fear: resFear?.resultado ?? resFear,
            trend: resTrend?.resultado ?? resTrend
          }
        } catch (err) {
          if (err.name === 'AbortError') return null
          console.error(`Erro ao carregar dados para ${sigla}:`, err)
          return { sigla, error: true }
        }
      })

      const resultados = await Promise.all(promessasMoedas)

      // O guard fica ANTES de consumir os resultados, não depois. Num abort
      // parcial — troca de filtro com várias moedas, algumas requisições já
      // respondidas e outras canceladas — o laço abaixo chega a chamar
      // setHistoricoMoeda/setTotalPaginas com o dado da consulta velha, e só o
      // resto do estado ficava barrado. A tabela e a paginação mostravam o
      // filtro anterior enquanto os gráficos já mostravam o novo.
      if (signal.aborted) return

      const novoHistoricoPreco = {}
      const novoFearGreed = {}
      const novoTrend = {}
      const moedasComErro = []

      // O corte é detectado pelo candle mais antigo que voltou, não por
      // totalRegistros: com a margem de aquecimento aquele total passou a
      // incluir candles anteriores ao período escolhido. Se o mais antigo
      // dentro da janela ainda é posterior ao início pedido, houve corte.
      const inicioPedido = dataInicio
        ? new Date(dataInicio.includes('T') ? dataInicio : `${dataInicio}T00:00:00`).getTime()
        : null

      const instanteDe = (r) =>
        new Date(r?.horaReferencia ?? r?.HoraReferencia ?? r?.dataHora ?? r?.DataHora).getTime()

      let recebidos = 0
      let maisAntigoNaJanela = null

      resultados.forEach(res => {
        if (!res) return
        if (res.error) {
          moedasComErro.push(res.sigla)
          return
        }
        const { sigla, preco, fear, trend } = res

        const regsPreco = preco?.registros ?? (Array.isArray(preco) ? preco : [])
        const regsFear = fear?.registros ?? (Array.isArray(fear) ? fear : [])
        const regsTrend = trend?.registros ?? (Array.isArray(trend) ? trend : [])

        // Só os candles do período escolhido contam; os de aquecimento não são
        // exibidos e não devem aparecer na conta.
        const naJanela = inicioPedido === null
          ? regsPreco
          : regsPreco.filter((r) => instanteDe(r) >= inicioPedido)

        if (naJanela.length > recebidos) {
          recebidos = naJanela.length
          // A API entrega do mais recente ao mais antigo.
          const ultimo = naJanela[naJanela.length - 1]
          maisAntigoNaJanela = ultimo
            ? (ultimo.horaReferencia ?? ultimo.HoraReferencia ?? ultimo.dataHora ?? ultimo.DataHora)
            : null
        }

        novoHistoricoPreco[sigla] = regsPreco
        novoFearGreed[sigla] = regsFear
        novoTrend[sigla] = regsTrend
      })

      if (moedasComErro.length > 0) {
        setErro(`Não foi possível carregar os dados de: ${moedasComErro.join(', ')}`)
      }

      // Uma hora de tolerância: o candle mais antigo raramente cai exatamente
      // na meia-noite do início pedido, e um desencontro de cadência não é
      // corte.
      const TOLERANCIA_MS = 60 * 60 * 1000
      const truncado =
        inicioPedido !== null &&
        maisAntigoNaJanela !== null &&
        new Date(maisAntigoNaJanela).getTime() - inicioPedido > TOLERANCIA_MS

      setCobertura(
        recebidos > 0
          ? { recebidos, truncado, desde: maisAntigoNaJanela }
          : null
      )

      setHistoricosPorMoeda(novoHistoricoPreco)
      setFearGreedPorMoeda(novoFearGreed)
      setTrendPorMoeda(novoTrend)
      setLoadingSentiment(false)
    }

    carregarDashboardData()

    return () => {
      controller.abort()
    }
  }, [moedasFiltro, dataInicio, dataFim, quantidade, intervalo, token, siglaParaIdMap, refreshTrigger])

  return {
    historicosPorMoeda,
    fearGreedPorMoeda,
    trendPorMoeda,
    loadingSentiment,
    cobertura,
    erro,
    setErro
  }
}
