import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { TextField, Button, Box } from '@mui/material'
import ErrorMessage from '../components/ErrorMessage'
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
      login(dados.tokenAutenticado)
      const usuario = decodeAuthenticationToken(dados.tokenAutenticado)
      setMensagem(t('welcome', { name: usuario?.nome ?? '' }))
      setTimeout(() => navegar('/dashboard'), 1500)
    } catch {
      setErro(t('loginFailed'))
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className="form-page">
      <div className={`form-card${erro ? ' shake' : ''}`}>
        <h2>{t('login')}</h2>
        <Box component="form" onSubmit={processarEnvio} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label={t('email')}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            variant="filled"
            color="primary"
            InputLabelProps={{ shrink: true }}
            inputProps={{ style: { caretColor: 'var(--color-primary)' } }}
            sx={{
              '& .MuiFilledInput-root': {
                backgroundColor: 'var(--color-bg)',
                '&:hover': {
                  backgroundColor: 'var(--color-bg)',
                },
                '&.Mui-focused': {
                  backgroundColor: 'var(--color-bg)',
                },
              },
            }}
          />
          <TextField
            label={t('password')}
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
            variant="filled"
            color="primary"
            InputLabelProps={{ shrink: true }}
            inputProps={{ style: { caretColor: 'var(--color-primary)' } }}
            sx={{
              '& .MuiFilledInput-root': {
                backgroundColor: 'var(--color-bg)',
                '&:hover': {
                  backgroundColor: 'var(--color-bg)',
                },
                '&.Mui-focused': {
                  backgroundColor: 'var(--color-bg)',
                },
              },
            }}
          />
          <ErrorMessage message={erro} onClose={() => setErro('')} />
          {mensagem && <div className="success-msg">{mensagem}</div>}
          <Button variant="contained" type="submit" disabled={carregando} color="primary">
            {t('signIn')}
          </Button>
          {carregando && <div className="loading-msg">{t('authenticating')}</div>}
        </Box>
        <div className="form-footer">
          <Link to="/register">{t('registerPrompt')}</Link>
        </div>
      </div>
    </div>
  )
}

export default Login
