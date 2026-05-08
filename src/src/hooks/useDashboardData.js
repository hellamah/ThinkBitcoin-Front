import { useState, useEffect, useRef } from 'react'
import { apiRequest, MarketEndpoint, VariavelExternaEndpoint } from '../utils/apiClient'
import { toUTCISO } from '../utils/dateUtils'

const MOCK_DADOS = [
  { dataHora: new Date().toISOString(), valorNegociado: 1000, variacaoPercentual: 0.1 },
  { dataHora: new Date(Date.now() - 3600 * 1000).toISOString(), valorNegociado: 1200, variacaoPercentual: 0.15 },
  { dataHora: new Date(Date.now() - 2 * 3600 * 1000).toISOString(), valorNegociado: 900, variacaoPercentual: -0.05 },
  { dataHora: new Date(Date.now() - 3 * 3600 * 1000).toISOString(), valorNegociado: 950, variacaoPercentual: 0.02 },
]

export default function useDashboardData({
  token,
  moedasCarousel,
  moedasFiltro,
  dataInicio,
  dataFim,
  intervalo,
  pagina,
  quantidade,
  resultadoFiltro
}) {
  const [historicosPorMoeda, setHistoricosPorMoeda] = useState({})
  const [fearGreedPorMoeda, setFearGreedPorMoeda] = useState({})
  const [trendPorMoeda, setTrendPorMoeda] = useState({})
  const [loadingSentiment, setLoadingSentiment] = useState(false)
  const [totalPaginas, setTotalPaginas] = useState(1)
  const [historicoMoeda, setHistoricoMoeda] = useState(null)
  const [dados, setDados] = useState([])
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

  useEffect(() => {
    let controller = new AbortController()

    const carregarDashboardData = async () => {
      if (!token) {
        setDados(MOCK_DADOS)
        return
      }

      setErro('')
      const signal = controller.signal

      setDados(MOCK_DADOS)
      setLoadingSentiment(true)

      const commonParams = new URLSearchParams()
      if (dataInicio) commonParams.append('dataInicio', dataInicio.includes('T') ? dataInicio : toUTCISO(new Date(`${dataInicio}T00:00:00`)))
      if (dataFim) commonParams.append('dataFim', dataFim.includes('T') ? dataFim : toUTCISO(new Date(`${dataFim}T23:59:59`)))
      if (intervalo) commonParams.append('intervalo', intervalo)
      if (pagina) commonParams.append('pagina', pagina)
      if (quantidade) commonParams.append('quantidade', quantidade)
      commonParams.append('ordemAsc', 'false')
      const queryString = commonParams.toString() ? `?${commonParams.toString()}` : ''

      const siglaParaIdMap = new Map()
      moedasCarousel?.forEach(m => {
        const sig = (m.simbolo || '').toLowerCase()
        const id = m.id
        if (sig && id) siglaParaIdMap.set(sig, id)
      })

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

        const pPreco = apiRequest(urlPreco, { headers: { Authorization: `Bearer ${token}` }, signal })
        
        const gerarHistoricoMock = (tipo, qtd) => {
          const mockRegs = []
          const now = new Date()
          const step = intervalo === '1m' ? 60000 : 3600000 
          for (let i = 0; i < qtd; i++) {
            const dataRef = new Date(now.getTime() - i * step).toISOString()
            if (tipo === 'fear') {
              mockRegs.push({
                valor: 40 + Math.floor(Math.random() * 40),
                classificacao: 'Neutral',
                horaReferencia: dataRef
              })
            } else {
              mockRegs.push({
                valorAtual: 100 + Math.floor(Math.random() * 50),
                mA5: 120, mA15: 121, delta5: 10, delta15: 20,
                volatilidade15: 30, minutosDesdePico: 60, rankNoMinuto: 5, geoTop1Code: 'CH',
                horaReferencia: dataRef
              })
            }
          }
          return { resultado: { registros: mockRegs } }
        }

        const pFear = idMoeda
          ? apiRequest(`${VariavelExternaEndpoint.FEAR_GREED}${queryString}${queryString ? '&' : '?'}idMoeda=${idMoeda}`, { headers: { Authorization: `Bearer ${token}` }, signal }).catch(() => 
              gerarHistoricoMock('fear', quantidade || 20)
            )
          : Promise.resolve(null)
          
        const pTrend = idMoeda
          ? apiRequest(`${VariavelExternaEndpoint.TREND}${queryString}${queryString ? '&' : '?'}idMoeda=${idMoeda}`, { headers: { Authorization: `Bearer ${token}` }, signal }).catch(() => 
              gerarHistoricoMock('trend', quantidade || 20)
            )
          : Promise.resolve(null)

        try {
          const [resPreco, resFear, resTrend] = await Promise.all([pPreco, pFear, pTrend])

          return {
            sigla,
            preco: resPreco?.resultado ?? resPreco?.Resultado ?? resPreco,
            fear: resFear?.resultado ?? resFear?.Resultado ?? resFear,
            trend: resTrend?.resultado ?? resTrend?.Resultado ?? resTrend
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

      resultados.forEach(res => {
        if (!res || res.error) return
        const { sigla, preco, fear, trend } = res

        const regsPreco = preco?.registros ?? preco?.Registros ?? (Array.isArray(preco) ? preco : [])
        const regsFear = fear?.registros ?? fear?.Registros ?? (Array.isArray(fear) ? fear : [])
        const regsTrend = trend?.registros ?? trend?.Registros ?? (Array.isArray(trend) ? trend : [])

        novoHistoricoPreco[sigla] = regsPreco
        novoFearGreed[sigla] = regsFear
        novoTrend[sigla] = regsTrend

        if (sigla === moedasFiltro[0]) {
          const paginasTotal = preco?.totalPaginas ?? preco?.TotalPaginas ?? 1
          setTotalPaginas(paginasTotal)
          setHistoricoMoeda({ registros: regsPreco, totalPaginas: paginasTotal })
        }
      })

      setHistoricosPorMoeda(novoHistoricoPreco)
      setFearGreedPorMoeda(novoFearGreed)
      setTrendPorMoeda(novoTrend)
      setLoadingSentiment(false)
    }

    carregarDashboardData()

    return () => {
      controller.abort()
    }
  }, [moedasFiltro, dataInicio, dataFim, resultadoFiltro, pagina, quantidade, intervalo, token, moedasCarousel])

  return {
    historicosPorMoeda,
    fearGreedPorMoeda,
    trendPorMoeda,
    loadingSentiment,
    totalPaginas,
    historicoMoeda,
    dados,
    erro,
    setErro
  }
}
