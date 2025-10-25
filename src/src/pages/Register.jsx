import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { TextField, Button, Box } from '@mui/material'
import ErrorMessage from '../components/ErrorMessage'
import { API_URL } from '../api'
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
      const respostaCadastro = await fetch(`${API_URL}/ThinkBitcoin/usuariosTB/inserirConsultor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ItemUsuarioTB: [
            { nome, email, senha, ativo: true },
          ],
        }),
      })
      if (!respostaCadastro.ok) throw new Error('Erro ao cadastrar')
      await respostaCadastro.json()

      const dadosLogin = await authenticate({ email, senha })
      login(dadosLogin.tokenAutenticado)
      const nome = obterNome(dadosLogin.tokenAutenticado)
      setMensagem(t('welcome', { name: nome }))
      setTimeout(() => navegar('/dashboard'), 1500)
    } catch {
      setErro(t('registerFailed'))
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className="form-page">
      <div className={`form-card${erro ? ' shake' : ''}`}>
        <h2>{t('register')}</h2>
        <Box component="form" onSubmit={processarEnvio} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label={t('name')}
            value={nome}
            onChange={(e) => setNome(e.target.value)}
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
          <ErrorMessage message={erro} />
          {mensagem && <div className="success-msg">{mensagem}</div>}
          <Button variant="contained" type="submit" disabled={carregando} color="primary">
            {t('signUp')}
          </Button>
          {carregando && <div className="loading-msg">{t('authenticating')}</div>}
        </Box>
        <div className="form-footer">
          <Link to="/login">{t('hasAccount')}</Link>
        </div>
      </div>
    </div>
  )
}

export default Register
