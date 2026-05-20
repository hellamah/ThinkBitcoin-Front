import React, { useState, useEffect, useMemo } from 'react'
import { Chart } from 'react-google-charts'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import Grid from '@mui/material/Grid'
import LinearProgress from '@mui/material/LinearProgress'
import { MdPublic, MdAnalytics } from 'react-icons/md'

import DashboardHeader from '../components/dashboard/DashboardHeader'
import ErrorMessage from '../components/ErrorMessage'
import CoinCarousel from '../components/dashboard/CoinCarousel'
import { useAuth } from '../context/AuthContext'
import useTranslation from '../hooks/useTranslation'
import useCoinPrices from '../hooks/useCoinPrices'
import { apiRequest, VariavelExternaEndpoint } from '../utils/apiClient'

const getCountryName = (code) => {
  const countries = {
    US: 'Estados Unidos',
    DE: 'Alemanha',
    CH: 'Suíça',
    BR: 'Brasil',
    CA: 'Canadá',
    GB: 'Reino Unido',
    FR: 'França',
    JP: 'Japão',
    CN: 'China',
    IN: 'Índia',
    RU: 'Rússia',
    AU: 'Austrália',
    NO: 'Noruega',
    SE: 'Suécia',
    NL: 'Holanda',
    SG: 'Singapura',
    IT: 'Itália',
    ES: 'Espanha',
  }
  return countries[String(code).toUpperCase()] || code
}

export default function GeoHeatmapView() {
  const { token, user: usuario, prefs } = useAuth()
  const { t } = useTranslation()
  const moedasCarousel = useCoinPrices()
  const [moedasFiltro, setMoedasFiltro] = useState([])
  
  const [heatmapData, setHeatmapData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  const topRegioes = useMemo(() => {
    if (!heatmapData || heatmapData.length <= 1) return []
    return heatmapData.slice(1)
      .map(([country, val]) => ({ country, val: Number(val) }))
      .sort((a, b) => b.val - a.val)
      .slice(0, 5)
  }, [heatmapData])

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
           const countryCode = item.geoTop1Code || item.GeoTop1Code
           chartData.push([
             getCountryName(countryCode),
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

      <section className="panel" style={{ marginTop: '20px', minHeight: '500px', backdropFilter: 'blur(16px)', background: 'rgba(20, 20, 20, 0.45)' }}>
        <Typography variant="h4" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1.5, fontFamily: 'Outfit, sans-serif', fontWeight: 800, color: 'var(--color-primary)' }}>
          <MdPublic /> {t('globalHotspot') || 'Geopolítica de Mercado'}
        </Typography>
        
        <Typography variant="body1" sx={{ opacity: 0.7, mb: 4, fontSize: '0.95rem' }}>
          Mapeamento global do interesse de busca pelo ativo, destacando as regiões que atualmente lideram a narrativa de mercado.
        </Typography>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
            <CircularProgress color="primary" />
          </Box>
        ) : heatmapData ? (
          <Grid container spacing={4}>
            {/* Mapa Coroplético Premium */}
            <Grid item xs={12} md={8}>
              <Box sx={{ 
                borderRadius: '16px', 
                overflow: 'hidden', 
                background: 'rgba(10, 10, 10, 0.45)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
                p: 2,
                backdropFilter: 'blur(8px)',
                position: 'relative'
              }}>
                <Chart
                  chartType="GeoChart"
                  width="100%"
                  height="450px"
                  data={heatmapData}
                  options={{
                    backgroundColor: 'transparent',
                    datalessRegionColor: '#121212',
                    defaultColor: '#1a1a1a',
                    colorAxis: { colors: ['#282208', '#cca92c', '#ffd700'] },
                    keepAspectRatio: true,
                    tooltip: { 
                      textStyle: { color: '#000000', fontName: 'Outfit', fontSize: 13 }
                    }
                  }}
                />
              </Box>
            </Grid>

            {/* Painel Lateral de Inteligência Geopolítica */}
            <Grid item xs={12} md={4}>
              <Box sx={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: 2,
                height: '100%',
                background: 'rgba(12, 12, 12, 0.65)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '16px',
                p: 3,
                boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
                backdropFilter: 'blur(12px)'
              }}>
                <Typography variant="h6" sx={{ color: 'var(--color-primary)', fontWeight: 800, fontFamily: 'Outfit, sans-serif', fontSize: '1.05rem', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                  Central de Inteligência
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.6, fontSize: '0.85rem', lineHeight: 1.4 }}>
                  Nível de aceleração e dominância de busca de narrativas por região geográfica para a moeda selecionada.
                </Typography>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 2 }}>
                  {topRegioes.length > 0 ? (
                    topRegioes.map((reg, idx) => (
                      <Box key={reg.country} sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Box sx={{ 
                              width: '26px', 
                              height: '26px', 
                              borderRadius: '50%', 
                              background: 'rgba(255, 215, 0, 0.08)', 
                              border: '1px solid rgba(255, 215, 0, 0.25)',
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center',
                              fontSize: '0.75rem',
                              fontWeight: 800,
                              color: 'var(--color-primary)',
                              fontFamily: 'Outfit, sans-serif'
                            }}>
                              {idx + 1}
                            </Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#fff', fontSize: '0.88rem', fontFamily: 'Outfit, sans-serif' }}>
                              {getCountryName(reg.country)}
                            </Typography>
                          </Box>
                          <Typography variant="body2" sx={{ fontWeight: 700, color: 'var(--color-primary)', fontSize: '0.88rem', fontFamily: 'Share Tech Mono, monospace' }}>
                            {reg.val}%
                          </Typography>
                        </Box>
                        <LinearProgress 
                          variant="determinate" 
                          value={Math.min(reg.val, 100)} 
                          sx={{ 
                            height: '5px', 
                            borderRadius: '3px',
                            background: 'rgba(255,255,255,0.03)',
                            '& .MuiLinearProgress-bar': {
                              background: 'linear-gradient(90deg, #cca92c 0%, #ffd700 100%)',
                              borderRadius: '3px',
                              boxShadow: '0 0 6px rgba(255, 215, 0, 0.35)'
                            }
                          }}
                        />
                      </Box>
                    ))
                  ) : (
                    <Box sx={{ p: 4, textAlign: 'center', opacity: 0.4 }}>
                      <Typography variant="body2" sx={{ fontStyle: 'italic' }}>Aguardando dados geográficos...</Typography>
                    </Box>
                  )}
                </Box>
              </Box>
            </Grid>
          </Grid>
        ) : (
          <Box sx={{ p: 6, textAlign: 'center', opacity: 0.5, background: 'rgba(10, 10, 10, 0.3)', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <MdAnalytics size={48} style={{ color: 'var(--color-primary)', marginBottom: '12px' }} />
            <Typography sx={{ fontFamily: 'Outfit, sans-serif' }}>Dados de mapa não disponíveis para o ativo selecionado no período.</Typography>
          </Box>
        )}
      </section>
    </div>
  )
}
