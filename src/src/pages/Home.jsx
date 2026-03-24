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
import profileImg from '../assets/profile-circuit.svg'
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
      <>
        <h1 className="page-title">{t('homeTitle')}</h1>
        <div className="crypto-list">
          {moedas.map((moeda) => {
            const isUp = moeda.variacao >= 0
            return (
              <Card key={moeda.simbolo} className="crypto-card">
                <CardActionArea onClick={() => obterDetalhes(moeda)} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1 }}>
                  <div className="crypto-main">
                    <div className="icon">
                      <CryptoIcon simbolo={moeda.simbolo} />
                    </div>
                    <div className="crypto-info">
                      <div className="crypto-name">{moeda.nome}</div>
                      <div className={`crypto-price ${isUp ? 'positive' : 'negative'}`}>
                        {formatarValor(moeda.valor)}
                        {isUp ? (
                          <MdTrendingUp className="trend-icon" />
                        ) : (
                          <MdTrendingDown className="trend-icon" />
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="chart-preview">
                    <Line
                      data={{
                        labels: rotulos,
                        datasets: [
                          {
                            data: moeda.dados.length === 1 ? [moeda.dados[0], moeda.dados[0]] : moeda.dados,
                            borderColor: '#00BFFF',
                            backgroundColor: 'transparent',
                          },
                        ],
                      }}
                      options={opcoes}
                    />
                  </div>
                </CardActionArea>
              </Card>
            )
          })}
        </div>
        <div className="brain-footer">
          <img src={profileImg} alt="profile" />
        </div>
        <Modal visible={!!detalhes} onClose={fechar}>
          {detalhes?.error ? (
            <p>{detalhes.error}</p>
          ) : detalhes ? (
            <>
              <h2>{detalhes.moeda.nome}</h2>
              <p>{formatarValor(detalhes.valor)}</p>
              <p>{detalhes.data}</p>
              <div className="chart-preview" style={{ width: '100%', height: '80px' }}>
                <Line
                  data={{
                    labels: rotulos,
                    datasets: [
                      {
                        data: detalhes.moeda.dados.length === 1 ? [detalhes.moeda.dados[0], detalhes.moeda.dados[0]] : detalhes.moeda.dados,
                        borderColor: '#00BFFF',
                        backgroundColor: 'transparent',
                      },
                    ],
                  }}
                  options={opcoes}
                />
              </div>
            </>
          ) : null}
        </Modal>
      </>
    )
}

export default Home
