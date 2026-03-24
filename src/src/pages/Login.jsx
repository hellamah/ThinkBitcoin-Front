import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { TextField, Button, Box } from '@mui/material'
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

  return (
    <div className="form-page">
      <div className={`form-card${erro ? ' shake' : ''}`}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1rem' }}>
          <img src={logo} alt="ThinkBitcoin Logo" style={{ height: '60px', marginBottom: '20px' }} />
          <h2 style={{ margin: 0 }}>{t('login')}</h2>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', marginTop: '8px' }}>
            Acesse sua conta para continuar
          </p>
        </div>
        
        <Box component="form" onSubmit={processarEnvio} sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <TextField
            label={t('email')}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            variant="filled"
            fullWidth
            InputProps={{ disableUnderline: true }}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label={t('password')}
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
            variant="filled"
            fullWidth
            InputProps={{ disableUnderline: true }}
            InputLabelProps={{ shrink: true }}
          />
          
          <ErrorMessage message={erro} onClose={() => setErro('')} />
          {mensagem && <div className="success-msg">{mensagem}</div>}
          
          <Button 
            variant="contained" 
            type="submit" 
            disabled={carregando} 
            color="primary"
            fullWidth
            size="large"
          >
            {carregando ? t('authenticating') : t('signIn')}
          </Button>
        </Box>
        
        <div className="form-footer">
          <Link to="/register">{t('registerPrompt')}</Link>
        </div>
      </div>
    </div>
  )
}

export default Login
