import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { TextField, Button, Box } from '@mui/material'
import ErrorMessage from '../components/ErrorMessage'
import logo from '../../logo-light.svg'
import { apiRequest, HttpMethod, UserEndpoint } from '../utils/apiClient'
import { authenticate } from '../utils/authentication'
import { useAuth } from '../context/AuthContext'
import useTranslation from '../hooks/useTranslation'

function Register() {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [mensagem, setMensagem] = useState('')
  const navegar = useNavigate()
  const { login } = useAuth()
  const { t } = useTranslation()

  const obterNome = (t) => {
    try {
      const payload = JSON.parse(atob(t.split('.')[1]))
      return (
        payload[
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'
        ] || ''
      )
    } catch {
      return ''
    }
  }

  const processarEnvio = async (e) => {
    e.preventDefault()
    setErro('')
    setMensagem('')
    try {
      setCarregando(true)
      await apiRequest(UserEndpoint.REGISTER_CONSULTANT, {
        method: HttpMethod.POST,
        body: {
          itemUsuarioTB: [
            { nome, email, senha, ativo: true },
          ],
        },
      })

      const dadosLogin = await authenticate({ email, senha })
      await login(dadosLogin.tokenAutenticado)
      const nomeUsuario = obterNome(dadosLogin.tokenAutenticado)
      setMensagem(t('welcome', { name: nomeUsuario }))
      setTimeout(() => navegar('/dashboard'), 800)
    } catch {
      setErro(t('registerFailed'))
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className="form-page">
      <div className={`form-card${erro ? ' shake' : ''}`}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1rem' }}>
          <img src={logo} alt="ThinkBitcoin Logo" style={{ height: '50px', marginBottom: '15px' }} />
          <h2 style={{ margin: 0 }}>{t('register')}</h2>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', marginTop: '8px' }}>
            Crie sua conta para começar a investir
          </p>
        </div>

        <Box component="form" onSubmit={processarEnvio} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label={t('name')}
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
            variant="filled"
            fullWidth
            InputProps={{ disableUnderline: true }}
            InputLabelProps={{ shrink: true }}
          />
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
            {carregando ? t('authenticating') : t('signUp')}
          </Button>
        </Box>
        
        <div className="form-footer">
          <Link to="/login">{t('hasAccount')}</Link>
        </div>
      </div>
    </div>
  )
}

export default Register
