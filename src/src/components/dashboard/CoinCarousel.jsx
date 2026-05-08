import React from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'
import CardActionArea from '@mui/material/CardActionArea'
import IconButton from '@mui/material/IconButton'
import { MdTrendingUp, MdTrendingDown, MdRefresh, MdSmartToy } from 'react-icons/md'
import CryptoIcon from '../CryptoIcon'
import * as mathUtils from '../../utils/mathUtils'

export default function CoinCarousel({ 
  moedasCarousel, 
  moedasFiltro, 
  selecionarMoeda, 
  handleDebateTrigger, 
  t, 
  isMobile 
}) {
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
                  <div key={m.simbolo} className="top-item">
                    <CryptoIcon simbolo={m.simbolo} />
                    <span className="top-name">{m.nome}</span>
                    <span className={`top-var ${up ? 'positive' : 'negative'}`}>
                      {mathUtils.formatPercent(m.variacao)}
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
                    padding: { xs: '16px 8px 48px', sm: '24px 16px 64px' },
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

                <IconButton
                  className="ai-chat-btn-overlay"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDebateTrigger(m.simbolo);
                  }}
                  title={t('chatWithAI', { coin: m.simbolo })}
                >
                  <MdSmartToy />
                </IconButton>
              </Card>
            )
          })
        )}
        <Box sx={{ minWidth: { xs: '32px', sm: '48px' }, flex: '0 0 auto', height: '1px' }} />
      </div>
    </>
  )
}
