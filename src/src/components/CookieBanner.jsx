import { useCallback, useEffect, useState } from 'react'
import { Box, Typography, Button } from '@mui/material'
import { MdCookie } from 'react-icons/md'
import { apiRequest, ConsentimentoEndpoint, HttpMethod } from '../utils/apiClient'
import { OrigemConsentimento, TipoConsentimento } from '../utils/consentimento'
import { useAuth } from '../context/AuthContext'
import useTranslation from '../hooks/useTranslation'

const STORAGE_KEY = 'cookie_consent_v1'
// Marca de que a escolha guardada localmente já foi registrada na trilha do
// usuário. Sem ela, todo carregamento da Home tentaria reenviar o mesmo aceite.
const SYNC_KEY = 'cookie_consent_sincronizado_v1'

function hasCookieConsent() {
  try {
    return !!localStorage.getItem(STORAGE_KEY)
  } catch {
    return false
  }
}

function lerCookieConsent() {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function saveCookieConsent(value) {
  try {
    localStorage.setItem(STORAGE_KEY, value)
    localStorage.removeItem(SYNC_KEY)
  } catch { /* storage indisponível (modo privado): o consentimento fica só nesta sessão */ }
}

function marcarSincronizado() {
  try {
    localStorage.setItem(SYNC_KEY, '1')
  } catch { /* idem: sem storage, sincroniza de novo na próxima visita */ }
}

function jaSincronizado() {
  try {
    return localStorage.getItem(SYNC_KEY) === '1'
  } catch {
    return false
  }
}

function CookieBanner() {
  const { token } = useAuth()
  const { t } = useTranslation()
  const [visivel, setVisivel] = useState(!hasCookieConsent())

  /**
   * Registra a escolha na trilha do usuário.
   *
   * Só com token: a trilha é do titular, e visitante anônimo não tem a quem ser
   * associado — para ele o localStorage segue sendo o registro possível.
   */
  const registrarNaTrilha = useCallback(
    async (aceitouTodos) => {
      if (!token) return

      try {
        await apiRequest(ConsentimentoEndpoint.REGISTRAR, {
          method: HttpMethod.POST,
          body: {
            origem: OrigemConsentimento.BANNER_COOKIES,
            itens: [{ tipo: TipoConsentimento.COOKIES, idDocumentoLegal: null, concedido: aceitouTodos }],
          },
        })
        marcarSincronizado()
      } catch (err) {
        // Falhar aqui não pode desfazer a escolha do usuário na tela: a
        // preferência já vale localmente e a sincronização tenta de novo depois.
        console.error('Erro ao registrar consentimento de cookies:', err)
      }
    },
    [token]
  )

  // Quem escolheu antes de entrar na conta — ou antes desta tela existir —
  // teria a preferência presa no navegador. Ao autenticar, ela sobe uma vez.
  // O servidor ignora reenvio idêntico, então nada disso polui a trilha.
  useEffect(() => {
    if (!token || jaSincronizado()) return

    const escolha = lerCookieConsent()
    if (!escolha) return

    registrarNaTrilha(escolha === 'all')
  }, [token, registrarNaTrilha])

  if (!visivel) return null

  const responder = (valor) => {
    saveCookieConsent(valor)
    setVisivel(false)
    registrarNaTrilha(valor === 'all')
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
          {t('cookies.texto')}{' '}
          {/* Caminho relativo, não a URL absoluta de produção: assim o link
              funciona no preview e no localhost em vez de pular para o site
              publicado. Abre em outra aba para não derrubar este banner. */}
          <Box component="a" href="/privacidade" target="_blank" rel="noopener"
            sx={{ color: 'var(--accent-ink)', textDecoration: 'none', fontWeight: 600, '&:hover': { opacity: 0.8 } }}>
            {t('cookies.politica')}
          </Box>.
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', gap: 1.5, flexShrink: 0 }}>
        <Button
          variant="outlined"
          size="small"
          onClick={() => responder('essential')}
          sx={{
            borderColor: 'var(--border-strong)',
            color: 'var(--text-muted)',
            borderRadius: '8px',
            fontSize: '0.78rem',
            px: 2,
            '&:hover': { borderColor: 'var(--border-interactive)', color: 'var(--text-primary)' },
          }}
        >
          {t('cookies.apenasEssenciais')}
        </Button>
        <Button
          variant="contained"
          size="small"
          onClick={() => responder('all')}
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
          {t('cookies.aceitarTodos')}
        </Button>
      </Box>
    </Box>
  )
}

export default CookieBanner
