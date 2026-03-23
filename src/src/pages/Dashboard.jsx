import { useEffect, useState } from 'react'
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
import { MdTrendingUp, MdTrendingDown } from 'react-icons/md'
import Card from '@mui/material/Card'
import CardActionArea from '@mui/material/CardActionArea'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
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
  const { token } = useAuth()
  const moedasCarousel = useCoinPrices()
  const { t } = useTranslation()
  const [dados, setDados] = useState([])
  const [erro, setErro] = useState('')
  const [sinal, setSinal] = useState(null)
  const [intervalo, setIntervalo] = useState('24h')
  
  // Filtros dinâmicos
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [moedaFiltro, setMoedaFiltro] = useState('')
  const [resultadoFiltro, setResultadoFiltro] = useState('')
  const [pagina, setPagina] = useState(1)
  const [quantidade, setQuantidade] = useState(20)
  const [totalPaginas, setTotalPaginas] = useState(1)
  const [historicoMoeda, setHistoricoMoeda] = useState(null)

  const carregarDashboardData = async () => {
    if (!token) {
      setDados(MOCK_DADOS)
      return
    }

    setErro('')
    
    // 1. Busca Sequências (Gráficos)
    const params = new URLSearchParams()
    if (dataInicio) params.append('dataInicio', dataInicio)
    if (dataFim) params.append('dataFim', dataFim)
    if (moedaFiltro) params.append('siglaMoeda', moedaFiltro)
    if (resultadoFiltro && resultadoFiltro !== 'ALL') params.append('resultado', resultadoFiltro)
    params.append('pagina', pagina)
    params.append('quantidade', quantidade)

    const urlSequence = `${MarketEndpoint.RETURN_SEQUENCE}?${params.toString()}`

    apiRequest(urlSequence, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((json) => {
        const resultado = json?.resultado
        setDados(resultado?.listaSequenciaRetorno || resultado?.ListaSequenciaRetorno || [])
        setTotalPaginas(resultado?.totalPaginas || resultado?.TotalPaginas || 1)
      })
      .catch((err) => {
        console.error('Erro ao buscar sequências:', err)
        setErro(t('fetchError'))
        setDados(MOCK_DADOS)
      })

    // 2. Busca Histórico de Moeda (se filtrada)
    if (moedaFiltro) {
      const urlHistory = `${MarketEndpoint.COIN_VALUE(moedaFiltro.toLowerCase())}?${params.toString()}`
      apiRequest(urlHistory, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((json) => {
          setHistoricoMoeda(json?.resultado)
        })
        .catch((err) => {
          console.error('Erro ao buscar histórico da moeda:', err)
          setHistoricoMoeda(null)
        })
    } else {
      setHistoricoMoeda(null)
    }
  }

  useEffect(() => {
    carregarDashboardData()
  }, [token, pagina, quantidade])

  const aplicarFiltros = () => {
    setPagina(1)
    carregarDashboardData()
  }

  const filtrarIntervalo = (lista) => {
    const agora = Date.now()
    const map = { '24h': 86400000, '7d': 604800000, '1m': 2592000000 }
    const limite = map[intervalo] || 86400000
    return lista.filter(
      (d) => new Date(d.dataHora).getTime() >= agora - limite
    )
  }

  const obterSinal = () => {
    apiRequest(MarketEndpoint.SCRIPT_COMMON, { method: HttpMethod.POST })
      .then((j) => setSinal(Number(j.acao)))
      .catch(() => setSinal(null))
  }

  useEffect(() => {
    obterSinal()
  }, [])

  const dadosFiltrados = filtrarIntervalo(dados)

  const rotulos = dadosFiltrados.map((d) =>
    new Date(d.dataHora).toLocaleString('pt-BR')
  )

  const opcoesBase = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { enabled: true },
    },
    elements: { point: { radius: 2 } },
    scales: {
      x: {
        display: false,
        grid: { display: false },
        ticks: { color: '#ccc' },
      },
      y: {
        display: true,
        grid: { color: '#333' },
        ticks: { color: '#ccc' },
      },
    },
  }

  const dadosNegociados = {
    labels: rotulos,
    datasets: [
      {
        label: 'Valor em R$',
        data: dadosFiltrados.map((d) => d.valorNegociado),
        borderColor: '#4caf50',
        backgroundColor: 'rgba(76, 175, 80, 0.1)',
        tension: 0.3,
        borderWidth: 2,
      },
      {
        label: 'Compra',
        data: dadosFiltrados.map((d) => (d.tipo === 1 ? d.valorNegociado : null)),
        borderColor: 'transparent',
        backgroundColor: '#4caf50',
        pointStyle: 'triangle',
        pointRadius: 6,
        showLine: false,
      },
      {
        label: 'Venda',
        data: dadosFiltrados.map((d) => (d.tipo === 2 ? d.valorNegociado : null)),
        borderColor: 'transparent',
        backgroundColor: '#f44336',
        pointStyle: 'rectRot',
        pointRadius: 6,
        showLine: false,
      },
    ],
  }

  const dadosVariacao = {
    labels: rotulos,
    datasets: [
      {
        label: 'Variação %',
        data: dadosFiltrados.map((d) => d.variacaoPercentual),
        borderColor: '#2196f3',
        backgroundColor: 'rgba(33, 150, 243, 0.1)',
        tension: 0.3,
        borderWidth: 2,
      },
      {
        label: 'Compra',
        data: dadosFiltrados.map((d) => (d.tipo === 1 ? d.variacaoPercentual : null)),
        borderColor: 'transparent',
        backgroundColor: '#4caf50',
        pointStyle: 'triangle',
        pointRadius: 6,
        showLine: false,
      },
      {
        label: 'Venda',
        data: dadosFiltrados.map((d) => (d.tipo === 2 ? d.variacaoPercentual : null)),
        borderColor: 'transparent',
        backgroundColor: '#f44336',
        pointStyle: 'rectRot',
        pointRadius: 6,
        showLine: false,
      },
    ],
  }

  const ultimoNegociado = dadosFiltrados.length
    ? dadosFiltrados[dadosFiltrados.length - 1].valorNegociado.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      })
    : '-'

  const ultimaVariacao = dadosFiltrados.length
    ? `${(dadosFiltrados[dadosFiltrados.length - 1].variacaoPercentual * 100).toFixed(2)}%`
    : '-'

  return (
    <>
      <h1 className="page-title">{t('dashboard')}</h1>
      <h2 className="page-subtitle">{t('sequence')}</h2>
      <ErrorMessage message={erro} />
      <div className="dashboard-actions">
        {sinal !== null && (
          <div className={`signal-banner ${sinal === 1 ? 'buy' : sinal === 2 ? 'sell' : 'hold'}`}>
            {sinal === 1
              ? t('signalBuy')
              : sinal === 2
              ? t('signalSell')
              : t('signalHold')}
          </div>
        )}
        <Button 
          variant="contained" 
          color="primary" 
          onClick={obterSinal}
          sx={{ fontWeight: 'bold' }}
        >
          {t('updateSignal')}
        </Button>
      </div>
      <div className="interval-selector">
        {['24h', '7d', '1m'].map((opt) => (
          <button
            key={opt}
            className={`interval-btn ${intervalo === opt ? 'active' : ''}`}
            onClick={() => setIntervalo(opt)}
          >
            {t(`interval${opt}`)}
          </button>
        ))}
      </div>
      <div className="crypto-carousel">
        {moedasCarousel.length === 0 ? (
          <div className="loading-msg">{t('loadingCoins')}</div>
        ) : (
          moedasCarousel.map((m) => {
            const isUp = m.variacao >= 0
            return (
              <Card key={m.simbolo} className="carousel-item" sx={{ minWidth: 120 }}>
                <CardActionArea sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: 1 }}>
                  <CryptoIcon simbolo={m.simbolo} />
                  <div className="carousel-info">
                    <span className="carousel-name">{m.nome}</span>
                    <span className={`carousel-price ${isUp ? 'positive' : 'negative'}`}> 
                      {m.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      {isUp ? (
                        <MdTrendingUp className="trend-icon" />
                      ) : (
                        <MdTrendingDown className="trend-icon" />
                      )}
                    </span>
                  </div>
                </CardActionArea>
              </Card>
            )
          })
        )}
      </div>
      <section className="panel top-coins">
        <h2>{t('topCoins')}</h2>
        <div className="top-list">
          {moedasCarousel
            .slice()
            .sort((a, b) => b.variacao - a.variacao)
            .slice(0, 5)
            .map((m) => {
              const up = m.variacao >= 0
              return (
                <Card key={m.simbolo} variant="outlined" className="top-item" sx={{ p: 1, display: 'flex', alignItems: 'center' }}>
                  <CryptoIcon simbolo={m.simbolo} />
                  <span className="top-name">{m.nome}</span>
                  <span className={`top-var ${up ? 'positive' : 'negative'}`}>{m.variacao.toFixed(2)}%</span>
                </Card>
              )
            })}
        </div>
      </section>

      <section className="panel filters-panel" style={{ marginTop: '20px', marginBottom: '20px', padding: '15px' }}>
        <h3 style={{ marginBottom: '15px' }}>{t('applyFilters')}</h3>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={2.4}>
            <TextField
              fullWidth
              label={t('startDate')}
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              InputLabelProps={{ shrink: true }}
              size="small"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={2.4}>
            <TextField
              fullWidth
              label={t('endDate')}
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              InputLabelProps={{ shrink: true }}
              size="small"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={2.4}>
            <TextField
              fullWidth
              select
              label={t('coin')}
              value={moedaFiltro}
              onChange={(e) => setMoedaFiltro(e.target.value)}
              size="small"
            >
              <MenuItem value="">{t('all')}</MenuItem>
              {moedasCarousel.map((m) => (
                <MenuItem key={m.simbolo} value={m.simbolo}>{m.simbolo}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6} md={2.4}>
            <TextField
              fullWidth
              select
              label={t('result')}
              value={resultadoFiltro}
              onChange={(e) => setResultadoFiltro(e.target.value)}
              size="small"
            >
              <MenuItem value="ALL">{t('all')}</MenuItem>
              <MenuItem value="WIN">{t('win')}</MenuItem>
              <MenuItem value="LOSS">{t('loss')}</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} md={2.4}>
            <Button variant="contained" fullWidth onClick={aplicarFiltros}>
              {t('applyFilters')}
            </Button>
          </Grid>
        </Grid>
      </section>

      <div className="dashboard-charts">
        <section className="panel chart-panel">
          <h2>{t('tradedValue')}</h2>
          <div className="chart-note">{t('lastValue')}: {ultimoNegociado}</div>
          <div className="chart-container">
            <Line data={dadosNegociados} options={opcoesBase} />
          </div>
        </section>
        <section className="panel chart-panel">
          <h2>{t('percentVariation')}</h2>
          <div className="chart-note">{t('lastVariation')}: {ultimaVariacao}</div>
          <div className="chart-container">
            <Line data={dadosVariacao} options={opcoesBase} />
          </div>
        </section>
      </div>

      {moedaFiltro && historicoMoeda && (
        <section className="panel history-panel" style={{ marginTop: '20px' }}>
          <h2>{t('coinHistory')}: {moedaFiltro}</h2>
          <TableContainer component={Paper} sx={{ backgroundColor: 'transparent', boxShadow: 'none' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ color: '#aaa', fontWeight: 'bold' }}>{t('date')}</TableCell>
                  <TableCell sx={{ color: '#aaa', fontWeight: 'bold' }}>{t('value')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(historicoMoeda?.registros || historicoMoeda?.Registros || []).map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell sx={{ color: '#eee' }}>{new Date(item.dataHora).toLocaleString('pt-BR')}</TableCell>
                    <TableCell sx={{ color: '#eee' }}>
                      {(item.valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </section>
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
    </>
  )
}

export default Dashboard
