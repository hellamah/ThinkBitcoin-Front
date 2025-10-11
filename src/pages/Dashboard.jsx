import { useEffect, useState } from 'react'
import { API_URL } from '../api'
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

  useEffect(() => {
    const url = `${API_URL}/ThinkBitcoin/sequenciasRetorno/`

    if (!token) {
      setDados(MOCK_DADOS)
      return
    }

    setErro('')
    fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error()
        return r.json()
      })
      .then((json) => setDados(json.resultado.listaSequenciaRetorno))
      .catch(() => {
        setErro(t('fetchError'))
      setDados(MOCK_DADOS)
    })
  }, [token])

  const filtrarIntervalo = (lista) => {
    const agora = Date.now()
    const map = { '24h': 86400000, '7d': 604800000, '1m': 2592000000 }
    const limite = map[intervalo] || 86400000
    return lista.filter(
      (d) => new Date(d.dataHora).getTime() >= agora - limite
    )
  }

  const obterSinal = () => {
    fetch(`${API_URL}/ThinkBitcoin/scriptComum`, { method: 'POST' })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
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
      {sinal !== null && (
        <div className="signal-banner">
          {sinal === 1
            ? t('signalBuy')
            : sinal === 2
            ? t('signalSell')
            : t('signalHold')}
        </div>
      )}
      <button className="update-signal" onClick={obterSinal}>
        {t('updateSignal')}
      </button>
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
        {moedasCarousel.map((m) => {
          const isUp = m.variacao >= 0
          return (
            <Card key={m.simbolo} className="carousel-item" sx={{ minWidth: 120 }}>
              <CardActionArea sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: 1 }}>
                <CryptoIcon simbolo={m.simbolo} />
                <div className="carousel-info">
                  <span className="carousel-name">{m.nome}</span>
                  <span className={`carousel-price ${isUp ? 'positive' : 'negative'}`}> 
                    {m.valor.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
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
        })}
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
    </>
  )
}

export default Dashboard
