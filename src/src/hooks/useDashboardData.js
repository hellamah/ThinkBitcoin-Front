import { useState, useEffect, useMemo, useRef } from 'react'
import { apiRequest, MarketEndpoint, VariavelExternaEndpoint } from '../utils/apiClient'
import { toUTCISO } from '../utils/dateUtils'
import { useDashboard } from '../context/DashboardContext'

export default function useDashboardData({
  token,
  moedasCarousel,
  moedasFiltro,
  dataInicio,
  dataFim,
  intervalo,
  pagina,
  quantidade
}) {
  const { refreshTrigger } = useDashboard()
  const [historicosPorMoeda, setHistoricosPorMoeda] = useState({})
  const [fearGreedPorMoeda, setFearGreedPorMoeda] = useState({})
  const [trendPorMoeda, setTrendPorMoeda] = useState({})
  const [loadingSentiment, setLoadingSentiment] = useState(false)
  const [totalPaginas, setTotalPaginas] = useState(1)
  const [historicoMoeda, setHistoricoMoeda] = useState(null)
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
      if (dataInicio) commonParams.append('dataInicio', dataInicio.includes('T') ? dataInicio : toUTCISO(new Date(`${dataInicio}T00:00:00`)))
      if (dataFim) commonParams.append('dataFim', dataFim.includes('T') ? dataFim : toUTCISO(new Date(`${dataFim}T23:59:59`)))
      if (intervalo) commonParams.append('intervalo', intervalo)
      if (pagina) commonParams.append('pagina', pagina)
      if (quantidade) commonParams.append('quantidade', quantidade)
      commonParams.append('ordemAsc', 'false')
      const queryString = commonParams.toString() ? `?${commonParams.toString()}` : ''

      const currentFilterKey = `${intervalo}-${dataInicio}-${dataFim}-${pagina}-${quantidade}`
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

      const novoHistoricoPreco = {}
      const novoFearGreed = {}
      const novoTrend = {}
      const moedasComErro = []

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

        novoHistoricoPreco[sigla] = regsPreco
        novoFearGreed[sigla] = regsFear
        novoTrend[sigla] = regsTrend

        if (sigla === moedasFiltro[0]) {
          const paginasTotal = preco?.totalPaginas ?? 1
          setTotalPaginas(paginasTotal)
          setHistoricoMoeda({ registros: regsPreco, totalPaginas: paginasTotal })
        }
      })

      if (signal.aborted) return

      if (moedasComErro.length > 0) {
        setErro(`Não foi possível carregar os dados de: ${moedasComErro.join(', ')}`)
      }

      setHistoricosPorMoeda(novoHistoricoPreco)
      setFearGreedPorMoeda(novoFearGreed)
      setTrendPorMoeda(novoTrend)
      setLoadingSentiment(false)
    }

    carregarDashboardData()

    return () => {
      controller.abort()
    }
  }, [moedasFiltro, dataInicio, dataFim, pagina, quantidade, intervalo, token, siglaParaIdMap, refreshTrigger])

  return {
    historicosPorMoeda,
    fearGreedPorMoeda,
    trendPorMoeda,
    loadingSentiment,
    totalPaginas,
    historicoMoeda,
    erro,
    setErro
  }
}
