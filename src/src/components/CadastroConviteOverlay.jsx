import { useState, useEffect, useCallback } from 'react'
import { MdCurrencyBitcoin } from 'react-icons/md'
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
  Checkbox,
  FormControlLabel,
  Link,
} from '@mui/material'
import Container from '@mui/material/Container'
import { MdClose, MdBolt, MdAutoGraph, MdShield, MdTranslate, MdPerson, MdSettings } from 'react-icons/md'
import ErrorMessage from './ErrorMessage'
import { apiRequest, HttpMethod, UserEndpoint, MarketEndpoint } from '../utils/apiClient'
import useDocumentoLegal from '../hooks/useDocumentoLegal'
import { TipoConsentimento, montarAceite } from '../utils/consentimento'
import useTranslation from '../hooks/useTranslation'
import { DEFAULT_PREFERENCES } from '../utils/preferences'
import { LANGUAGES } from '../lang'


/**
 * Overlay de cadastro por convite.
 * Um usuário autenticado pode cadastrar outra pessoa sem sair da Home.
 *
 * @param {{ onFechar: () => void }} props
 */
const CadastroConviteOverlay = ({ onFechar }) => {

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
  const [avisoEmail, setAvisoEmail] = useState(false)
  const [visivel, setVisivel] = useState(false)
  const [aceitouPrivacidade, setAceitouPrivacidade] = useState(false)
  const [aceitouTermos, setAceitouTermos] = useState(false)

  // A versão vigente de cada documento entra no cadastro junto com o aceite.
  // Marcar o checkbox sem registrar o que foi marcado era o problema desta
  // tela: os dois checkboxes só habilitavam o botão e não chegavam à API.
  const { documento: docPrivacidade } = useDocumentoLegal(TipoConsentimento.PRIVACIDADE)
  const { documento: docTermos } = useDocumentoLegal(TipoConsentimento.TERMOS)

  const documentosCarregados = !!docPrivacidade && !!docTermos

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
        aceites: [
          montarAceite(TipoConsentimento.PRIVACIDADE, docPrivacidade?.idDocumentoLegal),
          montarAceite(TipoConsentimento.TERMOS, docTermos?.idDocumentoLegal),
        ],
      }
      await apiRequest(UserEndpoint.CREATE, { method: HttpMethod.POST, body: payload })

      try {
        await apiRequest(UserEndpoint.ENVIAR_BOAS_VINDAS, {
          method: HttpMethod.POST,
          body: { email, nome, senha },
        })
      } catch {
        setAvisoEmail(true)
      }

      setSucesso(true)
      setTimeout(fecharComAnimacao, 1800)
    } catch (err) {
      setErro(err?.message || t('registerFailed'))
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
      backgroundColor: 'var(--surface-subtle)',
      borderRadius: '16px',
      border: '1px solid var(--border)',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      '&:before, &:after': {
        display: 'none',
      },
      '&:hover': {
        backgroundColor: 'var(--surface-fill)',
        borderColor: 'var(--accent-a30)',
      },
      '&.Mui-focused': {
        backgroundColor: 'var(--surface-fill-strong)',
        borderColor: 'var(--color-primary)',
        boxShadow: '0 0 0 3px var(--accent-a10)',
      },
    },
    '& .MuiInputLabel-root': {
      color: 'var(--text-faint)',
      fontSize: '0.85rem',
      '&.Mui-focused': {
        color: 'var(--accent-ink)',
      },
    },
    '& .MuiSelect-select': {
      display: 'flex',
      alignItems: 'center',
      gap: 1.5,
      py: 1.5,
    },
  }

  const sectionTitleSx = {
    mb: 2.5,
    color: 'var(--text-muted)',
    fontWeight: 800,
    fontSize: '0.7rem',
    textTransform: 'uppercase',
    letterSpacing: '2px',
    display: 'flex',
    alignItems: 'center',
    gap: 1.5,
    '& svg': {
        color: 'var(--accent-ink)',
        fontSize: '0.9rem',
    },
    '&::after': {
      content: '""',
      height: '1px',
      flex: 1,
      background: 'linear-gradient(90deg, var(--color-primary), transparent)',
      opacity: 0.2,
    }
  }

  const menuProps = {
    PaperProps: {
      sx: {
        backgroundColor: 'var(--surface-overlay)',
        backdropFilter: 'blur(20px)',
        border: '1px solid var(--border-strong)',
        borderRadius: '16px',
        mt: 1,
        boxShadow: '0 25px 60px var(--scrim-strong)',
        '& .MuiMenuItem-root': {
          fontSize: '0.9rem',
          py: 1.2,
          px: 2,
          '&:hover': {
            backgroundColor: 'var(--accent-a10)',
          },
          '&.Mui-selected': {
            backgroundColor: 'var(--accent-a20)',
            color: 'var(--accent-ink)',
            fontWeight: 800,
          },
        },
      },
    },
  }

  return (
    <div
      className={`convite-overlay-backdrop ${visivel ? 'convite-overlay-visible' : ''}`}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label={t('inviteOverlayAria')}
    >
      <Container maxWidth="xl" sx={{ height: '100%', display: 'flex', alignItems: 'center', py: { xs: 0, md: 3 } }}>
        <div className="convite-overlay-paper">

          {/* ── Botão fechar ─────────────────────────────────────── */}
          <IconButton
            onClick={fecharComAnimacao}
            className="convite-overlay-close"
            aria-label={t('close')}
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
                <span style={{ color: 'var(--accent-ink)' }}>
                  {t('registerVisualTitle').split(' ').slice(1).join(' ')}
                </span>
              </Typography>
              <Typography className="convite-overlay-subheadline">
                {t('registerVisualSubtitle')}
              </Typography>
            </div>

            {/* Orbital Original */}
            <div className="convite-showcase">
              <div className="ai-core-v3 convite-core"></div>

              <div className="ai-orbit-v3 orbit-1">
                <div className="orbit-node"></div>
                <MdBolt
                  style={{
                    position: 'absolute', top: '50%', right: '0',
                    color: 'var(--accent-ink)',
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
                    color: 'var(--accent-ink)',
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
                    color: 'var(--accent-ink)',
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
            <Box sx={{ mb: 4, maxWidth: 640, mx: 'auto', width: '100%', textAlign: 'center' }}>
              <Typography variant="h4" sx={{ fontWeight: 900, color: 'var(--text-primary)', mb: 1, letterSpacing: '-1.5px', fontSize: '2.2rem' }}>
                Convidar Pessoa
              </Typography>
              <Typography sx={{ color: 'var(--text-faint)', fontSize: '0.9rem' }}>
                Preencha os dados para cadastrar um novo acesso à plataforma.
              </Typography>
            </Box>

            {sucesso ? (
              <div className="convite-sucesso">
                <div className="convite-sucesso-icon">✓</div>
                <Typography sx={{ color: 'var(--accent-ink)', fontWeight: 700, fontSize: '1.1rem' }}>
                  Cadastro realizado com sucesso!
                </Typography>
                {avisoEmail ? (
                  <Typography sx={{ color: 'rgba(255,165,0,0.8)', fontSize: '0.8rem', mt: 1 }}>
                    ⚠ Não foi possível enviar o email de boas-vindas. Informe as credenciais manualmente.
                  </Typography>
                ) : (
                  <Typography sx={{ color: 'var(--text-faint)', fontSize: '0.85rem', mt: 1 }}>
                    Email de boas-vindas enviado para {email}.
                  </Typography>
                )}
                <Typography sx={{ color: 'var(--text-faint)', fontSize: '0.75rem', mt: 0.5 }}>
                  Fechando automaticamente...
                </Typography>
              </div>
            ) : (
              <form onSubmit={processarEnvio} style={{ width: '100%' }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0, maxWidth: 640, mx: 'auto', width: '100%' }}>

                  {/* Dados pessoais */}
                  <Box sx={{ mb: 3 }}>
                    <Typography sx={sectionTitleSx}>
                        <MdPerson /> {t('personalInfo')}
                    </Typography>
                    <Grid container spacing={2} justifyContent="center">
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
                        <FormControl fullWidth variant="filled" sx={{ ...inputSx, minWidth: 200 }}>
                          <InputLabel id="cadastro-cargo-label">{t('cargo')}</InputLabel>
                          <Select
                            labelId="cadastro-cargo-label"
                            value={cargo}
                            onChange={(e) => setCargo(e.target.value)}
                            disableUnderline
                            MenuProps={menuProps}
                          >
                            <MenuItem value={0}>{t('miner')}</MenuItem>
                            <MenuItem value={1}>{t('consultant')}</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <FormControl fullWidth variant="filled" sx={{ ...inputSx, minWidth: 160 }}>
                          <InputLabel id="cadastro-idioma-label">{t('language')}</InputLabel>
                          <Select
                            labelId="cadastro-idioma-label"
                            value={preferencias.idioma}
                            onChange={(e) => handlePrefChange('idioma', e.target.value)}
                            disableUnderline
                            MenuProps={menuProps}
                            startAdornment={
                              <InputAdornment position="start">
                                <MdTranslate style={{ color: 'var(--accent-ink)', marginRight: 8 }} />
                              </InputAdornment>
                            }
                          >
                            {LANGUAGES.map((idioma) => (
                              <MenuItem key={idioma.codigo} value={idioma.codigo}>
                                {idioma.rotulo}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>
                    </Grid>
                  </Box>

                  {/* Laboratório de Trader */}
                  <Box>
                    <Typography sx={sectionTitleSx}>
                        <MdSettings /> {t('traderLabTitle')}
                    </Typography>
                    <Grid container spacing={2} justifyContent="center">
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth label={t('initialInvestment')} type="number"
                          value={preferencias.investimentoInicial}
                          onChange={(e) => handlePrefChange('investimentoInicial', Number(e.target.value))}
                          variant="filled"
                          InputProps={{
                            disableUnderline: true,
                            startAdornment: (
                              <InputAdornment position="start" sx={{ color: 'var(--accent-ink)', fontWeight: 700 }}>
                                $
                              </InputAdornment>
                            ),
                          }}
                          sx={inputSx}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <FormControl fullWidth variant="filled" sx={{ ...inputSx, minWidth: 160 }}>
                          <InputLabel id="cadastro-moeda-label" shrink>{t('preferredCoin')}</InputLabel>
                          <Select
                            labelId="cadastro-moeda-label"
                            value={preferencias.siglaMoedaPreferida || ''}
                            onChange={(e) => handlePrefChange('siglaMoedaPreferida', e.target.value)}
                            disableUnderline
                            MenuProps={menuProps}
                            renderValue={(selected) => {
                              if (!selected) return <em>--</em>;
                              const coin = moedas.find(m => m.sigla === selected);
                              return (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  {coin?.icone ? <img src={coin.icone} alt={coin.nome} style={{ width: 18, height: 18 }} /> : <MdCurrencyBitcoin size={18} />}
                                  <span style={{ fontSize: '0.9rem' }}>{coin?.nome || selected}</span>
                                </Box>
                              );
                            }}
                          >
                            <MenuItem value=""><em>--</em></MenuItem>
                            {moedas.map((m) => (
                              <MenuItem key={m.sigla} value={m.sigla}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                  {m.icone ? <img src={m.icone} alt={m.nome || m.sigla} style={{ width: 22, height: 22 }} /> : <MdCurrencyBitcoin size={22} />}
                                  <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                                    <Typography sx={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2 }}>{m.nome || m.sigla}</Typography>
                                    <Typography sx={{ fontSize: '0.7rem', color: 'var(--text-faint)' }}>{m.sigla}</Typography>
                                  </Box>
                                </Box>
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>
                    </Grid>
                  </Box>
                </Box>

                <Box sx={{ mt: 4, pb: 4, display: 'flex', flexDirection: 'column', gap: 1.5, maxWidth: 640, mx: 'auto', width: '100%' }}>

                  {/* Checkboxes de consentimento */}
                  <Box sx={{
                    p: 2.5, borderRadius: '14px',
                    border: '1px solid rgba(255, 215, 0, 0.12)',
                    backgroundColor: 'var(--accent-a03)',
                    display: 'flex', flexDirection: 'column', gap: 1,
                  }}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={aceitouPrivacidade}
                          onChange={(e) => setAceitouPrivacidade(e.target.checked)}
                          sx={{ color: 'var(--text-faint)', '&.Mui-checked': { color: 'var(--accent-ink)' }, py: 0.5 }}
                        />
                      }
                      label={
                        <Typography sx={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                          Li e concordo com a{' '}
                          {/* Nova aba, e caminho relativo: navegar na mesma aba
                              perderia o formulário de cadastro já preenchido. */}
                          <Link href="/privacidade" target="_blank" rel="noopener"
                            sx={{ color: 'var(--accent-ink)', fontWeight: 600, '&:hover': { opacity: 0.8 } }}>
                            Política de Privacidade
                          </Link>
                          {' '}e com o tratamento dos meus dados conforme a LGPD.
                          {docPrivacidade?.versao && (
                            <span style={{ color: 'var(--text-faint)' }}> (versão {docPrivacidade.versao})</span>
                          )}
                        </Typography>
                      }
                      sx={{ alignItems: 'flex-start', mr: 0 }}
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={aceitouTermos}
                          onChange={(e) => setAceitouTermos(e.target.checked)}
                          sx={{ color: 'var(--text-faint)', '&.Mui-checked': { color: 'var(--accent-ink)' }, py: 0.5 }}
                        />
                      }
                      label={
                        <Typography sx={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                          Li e concordo com os{' '}
                          <Link href="/termos" target="_blank" rel="noopener"
                            sx={{ color: 'var(--accent-ink)', fontWeight: 600, '&:hover': { opacity: 0.8 } }}>
                            Termos de Uso
                          </Link>
                          {' '}da plataforma ThinkBitcoin.
                          {docTermos?.versao && (
                            <span style={{ color: 'var(--text-faint)' }}> (versão {docTermos.versao})</span>
                          )}
                        </Typography>
                      }
                      sx={{ alignItems: 'flex-start', mr: 0 }}
                    />
                  </Box>

                  <ErrorMessage message={erro} onClose={() => setErro('')} />
                  <Button
                    variant="contained"
                    type="submit"
                    disabled={carregando || !aceitouPrivacidade || !aceitouTermos || !documentosCarregados}
                    fullWidth
                    size="large"
                    sx={{
                      py: 2.2,
                      borderRadius: '16px',
                      fontSize: '1.1rem',
                      fontWeight: 900,
                      backgroundColor: 'var(--accent)',
                      color: 'var(--text-on-accent)',
                      textTransform: 'uppercase',
                      letterSpacing: '1px',
                      boxShadow: '0 8px 30px -8px var(--accent-a30)',
                      '&:hover': {
                        bgcolor: '#f5cc00',
                        transform: 'translateY(-3px)',
                        boxShadow: '0 15px 40px -10px var(--accent-a50)',
                      },
                      '&.Mui-disabled': {
                        backgroundColor: 'var(--accent-a20)',
                        color: 'var(--text-on-accent)',
                      },
                      transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                  >
                    {carregando ? 'PROCESSANDO...' : 'Cadastrar'}
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
