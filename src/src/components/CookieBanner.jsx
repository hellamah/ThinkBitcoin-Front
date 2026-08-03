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
      backgroundColor: 'var(--surface-overlay)',
      backdropFilter: 'blur(16px)',
      borderTop: '1px solid var(--accent-a15)',
      px: { xs: 2, md: 6 },
      py: { xs: 2, md: 2.5 },
      display: 'flex',
      alignItems: { xs: 'flex-start', md: 'center' },
      flexDirection: { xs: 'column', md: 'row' },
      gap: { xs: 2, md: 4 },
    }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, flex: 1 }}>
        <MdCookie style={{ color: 'var(--accent-ink)', fontSize: '1.3rem', flexShrink: 0, marginTop: 2 }} />
        <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.82rem', lineHeight: 1.6 }}>
          Utilizamos cookies essenciais para o funcionamento da plataforma e cookies de preferências para melhorar sua experiência.
          Consulte nossa{' '}
          {/* Caminho relativo, não a URL absoluta de produção: assim o link
              funciona no preview e no localhost em vez de pular para o site
              publicado. Abre em outra aba para não derrubar este banner. */}
          <Box component="a" href="/privacidade" target="_blank" rel="noopener"
            sx={{ color: 'var(--accent-ink)', textDecoration: 'none', fontWeight: 600, '&:hover': { opacity: 0.8 } }}>
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
            borderColor: 'var(--border-strong)',
            color: 'var(--text-muted)',
            borderRadius: '8px',
            fontSize: '0.78rem',
            px: 2,
            '&:hover': { borderColor: 'var(--border-interactive)', color: 'var(--text-primary)' },
          }}
        >
          Apenas essenciais
        </Button>
        <Button
          variant="contained"
          size="small"
          onClick={aceitar}
          sx={{
            backgroundColor: 'var(--accent)',
            color: 'var(--text-on-accent)',
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
