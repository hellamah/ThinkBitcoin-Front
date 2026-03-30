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
import { useState } from 'react'
import { Line } from 'react-chartjs-2'
import Card from '@mui/material/Card'
import CardActionArea from '@mui/material/CardActionArea'
import Box from '@mui/material/Box'
import CryptoIcon from '../components/CryptoIcon'
import Modal from '../components/Modal.jsx'
import { MdTrendingUp, MdTrendingDown } from 'react-icons/md'
import { apiRequest, MarketEndpoint } from '../utils/apiClient'
import useCoinPrices from '../hooks/useCoinPrices'
import useTranslation from '../hooks/useTranslation'

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

function Home() {
  const moedas = useCoinPrices()
  const { t } = useTranslation()
  const [detalhes, setDetalhes] = useState(null)
  const fechar = () => setDetalhes(null)
  let rotulos = moedas[0]?.dados
    ? moedas[0].dados.map((_, i) => (i + 1).toString())
    : []
  if (rotulos.length === 1) rotulos = ['1', '2']

  const formatarValor = (v) =>
    (v || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' })

  const opcoes = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { enabled: true },
    },
    elements: { point: { radius: 0 } },
    scales: {
      x: { display: false, grid: { display: false }, ticks: { color: '#ccc' } },
      y: { display: false, grid: { color: '#333' }, ticks: { color: '#ccc' } },
    },
  }

  const obterDetalhes = async (moeda) => {
    try {
      const json = await apiRequest(MarketEndpoint.COIN_VALUE(moeda.simbolo))
      const valor = json.resultado.valor
      const data = new Date(json.resultado.dataHora).toLocaleString('en-US')
      setDetalhes({ moeda, valor, data })
    } catch {
      setDetalhes({ error: t('fetchError') })
    }
  }

    return (
      <div className="home-content-wrapper">
        <section className="hero-section">
          <h1 className="hero-title">
            Inteligência que <br />
            <span style={{ color: 'var(--color-primary)', WebkitTextFillColor: 'var(--color-primary)' }}>Antecipa</span> o Mercado.
          </h1>
          <p className="hero-subtitle">
            Onde o pensamento estratégico encontra a liquidez digital. 
            Monitore a volatilidade com precisão algorítmica e insights em tempo real.
          </p>
        </section>

        <div className="section-header" style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
            <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 200, color: 'var(--color-text-secondary)' }}>ATIVOS EM DESTAQUE</h2>
            <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, rgba(255,255,255,0.1), transparent)' }}></div>
        </div>

        <div className="crypto-grid-v2">
          {moedas.map((moeda, idx) => {
            const isUp = moeda.variacao >= 0
            return (
              <Card 
                key={moeda.simbolo} 
                className={`crypto-card-premium stagger-${(idx % 8) + 1}`}
                sx={{ background: 'transparent', boxShadow: 'none' }}
              >
                <CardActionArea 
                    onClick={() => obterDetalhes(moeda)} 
                    className="card-content-v2"
                >
                  <div className="card-header-v2">
                    <div className="card-title-group">
                        <span className="card-coin-name">{moeda.nome}</span>
                        <span className="card-coin-symbol">{moeda.simbolo} / USD</span>
                    </div>
                    <Box sx={{ p: 1.5, background: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <CryptoIcon simbolo={moeda.simbolo} size={32} />
                    </Box>
                  </div>

                  <div className="card-middle-v2" style={{ height: '80px', margin: '8px 0' }}>
                    <Line
                      data={{
                        labels: rotulos,
                        datasets: [
                          {
                            data: moeda.dados.length === 1 ? [moeda.dados[0], moeda.dados[0]] : moeda.dados,
                            borderColor: isUp ? '#00ffaa' : '#ff4444',
                            backgroundColor: 'transparent',
                            borderWidth: 2,
                            tension: 0.4,
                            pointRadius: 0
                          },
                        ],
                      }}
                      options={opcoes}
                    />
                  </div>

                  <div className="card-footer-v2" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div className="card-price-large">
                        {formatarValor(moeda.valor)}
                    </div>
                    <div className={`crypto-variation ${isUp ? 'positive' : 'negative'}`} style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '4px',
                        padding: '4px 8px',
                        background: isUp ? 'rgba(0, 255, 170, 0.1)' : 'rgba(255, 68, 68, 0.1)',
                        borderRadius: '8px',
                        fontSize: '0.9rem',
                        fontWeight: 700
                    }}>
                      {isUp ? <MdTrendingUp /> : <MdTrendingDown />}
                      {Math.abs(moeda.variacao).toFixed(2)}%
                    </div>
                  </div>
                </CardActionArea>
              </Card>
            )
          })}
        </div>
        
        <Modal visible={!!detalhes} onClose={fechar}>
          {detalhes?.error ? (
            <p>{detalhes.error}</p>
          ) : detalhes ? (
            <>
              <h2>{detalhes.moeda.nome}</h2>
              <p>{formatarValor(detalhes.valor)}</p>
              <p>{detalhes.data}</p>
              <div className="chart-preview" style={{ width: '100%', height: '140px', marginTop: '20px' }}>
                <Line
                  data={{
                    labels: rotulos,
                    datasets: [
                      {
                        data: detalhes.moeda.dados.length === 1 ? [detalhes.moeda.dados[0], detalhes.moeda.dados[0]] : detalhes.moeda.dados,
                        borderColor: detalhes.moeda.variacao >= 0 ? '#00ffaa' : '#ff4444',
                        backgroundColor: 'transparent',
                        borderWidth: 2,
                        tension: 0.4
                      },
                    ],
                  }}
                  options={{
                      ...opcoes,
                      scales: {
                          x: { display: true, grid: { display: false }, ticks: { color: '#666' } },
                          y: { display: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#666' } }
                      }
                  }}
                />
              </div>
            </>
          ) : null}
        </Modal>
      </div>
    )
}

export default Home
