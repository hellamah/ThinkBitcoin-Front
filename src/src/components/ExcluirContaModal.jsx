import { useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { MdWarning } from 'react-icons/md'

import Modal from './Modal'
import { apiRequest, UserEndpoint, HttpMethod } from '../utils/apiClient'
import useTranslation from '../hooks/useTranslation'

// Confirmação da exclusão da própria conta. A senha não é só cerimônia: a
// sessão pode estar aberta numa máquina emprestada, e o backend a valida
// antes de apagar qualquer coisa.
export default function ExcluirContaModal({ visible, onClose, onDeleted }) {
  const { t } = useTranslation()
  const [senha, setSenha] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  const fechar = () => {
    if (loading) return
    setSenha('')
    setErro('')
    onClose()
  }

  const confirmar = async (e) => {
    e.preventDefault()
    if (!senha) {
      setErro(t('account.passwordRequired'))
      return
    }

    setLoading(true)
    setErro('')
    try {
      await apiRequest(UserEndpoint.DELETE_ACCOUNT, {
        method: HttpMethod.POST,
        body: { senha },
        suppressAuthRedirect: true,
      })
      setSenha('')
      // Sem soltar o loading: onDeleted desloga e o modal sai da árvore.
      onDeleted()
    } catch (err) {
      setErro(err.status === 400 ? t('account.invalidPassword') : t('account.errorDeletingAccount'))
      setLoading(false)
    }
  }

  return (
    <Modal visible={visible} onClose={fechar}>
      <Box component="form" onSubmit={confirmar} sx={{ display: 'flex', flexDirection: 'column', gap: 3, p: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ color: 'var(--danger-ink)', display: 'flex', fontSize: '2rem' }}>
            <MdWarning />
          </Box>
          <Typography variant="h6" sx={{
            fontWeight: 800,
            color: 'var(--text-primary)',
            fontFamily: "'Share Tech Mono', monospace",
            textTransform: 'uppercase',
          }}>
            {t('account.deleteConfirmTitle')}
          </Typography>
        </Box>

        <Typography variant="body2" sx={{ color: 'var(--text-muted)' }}>
          {t('account.deleteConfirmWarning')}
        </Typography>

        <TextField
          fullWidth
          autoFocus
          type="password"
          label={t('account.deleteConfirmPassword')}
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          disabled={loading}
          error={Boolean(erro)}
          helperText={erro || ' '}
          InputLabelProps={{ sx: { color: 'var(--text-muted)' } }}
          sx={{
            '& .MuiOutlinedInput-root': {
              backgroundColor: 'var(--surface-subtle)',
              borderRadius: '10px',
            },
            '& .MuiInputBase-input': { color: 'var(--text-primary)', fontWeight: 600 },
          }}
        />

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
          <Button
            onClick={fechar}
            disabled={loading}
            sx={{ color: 'var(--text-muted)', fontWeight: 700 }}
          >
            {t('account.cancel')}
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={loading}
            sx={{
              backgroundColor: 'var(--danger)',
              color: '#fff',
              fontWeight: 800,
              px: 3,
              borderRadius: '10px',
              '&:hover': { backgroundColor: 'var(--danger)', filter: 'brightness(1.1)' },
              '&.Mui-disabled': { backgroundColor: 'var(--danger-a10)', color: 'var(--text-faint)' },
            }}
          >
            {loading ? t('account.deleting') : t('account.deleteConfirmButton')}
          </Button>
        </Box>
      </Box>
    </Modal>
  )
}
