import { useEffect, useState, useRef, useMemo } from 'react'
import { apiRequest, HttpMethod, MarketEndpoint } from '../utils/apiClient'
import useCoinPrices from '../hooks/useCoinPrices'
import { useAuth } from '../context/AuthContext'
import useTranslation from '../hooks/useTranslation'
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
import { Line } from 'react-chartjs-2'
import CryptoIcon from '../components/CryptoIcon'
import { MdTrendingUp, MdTrendingDown, MdRefresh, MdSmartToy, MdClose } from 'react-icons/md'
import Card from '@mui/material/Card'
import CardActionArea from '@mui/material/CardActionArea'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import Pagination from '@mui/material/Pagination'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Paper from '@mui/material/Paper'
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

const MOCK_DADOS = [
  {
    dataHora: new Date().toISOString(),
    valorNegociado: 1000,
    variacaoPercentual: 0.1,
  },
  {
    dataHora: new Date(Date.now() - 3600 * 1000).toISOString(),
    valorNegociado: 1200,
    variacaoPercentual: 0.15,
  },
  {
    dataHora: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    valorNegociado: 900,
    variacaoPercentual: -0.05,
  },
  {
    dataHora: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
    valorNegociado: 950,
    variacaoPercentual: 0.02,
  },
]

function Dashboard() {
  const { token, user: usuario, prefs } = useAuth()
  const moedasCarousel = useCoinPrices()
  const { t } = useTranslation()
  const hasInitializedPref = useRef(false)
  const [dados, setDados] = useState([])
  const [erro, setErro] = useState('')
  const [sinal, setSinal] = useState(null)
  const [intervalo, setIntervalo] = useState('1m') // Mudado para 1m como padrão para garantir visualização inicial
  
  // Filtros dinâmicos
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [moedasFiltro, setMoedasFiltro] = useState([]) // Array para seleção múltipla
  const [resultadoFiltro, setResultadoFiltro] = useState('')
  const [pagina, setPagina] = useState(1)
  const [quantidade, setQuantidade] = useState(20)
  const [totalPaginas, setTotalPaginas] = useState(1)
  const [historicoMoeda, setHistoricoMoeda] = useState(null)
  const [showMonitor, setShowMonitor] = useState(false)
  const [moedaMonitor, setMoedaMonitor] = useState(null)
  const [historicosPorMoeda, setHistoricosPorMoeda] = useState({}) // { BTC: [{valor, dataHora}, ...] }
  const [normalizacao, setNormalizacao] = useState('base100') // 'bruto' | 'minmax' | 'base100' | 'zscore'
  const filterSummaryRef = useRef('') // Cache de string dos filtros globais (intervalo+datas)

  
  // Limpa erro automaticamente após 10 segundos
  useEffect(() => {
    if (erro) {
      const timer = setTimeout(() => {
        setErro('')
      }, 10000)
      return () => clearTimeout(timer)
    }
  }, [erro])

  // Inicializa com a moeda preferida do usuário - Tentativa Ultra Resiliente
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

      if (initialized) {
          hasInitializedPref.current = true
      }
    } catch (err) {
      console.error('Erro na inicialização do Dashboard:', err)
    }
  }, [prefs, token, moedasCarousel])

  const carregarDashboardData = async (controller) => {
    if (!token) {
      setDados(MOCK_DADOS)
      return
    }

    setErro('')
    const signal = controller?.signal
    
    // 1. Busca Sequências (Gráficos) - REMOVIDO TEMPORARIAMENTE (BACKEND EM DESENVOLVIMENTO)
    setDados(MOCK_DADOS)

    // 2. Busca histórico inteligente: Cache por intervalo + Streaming
    const currentFilterKey = `${intervalo}-${dataInicio}-${dataFim}`
    const isSameFilter = filterSummaryRef.current === currentFilterKey
    filterSummaryRef.current = currentFilterKey

    // Se mudou o filtro global, limpamos APENAS os dados que existiam para começar do zero no novo intervalo
    if (!isSameFilter) {
      setHistoricosPorMoeda({})
    }

    moedasFiltro.forEach(sigla => {
      // Sincroniza tabela com a primeira da lista (mesmo se vier do cache)
      if (sigla === moedasFiltro[0] && historicosPorMoeda[sigla]) {
          setHistoricoMoeda({ registros: historicosPorMoeda[sigla] })
      }

      // Se já temos e o filtro é o mesmo, não fazemos nada (pula fetch)
      if (isSameFilter && historicosPorMoeda[sigla]) return

      if (!sigla || sigla === 'Ativo') return

      apiRequest(MarketEndpoint.COIN_VALUE(sigla.toLowerCase()), {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      })
        .then(json => {
          if (signal?.aborted) return
          const res = json?.resultado ?? json?.Resultado ?? json
          const registros = res?.registros ?? res?.Registros ?? (Array.isArray(res) ? res : [])
          
          setHistoricosPorMoeda(prev => ({ ...prev, [sigla]: registros }))
          
          // Sincroniza tabela com a primeira carregada
          if (sigla === moedasFiltro[0]) {
             setHistoricoMoeda({ registros })
          }
        })
        .catch(err => {
          if (err.name === 'AbortError') return
          setHistoricosPorMoeda(prev => ({ ...prev, [sigla]: [] }))
        })
    })

    // Limpa moedas que foram removidas do filtro mas permaneciam no cache
    setHistoricosPorMoeda(prev => {
        const novoMap = { ...prev }
        let changed = false
        Object.keys(novoMap).forEach(key => {
            if (!moedasFiltro.includes(key)) {
                delete novoMap[key]
                changed = true
            }
        })
        return changed ? novoMap : prev
    })
  }

  useEffect(() => {
    const controller = new AbortController()
    carregarDashboardData(controller)
    return () => controller.abort()
  }, [token, pagina, quantidade, moedasFiltro, dataInicio, dataFim, resultadoFiltro, intervalo])

  const selecionarMoeda = (simbolo) => {
    setMoedasFiltro(prev => {
      const isSelected = prev.includes(simbolo)
      if (isSelected) {
        return prev.filter(s => s !== simbolo)
      } else {
        return [...prev, simbolo]
      }
    })
    setPagina(1)
  }

  const handleDebateTrigger = async (sigla) => {
    if (!token) return

    setMoedaMonitor(sigla)
    setShowMonitor(true)

    try {
      const idUsuarioTB = prefs?.idPreferenciasUsuarioTB || '3fa85f64-5717-4562-b3fc-2c963f66afa6'

      await apiRequest(MarketEndpoint.DEBATE, {
        method: HttpMethod.POST,
        headers: { Authorization: `Bearer ${token}` },
        body: {
          siglaMoeda: sigla,
          idUsuarioTB,
          quantidadeRegistros: 0,
        },
      })
      console.log(`Debate solicitado para ${sigla} via RabbitMQ`)
    } catch (err) {
      console.error('Erro ao iniciar debate:', err)
      setErro(t('errorTriggeringDebate') || 'Erro ao iniciar debate com a IA')
    }
  }

  const filtrarIntervalo = (lista) => {
    if (!lista || !Array.isArray(lista) || lista.length === 0) return []
    const agora = Date.now()
    const map = { '24h': 86400000, '7d': 604800000, '1m': 2592000000 }
    const limite = map[intervalo] || 2592000000
    
    const filtrados = lista.filter((d) => {
      const dHora = d.dataHora || d.DataHora
      if (!dHora) return false
      return new Date(dHora).getTime() >= agora - limite
    })

    // Se o filtro temporal esvaziou a lista, mostra tudo que tiver disponível 
    // para não deixar a tela "quebrada" ou vazia sem contexto
    return filtrados.length > 0 ? filtrados : lista
  }

  // Carregamento de sinal via Script Common removido até nova definição do backend

  const dadosFiltrados = filtrarIntervalo(dados)
  const moedasUnicas = [...new Set(dadosFiltrados.map(d => d.siglaMoeda || d.SiglaMoeda || 'Ativo'))]


  // --- MEMOIZAÇÃO DOS DADOS DO GRÁFICO (Performance Máxima) ---
  const { dadosGraficoPreco, dadosGraficoVariacao, multiMoeda } = useMemo(() => {
    const CORES_SIMPLE = ['#FFD700', '#2196f3', '#4caf50', '#e91e63', '#9c27b0', '#ff9800', '#00bcd4']
    
    // 1. Timestamps comuns
    const allTimestampsSet = new Set()
    try {
        Object.values(historicosPorMoeda || {}).forEach(lista => {
            if (Array.isArray(lista)) {
                lista.forEach(r => {
                    if (r) {
                        const dh = r.dataHora ?? r.DataHora
                        if (dh) allTimestampsSet.add(dh)
                    }
                })
            }
        })
    } catch (err) {
        console.error('Erro ao processar timestamps:', err)
    }
    const timestampsUnicos = Array.from(allTimestampsSet).sort()
    const labels = timestampsUnicos.map(t => 
      new Date(t).toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
    )

    const moedasOrdenadas = Object.keys(historicosPorMoeda).filter(sig => historicosPorMoeda[sig]?.length > 0)
    const multi = moedasOrdenadas.length > 1

    const datasetsPreco = moedasOrdenadas.map((sigla, idx) => {
      const cor = CORES_SIMPLE[idx % CORES_SIMPLE.length]
      const priceMap = new Map()
      const historico = historicosPorMoeda[sigla] || []
      historico.forEach(r => {
          if (!r) return
          const val = r.valor ?? r.Valor ?? r.valorNegociado ?? r.ValorNegociado ?? 0
          const dh = r.dataHora ?? r.DataHora
          if (dh) priceMap.set(dh, val)
      })
      return {
        label: sigla,
        data: timestampsUnicos.map(ts => priceMap.get(ts) ?? null),
        borderColor: cor,
        backgroundColor: `${cor}18`,
        tension: 0.3,
        fill: !multi && idx === 0,
        pointRadius: multi ? 0 : 3,
        borderWidth: 2,
        spanGaps: true,
      }
    })

    const datasetsVariacao = moedasOrdenadas.map((sigla, idx) => {
      const cor = CORES_SIMPLE[idx % CORES_SIMPLE.length]
      const varMap = new Map()
      const hist = (historicosPorMoeda && sigla) ? (historicosPorMoeda[sigla] || []) : []
      const dataInicioObj = new Date(dataInicio)
      const dataFimObj = new Date(dataFim)

      hist.filter(item => {
        if (!item || !item.dataHora) return false
        const itemDate = new Date(item.dataHora)
        return itemDate >= dataInicioObj && itemDate <= dataFimObj
      }).forEach(r => {
          if (!r) return
          const val = r.variacaoPercentual ?? r.VariacaoPercentual ?? r.variacao ?? r.Variacao ?? 0
          const dh = r.dataHora ?? r.DataHora
          if (dh) varMap.set(dh, val * 100) // Converte para % decimal se necessário
      })
      return {
        label: sigla,
        data: timestampsUnicos.map(ts => varMap.get(ts) ?? null),
        borderColor: cor,
        backgroundColor: `${cor}18`,
        tension: 0.3,
        fill: !multi && idx === 0,
        pointRadius: multi ? 0 : 3,
        borderWidth: 2,
        spanGaps: true,
      }
    })

    return { 
      dadosGraficoPreco: { labels, datasets: datasetsPreco }, 
      dadosGraficoVariacao: { labels, datasets: datasetsVariacao },
      multiMoeda: multi 
    }
  }, [historicosPorMoeda])

  const baseOpcoes = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: multiMoeda,
        labels: { color: '#ccc', boxWidth: 10 }
      },
      tooltip: {
        mode: 'index',
        intersect: false,
      }
    },
    scales: {
      x: { display: false },
      y: {
        grid: { color: 'rgba(255,255,255,0.05)' },
        ticks: { color: '#888' }
      }
    }
  }

  const opcoesPreco = {
    ...baseOpcoes,
    plugins: {
      ...baseOpcoes.plugins,
      tooltip: {
        ...baseOpcoes.plugins.tooltip,
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: $${Number(ctx.parsed.y).toLocaleString('en-US')}`
        }
      }
    },
    scales: {
      ...baseOpcoes.scales,
      y: {
        ...baseOpcoes.scales.y,
        ticks: { 
          ...baseOpcoes.scales.y.ticks,
          callback: (v) => `$${Number(v).toLocaleString('en-US')}`
        }
      }
    }
  }

  const opcoesVariacao = {
    ...baseOpcoes,
    plugins: {
      ...baseOpcoes.plugins,
      tooltip: {
        ...baseOpcoes.plugins.tooltip,
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${Number(ctx.parsed.y).toFixed(2)}%`
        }
      }
    },
    scales: {
      ...baseOpcoes.scales,
      y: {
        ...baseOpcoes.scales.y,
        ticks: { 
          ...baseOpcoes.scales.y.ticks,
          callback: (v) => `${v.toFixed(2)}%`
        }
      }
    }
  }

  const dadosNegociados = dadosGraficoPreco
  const dadosVariacao = dadosGraficoVariacao

  const ultimoNegociado = useMemo(() => {
    const sigla = moedasFiltro[0]
    const hist = (historicosPorMoeda && sigla) ? (historicosPorMoeda[sigla] || []) : []
    if (!hist.length) return '-'
    const last = hist[hist.length - 1]
    const val = last?.valor ?? last?.Valor ?? last?.valorNegociado ?? last?.ValorNegociado ?? 0
    return Number(val).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
  }, [historicosPorMoeda, moedasFiltro])

  const ultimaVariacao = useMemo(() => {
    const sigla = moedasFiltro[0]
    const hist = (historicosPorMoeda && sigla) ? (historicosPorMoeda[sigla] || []) : []
    if (!hist.length) return '-'
    const last = hist[hist.length - 1]
    const val = last?.variacaoPercentual ?? last?.VariacaoPercentual ?? last?.variacao ?? last?.Variacao ?? 0
    return `${(Number(val) * 100).toFixed(2)}%`
  }, [historicosPorMoeda, moedasFiltro])

  // Top level error boundary for the component render
  if (!token) return <Box sx={{ p: 5 }}>Redirecting to login...</Box>

  try {
     return (
    <div className="dashboard-container">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>{t('dashboard')}</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
            {t('welcome', { name: (prefs?.nome || usuario?.nome || '') })}
          </p>
        </div>
        
        <div className="dashboard-actions-top">
           {/* Botão de atualização de sinal removido até backend estar pronto */}
        </div>
      </header>
      
      <ErrorMessage message={erro} onClose={() => setErro('')} />

      {showMonitor && (
        <section className="agent-monitor-container">
          <div className="agent-monitor-panel">
            <div className="scanline"></div>
            <div className="agent-monitor-header">
              <div className="agent-status-badge">
                <div className="status-dot-pulse"></div>
                CORE_AGENT_LINK::SIGNALR_ACTIVE_{moedaMonitor}
              </div>
              <IconButton onClick={() => setShowMonitor(false)} size="small" sx={{ color: 'var(--neon-green)' }}>
                <MdClose />
              </IconButton>
            </div>
            <div className="agent-chat-area">
              <div className="agent-message">
                <span className="agent-prefix">&gt; [SYSTEM]</span>
                <span className="agent-msg-content">Initializing neural bridge to Ollama instance...</span>
              </div>
              <div className="agent-message">
                <span className="agent-prefix">&gt; [ATLAS]</span>
                <span className="agent-msg-content">Analyzing {moedaMonitor} market regime. Detecting bullish divergence patterns in M15.</span>
              </div>
              <div className="agent-message">
                <span className="agent-prefix">&gt; [ECHO]</span>
                <span className="agent-msg-content">Cross-referencing with sentiment-oscillator. Synergy score at 0.89.</span>
              </div>
              <div className="decor-hex">
                0x45 0x67 0x89 0xAB 0xCD 0xEF
              </div>
            </div>
          </div>
        </section>
      )}

      <Box 
        className="panel top-coins" 
        sx={{ 
          background: 'rgba(20, 20, 20, 0.6) !important', 
          backdropFilter: 'blur(15px) !important',
          border: '1px solid rgba(255, 215, 0, 0.1) !important',
          mb: 3
        }}
      >
        <h2><MdTrendingUp style={{ verticalAlign: 'middle', marginRight: '8px' }} /> {t('topCoins')}</h2>
        <div className="top-list">
          {moedasCarousel.length === 0 ? (
             <Box sx={{ p: 3, textAlign: 'center', opacity: 0.6 }}>
                <Typography variant="body2">{t('loadingCoins')}...</Typography>
             </Box>
          ) : (
            moedasCarousel
              .slice()
              .sort((a, b) => b.variacao - a.variacao)
              .slice(0, 5)
              .map((m) => {
                const up = m.variacao >= 0
                return (
                  <div key={m.simbolo} className="top-item">
                    <CryptoIcon simbolo={m.simbolo} />
                    <span className="top-name">{m.nome}</span>
                    <span className={`top-var ${up ? 'positive' : 'negative'}`}>
                      {up ? '+' : ''}{m.variacao.toFixed(2)}%
                    </span>
                  </div>
                )
              })
          )}
        </div>
      </Box>

      <div className="crypto-carousel">
        {moedasCarousel.length === 0 ? (
          <Box sx={{ 
            width: '100%', 
            p: 4, 
            textAlign: 'center', 
            background: 'rgba(20, 20, 20, 0.4)', 
            borderRadius: '16px', 
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.05)'
          }}>
            <Typography variant="body1" sx={{ color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
               <MdRefresh className="spin" /> {t('loadingCoins')}
            </Typography>
          </Box>
        ) : (
          moedasCarousel.map((m) => {
            const isUp = m.variacao >= 0
            const isSelected = moedasFiltro.includes(m.simbolo)
            return (
              <Card 
                key={m.simbolo} 
                className={`carousel-item ${isSelected ? 'selected' : ''}`}
                sx={{ 
                  minWidth: 120,
                  border: isSelected ? '2px solid var(--color-primary) !important' : '1px solid rgba(255,255,255,0.05) !important',
                  transform: isSelected ? 'scale(1.05)' : 'none',
                  boxShadow: isSelected ? '0 0 15px rgba(255, 215, 0, 0.3) !important' : 'none'
                }}
              >
                  <CardActionArea
                    className={`carousel-card-inner ${isSelected ? 'selected' : ''}`}
                    onClick={() => selecionarMoeda(m.simbolo)}
                    sx={{
                      padding: '24px 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 1.5,
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      border: isSelected ? '1px solid var(--color-primary)' : '1px solid transparent',
                      background: isSelected ? 'rgba(255, 215, 0, 0.05)' : 'transparent',
                      '&:hover': {
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        transform: 'translateY(-4px)'
                      }
                    }}
                  >
                    <div className={`coin-icon-wrapper ${isSelected ? 'pulse' : ''}`}>
                        <CryptoIcon simbolo={m.simbolo} />
                    </div>
                    <div className="carousel-info">
                      <span className="carousel-name" style={{ fontWeight: isSelected ? 700 : 400, color: isSelected ? 'var(--color-primary)' : 'inherit' }}>
                        {m.simbolo}
                      </span>
                      <span className={`carousel-price ${isUp ? 'positive' : 'negative'}`} style={{ fontSize: '0.85rem' }}> 
                        {m.valor.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                      </span>
                      <div className={`carousel-mini-var ${isUp ? 'up' : 'down'}`}>
                        {isUp ? <MdTrendingUp /> : <MdTrendingDown />}
                        {Math.abs(m.variacao).toFixed(1)}%
                      </div>
                    </div>
                    
                    <IconButton 
                      className="ai-chat-btn-overlay"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDebateTrigger(m.simbolo);
                      }}
                      title={`Conversar com IA sobre ${m.simbolo}`}
                    >
                      <MdSmartToy />
                    </IconButton>

                    {isSelected && (
                        <div className="selected-indicator">
                            <div className="dot"></div>
                        </div>
                    )}
                  </CardActionArea>
              </Card>
            )
          })
        )}
      </div>

      <section className="panel filters-panel" style={{ marginBottom: '40px', padding: '20px' }}>
        <Box sx={{ 
          display: 'flex', 
          flexDirection: { xs: 'column', md: 'row' },
          gap: 3, 
          alignItems: 'flex-end', 
          justifyContent: 'center',
          flexWrap: 'wrap'
        }}>
          <Box sx={{ flex: '1 1 180px', minWidth: '150px' }}>
            <TextField
              fullWidth
              label={t('startDate')}
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              InputLabelProps={{ shrink: true }}
              size="small"
              variant="outlined"
              sx={{ 
                '& .MuiOutlinedInput-root': {
                    backgroundColor: 'rgba(255,255,255,0.02)',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' }
                }
              }}
            />
          </Box>
          <Box sx={{ flex: '1 1 180px', minWidth: '150px' }}>
            <TextField
              fullWidth
              label={t('endDate')}
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              InputLabelProps={{ shrink: true }}
              size="small"
              variant="outlined"
              sx={{ 
                '& .MuiOutlinedInput-root': {
                    backgroundColor: 'rgba(255,255,255,0.02)',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' }
                }
              }}
            />
          </Box>

          <Box sx={{ flex: '0 1 140px', minWidth: '120px' }}>
            <TextField
              fullWidth
              select
              label={t('result')}
              value={resultadoFiltro}
              onChange={(e) => setResultadoFiltro(e.target.value)}
              size="small"
              variant="outlined"
              sx={{ 
                '& .MuiOutlinedInput-root': {
                    backgroundColor: 'rgba(255,255,255,0.02)',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' }
                }
              }}
            >
              <MenuItem value="ALL">{t('all')}</MenuItem>
              <MenuItem value="WIN">{t('win')}</MenuItem>
              <MenuItem value="LOSS">{t('loss')}</MenuItem>
            </TextField>
          </Box>

          <Box sx={{ flex: '0 1 180px', minWidth: '160px' }}>
            <div className="interval-selector-mini" style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', padding: '4px', border: '1px solid rgba(255,255,255,0.1)', height: '40px', boxSizing: 'border-box' }}>
              {['24h', '7d', '1m'].map((opt) => (
                <button
                  key={opt}
                  className={`interval-btn-mini ${intervalo === opt ? 'active' : ''}`}
                  onClick={() => {
                    setIntervalo(opt)
                    setPagina(1) // Opcional: resetar página se mudar o intervalo? Geralmente sim.
                  }}
                  style={{ flex: 1, padding: '0 8px', fontSize: '0.8rem' }}
                >
                  {t(`interval${opt}`)}
                </button>
              ))}
            </div>
          </Box>
        </Box>
      </section>

      <div style={{ marginTop: '40px', marginBottom: '16px', padding: '0 4px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: '1.25rem' }}>{t('sequence')}</h2>
        {multiMoeda && (
          <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.8rem', color: '#888', alignSelf: 'center' }}>Normalização:</span>
            {[
              { key: 'base100', label: 'Base 100', title: 'Performance relativa — começa em 100 para todas' },
              { key: 'minmax', label: 'Min-Max', title: 'Escala 0 a 1 relativa ao período' },
              { key: 'zscore', label: 'Z-Score', title: 'Volatilidade — desvios em relação à média' },
            ].map(({ key, label, title }) => (
              <button
                key={key}
                title={title}
                onClick={() => setNormalizacao(key)}
                style={{
                  padding: '4px 12px',
                  fontSize: '0.78rem',
                  borderRadius: '20px',
                  border: normalizacao === key ? '1px solid #FFD700' : '1px solid #444',
                  background: normalizacao === key ? 'rgba(255,215,0,0.12)' : 'transparent',
                  color: normalizacao === key ? '#FFD700' : '#888',
                  cursor: 'pointer',
                  fontWeight: normalizacao === key ? 600 : 400,
                  transition: 'all 0.2s',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="dashboard-charts">
        <Box className="panel chart-panel" sx={{ 
          background: 'rgba(20, 20, 20, 0.6) !important', 
          backdropFilter: 'blur(15px) !important',
          border: '1px solid rgba(255, 255, 255, 0.05) !important'
        }}>
          <h2>{t('tradedValue')}</h2>
          <div className="chart-note">{t('lastValue')}: {ultimoNegociado}</div>
          <div className="chart-container">
            <Line data={dadosNegociados} options={opcoesPreco} />
          </div>
        </Box>
        <Box className="panel chart-panel" sx={{ 
          background: 'rgba(20, 20, 20, 0.6) !important', 
          backdropFilter: 'blur(15px) !important',
          border: '1px solid rgba(255, 255, 255, 0.05) !important'
        }}>
          <h2>{t('percentVariation')}</h2>
          <div className="chart-note">{t('lastVariation')}: {ultimaVariacao}</div>
          <div className="chart-container">
            <Line data={dadosVariacao} options={opcoesVariacao} />
          </div>
        </Box>
      </div>

      {moedasFiltro.length > 0 && historicoMoeda && (
        <Box className="panel history-panel" sx={{ 
          marginTop: '20px', 
          background: 'rgba(20, 20, 20, 0.6) !important' 
        }}>
          <h2>{t('coinHistory')}: {moedasFiltro[0]}</h2>
          <TableContainer component={Paper} sx={{ backgroundColor: 'transparent', boxShadow: 'none' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ color: '#aaa', fontWeight: 'bold' }}>{t('date')}</TableCell>
                  <TableCell sx={{ color: '#aaa', fontWeight: 'bold' }}>{t('value')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(historicoMoeda?.registros || historicoMoeda?.Registros || []).map((item, idx) => {
                  const dh = item?.dataHora ?? item?.DataHora
                  const val = item?.valor ?? item?.Valor ?? item?.valorNegociado ?? item?.ValorNegociado ?? 0
                  return (
                    <TableRow key={idx}>
                      <TableCell sx={{ color: '#eee' }}>{dh ? new Date(dh).toLocaleString('en-US') : '-'}</TableCell>
                      <TableCell sx={{ color: '#eee' }}>
                        {Number(val).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {totalPaginas > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3, mb: 3 }}>
          <Pagination 
            count={totalPaginas} 
            page={pagina} 
            onChange={(_, val) => setPagina(val)} 
            color="primary" 
          />
        </Box>
      )}
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

export default Dashboard
