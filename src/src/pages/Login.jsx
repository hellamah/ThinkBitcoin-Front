import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { TextField, Button, Box, Paper, Typography } from '@mui/material'
import { MdEmail, MdLock } from 'react-icons/md'
import ErrorMessage from '../components/ErrorMessage'
import logo from '../../logo-light.svg'
import {
  authenticate,
  decodeAuthenticationToken,
} from '../utils/authentication'
import { useAuth } from '../context/AuthContext'
import useTranslation from '../hooks/useTranslation'

function Login() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [mensagem, setMensagem] = useState('')
  const navegar = useNavigate()
  const { login } = useAuth()
  const { t } = useTranslation()

  const processarEnvio = async (e) => {
    e.preventDefault()
    setErro('')
    setMensagem('')
    try {
      setCarregando(true)
      const dados = await authenticate({ email, senha })
      await login(dados.tokenAutenticado)
      const usuario = decodeAuthenticationToken(dados.tokenAutenticado)
      setMensagem(t('welcome', { name: usuario?.nome ?? '' }))
      setTimeout(() => navegar('/dashboard'), 800)
    } catch {
      setErro(t('loginFailed'))
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
      '&:hover': {
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderColor: 'var(--color-primary)',
      },
      '&.Mui-focused': {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderColor: 'var(--color-primary)',
      }
    },
    '& .MuiInputLabel-root': { color: 'rgba(255, 255, 255, 0.6)' },
    '& .MuiInputLabel-root.Mui-focused': { color: 'var(--color-primary)' }
  }

  return (
    <Box className="form-page">
      <Paper 
        className={`form-card ${erro ? 'shake' : ''}`}
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
          transition: 'all 0.4s ease-in-out'
        }}
      >
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <img src={logo} alt="ThinkBitcoin Logo" style={{ height: '70px', marginBottom: '16px' }} />
          <Typography variant="h4" sx={{ fontWeight: 800, color: 'var(--color-primary)', letterSpacing: '-0.5px' }}>
            {t('login')}
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.6)', mt: 1 }}>
            Configure seu perfil de investimento profissional
          </Typography>
        </Box>
        
        <form onSubmit={processarEnvio}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <TextField
              fullWidth
              label={t('email')}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              variant="filled"
              sx={inputSx}
              InputProps={{ 
                disableUnderline: true,
                startAdornment: (
                  <Box sx={{ mr: 1, color: 'rgba(255,255,255,0.4)', display: 'flex' }}><MdEmail /></Box>
                )
              }}
            />
            <TextField
              fullWidth
              label={t('password')}
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
              variant="filled"
              sx={inputSx}
              InputProps={{ 
                disableUnderline: true,
                startAdornment: (
                  <Box sx={{ mr: 1, color: 'rgba(255,255,255,0.4)', display: 'flex' }}><MdLock /></Box>
                )
              }}
             / >
            
            <ErrorMessage message={erro} onClose={() => setErro('')} />
            {mensagem && <Typography sx={{ textAlign: 'center', color: 'var(--color-primary)', mb: 2 }}>{mensagem}</Typography>}
            
            <Button 
                variant="contained" type="submit" disabled={carregando} fullWidth size="large"
                sx={{ 
                    mt: 2,
                    py: 1.8, 
                    borderRadius: '12px', 
                    fontSize: '1rem', 
                    fontWeight: 700, 
                    bgcolor: 'var(--color-primary)', 
                    color: '#000',
                    boxShadow: '0 8px 20px -8px rgba(255, 215, 0, 0.5)',
                    transition: 'all 0.3s ease',
                    '&:hover': { transform: 'translateY(-2px)', bgcolor: '#e0c200', boxShadow: '0 12px 25px -10px rgba(255, 215, 0, 0.6)' },
                    '&:active': { transform: 'scale(0.98)' }
                }}
            >
                {carregando ? t('authenticating').toUpperCase() : t('signIn').toUpperCase()}
            </Button>

            <Box sx={{ mt: 3, textAlign: 'center' }}>
               <Link to="/register" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none', fontSize: '0.9rem', borderBottom: '1px solid transparent', transition: 'all 0.2s' }}>
                   {t('registerPrompt')}
               </Link>
            </Box>
          </Box>
        </form>
      </Paper>
    </Box>
  )
}

export default Login
