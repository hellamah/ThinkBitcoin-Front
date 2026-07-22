import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { TextField, Button, Box, Paper, Typography, CircularProgress } from '@mui/material'
import { MdLock } from 'react-icons/md'
import logo from '../../logo-light.svg'
import { apiRequest, HttpMethod, UserEndpoint } from '../utils/apiClient'

function RedefinirSenha() {
  const [searchParams] = useSearchParams()
  const navegar = useNavigate()
  const token = searchParams.get('token')

  const [novaSenha, setNovaSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState(false)
  const [carregando, setCarregando] = useState(false)

  useEffect(() => {
    if (!token) setErro('Link inválido. Solicite uma nova redefinição de senha.')
  }, [token])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErro('')
    if (novaSenha !== confirmarSenha) {
      setErro('As senhas não coincidem.')
      return
    }
    try {
      setCarregando(true)
      await apiRequest(UserEndpoint.REDEFINIR_SENHA, {
        method: HttpMethod.POST,
        body: { token, novaSenha },
        suppressAuthRedirect: true,
      })
      setSucesso(true)
      setTimeout(() => navegar('/login'), 3000)
    } catch (err) {
      if (err.status === 400) {
        setErro('Token inválido, já utilizado ou expirado. Solicite uma nova redefinição.')
      } else {
        setErro('Não foi possível redefinir a senha. Tente novamente.')
      }
    } finally {
      setCarregando(false)
    }
  }

  const inputSx = {
    mb: 2,
    '& .MuiFilledInput-root': {
      backgroundColor: 'var(--surface-fill)',
      borderRadius: '12px',
      border: '1px solid var(--border-strong)',
      '&:hover': { backgroundColor: 'var(--surface-fill-strong)', borderColor: 'var(--color-primary)' },
      '&.Mui-focused': { backgroundColor: 'var(--surface-fill-strong)', borderColor: 'var(--color-primary)' },
    },
    '& .MuiInputLabel-root': { color: 'var(--text-muted)' },
    '& .MuiInputLabel-root.Mui-focused': { color: 'var(--accent-ink)' },
  }

  return (
    <Box className="form-page">
      <Paper
        elevation={0}
        sx={{
          maxWidth: '440px',
          width: '95%',
          p: { xs: 4, md: 6 },
          backgroundColor: 'var(--surface-overlay)',
          backdropFilter: 'blur(20px)',
          borderRadius: '24px',
          border: '1px solid var(--accent-a15)',
          boxShadow: '0 25px 50px -12px var(--scrim)',
        }}
      >
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <img src={logo} alt="ThinkBitcoin Logo" style={{ height: '70px', marginBottom: '16px' }} />
          <Typography variant="h5" sx={{ fontWeight: 800, color: 'var(--accent-ink)' }}>
            Redefinir senha
          </Typography>
        </Box>

        {sucesso ? (
          <Box sx={{ textAlign: 'center', py: 2 }}>
            <Typography sx={{ color: 'var(--success)', fontSize: '1rem', mb: 2 }}>
              Senha redefinida com sucesso!
            </Typography>
            <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              Redirecionando para o login...
            </Typography>
          </Box>
        ) : (
          <form onSubmit={handleSubmit}>
            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
              <TextField
                fullWidth label="Nova senha" type="password"
                value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)}
                required variant="filled" sx={inputSx}
                InputProps={{
                  disableUnderline: true,
                  startAdornment: <Box sx={{ mr: 1, color: 'var(--text-faint)', display: 'flex' }}><MdLock /></Box>
                }}
              />
              <TextField
                fullWidth label="Confirmar nova senha" type="password"
                value={confirmarSenha} onChange={(e) => setConfirmarSenha(e.target.value)}
                required variant="filled" sx={inputSx}
                InputProps={{
                  disableUnderline: true,
                  startAdornment: <Box sx={{ mr: 1, color: 'var(--text-faint)', display: 'flex' }}><MdLock /></Box>
                }}
              />

              {erro && (
                <Typography sx={{ color: 'var(--danger)', fontSize: '0.85rem', mb: 2 }}>{erro}</Typography>
              )}

              <Button
                variant="contained" type="submit" fullWidth size="large"
                disabled={carregando || !token}
                sx={{
                  mt: 1, py: 1.8, borderRadius: '12px', fontSize: '1rem', fontWeight: 700,
                  backgroundColor: 'var(--accent)', color: 'var(--text-on-accent)',
                  '&:hover': { bgcolor: '#e0c200' },
                }}
              >
                {carregando ? <CircularProgress size={24} sx={{ color: 'var(--text-on-accent)' }} /> : 'Redefinir senha'}
              </Button>

              <Button
                variant="text" fullWidth onClick={() => navegar('/login')}
                sx={{ mt: 2, color: 'var(--text-faint)', '&:hover': { color: 'var(--accent-ink)' } }}
              >
                Voltar ao login
              </Button>
            </Box>
          </form>
        )}
      </Paper>
    </Box>
  )
}

export default RedefinirSenha
