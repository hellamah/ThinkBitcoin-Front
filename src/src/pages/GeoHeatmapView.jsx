import React, { useState, useEffect, useMemo } from 'react'
import { Chart } from 'react-google-charts'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import Grid from '@mui/material/Grid'
import LinearProgress from '@mui/material/LinearProgress'
import Button from '@mui/material/Button'
import Fade from '@mui/material/Fade'
import { MdPublic, MdAnalytics, MdClose } from 'react-icons/md'

import DashboardHeader from '../components/dashboard/DashboardHeader'
import ErrorMessage from '../components/ErrorMessage'
import CoinCarousel from '../components/dashboard/CoinCarousel'
import { useAuth } from '../context/AuthContext'
import { useDashboard } from '../context/DashboardContext'
import useTranslation from '../hooks/useTranslation'
import useCoinPrices from '../hooks/useCoinPrices'
import { apiRequest, VariavelExternaEndpoint } from '../utils/apiClient'
import { MapRegion } from '../utils/enums'
import { formatTooltipData, getRegionForCountry, filterCoinsByCountry } from '../utils/mapUtils'

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
    ZA: 'África do Sul',
    NG: 'Nigéria',
    EG: 'Egito',
    KE: 'Quênia',
    GH: 'Gana',
    MA: 'Marrocos',
    NZ: 'Nova Zelândia',
    KR: 'Coreia do Sul',
    MX: 'México',
    AR: 'Argentina',
    CO: 'Colômbia',
  }
  return countries[String(code).toUpperCase()] || code
}

export default function GeoHeatmapView() {
  const { token, user: usuario, prefs } = useAuth()
  const { refreshTrigger, moedaSelecionada, setMoedaSelecionada } = useDashboard()
  const { t } = useTranslation()
  const moedasCarousel = useCoinPrices()
  
  const [heatmapData, setHeatmapData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200)
  const [paisSelecionado, setPaisSelecionado] = useState(null)
  const [regionSelecionada, setRegionSelecionada] = useState(MapRegion.WORLD)
  const [intervaloMapa, setIntervaloMapa] = useState('24h')


  // Otimizado: Resize handler com debounce de 150ms para evitar gargalos com renderização do SVG
  useEffect(() => {
    let timeoutId = null
    const handleResize = () => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        setWindowWidth(window.innerWidth)
      }, 150)
    }
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      clearTimeout(timeoutId)
    }
  }, [])

  const chartHeight = useMemo(() => {
    if (windowWidth < 600) return '280px'
    if (windowWidth < 960) return '360px'
    return '450px'
  }, [windowWidth])

  // moedasFiltro derivada do estado global moedaSelecionada
  const moedasFiltro = useMemo(() => {
    return moedaSelecionada ? [moedaSelecionada] : []
  }, [moedaSelecionada])

  const topRegioes = useMemo(() => {
    if (!heatmapData || heatmapData.length <= 1) return []
    // Ignora o cabeçalho do chartData e mapeia, desempacotando objeto do país se houver
    const items = heatmapData.slice(1)
      .map(([countryCell, val]) => {
        const country = typeof countryCell === 'object' ? countryCell.v : countryCell
        return { country, val: Number(val) }
      })
      .sort((a, b) => b.val - a.val)
      .slice(0, 5)

    const totalSum = items.reduce((acc, curr) => acc + curr.val, 0)
    if (totalSum === 0) return items.map(item => ({ ...item, displayVal: 0 }))

    // Calcula a participação relativa de cada país para que a soma feche em 100% no painel
    let calculatedItems = items.map(item => ({
      ...item,
      displayVal: Math.round((item.val / totalSum) * 100)
    }))

    // Corrige pequenas variações de arredondamento matemático para somar exatamente 100%
    const currentSum = calculatedItems.reduce((acc, curr) => acc + curr.displayVal, 0)
    const diff = 100 - currentSum
    if (diff !== 0 && calculatedItems.length > 0) {
      calculatedItems[0].displayVal += diff
    }

    return calculatedItems
  }, [heatmapData])

  // Filtra as moedas do carrossel baseado no país selecionado
  const moedasExibidas = useMemo(() => {
    const filtered = filterCoinsByCountry(paisSelecionado, moedasCarousel)
    // Garante que o ativo selecionado no momento sempre esteja presente no carrossel para não quebrar a UI
    if (moedaSelecionada && !filtered.find(m => m.simbolo === moedaSelecionada)) {
      const match = moedasCarousel?.find(m => m.simbolo === moedaSelecionada)
      if (match) {
        filtered.push(match)
      }
    }
    return filtered
  }, [paisSelecionado, moedasCarousel, moedaSelecionada])

  // Identifica dinamicamente quais regiões têm dados presentes para habilitar/desabilitar botões de zoom
  const activeRegions = useMemo(() => {
    const active = new Set([MapRegion.WORLD]) // Mundo está sempre disponível
    if (heatmapData && heatmapData.length > 1) {
      heatmapData.slice(1).forEach(([countryCell]) => {
        const countryCode = typeof countryCell === 'object' ? countryCell.v : countryCell
        const region = getRegionForCountry(countryCode)
        if (region) {
          active.add(region)
        }
      })
    }
    return active
  }, [heatmapData])

  useEffect(() => {
    if (!token || !moedasCarousel?.length || moedaSelecionada) return

    const moedaProp = prefs?.siglaMoedaPreferida || prefs?.moedaPreferida
    let initialized = false
    if (moedaProp) {
      const match = moedasCarousel.find(m =>
        (m.simbolo && String(m.simbolo).toUpperCase() === String(moedaProp).toUpperCase().trim())
      )
      if (match) {
        setMoedaSelecionada(match.simbolo)
        initialized = true
      }
    }

    if (!initialized) {
      const btc = moedasCarousel.find(m => m.simbolo === 'BTC') || moedasCarousel[0]
      if (btc) setMoedaSelecionada(btc.simbolo)
    }
  }, [prefs, token, moedasCarousel, moedaSelecionada, setMoedaSelecionada])

  const carregarHeatmap = async () => {
    if (!token || !moedaSelecionada) return

    setLoading(true)
    setErro('')
    try {
      const moeda = moedasCarousel.find(m => m.simbolo === moedaSelecionada)
      const idMoedaParam = moeda && moeda.id ? `?idMoeda=${moeda.id}` : ''
      const sep = idMoedaParam ? '&' : '?'
      const url = `${VariavelExternaEndpoint.TREND_HEATMAP}${idMoedaParam}${sep}intervalo=${intervaloMapa}`
      const response = await apiRequest(url, { headers: { Authorization: `Bearer ${token}` } })

      let rawData = []
      if (response && response.resultado) {
        rawData = Array.isArray(response.resultado) ? response.resultado : (response.resultado.registros || [])
      } else if (Array.isArray(response)) {
        rawData = response
      }

      // Calcula as participações relativas proporcionais das top 5 regiões para o Tooltip
      const top5List = rawData.map(item => {
        const countryCode = String(item.geoTop1Code || item.GeoTop1Code).toUpperCase()
        const val = Number(item.frequenciaLideranca || item.FrequenciaLideranca || item.mediaIntensidade || item.MediaIntensidade || 0)
        return { countryCode, val }
      }).sort((a, b) => b.val - a.val).slice(0, 5)

      const totalSum = top5List.reduce((acc, curr) => acc + curr.val, 0)
      const sharesMap = {}
      if (totalSum > 0) {
        let sumShares = 0
        top5List.forEach(item => {
          const share = Math.round((item.val / totalSum) * 100)
          sharesMap[item.countryCode] = share
          sumShares += share
        })
        const diff = 100 - sumShares
        if (diff !== 0 && top5List.length > 0) {
          sharesMap[top5List[0].countryCode] += diff
        }
      }

      // Converte para o formato do Google Charts com suporte a HTML Tooltips contendo as porcentagens normalizadas
      const chartData = [
        [
          "Country", 
          t('marketInterest') || "Interesse Global (Dominância)", 
          { role: 'tooltip', type: 'string', p: { html: true } }
        ]
      ]
      if (rawData && rawData.length > 0) {
        rawData.forEach(item => {
           const countryCode = String(item.geoTop1Code || item.GeoTop1Code).toUpperCase()
           const val = item.frequenciaLideranca || item.FrequenciaLideranca || item.mediaIntensidade || item.MediaIntensidade || 0
           const normalizedPercent = sharesMap[countryCode] || 0
           
           const tooltipHtml = formatTooltipData(getCountryName(countryCode), moedaSelecionada, normalizedPercent)
           chartData.push([
             { v: countryCode, f: '' }, // Habilita o valor formatado vazio para omitir o cabeçalho padrão (ex: "US")
             val, // Mantém valor bruto para escala de coloração coroplética no mapa
             tooltipHtml
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
  }, [moedaSelecionada, token, refreshTrigger, intervaloMapa])

  const selecionarMoeda = (simbolo) => {
    setMoedaSelecionada(simbolo)
  }

  const handleCountryClick = (countryCode) => {
    if (paisSelecionado === countryCode) {
      setPaisSelecionado(null)
      setRegionSelecionada(MapRegion.WORLD)
    } else {
      setPaisSelecionado(countryCode)
      const region = getRegionForCountry(countryCode)
      setRegionSelecionada(region)
    }
  }

  const chartEvents = useMemo(() => [
    {
      eventName: 'select',
      callback: ({ chartWrapper }) => {
        const chart = chartWrapper.getChart()
        const selection = chart.getSelection()
        if (selection.length > 0) {
          const row = selection[0].row
          if (heatmapData && heatmapData[row + 1]) {
            const countryCell = heatmapData[row + 1][0]
            const countryCode = typeof countryCell === 'object' ? countryCell.v : countryCell
            handleCountryClick(countryCode)
          }
          // Limpa seleção para evitar coloração cinza padrão do Google Charts
          chart.setSelection([])
        }
      }
    }
  ], [heatmapData, paisSelecionado])

  const chartOptions = useMemo(() => ({
    backgroundColor: 'transparent',
    datalessRegionColor: '#1a1a1a',
    defaultColor: '#252525',
    colorAxis: { colors: ['#282208', '#cca92c', '#ffd700'] },
    keepAspectRatio: true,
    region: regionSelecionada,
    tooltip: { 
      isHtml: true,
      trigger: 'focus'
    }
  }), [regionSelecionada])

  if (!token) return <Box sx={{ p: 5 }}>Redirecting to login...</Box>

  return (
    <div className="dashboard-container">
      {/* Estilo CSS Global Injetado para remover bordas/backgrounds e sombras padrão dos tooltips do Google Charts */}
      <style dangerouslySetInnerHTML={{__html: `
        .google-visualization-tooltip {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          padding: 0 !important;
          pointer-events: none !important;
        }
      `}} />

      <DashboardHeader t={t} prefs={prefs} usuario={usuario} title={t('nav.heatmap') || 'Geopolítica'} />

      <ErrorMessage message={erro} onClose={() => setErro('')} />

      <CoinCarousel 
        moedasCarousel={moedasExibidas}
        moedasFiltro={moedasFiltro}
        selecionarMoeda={selecionarMoeda}
        handleDebateTrigger={() => {}}
        t={t}
        isMobile={false}
        isHeatmap={true}
      />

      <section className="panel" style={{ marginTop: '20px', minHeight: '550px', backdropFilter: 'blur(16px)', background: 'rgba(20, 20, 20, 0.45)' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, flexDirection: { xs: 'column', sm: 'row' }, gap: 2, mb: 4 }}>
          <Box>
            <Typography variant="h4" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1.5, fontFamily: 'Outfit, sans-serif', fontWeight: 800, color: 'var(--color-primary)' }}>
              <MdPublic /> {t('globalHotspot') || 'Geopolítica de Mercado'}
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.7, fontSize: '0.95rem' }}>
              Mapeamento global do interesse de busca pelo ativo, destacando as regiões que atualmente lideram a narrativa de mercado.
            </Typography>
          </Box>
          <Box sx={{ flexShrink: 0 }}>
            <div className="interval-selector-mini">
              {[
                { label: '1H', value: '1h' },
                { label: '1D', value: '24h' },
                { label: '1M', value: '1m' }
              ].map((opt) => (
                <button
                  key={opt.value}
                  className={`interval-btn-mini ${intervaloMapa === opt.value ? 'active' : ''}`}
                  onClick={() => setIntervaloMapa(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </Box>
        </Box>

        {/* Banner Informativo de Filtro por País */}
        {paisSelecionado && (
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            background: 'rgba(255, 215, 0, 0.08)',
            border: '1px solid rgba(255, 215, 0, 0.25)',
            borderRadius: '12px',
            px: 2,
            py: 1,
            mb: 3,
            backdropFilter: 'blur(8px)',
            animation: 'fadeIn 0.4s ease'
          }}>
            <Typography variant="body2" sx={{ color: '#fff', fontSize: '0.88rem', fontFamily: 'Outfit, sans-serif' }}>
              🔍 Filtrando carrossel de ativos mais populares em: <strong>{getCountryName(paisSelecionado)}</strong>
            </Typography>
            <Button 
              size="small" 
              onClick={() => {
                setPaisSelecionado(null)
                setRegionSelecionada(MapRegion.WORLD)
              }}
              startIcon={<MdClose />}
              sx={{ 
                color: 'var(--color-primary)', 
                textTransform: 'none',
                fontWeight: 'bold',
                fontSize: '0.8rem',
                '&:hover': {
                  background: 'rgba(255, 215, 0, 0.12)'
                }
              }}
            >
              Limpar Filtro
            </Button>
          </Box>
        )}

        {/* Barra de Controle de Zoom e Pan Regional */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 3, alignItems: 'center' }}>
          <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.5)', mr: 1, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
            Zoom Geográfico:
          </Typography>
          {Object.entries(MapRegion).map(([key, value]) => {
            const isSelected = regionSelecionada === value
            const isActive = activeRegions.has(value)
            const label = {
              WORLD: 'Mundo',
              AMERICAS: 'Américas',
              EUROPE: 'Europa',
              ASIA: 'Ásia',
              AFRICA: 'África',
              OCEANIA: 'Oceania'
            }[key]

            return (
              <Box
                key={key}
                onClick={() => {
                  if (!isActive) return
                  setRegionSelecionada(value)
                  // Se mudarmos a região manualmente, limpa o filtro de país caso ele não pertença à nova região
                  if (paisSelecionado) {
                    const countryRegion = getRegionForCountry(paisSelecionado)
                    if (countryRegion !== value && value !== MapRegion.WORLD) {
                      setPaisSelecionado(null)
                    }
                  }
                }}
                sx={{
                  px: 2,
                  py: 0.6,
                  borderRadius: '20px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: isActive ? 'pointer' : 'not-allowed',
                  fontFamily: 'Outfit, sans-serif',
                  background: isSelected ? 'var(--color-primary)' : 'rgba(255, 255, 255, 0.04)',
                  color: isSelected ? '#000' : (isActive ? 'rgba(255, 255, 255, 0.7)' : 'rgba(255, 255, 255, 0.2)'),
                  border: '1px solid',
                  borderColor: isSelected ? 'var(--color-primary)' : (isActive ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.02)'),
                  opacity: isActive ? 1 : 0.45,
                  boxShadow: isSelected ? '0 0 12px rgba(255, 215, 0, 0.25)' : 'none',
                  transition: 'all 0.3s cubic-bezier(0.165, 0.84, 0.44, 1)',
                  '&:hover': isActive ? {
                    background: isSelected ? 'var(--color-primary)' : 'rgba(255, 255, 255, 0.08)',
                    borderColor: isSelected ? 'var(--color-primary)' : 'rgba(255, 215, 0, 0.3)',
                    color: isSelected ? '#000' : '#fff'
                  } : {}
                }}
              >
                {label}
              </Box>
            )
          })}
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
            <CircularProgress color="primary" />
          </Box>
        ) : heatmapData ? (
          <Fade in={!loading} timeout={500}>
            <Grid container spacing={4}>
              {/* Mapa Coroplético Premium */}
              <Grid size={{ xs: 12, md: 8 }}>
                <Box sx={{ 
                  height: { xs: 'auto', md: '100%' },
                  display: 'flex',
                  flexDirection: 'column',
                  borderRadius: '16px', 
                  overflow: 'hidden', 
                  background: 'rgba(10, 10, 10, 0.45)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
                  p: 2,
                  backdropFilter: 'blur(8px)',
                  position: 'relative',
                  transition: 'all 0.4s cubic-bezier(0.165, 0.84, 0.44, 1)',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    borderColor: 'var(--color-primary)',
                    boxShadow: '0 18px 48px rgba(0,0,0,0.7), 0 0 20px rgba(255, 215, 0, 0.08)'
                  }
                }}>
                  <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: chartHeight }}>
                    <Chart
                      key={`${windowWidth}-${regionSelecionada}-${moedaSelecionada}-${intervaloMapa}`}
                      chartType="GeoChart"
                      width="100%"
                      height={chartHeight}
                      data={heatmapData}
                      options={chartOptions}
                      chartEvents={chartEvents}
                    />
                  </Box>
                </Box>
              </Grid>

              {/* Painel Lateral de Inteligência Geopolítica */}
              <Grid size={{ xs: 12, md: 4 }}>
                <Box sx={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: 2,
                  height: { xs: 'auto', md: '100%' },
                  background: 'rgba(12, 12, 12, 0.65)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: '16px',
                  p: 3,
                  boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
                  backdropFilter: 'blur(12px)',
                  transition: 'all 0.4s cubic-bezier(0.165, 0.84, 0.44, 1)',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    borderColor: 'var(--color-primary)',
                    boxShadow: '0 18px 48px rgba(0,0,0,0.7), 0 0 20px rgba(255, 215, 0, 0.08)'
                  }
                }}>
                  <Typography variant="h6" sx={{ color: 'var(--color-primary)', fontWeight: 800, fontFamily: 'Outfit, sans-serif', fontSize: '1.05rem', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                    Central de Inteligência
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.6, fontSize: '0.85rem', lineHeight: 1.4 }}>
                    Nível de aceleração e dominância de busca de narrativas por região geográfica para a moeda selecionada ({moedaSelecionada}).
                  </Typography>

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 2 }}>
                    {topRegioes.length > 0 ? (
                      topRegioes.map((reg, idx) => (
                        <Box 
                          key={reg.country} 
                          onClick={() => handleCountryClick(reg.country)}
                          sx={{ 
                            display: 'flex', 
                            flexDirection: 'column', 
                            gap: 0.8,
                            cursor: 'pointer',
                            p: 1.2,
                            borderRadius: '8px',
                            transition: 'all 0.2s cubic-bezier(0.165, 0.84, 0.44, 1)',
                            background: paisSelecionado === reg.country ? 'rgba(255, 215, 0, 0.04)' : 'transparent',
                            border: '1px solid',
                            borderLeft: paisSelecionado === reg.country ? '4px solid var(--color-primary)' : '1px solid transparent',
                            borderColor: paisSelecionado === reg.country ? 'rgba(255, 215, 0, 0.25)' : 'transparent',
                            '&:hover': {
                              background: 'rgba(255, 255, 255, 0.03)'
                            }
                          }}
                        >
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                              <Box sx={{ 
                                width: '26px', 
                                height: '26px', 
                                borderRadius: '50%', 
                                background: paisSelecionado === reg.country ? 'var(--color-primary)' : 'rgba(255, 215, 0, 0.08)', 
                                border: '1px solid rgba(255, 215, 0, 0.25)',
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                fontSize: '0.75rem',
                                fontWeight: 800,
                                color: paisSelecionado === reg.country ? '#000' : 'var(--color-primary)',
                                fontFamily: 'Outfit, sans-serif'
                              }}>
                                {idx + 1}
                              </Box>
                              <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#fff', fontSize: '0.88rem', fontFamily: 'Outfit, sans-serif' }}>
                                {getCountryName(reg.country)}
                              </Typography>
                            </Box>
                            <Typography variant="body2" sx={{ fontWeight: 700, color: 'var(--color-primary)', fontSize: '0.88rem', fontFamily: 'Share Tech Mono, monospace' }}>
                              {reg.displayVal}%
                            </Typography>
                          </Box>
                          <LinearProgress 
                            variant="determinate" 
                            value={reg.displayVal} 
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
          </Fade>
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
