import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TextField, Button, Box, Paper, Typography, Modal, CircularProgress } from '@mui/material'
import { MdEmail, MdLock } from 'react-icons/md'
import ErrorMessage from '../components/ErrorMessage'
import logo from '../../logo-light.svg'
import {
  authenticate,
  decodeAuthenticationToken,
} from '../utils/authentication'
import { useAuth } from '../context/AuthContext'
import useTranslation from '../hooks/useTranslation'
import { apiRequest, HttpMethod, UserEndpoint } from '../utils/apiClient'

function Login() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [mensagem, setMensagem] = useState('')
  const navegar = useNavigate()
  const { login } = useAuth()
  const { t } = useTranslation()

  const [modalAberto, setModalAberto] = useState(false)
  const [emailRecuperacao, setEmailRecuperacao] = useState('')
  const [erroRecuperacao, setErroRecuperacao] = useState('')
  const [mensagemRecuperacao, setMensagemRecuperacao] = useState('')
  const [enviandoRecuperacao, setEnviandoRecuperacao] = useState(false)

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
    } catch (err) {
      // Mostra o motivo informado pelo backend (ex.: "Senha inválida") quando houver.
      setErro(err?.hasBackendMessage ? err.message : t('loginFailed'))
    } finally {
      setCarregando(false)
    }
  }

  const abrirModalRecuperacao = () => {
    setEmailRecuperacao('')
    setErroRecuperacao('')
    setMensagemRecuperacao('')
    setModalAberto(true)
  }

  const enviarRecuperacao = async (e) => {
    e.preventDefault()
    setErroRecuperacao('')
    setMensagemRecuperacao('')
    try {
      setEnviandoRecuperacao(true)
      await apiRequest(UserEndpoint.RECUPERAR_SENHA, {
        method: HttpMethod.POST,
        body: {
          email: emailRecuperacao,
          urlBase: window.location.origin,
        },
        suppressAuthRedirect: true,
      })
      setMensagemRecuperacao('Se este email estiver cadastrado, você receberá um link de redefinição em breve.')
    } catch {
      setErroRecuperacao('Não foi possível processar a solicitação. Tente novamente.')
    } finally {
      setEnviandoRecuperacao(false)
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
             />

            <Box sx={{ textAlign: 'right', mt: -1, mb: 1 }}>
              <Typography
                component="span"
                onClick={abrirModalRecuperacao}
                sx={{
                  color: 'rgba(255,255,255,0.5)',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  '&:hover': { color: 'var(--color-primary)' },
                  transition: 'color 0.2s',
                }}
              >
                Esqueci minha senha
              </Typography>
            </Box>

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
               <Typography sx={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.8rem', fontStyle: 'italic' }}>
                   {t('exclusiveAccess')}
               </Typography>
            </Box>
          </Box>
        </form>
      </Paper>

      <Modal open={modalAberto} onClose={() => setModalAberto(false)}>
        <Box sx={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: { xs: '90%', sm: '400px' },
          background: 'rgba(20, 20, 20, 0.97)',
          backdropFilter: 'blur(20px)',
          borderRadius: '20px',
          border: '1px solid rgba(255, 215, 0, 0.2)',
          boxShadow: '0 25px 50px rgba(0,0,0,0.6)',
          p: 4,
        }}>
          <Typography variant="h6" sx={{ fontWeight: 700, color: 'var(--color-primary)', mb: 1 }}>
            Recuperar senha
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.875rem', mb: 3 }}>
            Informe seu email e enviaremos um link para redefinir sua senha.
          </Typography>

          {mensagemRecuperacao ? (
            <Typography sx={{ color: '#4caf50', fontSize: '0.9rem', textAlign: 'center', py: 2 }}>
              {mensagemRecuperacao}
            </Typography>
          ) : (
            <form onSubmit={enviarRecuperacao}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={emailRecuperacao}
                onChange={(e) => setEmailRecuperacao(e.target.value)}
                required
                variant="filled"
                sx={{ ...inputSx, mb: 2 }}
                InputProps={{
                  disableUnderline: true,
                  startAdornment: (
                    <Box sx={{ mr: 1, color: 'rgba(255,255,255,0.4)', display: 'flex' }}><MdEmail /></Box>
                  )
                }}
              />
              {erroRecuperacao && (
                <Typography sx={{ color: '#f44336', fontSize: '0.8rem', mb: 2 }}>{erroRecuperacao}</Typography>
              )}
              <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                <Button
                  fullWidth variant="outlined"
                  onClick={() => setModalAberto(false)}
                  sx={{ borderColor: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.6)', borderRadius: '10px' }}
                >
                  Cancelar
                </Button>
                <Button
                  fullWidth variant="contained" type="submit" disabled={enviandoRecuperacao}
                  sx={{
                    bgcolor: 'var(--color-primary)', color: '#000', borderRadius: '10px', fontWeight: 700,
                    '&:hover': { bgcolor: '#e0c200' }
                  }}
                >
                  {enviandoRecuperacao ? <CircularProgress size={20} sx={{ color: '#000' }} /> : 'Enviar'}
                </Button>
              </Box>
            </form>
          )}
        </Box>
      </Modal>
    </Box>
  )
}

export default Login
