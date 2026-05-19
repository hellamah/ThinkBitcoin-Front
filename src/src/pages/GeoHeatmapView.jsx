import React, { useState, useEffect } from 'react'
import { Chart } from 'react-google-charts'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import { MdPublic, MdAnalytics } from 'react-icons/md'

import DashboardHeader from '../components/dashboard/DashboardHeader'
import ErrorMessage from '../components/ErrorMessage'
import CoinCarousel from '../components/dashboard/CoinCarousel'
import { useAuth } from '../context/AuthContext'
import useTranslation from '../hooks/useTranslation'
import useCoinPrices from '../hooks/useCoinPrices'
import { apiRequest, VariavelExternaEndpoint } from '../utils/apiClient'

export default function GeoHeatmapView() {
  const { token, user: usuario, prefs } = useAuth()
  const { t } = useTranslation()
  const moedasCarousel = useCoinPrices()
  const [moedasFiltro, setMoedasFiltro] = useState([])
  
  const [heatmapData, setHeatmapData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (!token || !moedasCarousel?.length || moedasFiltro.length > 0) return

    const moedaProp = prefs?.siglaMoedaPreferida || prefs?.moedaPreferida
    let initialized = false
    if (moedaProp) {
      const match = moedasCarousel.find(m =>
        (m.simbolo && String(m.simbolo).toUpperCase() === String(moedaProp).toUpperCase().trim())
      )
      if (match) {
        setMoedasFiltro([match.simbolo])
        initialized = true
      }
    }

    if (!initialized) {
      const btc = moedasCarousel.find(m => m.simbolo === 'BTC') || moedasCarousel[0]
      if (btc) setMoedasFiltro([btc.simbolo])
    }
  }, [prefs, token, moedasCarousel, moedasFiltro])

  const carregarHeatmap = async () => {
    if (!token || moedasFiltro.length === 0) return

    setLoading(true)
    setErro('')
    try {
      const sigla = moedasFiltro[0]
      const moeda = moedasCarousel.find(m => m.simbolo === sigla)
      const idMoedaParam = moeda && moeda.id ? `?idMoeda=${moeda.id}` : ''

      const url = `${VariavelExternaEndpoint.TREND_HEATMAP}${idMoedaParam}`
      const response = await apiRequest(url, { headers: { Authorization: `Bearer ${token}` } })

      let rawData = []
      if (response && response.resultado) {
        rawData = Array.isArray(response.resultado) ? response.resultado : (response.resultado.registros || [])
      } else if (Array.isArray(response)) {
        rawData = response
      }

      // Converte para o formato do Google Charts: [["Country", "Value"], ["DE", 100], ...]
      const chartData = [["Country", t('marketInterest') || "Interesse Global (Dominância)"]]
      if (rawData && rawData.length > 0) {
        rawData.forEach(item => {
           chartData.push([
             item.geoTop1Code || item.GeoTop1Code,
             item.frequenciaLideranca || item.FrequenciaLideranca || item.mediaIntensidade || item.MediaIntensidade || 0
           ])
        })
      }
      setHeatmapData(chartData.length > 1 ? chartData : null)
    } catch (err) {
      console.error("Erro ao carregar Heatmap", err)
      setErro('Não foi possível carregar os dados geográficos no momento.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarHeatmap()
  }, [moedasFiltro, token])

  const selecionarMoeda = (simbolo) => {
    // Permite apenas uma moeda selecionada para o mapa
    setMoedasFiltro([simbolo])
  }

  if (!token) return <Box sx={{ p: 5 }}>Redirecting to login...</Box>

  return (
    <div className="dashboard-container">
      <DashboardHeader t={t} prefs={prefs} usuario={usuario} />

      <ErrorMessage message={erro} onClose={() => setErro('')} />

      <CoinCarousel 
        moedasCarousel={moedasCarousel}
        moedasFiltro={moedasFiltro}
        selecionarMoeda={selecionarMoeda}
        handleDebateTrigger={() => {}}
        t={t}
        isMobile={false}
      />

      <section className="panel" style={{ marginTop: '20px', minHeight: '500px' }}>
        <Typography variant="h4" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <MdPublic /> {t('globalHotspot') || 'Geopolítica de Mercado'}
        </Typography>
        
        <Typography variant="body1" sx={{ opacity: 0.7, mb: 4 }}>
          Mapeamento global do interesse de busca pelo ativo, destacando as regiões que atualmente lideram a narrativa de mercado.
        </Typography>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
            <CircularProgress color="primary" />
          </Box>
        ) : heatmapData ? (
          <Box sx={{ borderRadius: '8px', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
            <Chart
              chartType="GeoChart"
              width="100%"
              height="600px"
              data={heatmapData}
              options={{
                backgroundColor: '#0d0d0d',
                datalessRegionColor: '#1a1a1a',
                defaultColor: '#1e1e1e',
                colorAxis: { colors: ['#333333', '#ffd700', '#ff8c00'] },
                tooltip: { textStyle: { color: '#000000' } }
              }}
            />
          </Box>
        ) : (
          <Box sx={{ p: 4, textAlign: 'center', opacity: 0.5 }}>
            <MdAnalytics size={48} />
            <Typography>Dados de mapa não disponíveis para o ativo selecionado no período.</Typography>
          </Box>
        )}
      </section>
    </div>
  )
}
