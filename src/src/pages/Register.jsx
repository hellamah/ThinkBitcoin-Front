import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { 
  TextField, 
  Button, 
  Box, 
  Grid, 
  Typography, 
  MenuItem, 
  Select, 
  FormControl, 
  InputLabel,
  InputAdornment,
  Divider,
  Paper
} from '@mui/material'
import { 
  MdPerson, 
  MdEmail, 
  MdLock, 
  MdWork, 
  MdCurrencyBitcoin, 
  MdAccountBalanceWallet,
  MdTune,
  MdSecurity,
  MdHistory,
  MdLanguage,
  MdStore
} from 'react-icons/md'
import ErrorMessage from '../components/ErrorMessage'
import logo from '../../logo-light.svg'
import { apiRequest, HttpMethod, UserEndpoint, MarketEndpoint } from '../utils/apiClient'
import { authenticate, decodeAuthenticationToken } from '../utils/authentication'
import { useAuth } from '../context/AuthContext'
import useTranslation from '../hooks/useTranslation'
import { 
  DEFAULT_PREFERENCES, 
  AlgorithmStyle, 
  Language, 
  Theme, 
  RiskProfile, 
  ReviewFrequency 
} from '../utils/preferences'

function Register() {
  const { t } = useTranslation()
  const { login } = useAuth()
  const navegar = useNavigate()
  
  // User Info
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [cargo, setCargo] = useState(0) // 0 = Minerador, 1 = Consultor
  
  // Preferences (initialized with defaults)
  const [preferencias, setPreferencias] = useState({
    ...DEFAULT_PREFERENCES,
    dataUltimaInteracaoIA: new Date().toISOString()
  })

  // Auxiliary data
  const [moedas, setMoedas] = useState([])
  const [exchanges, setExchanges] = useState([])
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [mensagem, setMensagem] = useState('')

  useEffect(() => {
    const carregarDados = async () => {
      try {
        const [resM, resE] = await Promise.all([
          apiRequest(MarketEndpoint.COIN_LIST),
          apiRequest(MarketEndpoint.EXCHANGES)
        ])
        setMoedas(resM?.resultado || resM?.Resultado || (Array.isArray(resM) ? resM : []))
        setExchanges(resE?.resultado || resE?.Resultado || (Array.isArray(resE) ? resE : []))
      } catch (err) {
        console.error('Erro ao carregar dados:', err)
      }
    }
    carregarDados()
  }, [])

  const handlePrefChange = (field, value) => {
    setPreferencias(prev => ({ ...prev, [field]: value }))
  }


  const processarEnvio = async (e) => {
    e.preventDefault()
    setErro('')
    setMensagem('')
    try {
      setCarregando(true)
      
      const payload = {
        nome,
        email,
        senha,
        ativo: true,
        cargo: Number(cargo),
        preferencias: {
          ...preferencias,
          dataUltimaInteracaoIA: new Date().toISOString()
        }
      }

      await apiRequest(UserEndpoint.CREATE, {
        method: HttpMethod.POST,
        body: payload,
      })

      const dadosLogin = await authenticate({ email, senha })
      await login(dadosLogin.tokenAutenticado)
      const nomeUsuario = decodeAuthenticationToken(dadosLogin.tokenAutenticado)?.nome || ''
      setMensagem(t('welcome', { name: nomeUsuario }))
      setTimeout(() => navegar('/dashboard'), 1000)
    } catch (err) {
      setErro(t('registerFailed'))
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
    <Box className="form-page" sx={{ py: 4 }}>
      <Paper 
        className={`form-card ${erro ? 'shake' : ''}`}
        elevation={0}
        sx={{
          maxWidth: '850px',
          width: '95%',
          p: { xs: 3, md: 5 },
          background: 'rgba(20, 20, 20, 0.85)',
          backdropFilter: 'blur(15px)',
          borderRadius: '24px',
          border: '1px solid rgba(255, 215, 0, 0.15)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          margin: '0 auto',
          transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
      >
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <img src={logo} alt="ThinkBitcoin" style={{ height: '60px', marginBottom: '20px' }} />
          <Typography variant="h4" sx={{ fontWeight: 800, color: 'var(--color-primary)', letterSpacing: '-0.5px' }}>
            {t('register')}
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.6)', mt: 1 }}>
            Configure seu perfil de investimento profissional
          </Typography>
        </Box>

        <form onSubmit={processarEnvio}>
          <Grid container spacing={4}>
            {/* Seção: Informações Pessoais */}
            <Grid item xs={12} md={5}>
              <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1, color: 'rgba(255,255,255,0.9)' }}>
                 <MdPerson style={{ color: 'var(--color-primary)' }} /> {t('personalInfo')}
              </Typography>
              
              <TextField
                fullWidth label={t('name')} value={nome} onChange={(e) => setNome(e.target.value)} required
                variant="filled" InputProps={{ disableUnderline: true, startAdornment: <InputAdornment position="start"><MdPerson /></InputAdornment> }} sx={inputSx}
              />
              
              <TextField
                fullWidth label={t('email')} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                variant="filled" InputProps={{ disableUnderline: true, startAdornment: <InputAdornment position="start"><MdEmail /></InputAdornment> }} sx={inputSx}
              />
              
              <TextField
                fullWidth label={t('password')} type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required
                variant="filled" InputProps={{ disableUnderline: true, startAdornment: <InputAdornment position="start"><MdLock /></InputAdornment> }} sx={inputSx}
              />

              <FormControl fullWidth variant="filled" sx={inputSx}>
                <InputLabel>{t('cargo')}</InputLabel>
                <Select value={cargo} onChange={(e) => setCargo(e.target.value)} disableUnderline
                  startAdornment={<InputAdornment position="start"><MdWork /></InputAdornment>}
                >
                  <MenuItem value={0}>{t('miner')}</MenuItem>
                  <MenuItem value={1}>{t('consultant')}</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Divisor Vertical visível em Desktop */}
            <Grid item xs={12} md={0.5} sx={{ display: { xs: 'none', md: 'flex' }, justifyContent: 'center' }}>
                <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.05)' }} />
            </Grid>

            {/* Seção: Preferências de Investimento */}
            <Grid item xs={12} md={6.5}>
              <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1, color: 'rgba(255,255,255,0.9)' }}>
                 <MdTune style={{ color: 'var(--color-primary)' }} /> {t('algorithmStyle') || 'Perfil de Trading'}
              </Typography>

              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField
                    fullWidth label={t('initialInvestment')} type="number" 
                    value={preferencias.investimentoInicial} onChange={(e) => handlePrefChange('investimentoInicial', Number(e.target.value))}
                    variant="filled" InputProps={{ disableUnderline: true, startAdornment: <InputAdornment position="start">$</InputAdornment> }} sx={inputSx}
                  />
                </Grid>
                <Grid item xs={6}>
                  <FormControl fullWidth variant="filled" sx={inputSx}>
                    <InputLabel>{t('preferredCoin')}</InputLabel>
                    <Select value={preferencias.siglaMoedaPreferida || ''} onChange={(e) => handlePrefChange('siglaMoedaPreferida', e.target.value)} disableUnderline
                      startAdornment={<InputAdornment position="start"><MdCurrencyBitcoin /></InputAdornment>}
                    >
                      <MenuItem value=""><em>--</em></MenuItem>
                      {moedas.map(m => <MenuItem key={m.sigla} value={m.sigla}>{m.sigla}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={6}>
                  <FormControl fullWidth variant="filled" sx={inputSx}>
                    <InputLabel>{t('riskProfile')}</InputLabel>
                    <Select value={preferencias.perfilRisco} onChange={(e) => handlePrefChange('perfilRisco', e.target.value)} disableUnderline
                      startAdornment={<InputAdornment position="start"><MdSecurity /></InputAdornment>}
                    >
                      <MenuItem value={RiskProfile.CONSERVATIVE}>{t('conservative')}</MenuItem>
                      <MenuItem value={RiskProfile.MODERATE}>{t('moderate')}</MenuItem>
                      <MenuItem value={RiskProfile.AGGRESSIVE}>{t('aggressive')}</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={6}>
                  <FormControl fullWidth variant="filled" sx={inputSx}>
                    <InputLabel>{t('algorithmStyle')}</InputLabel>
                    <Select value={preferencias.estiloAlgoritmo} onChange={(e) => handlePrefChange('estiloAlgoritmo', e.target.value)} disableUnderline
                      startAdornment={<InputAdornment position="start"><MdTune /></InputAdornment>}
                    >
                      <MenuItem value={AlgorithmStyle.CONSERVATIVE}>{t('conservative')}</MenuItem>
                      <MenuItem value={AlgorithmStyle.BALANCED}>{t('balanced')}</MenuItem>
                      <MenuItem value={AlgorithmStyle.AGGRESSIVE}>{t('aggressive')}</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={6}>
                  <FormControl fullWidth variant="filled" sx={inputSx}>
                    <InputLabel>{t('exchange')}</InputLabel>
                    <Select value={preferencias.siglaEmpresaExterna || ''} onChange={(e) => handlePrefChange('siglaEmpresaExterna', e.target.value)} disableUnderline
                      startAdornment={<InputAdornment position="start"><MdStore /></InputAdornment>}
                    >
                      <MenuItem value=""><em>--</em></MenuItem>
                      {exchanges.map(ex => <MenuItem key={ex.sigla} value={ex.sigla}>{ex.nome}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={6}>
                  <FormControl fullWidth variant="filled" sx={inputSx}>
                    <InputLabel>{t('reviewFrequency')}</InputLabel>
                    <Select value={preferencias.frequenciaReview} onChange={(e) => handlePrefChange('frequenciaReview', e.target.value)} disableUnderline
                      startAdornment={<InputAdornment position="start"><MdHistory /></InputAdornment>}
                    >
                      <MenuItem value={ReviewFrequency.DAILY}>{t('daily')}</MenuItem>
                      <MenuItem value={ReviewFrequency.WEEKLY}>{t('weekly')}</MenuItem>
                      <MenuItem value={ReviewFrequency.MONTHLY}>{t('monthly')}</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </Grid>
          </Grid>

          <Box sx={{ mt: 4, display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
            <ErrorMessage message={erro} onClose={() => setErro('')} />
            {mensagem && <Typography sx={{ color: 'var(--color-primary)', fontWeight: 600 }}>{mensagem}</Typography>}
            
            <Button 
                variant="contained" type="submit" disabled={carregando} fullWidth size="large"
                sx={{ 
                    maxHeight: '56px',
                    py: 1.8, 
                    borderRadius: '12px', 
                    fontSize: '1.1rem', 
                    fontWeight: 700, 
                    bgcolor: 'var(--color-primary)', 
                    color: '#000',
                    transition: 'all 0.3s ease',
                    boxShadow: '0 8px 20px -8px rgba(255, 215, 0, 0.5)',
                    '&:hover': { transform: 'translateY(-2px)', bgcolor: '#e0c200', boxShadow: '0 12px 25px -10px rgba(255, 215, 0, 0.6)' },
                    '&:active': { transform: 'scale(0.98)' }
                }}
            >
                {carregando ? 'PROCESSANDO...' : t('signUp').toUpperCase()}
            </Button>

            <Link to="/login" style={{ marginTop: '16px', color: 'rgba(255,255,255,0.6)', textDecoration: 'none', fontSize: '0.9rem', borderBottom: '1px solid transparent', transition: 'all 0.2s' }} 
               onMouseOver={(e) => e.target.style.color = 'var(--color-primary)'} onMouseOut={(e) => e.target.style.color = 'rgba(255,255,255,0.6)'}>
                {t('hasAccount')}
            </Link>
          </Box>
        </form>
      </Paper>
    </Box>
  )
}

export default Register
