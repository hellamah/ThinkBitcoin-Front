import React, { useRef, useState, useEffect, useCallback } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'
import CardActionArea from '@mui/material/CardActionArea'
import { MdTrendingUp, MdTrendingDown, MdRefresh, MdChevronLeft, MdChevronRight } from 'react-icons/md'
import CryptoIcon from '../CryptoIcon'
import * as mathUtils from '../../utils/mathUtils'

export default function CoinCarousel({
  moedasCarousel,
  moedasFiltro,
  selecionarMoeda,
  t,
  isMobile,
  isHeatmap
}) {
  const carrosselRef = useRef(null)
  const centralizouSelecaoRef = useRef(false)
  const [podeRolarEsquerda, setPodeRolarEsquerda] = useState(false)
  const [podeRolarDireita, setPodeRolarDireita] = useState(false)

  const atualizarSetas = useCallback(() => {
    const el = carrosselRef.current
    if (!el) return
    setPodeRolarEsquerda(el.scrollLeft > 2)
    setPodeRolarDireita(el.scrollLeft < el.scrollWidth - el.clientWidth - 2)
  }, [])

  // A lista de moedas vem do backend com tamanho variável; a barra de rolagem é
  // escondida por estilo, então mouse precisa de rodinha + setas para navegar.
  useEffect(() => {
    const el = carrosselRef.current
    if (!el) return
    atualizarSetas()

    // Converte a rodinha vertical em rolagem horizontal do carrossel.
    // Registrado manualmente porque precisa de passive: false para o
    // preventDefault impedir a página de rolar junto.
    const aoUsarRodinha = (e) => {
      if (el.scrollWidth <= el.clientWidth) return
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return // gesto horizontal nativo (trackpad)
      e.preventDefault()
      el.scrollLeft += e.deltaY
    }

    const observador = new ResizeObserver(atualizarSetas)
    observador.observe(el)
    el.addEventListener('scroll', atualizarSetas, { passive: true })
    el.addEventListener('wheel', aoUsarRodinha, { passive: false })
    return () => {
      observador.disconnect()
      el.removeEventListener('scroll', atualizarSetas)
      el.removeEventListener('wheel', aoUsarRodinha)
    }
  }, [atualizarSetas, moedasCarousel.length])

  // A moeda preferida (ex.: BTC) pode carregar fora da área visível quando a
  // lista do backend é longa: centraliza a seleção inicial uma única vez.
  useEffect(() => {
    if (centralizouSelecaoRef.current || !moedasFiltro?.length) return
    const selecionado = carrosselRef.current?.querySelector('.carousel-item.selected')
    if (!selecionado) return
    centralizouSelecaoRef.current = true
    selecionado.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [moedasFiltro])

  const rolar = (direcao) => {
    const el = carrosselRef.current
    if (!el) return
    el.scrollBy({ left: direcao * el.clientWidth * 0.7, behavior: 'smooth' })
  }

  const carouselContent = (
    <div className={`crypto-carousel-wrapper ${podeRolarEsquerda ? 'can-left' : ''} ${podeRolarDireita ? 'can-right' : ''}`}>
      {podeRolarEsquerda && (
        <button type="button" className="carousel-nav prev" onClick={() => rolar(-1)} aria-label={t('carrosselAnterior') || 'Moedas anteriores'}>
          <MdChevronLeft />
        </button>
      )}
      {podeRolarDireita && (
        <button type="button" className="carousel-nav next" onClick={() => rolar(1)} aria-label={t('carrosselProximo') || 'Próximas moedas'}>
          <MdChevronRight />
        </button>
      )}
    <div
      className="crypto-carousel"
      ref={carrosselRef}
      style={isHeatmap ? {
        marginTop: '0px',
        padding: '10px 0px 10px',
        border: 'none',
        background: 'transparent',
        boxShadow: 'none'
      } : {}}
    >
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
                minWidth: { xs: 100, sm: 120 },
                border: isSelected ? '2px solid var(--color-primary) !important' : '1px solid rgba(255,255,255,0.05) !important',
                transform: isSelected ? 'scale(1.05)' : 'none',
                boxShadow: isSelected ? '0 0 15px rgba(255, 215, 0, 0.3) !important' : 'none'
              }}
            >
              <CardActionArea
                className={`carousel-card-inner ${isSelected ? 'selected' : ''}`}
                onClick={() => selecionarMoeda(m.simbolo)}
                sx={{
                  padding: { xs: '16px 8px', sm: '24px 16px' },
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: { xs: 1, sm: 2 },
                  width: '100%',
                  height: '100%',
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
                  <CryptoIcon simbolo={m.simbolo} size={isMobile ? 32 : 40} />
                </div>
                <div className="carousel-info">
                  <span className="carousel-name" style={{ fontWeight: isSelected ? 700 : 400, color: isSelected ? 'var(--color-primary)' : 'inherit' }}>
                    {m.simbolo}
                  </span>
                  <span className={`carousel-price ${isUp ? 'positive' : 'negative'}`} style={{ fontSize: '0.85rem' }}>
                    {mathUtils.formatCurrency(m.valor)}
                  </span>
                  <div className={`carousel-mini-var ${isUp ? 'up' : 'down'}`}>
                    {isUp ? <MdTrendingUp /> : <MdTrendingDown />}
                    {mathUtils.formatPercent(m.variacao, 1)}
                  </div>
                </div>

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
      <Box sx={{ minWidth: { xs: '32px', sm: '48px' }, flex: '0 0 auto', height: '1px' }} />
    </div>
    </div>
  )

  if (isHeatmap) {
    return (
      <Box className="panel top-coins" sx={{ mb: '20px' }}>
        <h2>
          <MdTrendingUp style={{ verticalAlign: 'middle', marginRight: '10px' }} /> 
          {t('selectAssetHeatmap') || 'Selecione o Ativo para Análise Geopolítica'}
        </h2>
        {carouselContent}
      </Box>
    )
  }

  return (
    <>
      <Box className="panel top-coins">
        <h2><MdTrendingUp style={{ verticalAlign: 'middle', marginRight: '10px' }} /> {t('topCoins')}</h2>
        <div className="top-list">
          {moedasCarousel.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center', opacity: 0.6 }}>
              <Typography variant="body2" sx={{ fontStyle: 'italic' }}>{t('loadingCoins')}...</Typography>
            </Box>
          ) : (
            moedasCarousel
              .slice()
              .sort((a, b) => b.variacao - a.variacao)
              .slice(0, 5)
              .map((m) => {
                const up = m.variacao >= 0
                return (
                  <div key={m.simbolo} className="top-item-card">
                    <div className="top-item-main">
                      <div className="top-item-icon-wrapper">
                        <CryptoIcon simbolo={m.simbolo} size={28} />
                      </div>
                      <div className="top-item-info">
                        <div className="top-item-header-row">
                          <span className="top-name">{m.nome}</span>
                          <span className={`top-var-badge ${up ? 'up' : 'down'}`}>
                            {up ? '▲' : '▼'} {mathUtils.formatPercent(m.variacao).replace('+', '').replace('-', '')}
                          </span>
                        </div>
                        <span className="top-price">{mathUtils.formatCurrency(m.valor)}</span>
                      </div>
                    </div>
                  </div>
                )
              })
          )}
        </div>
      </Box>

      {carouselContent}
    </>
  )
}
