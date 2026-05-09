import { useState, useEffect, useCallback } from 'react'
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
  IconButton,
} from '@mui/material'
import Container from '@mui/material/Container'
import { MdClose, MdBolt, MdAutoGraph, MdShield, MdTranslate } from 'react-icons/md'
import ErrorMessage from './ErrorMessage'
import { apiRequest, HttpMethod, UserEndpoint, MarketEndpoint } from '../utils/apiClient'
import { authenticate } from '../utils/authentication'
import useTranslation from '../hooks/useTranslation'
import {
  DEFAULT_PREFERENCES,
  AlgorithmStyle,
  RiskProfile,
  ReviewFrequency,
  Language,
} from '../utils/preferences'

/**
 * Overlay de cadastro por convite.
 * Um usuário autenticado pode cadastrar outra pessoa sem sair da Home.
 *
 * @param {{ onFechar: () => void }} props
 */
function CadastroConviteOverlay({ onFechar }) {
  const { t } = useTranslation()

  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [cargo, setCargo] = useState(0)

  const [preferencias, setPreferencias] = useState({
    ...DEFAULT_PREFERENCES,
    dataUltimaInteracaoIA: new Date().toISOString(),
  })

  const [moedas, setMoedas] = useState([])
  const [exchanges, setExchanges] = useState([])
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [visivel, setVisivel] = useState(false)

  // Animação de entrada
  useEffect(() => {
    requestAnimationFrame(() => setVisivel(true))
  }, [])

  // Fechar com Escape
  const fecharComAnimacao = useCallback(() => {
    setVisivel(false)
    setTimeout(onFechar, 320)
  }, [onFechar])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') fecharComAnimacao()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [fecharComAnimacao])

  // Carregar moedas e exchanges
  useEffect(() => {
    const carregarDados = async () => {
      try {
        const [resM, resE] = await Promise.all([
          apiRequest(MarketEndpoint.COIN_LIST),
          apiRequest(MarketEndpoint.EXCHANGES),
        ])
        setMoedas(resM?.resultado || resM?.Resultado || (Array.isArray(resM) ? resM : []))
        setExchanges(resE?.resultado || resE?.Resultado || (Array.isArray(resE) ? resE : []))
      } catch (err) {
        console.error('Erro ao carregar dados:', err)
      }
    }
    carregarDados()
  }, [])

  useEffect(() => {
    if (exchanges.length > 0) {
      const binance = exchanges.find((ex) => ex.nome?.toLowerCase().includes('binance'))
      if (binance) {
        setPreferencias((prev) => ({ ...prev, siglaEmpresaExterna: binance.sigla }))
      }
    }
  }, [exchanges])

  const handlePrefChange = (field, value) => {
    setPreferencias((prev) => ({ ...prev, [field]: value }))
  }

  const processarEnvio = async (e) => {
    e.preventDefault()
    setErro('')
    try {
      setCarregando(true)
      const payload = {
        nome,
        email,
        senha,
        ativo: true,
        cargo: Number(cargo),
        preferencias: { ...preferencias, dataUltimaInteracaoIA: new Date().toISOString() },
      }
      await apiRequest(UserEndpoint.CREATE, { method: HttpMethod.POST, body: payload })
      setSucesso(true)
      setTimeout(fecharComAnimacao, 1800)
    } catch {
      setErro(t('registerFailed'))
    } finally {
      setCarregando(false)
    }
  }

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) fecharComAnimacao()
  }

  // ─── Estilos dos inputs ───────────────────────────────────────────────────
  const inputSx = {
    mb: 2.5,
    '& .MuiFilledInput-root': {
      backgroundColor: 'rgba(255, 255, 255, 0.04)',
      borderRadius: '16px',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      transition: 'all 0.3s ease',
      '&:hover': {
        backgroundColor: 'rgba(255, 255, 255, 0.07)',
        borderColor: 'var(--color-primary)',
      },
      '&.Mui-focused': {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderColor: 'var(--color-primary)',
      },
    },
    '& .MuiInputLabel-root': {
      color: 'rgba(255, 255, 255, 0.5)',
      fontSize: '0.9rem',
    },
  }

  const sectionTitleSx = {
    mb: 2.5,
    color: 'rgba(255, 255, 255, 0.4)',
    fontWeight: 700,
    fontSize: '0.75rem',
    textTransform: 'uppercase',
    letterSpacing: '2px',
  }

  return (
    <div
      className={`convite-overlay-backdrop ${visivel ? 'convite-overlay-visible' : ''}`}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label="Cadastrar novo usuário por convite"
    >
      <Container maxWidth="xl" sx={{ height: '100%', display: 'flex', alignItems: 'center', py: { xs: 0, md: 3 } }}>
        <div className="convite-overlay-paper">

          {/* ── Botão fechar ─────────────────────────────────────── */}
          <IconButton
            onClick={fecharComAnimacao}
            className="convite-overlay-close"
            aria-label="Fechar overlay"
            size="small"
          >
            <MdClose />
          </IconButton>

          {/* ── Lado esquerdo — ai-showcase ───────────────────────── */}
          <div className="convite-overlay-visual">
            <div className="convite-overlay-visual-content">
              <Typography
                variant="h3"
                className="convite-overlay-headline"
              >
                {t('registerVisualTitle').split(' ')[0]}<br />
                <span style={{ color: 'var(--color-primary)' }}>
                  {t('registerVisualTitle').split(' ').slice(1).join(' ')}
                </span>
              </Typography>
              <Typography className="convite-overlay-subheadline">
                {t('registerVisualSubtitle')}
              </Typography>
            </div>

            {/* Orbital reutilizado do ai-showcase-v3 */}
            <div className="convite-showcase">
              <div className="ai-core-v3 convite-core"></div>

              <div className="ai-orbit-v3 orbit-1">
                <div className="orbit-node"></div>
                <MdBolt
                  style={{
                    position: 'absolute', top: '50%', right: '0',
                    color: 'var(--color-primary)',
                    transform: 'translate(50%, -50%)',
                    fontSize: '20px',
                  }}
                />
              </div>

              <div className="ai-orbit-v3 orbit-2">
                <div className="orbit-node"></div>
                <MdAutoGraph
                  style={{
                    position: 'absolute', bottom: '0', left: '50%',
                    color: 'var(--color-primary)',
                    transform: 'translate(-50%, 50%)',
                    fontSize: '20px',
                  }}
                />
              </div>

              <div className="ai-orbit-v3 orbit-3">
                <div className="orbit-node"></div>
                <MdShield
                  style={{
                    position: 'absolute', top: '50%', left: '0',
                    color: 'var(--color-primary)',
                    transform: 'translate(-50%, -50%)',
                    fontSize: '20px',
                  }}
                />
              </div>

              <div className="convite-system-label">INVITE_SYSTEM_ACTIVE</div>
            </div>
          </div>

          {/* ── Lado direito — formulário ─────────────────────────── */}
          <div className="convite-overlay-form">
            <Box sx={{ mb: 5 }}>
              <Typography variant="h4" sx={{ fontWeight: 900, color: '#fff', mb: 1, letterSpacing: '-1.5px' }}>
                Convidar Pessoa
              </Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.9rem' }}>
                Preencha os dados para cadastrar um novo acesso à plataforma.
              </Typography>
            </Box>

            {sucesso ? (
              <div className="convite-sucesso">
                <div className="convite-sucesso-icon">✓</div>
                <Typography sx={{ color: 'var(--color-primary)', fontWeight: 700, fontSize: '1.1rem' }}>
                  Cadastro realizado com sucesso!
                </Typography>
                <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', mt: 1 }}>
                  Fechando automaticamente...
                </Typography>
              </div>
            ) : (
              <form onSubmit={processarEnvio}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>

                  {/* Dados pessoais */}
                  <Box>
                    <Typography sx={sectionTitleSx}>{t('personalInfo')}</Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth label={t('name')} value={nome}
                          onChange={(e) => setNome(e.target.value)}
                          required variant="filled"
                          InputProps={{ disableUnderline: true }} sx={inputSx}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth label={t('email')} type="email" value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required variant="filled"
                          InputProps={{ disableUnderline: true }} sx={inputSx}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth label={t('password')} type="password" value={senha}
                          onChange={(e) => setSenha(e.target.value)}
                          required variant="filled"
                          InputProps={{ disableUnderline: true }} sx={inputSx}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <FormControl fullWidth variant="filled" sx={inputSx}>
                          <InputLabel>{t('cargo')}</InputLabel>
                          <Select value={cargo} onChange={(e) => setCargo(e.target.value)} disableUnderline>
                            <MenuItem value={0}>{t('miner')}</MenuItem>
                            <MenuItem value={1}>{t('consultant')}</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <FormControl fullWidth variant="filled" sx={inputSx}>
                          <InputLabel>{t('language')}</InputLabel>
                          <Select
                            value={preferencias.idioma}
                            onChange={(e) => handlePrefChange('idioma', e.target.value)}
                            disableUnderline
                            startAdornment={
                              <InputAdornment position="start">
                                <MdTranslate style={{ color: 'var(--color-primary)', marginRight: 8 }} />
                              </InputAdornment>
                            }
                          >
                            <MenuItem value={Language.PT}>{t('portuguese')}</MenuItem>
                            <MenuItem value={Language.EN}>{t('english')}</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                    </Grid>
                  </Box>

                  {/* Algoritmo */}
                  <Box>
                    <Typography sx={sectionTitleSx}>{t('algorithmStyle')}</Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth label={t('initialInvestment')} type="number"
                          value={preferencias.investimentoInicial}
                          onChange={(e) => handlePrefChange('investimentoInicial', Number(e.target.value))}
                          variant="filled"
                          InputProps={{
                            disableUnderline: true,
                            startAdornment: (
                              <InputAdornment position="start" sx={{ color: 'var(--color-primary)', fontWeight: 700 }}>
                                $
                              </InputAdornment>
                            ),
                          }}
                          sx={inputSx}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <FormControl fullWidth variant="filled" sx={inputSx}>
                          <InputLabel>{t('preferredCoin')}</InputLabel>
                          <Select
                            value={preferencias.siglaMoedaPreferida || ''}
                            onChange={(e) => handlePrefChange('siglaMoedaPreferida', e.target.value)}
                            disableUnderline
                          >
                            <MenuItem value=""><em>--</em></MenuItem>
                            {moedas.map((m) => (
                              <MenuItem key={m.sigla} value={m.sigla}>{m.sigla}</MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <FormControl fullWidth variant="filled" sx={inputSx}>
                          <InputLabel>{t('riskProfile')}</InputLabel>
                          <Select
                            value={preferencias.perfilRisco}
                            onChange={(e) => handlePrefChange('perfilRisco', e.target.value)}
                            disableUnderline
                          >
                            <MenuItem value={RiskProfile.CONSERVATIVE}>{t('conservative')}</MenuItem>
                            <MenuItem value={RiskProfile.MODERATE}>{t('moderate')}</MenuItem>
                            <MenuItem value={RiskProfile.AGGRESSIVE}>{t('aggressive')}</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <FormControl fullWidth variant="filled" sx={inputSx}>
                          <InputLabel>{t('algorithmStyle')}</InputLabel>
                          <Select
                            value={preferencias.estiloAlgoritmo}
                            onChange={(e) => handlePrefChange('estiloAlgoritmo', e.target.value)}
                            disableUnderline
                          >
                            <MenuItem value={AlgorithmStyle.CONSERVATIVE}>{t('conservative')}</MenuItem>
                            <MenuItem value={AlgorithmStyle.BALANCED}>{t('balanced')}</MenuItem>
                            <MenuItem value={AlgorithmStyle.AGGRESSIVE}>{t('aggressive')}</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <FormControl fullWidth variant="filled" sx={inputSx}>
                          <InputLabel>{t('exchange')}</InputLabel>
                          <Select
                            value={preferencias.siglaEmpresaExterna || ''}
                            disableUnderline disabled
                          >
                            {exchanges.map((ex) => (
                              <MenuItem key={ex.sigla} value={ex.sigla}>{ex.nome}</MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <FormControl fullWidth variant="filled" sx={inputSx}>
                          <InputLabel>{t('reviewFrequency')}</InputLabel>
                          <Select
                            value={preferencias.frequenciaReview}
                            onChange={(e) => handlePrefChange('frequenciaReview', e.target.value)}
                            disableUnderline
                          >
                            <MenuItem value={ReviewFrequency.DAILY}>{t('daily')}</MenuItem>
                            <MenuItem value={ReviewFrequency.WEEKLY}>{t('weekly')}</MenuItem>
                            <MenuItem value={ReviewFrequency.MONTHLY}>{t('monthly')}</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                    </Grid>
                  </Box>
                </Box>

                <Box sx={{ mt: 5, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <ErrorMessage message={erro} onClose={() => setErro('')} />
                  <Button
                    variant="contained"
                    type="submit"
                    disabled={carregando}
                    fullWidth
                    size="large"
                    sx={{
                      py: 2.2,
                      borderRadius: '18px',
                      fontSize: '1.1rem',
                      fontWeight: 900,
                      bgcolor: 'var(--color-primary)',
                      color: '#000',
                      textTransform: 'none',
                      '&:hover': {
                        bgcolor: '#e0c200',
                        transform: 'translateY(-3px)',
                        boxShadow: '0 15px 30px -10px rgba(255, 215, 0, 0.5)',
                      },
                      transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                  >
                    {carregando ? 'PROCESSANDO...' : 'Cadastrar Convidado'}
                  </Button>
                </Box>
              </form>
            )}
          </div>

        </div>
      </Container>
    </div>
  )
}

export default CadastroConviteOverlay
