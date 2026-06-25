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
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      borderRadius: '12px',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.08)', borderColor: 'var(--color-primary)' },
      '&.Mui-focused': { backgroundColor: 'rgba(255, 255, 255, 0.1)', borderColor: 'var(--color-primary)' },
    },
    '& .MuiInputLabel-root': { color: 'rgba(255, 255, 255, 0.6)' },
    '& .MuiInputLabel-root.Mui-focused': { color: 'var(--color-primary)' },
  }

  return (
    <Box className="form-page">
      <Paper
        elevation={0}
        sx={{
          maxWidth: '440px',
          width: '95%',
          p: { xs: 4, md: 6 },
          background: 'rgba(20, 20, 20, 0.85)',
          backdropFilter: 'blur(20px)',
          borderRadius: '24px',
          border: '1px solid rgba(255, 215, 0, 0.15)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        }}
      >
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <img src={logo} alt="ThinkBitcoin Logo" style={{ height: '70px', marginBottom: '16px' }} />
          <Typography variant="h5" sx={{ fontWeight: 800, color: 'var(--color-primary)' }}>
            Redefinir senha
          </Typography>
        </Box>

        {sucesso ? (
          <Box sx={{ textAlign: 'center', py: 2 }}>
            <Typography sx={{ color: '#4caf50', fontSize: '1rem', mb: 2 }}>
              Senha redefinida com sucesso!
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.875rem' }}>
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
                  startAdornment: <Box sx={{ mr: 1, color: 'rgba(255,255,255,0.4)', display: 'flex' }}><MdLock /></Box>
                }}
              />
              <TextField
                fullWidth label="Confirmar nova senha" type="password"
                value={confirmarSenha} onChange={(e) => setConfirmarSenha(e.target.value)}
                required variant="filled" sx={inputSx}
                InputProps={{
                  disableUnderline: true,
                  startAdornment: <Box sx={{ mr: 1, color: 'rgba(255,255,255,0.4)', display: 'flex' }}><MdLock /></Box>
                }}
              />

              {erro && (
                <Typography sx={{ color: '#f44336', fontSize: '0.85rem', mb: 2 }}>{erro}</Typography>
              )}

              <Button
                variant="contained" type="submit" fullWidth size="large"
                disabled={carregando || !token}
                sx={{
                  mt: 1, py: 1.8, borderRadius: '12px', fontSize: '1rem', fontWeight: 700,
                  bgcolor: 'var(--color-primary)', color: '#000',
                  '&:hover': { bgcolor: '#e0c200' },
                }}
              >
                {carregando ? <CircularProgress size={24} sx={{ color: '#000' }} /> : 'Redefinir senha'}
              </Button>

              <Button
                variant="text" fullWidth onClick={() => navegar('/login')}
                sx={{ mt: 2, color: 'rgba(255,255,255,0.4)', '&:hover': { color: 'var(--color-primary)' } }}
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
