import { useState } from 'react'
import { Box, Typography, Button } from '@mui/material'
import { MdCookie } from 'react-icons/md'

const STORAGE_KEY = 'cookie_consent_v1'

export function hasCookieConsent() {
  try {
    return !!localStorage.getItem(STORAGE_KEY)
  } catch {
    return false
  }
}

function saveCookieConsent(value) {
  try {
    localStorage.setItem(STORAGE_KEY, value)
  } catch {}
}

function CookieBanner() {
  const [visivel, setVisivel] = useState(!hasCookieConsent())

  if (!visivel) return null

  const aceitar = () => {
    saveCookieConsent('all')
    setVisivel(false)
  }

  const essenciais = () => {
    saveCookieConsent('essential')
    setVisivel(false)
  }

  return (
    <Box sx={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 1400,
      background: 'rgba(10, 10, 10, 0.96)',
      backdropFilter: 'blur(16px)',
      borderTop: '1px solid rgba(255, 215, 0, 0.15)',
      px: { xs: 2, md: 6 },
      py: { xs: 2, md: 2.5 },
      display: 'flex',
      alignItems: { xs: 'flex-start', md: 'center' },
      flexDirection: { xs: 'column', md: 'row' },
      gap: { xs: 2, md: 4 },
    }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, flex: 1 }}>
        <MdCookie style={{ color: 'var(--color-primary)', fontSize: '1.3rem', flexShrink: 0, marginTop: 2 }} />
        <Typography sx={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.82rem', lineHeight: 1.6 }}>
          Utilizamos cookies essenciais para o funcionamento da plataforma e cookies de preferências para melhorar sua experiência.
          Consulte nossa{' '}
          <Box component="a" href="https://minerthinkbitcoin.com/privacidade" target="_blank" rel="noopener"
            sx={{ color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 600, '&:hover': { opacity: 0.8 } }}>
            Política de Privacidade
          </Box>.
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', gap: 1.5, flexShrink: 0 }}>
        <Button
          variant="outlined"
          size="small"
          onClick={essenciais}
          sx={{
            borderColor: 'rgba(255,255,255,0.2)',
            color: 'rgba(255,255,255,0.55)',
            borderRadius: '8px',
            fontSize: '0.78rem',
            px: 2,
            '&:hover': { borderColor: 'rgba(255,255,255,0.4)', color: '#fff' },
          }}
        >
          Apenas essenciais
        </Button>
        <Button
          variant="contained"
          size="small"
          onClick={aceitar}
          sx={{
            bgcolor: 'var(--color-primary)',
            color: '#000',
            borderRadius: '8px',
            fontSize: '0.78rem',
            fontWeight: 700,
            px: 2,
            '&:hover': { bgcolor: '#e0c200' },
          }}
        >
          Aceitar todos
        </Button>
      </Box>
    </Box>
  )
}

export default CookieBanner
