import { useState, useEffect } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Grid from '@mui/material/Grid'
import { MdSettings, MdTrendingUp, MdAccountBalanceWallet } from 'react-icons/md'

import { apiRequest, PatrimonioEndpoint } from '../../utils/apiClient'
import useTranslation from '../../hooks/useTranslation'
import PatrimonioModal from './PatrimonioModal'

export default function PatrimonioCard({ token, user }) {
  const { t } = useTranslation()
  const [patrimonio, setPatrimonio] = useState(null)
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)

  const carregarPatrimonio = async () => {
    if (!token || !user?.idUsuarioTB) return
    setLoading(true)
    try {
      const res = await apiRequest(PatrimonioEndpoint.BY_USER(user.idUsuarioTB), {
        headers: { Authorization: `Bearer ${token}` }
      })
      const dados = res?.resultado || res?.Resultado || null
      setPatrimonio(dados)
    } catch (err) {
      console.error('Erro ao buscar patrimônio:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarPatrimonio()
  }, [token, user])

  if (loading && !patrimonio) {
    return (
      <Box className="patrimonio-summary-card" sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={30} sx={{ color: 'var(--color-primary)' }} />
      </Box>
    )
  }

  const saldoBRL = patrimonio?.saldoTotalBRL ?? 0
  const saldoUSD = patrimonio?.saldoTotalUSD ?? 0

  return (
    <Box className="patrimonio-summary-card">
      <Grid container spacing={3} alignItems="center">
        <Grid item xs={12} md={7}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
            <MdAccountBalanceWallet style={{ fontSize: '1.4rem', color: 'var(--color-primary)' }} />
            <Typography className="patrimonio-title-glow" variant="subtitle2" sx={{ fontWeight: 800 }}>
              {t('patrimonio.title')}
            </Typography>
            {saldoBRL > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, bgcolor: 'rgba(76, 175, 80, 0.1)', color: '#81c784', px: 1, py: 0.2, borderRadius: '10px', fontSize: '0.7rem', fontWeight: 'bold', fontFamily: "'Share Tech Mono', monospace" }}>
                <MdTrendingUp /> ACTIVE_GROWTH
              </Box>
            )}
          </Box>

          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'flex-start', sm: 'baseline' }, gap: { xs: 1, sm: 3 } }}>
            <Typography className="patrimonio-value-brl">
              R$ {saldoBRL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Typography>
            <Typography className="patrimonio-value-usd">
              / $ {saldoUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Typography>
          </Box>
        </Grid>

        <Grid item xs={12} md={5} sx={{ display: 'flex', justifyContent: { xs: 'flex-start', md: 'flex-end' } }}>
          <Button
            variant="outlined"
            onClick={() => setModalOpen(true)}
            className="patrimonio-btn-manage"
            startIcon={<MdSettings />}
            sx={{ px: 3, py: 1 }}
          >
            {t('patrimonio.manage').toUpperCase()}
          </Button>
        </Grid>
      </Grid>

      {/* Modal de Gestão */}
      <PatrimonioModal
        visible={modalOpen}
        onClose={() => setModalOpen(false)}
        token={token}
        user={user}
        patrimonio={patrimonio}
        onRefresh={carregarPatrimonio}
      />
    </Box>
  )
}
