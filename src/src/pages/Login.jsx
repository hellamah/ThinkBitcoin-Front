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
      setMensagemRecuperacao(t('senha.recuperarEnviado'))
    } catch {
      setErroRecuperacao(t('senha.recuperarErro'))
    } finally {
      setEnviandoRecuperacao(false)
    }
  }

  const inputSx = {
    mb: 2,
    '& .MuiFilledInput-root': {
      backgroundColor: 'var(--surface-fill)',
      borderRadius: '12px',
      border: '1px solid var(--border-strong)',
      '&:hover': {
        backgroundColor: 'var(--surface-fill-strong)',
        borderColor: 'var(--color-primary)',
      },
      '&.Mui-focused': {
        backgroundColor: 'var(--surface-fill-strong)',
        borderColor: 'var(--color-primary)',
      }
    },
    '& .MuiInputLabel-root': { color: 'var(--text-muted)' },
    '& .MuiInputLabel-root.Mui-focused': { color: 'var(--accent-ink)' }
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
          backgroundColor: 'var(--surface-overlay)',
          backdropFilter: 'blur(20px)',
          borderRadius: '24px',
          border: '1px solid var(--accent-a15)',
          boxShadow: '0 25px 50px -12px var(--scrim)',
          transition: 'all 0.4s ease-in-out'
        }}
      >
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <img src={logo} alt="ThinkBitcoin Logo" style={{ height: '70px', marginBottom: '16px' }} />
          <Typography variant="h4" sx={{ fontWeight: 800, color: 'var(--accent-ink)', letterSpacing: '-0.5px' }}>
            {t('login')}
          </Typography>
          <Typography sx={{ color: 'var(--text-muted)', mt: 1 }}>
            {t('loginSubtitle')}
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
                  <Box sx={{ mr: 1, color: 'var(--text-faint)', display: 'flex' }}><MdEmail /></Box>
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
                  <Box sx={{ mr: 1, color: 'var(--text-faint)', display: 'flex' }}><MdLock /></Box>
                )
              }}
             />

            <Box sx={{ textAlign: 'right', mt: -1, mb: 1 }}>
              {/* Era um <span> com onClick: o único caminho para recuperar a
                  senha não existia para quem navega por teclado, e o leitor de
                  tela anunciava a frase como texto comum.

                  `type="button"` não é detalhe: isto vive dentro do <form> de
                  login, e o padrão do HTML para botão sem type é submit —
                  abrir o modal passaria a tentar autenticar junto. */}
              <Typography
                component="button"
                type="button"
                className="botao-nu"
                onClick={abrirModalRecuperacao}
                sx={{
                  color: 'var(--text-muted)',
                  fontSize: '0.8rem',
                  '&:hover': { color: 'var(--accent-ink)' },
                  transition: 'color 0.2s',
                }}
              >
                {t('senha.esqueci')}
              </Typography>
            </Box>

            <ErrorMessage message={erro} onClose={() => setErro('')} />
            {mensagem && <Typography sx={{ textAlign: 'center', color: 'var(--accent-ink)', mb: 2 }}>{mensagem}</Typography>}

            <Button
                variant="contained" type="submit" disabled={carregando} fullWidth size="large"
                sx={{
                    mt: 2,
                    py: 1.8,
                    borderRadius: '12px',
                    fontSize: '1rem',
                    fontWeight: 700,
                    backgroundColor: 'var(--accent)',
                    color: 'var(--text-on-accent)',
                    boxShadow: '0 8px 20px -8px var(--accent-a50)',
                    transition: 'all 0.3s ease',
                    '&:hover': { transform: 'translateY(-2px)', bgcolor: '#e0c200', boxShadow: '0 12px 25px -10px rgba(255, 215, 0, 0.6)' },
                    '&:active': { transform: 'scale(0.98)' }
                }}
            >
                {carregando ? t('authenticating').toUpperCase() : t('signIn').toUpperCase()}
            </Button>

            <Box sx={{ mt: 3, textAlign: 'center' }}>
               <Typography sx={{ color: 'var(--text-faint)', fontSize: '0.8rem', fontStyle: 'italic' }}>
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
          backgroundColor: 'var(--surface-overlay)',
          backdropFilter: 'blur(20px)',
          borderRadius: '20px',
          border: '1px solid var(--accent-a20)',
          boxShadow: '0 25px 50px var(--scrim)',
          p: 4,
        }}>
          <Typography variant="h6" sx={{ fontWeight: 700, color: 'var(--accent-ink)', mb: 1 }}>
            {t('senha.recuperarTitulo')}
          </Typography>
          <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.875rem', mb: 3 }}>
            {t('senha.recuperarDescricao')}
          </Typography>

          {mensagemRecuperacao ? (
            <Typography sx={{ color: 'var(--success)', fontSize: '0.9rem', textAlign: 'center', py: 2 }}>
              {mensagemRecuperacao}
            </Typography>
          ) : (
            <form onSubmit={enviarRecuperacao}>
              <TextField
                fullWidth
                label={t('email')}
                type="email"
                value={emailRecuperacao}
                onChange={(e) => setEmailRecuperacao(e.target.value)}
                required
                variant="filled"
                sx={{ ...inputSx, mb: 2 }}
                InputProps={{
                  disableUnderline: true,
                  startAdornment: (
                    <Box sx={{ mr: 1, color: 'var(--text-faint)', display: 'flex' }}><MdEmail /></Box>
                  )
                }}
              />
              {erroRecuperacao && (
                <Typography sx={{ color: 'var(--danger)', fontSize: '0.8rem', mb: 2 }}>{erroRecuperacao}</Typography>
              )}
              <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                <Button
                  fullWidth variant="outlined"
                  onClick={() => setModalAberto(false)}
                  sx={{ borderColor: 'var(--border-strong)', color: 'var(--text-muted)', borderRadius: '10px' }}
                >
                  {t('senha.recuperarCancelar')}
                </Button>
                <Button
                  fullWidth variant="contained" type="submit" disabled={enviandoRecuperacao}
                  sx={{
                    backgroundColor: 'var(--accent)', color: 'var(--text-on-accent)', borderRadius: '10px', fontWeight: 700,
                    '&:hover': { bgcolor: '#e0c200' }
                  }}
                >
                  {enviandoRecuperacao ? <CircularProgress size={20} sx={{ color: 'var(--text-on-accent)' }} /> : t('senha.recuperarEnviar')}
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
