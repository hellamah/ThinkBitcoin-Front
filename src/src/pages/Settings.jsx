import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  MdBrightness4,
  MdLanguage,
  MdNotifications,
  MdTune,
  MdAccountBalanceWallet,
  MdTrendingDown,
  MdCurrencyBitcoin,
  MdStore,
  MdSecurity,
  MdHistory,
  MdAssessment,
  MdLock,
  MdPayment,
} from 'react-icons/md'
import Button from '@mui/material/Button'
import Switch from '@mui/material/Switch'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import CircularProgress from '@mui/material/CircularProgress'
import '../App.css'
import { useAuth } from '../context/AuthContext'
import useTranslation from '../hooks/useTranslation'
import { apiRequest, MarketEndpoint, UserEndpoint, PlanosPagamentoEndpoint, HttpMethod } from '../utils/apiClient'
import { API_URL } from '../api'
import {
  AlgorithmStyle,
  Language,
  Theme,
  RiskProfile,
  ReviewFrequency,
} from '../utils/preferences'
import { isNotificationSupported } from '../utils/browser'
import { executeNotificationWorkflow } from '../utils/workflow'
import PlanosPagamentoModal from '../components/PlanosPagamentoModal'

function Settings() {
  const { t } = useTranslation()
  const { token, user, prefs, updatePreferences } = useAuth()
  const [localPrefs, setLocalPrefs] = useState(prefs)
  const [toast, setToast] = useState('')
  const [moedas, setMoedas] = useState([])
  const [exchanges, setExchanges] = useState([])
  const [senha, setSenha] = useState({ atual: '', nova: '', confirma: '' })
  const [loadingSenha, setLoadingSenha] = useState(false)
  const [planoAtivo, setPlanoAtivo] = useState(null)
  const [loadingPlano, setLoadingPlano] = useState(true)
  const [modalPlanosOpen, setModalPlanosOpen] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()

  // ?planos=1 abre o modal de planos direto (usado pelo convite de upsell
  // do Layout quando a API responde 403 em recurso de assinatura paga).
  useEffect(() => {
    if (searchParams.get('planos') === '1') {
      setModalPlanosOpen(true)
      searchParams.delete('planos')
      setSearchParams(searchParams, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const carregarPlanoAtivo = async () => {
    if (!token) return
    setLoadingPlano(true)
    try {
      const res = await apiRequest(PlanosPagamentoEndpoint.LIST)
      const lista = res?.resultado?.planos || res?.Resultado?.planos || []
      const ativo = lista.find(p => p.ativo) || lista[0]
      setPlanoAtivo(ativo)
    } catch (err) {
      console.error('Erro ao buscar plano ativo:', err)
    } finally {
      setLoadingPlano(false)
    }
  }

  useEffect(() => {
    carregarPlanoAtivo()
    const carregarDados = async () => {
      try {
        const [resM, resE] = await Promise.all([
          apiRequest(MarketEndpoint.COIN_LIST),
          apiRequest(MarketEndpoint.EXCHANGES)
        ])
        const listaM = resM?.resultado || resM?.Resultado || (Array.isArray(resM) ? resM : [])
        const listaE = resE?.resultado || resE?.Resultado || (Array.isArray(resE) ? resE : [])
        setMoedas(listaM)
        setExchanges(listaE)
      } catch (err) {
        console.error('Erro ao carregar dados:', err)
        // Fallback para manter a interface funcional
        setMoedas([
          { id: 'btc-id', sigla: 'BTC', nome: 'Bitcoin' },
          { id: 'eth-id', sigla: 'ETH', nome: 'Ethereum' },
          { id: 'sol-id', sigla: 'SOL', nome: 'Solana' },
        ])
      }
    }
    carregarDados()
  }, [])

  useEffect(() => {
    if (prefs) setLocalPrefs(prefs)
  }, [prefs])

  const confirm = () => {
    setToast(t('settingsSaved') || 'Configurações salvas!')
    setTimeout(() => setToast(''), 2000)
  }

  const toggleTheme = () => {
    const novo = (prefs?.tema === Theme.DARK) ? Theme.LIGHT : Theme.DARK
    updatePreferences({ tema: novo })
    setToast(novo === Theme.LIGHT ? t('lightOn') : t('darkOn'))
    setTimeout(() => setToast(''), 2000)
  }

  const changeLang = (e) => {
    const lang = e.target.value
    if (!Object.values(Language).includes(lang)) return
    updatePreferences({ idioma: lang })
    confirm()
  }

  const changeAlerts = async (e) => {
    const enabled = e.target.checked
    const result = await executeNotificationWorkflow({
      enabled,
      token,
      isNotificationSupported,
      notificationApi: Notification,
      baseUrl: API_URL,
    })
    updatePreferences({ notificacoes: result.shouldEnableNotifications })
    setToast(t(result.messageKey))
    setTimeout(() => setToast(''), 2000)
  }

  const changeEstilo = (e) => {
    const val = e.target.value
    if (!Object.values(AlgorithmStyle).includes(val)) return
    updatePreferences({ estiloAlgoritmo: val })
    confirm()
  }

  const handleTrocarSenha = async (e) => {
    e.preventDefault()
    if (!senha.atual || !senha.nova || !senha.confirma) {
      setToast(t('fillAllFields') || 'Preencha todos os campos')
      setTimeout(() => setToast(''), 3000)
      return
    }
    if (senha.nova !== senha.confirma) {
      setToast(t('passwordsDontMatch') || 'As senhas não coincidem')
      setTimeout(() => setToast(''), 3000)
      return
    }
    if (senha.nova.length < 6) {
      setToast(t('passwordTooShort') || 'A senha deve ter no mínimo 6 caracteres')
      setTimeout(() => setToast(''), 3000)
      return
    }

    setLoadingSenha(true)
    try {
      await apiRequest(UserEndpoint.CHANGE_PASSWORD, {
        method: HttpMethod.POST,
        body: {
          idUsuarioTB: user?.idUsuarioTB,
          senhaAtual: senha.atual,
          novaSenha: senha.nova
        },
        suppressAuthRedirect: true,
      })
      setToast(t('passwordChangedSuccess') || 'Senha alterada com sucesso!')
      setSenha({ atual: '', nova: '', confirma: '' })
    } catch (err) {
      const msg = err.status === 400 ? (t('invalidCurrentPassword') || 'Senha atual incorreta') : (t('errorChangingPassword') || 'Erro ao alterar senha')
      setToast(msg)
    } finally {
      setLoadingSenha(false)
      setTimeout(() => setToast(''), 3000)
    }
  }

  const renderPanel = (icon, title, children) => (
    <Box className="panel settings-panel" sx={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '32px' }}>
        <div className="settings-panel-icon-wrapper">
          {icon}
        </div>
        <Typography variant="h6" sx={{
          margin: 0,
          fontWeight: 800,
          color: '#fff',
          letterSpacing: '1px',
          fontFamily: "'Share Tech Mono', monospace",
          textTransform: 'uppercase'
        }}>
          {title}
        </Typography>
      </header>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', flex: 1 }}>
        {children}
      </div>
    </Box>
  )


  const renderField = (label, component) => (
    <Box sx={{
      display: 'grid',
      gridTemplateColumns: '1fr 220px',
      alignItems: 'center',
      gap: 3,
      width: '100%',
      py: 1.5,
      borderBottom: '1px solid rgba(255, 255, 255, 0.03)'
    }}>
      <Typography className="settings-field-label">
        {label}
      </Typography>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        {component}
      </Box>
    </Box>
  )

  const selectSx = {
    width: '100%',
    bgcolor: 'rgba(255,255,255,0.03)',
    borderRadius: '12px',
    transition: 'all 0.3s ease',
    '& .MuiOutlinedInput-notchedOutline': {
      borderColor: 'rgba(255,255,255,0.1)',
      borderWidth: '1px'
    },
    '&:hover': {
      bgcolor: 'rgba(255,255,255,0.06)',
    },
    '&:hover .MuiOutlinedInput-notchedOutline': {
      borderColor: 'rgba(255,215,0,0.5)',
    },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
      borderColor: 'var(--color-primary)',
      borderWidth: '2px'
    },
    '& .MuiSelect-select': {
      py: 1.2,
      color: '#fff',
      fontWeight: 600,
      fontSize: '0.9rem'
    }
  }

  const inputSx = {
    width: '100%',
    '& .MuiOutlinedInput-root': {
      bgcolor: 'rgba(255,255,255,0.03)',
      borderRadius: '10px',
      transition: 'all 0.3s ease',
      '&:hover': { bgcolor: 'rgba(255,255,255,0.06)' },
      '&.Mui-focused': { bgcolor: 'rgba(255,255,255,0.08)' }
    },
    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.1)' },
    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,215,0,0.5)' },
    '& .MuiInputBase-input': { color: '#fff', fontWeight: 600, fontFamily: "'Share Tech Mono', monospace" }
  }

  return (
    <Box className="settings-page">
      <header style={{ marginBottom: '64px', textAlign: 'center', width: '100%', animation: 'fadeInDown 0.8s ease-out' }}>
        <Typography variant="h2" sx={{
          fontWeight: 900,
          color: '#fff',
          letterSpacing: '-2px',
          mb: 1,
          textTransform: 'uppercase',
          fontFamily: "'Inter', sans-serif"
        }}>
          {t('settingsTitle')}
        </Typography>
        <Box sx={{
          width: '80px',
          height: '4px',
          background: 'linear-gradient(90deg, transparent, var(--color-primary), transparent)',
          margin: '16px auto',
          borderRadius: '4px',
          boxShadow: '0 0 20px var(--color-primary)'
        }} />
        <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '1rem', fontWeight: 500, letterSpacing: '0.5px' }}>
          {t('settingsSubtitle') || 'CONTROL_CENTER // CONFIGURAÇÃO_SISTEMA'}
        </Typography>
      </header>

      <div className="settings-grid">
        {renderPanel(<MdBrightness4 />, t('themeTitle'), (
          <>
            {renderField(t('themeSite'), (
              <Button
                variant="outlined"
                onClick={toggleTheme}
                fullWidth
                startIcon={prefs?.tema === Theme.LIGHT ? <MdBrightness4 /> : <Box sx={{ color: 'var(--color-primary)', display: 'flex' }}><MdBrightness4 /></Box>}
                sx={{
                  borderColor: 'rgba(255,255,255,0.1)',
                  color: '#fff',
                  py: 1.2,
                  borderRadius: '12px',
                  background: 'rgba(255,255,255,0.03)',
                  '&:hover': {
                    borderColor: 'var(--color-primary)',
                    background: 'rgba(255,215,0,0.05)'
                  }
                }}
              >
                <Box sx={{ fontWeight: 700 }}>
                  {prefs?.tema === Theme.LIGHT ? t('lightMode').toUpperCase() : t('darkMode').toUpperCase()}
                </Box>
              </Button>
            ))}
            {renderField(t('language'), (
              <Select
                value={localPrefs?.idioma || Language.PT}
                onChange={(e) => {
                  const val = e.target.value
                  setLocalPrefs(p => ({ ...p, idioma: val }))
                  changeLang(e)
                }}
                size="small"
                sx={selectSx}
              >
                <MenuItem value={Language.PT}>{t('portuguese')}</MenuItem>
                <MenuItem value={Language.EN}>{t('english')}</MenuItem>
              </Select>
            ))}
          </>
        ))}

        {renderPanel(<MdTune />, t('algorithmStyle'), (
          renderField(t('algorithmStyle') || 'Estilo do Robô', (
            <Select
              value={localPrefs?.estiloAlgoritmo || AlgorithmStyle.BALANCED}
              onChange={(e) => {
                const val = e.target.value
                setLocalPrefs(p => ({ ...p, estiloAlgoritmo: val }))
                changeEstilo(e)
              }}
              size="small"
              sx={selectSx}
            >
              <MenuItem value={AlgorithmStyle.CONSERVATIVE}>{t('conservative')}</MenuItem>
              <MenuItem value={AlgorithmStyle.BALANCED}>{t('balanced')}</MenuItem>
              <MenuItem value={AlgorithmStyle.AGGRESSIVE}>{t('aggressive')}</MenuItem>
            </Select>
          ))
        ))}

        {renderPanel(<MdNotifications />, t('notifications'), (
          renderField(t('emailNotifications'), (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>{localPrefs?.notificacoes ? t('enabled') : t('disabled')}</span>
              <Switch
                checked={!!localPrefs?.notificacoes}
                onChange={(e) => {
                  const val = e.target.checked
                  setLocalPrefs(p => ({ ...p, notificacoes: val }))
                  changeAlerts(e)
                }}
                color="primary"
              />
            </Box>
          ))
        ))}

        {renderPanel(<MdPayment />, t('planos.title'), (
          <>
            {renderField(t('planos.currentPlan'), (
              <Typography variant="body1" sx={{ color: 'var(--color-primary)', fontWeight: 800, fontFamily: "'Share Tech Mono', monospace" }}>
                {loadingPlano ? (
                  <CircularProgress size={16} sx={{ color: 'var(--color-primary)' }} />
                ) : (
                  planoAtivo?.nome || 'Consultor (Básico)'
                )}
              </Typography>
            ))}
            <Button
              variant="outlined"
              onClick={() => setModalPlanosOpen(true)}
              fullWidth
              sx={{
                borderColor: 'rgba(255,255,255,0.1)',
                color: '#fff',
                py: 1.2,
                borderRadius: '12px',
                background: 'rgba(255,255,255,0.03)',
                fontFamily: "'Share Tech Mono', monospace",
                fontWeight: 700,
                '&:hover': {
                  borderColor: 'var(--color-primary)',
                  background: 'rgba(255,215,0,0.05)'
                }
              }}
            >
              {t('planos.viewPlans').toUpperCase()}
            </Button>
          </>
        ))}

        {renderPanel(<MdAccountBalanceWallet />, t('traderLabTitle'), (
          <>
            {renderField(t('initialInvestment'), (
              <TextField
                type="number"
                variant="outlined"
                size="small"
                value={localPrefs?.investimentoInicial ?? 0}
                onChange={(e) => setLocalPrefs(p => ({ ...p, investimentoInicial: e.target.value }))}
                onBlur={(e) => {
                  const val = parseFloat(e.target.value) || 0
                  updatePreferences({ investimentoInicial: val })
                  confirm()
                }}
                sx={inputSx}
                InputProps={{ startAdornment: <Box sx={{ mr: 1, color: 'var(--color-primary)', fontWeight: 700, fontSize: '0.9rem' }}>$</Box> }}
              />
            ))}

            {renderField(t('preferredCoin'), (
              <Select
                value={localPrefs?.siglaMoedaPreferida || ''}
                onChange={(e) => {
                  const val = e.target.value
                  setLocalPrefs(p => ({ ...p, siglaMoedaPreferida: val }))
                  updatePreferences({ siglaMoedaPreferida: val })
                  confirm()
                }}
                size="small"
                sx={selectSx}
              >
                <MenuItem value=""><em>{t('none') || 'Padrão'}</em></MenuItem>
                {moedas.map(m => (
                  <MenuItem key={m.sigla} value={m.sigla}>{m.sigla}</MenuItem>
                ))}
              </Select>
            ))}
          </>
        ))}

        <div style={{ gridColumn: '1 / -1' }}>
          {renderPanel(<MdSecurity />, t('riskManagementTitle'), (
            <Grid container spacing={4}>
              <Grid item xs={12} md={6}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {renderField(t('maxRiskPerTrade'), (
                    <TextField
                      type="number"
                      size="small"
                      value={localPrefs?.riscoMaximoPerda ?? 0}
                      onChange={(e) => setLocalPrefs(p => ({ ...p, riscoMaximoPerda: e.target.value }))}
                      onBlur={(e) => {
                        const val = parseFloat(e.target.value) || 0
                        updatePreferences({ riscoMaximoPerda: val })
                        confirm()
                      }}
                      sx={inputSx}
                      InputProps={{ endAdornment: <Box sx={{ ml: 1, color: 'var(--color-primary)', fontWeight: 700 }}>%</Box> }}
                    />
                  ))}

                  {renderField(t('reviewFrequency'), (
                    <Select
                      value={localPrefs?.frequenciaReview || ReviewFrequency.DAILY}
                      onChange={(e) => {
                        const val = e.target.value
                        setLocalPrefs(p => ({ ...p, frequenciaReview: val }))
                        updatePreferences({ frequenciaReview: val })
                        confirm()
                      }}
                      size="small"
                      sx={selectSx}
                    >
                      <MenuItem value={ReviewFrequency.DAILY}><Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><MdHistory /> {t('daily')}</Box></MenuItem>
                      <MenuItem value={ReviewFrequency.WEEKLY}><Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><MdHistory /> {t('weekly')}</Box></MenuItem>
                      <MenuItem value={ReviewFrequency.MONTHLY}><Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><MdHistory /> {t('monthly')}</Box></MenuItem>
                    </Select>
                  ))}
                </Box>
              </Grid>
              <Grid item xs={12} md={6}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {renderField(t('safetyBalance'), (
                    <Box sx={{ display: 'flex', gap: 1, width: '100%' }}>
                      <TextField
                        type="number"
                        size="small"
                        placeholder="0.00"
                        value={localPrefs?.saldoSeguranca ?? 0}
                        onChange={(e) => setLocalPrefs(p => ({ ...p, saldoSeguranca: e.target.value }))}
                        onBlur={(e) => {
                          const val = parseFloat(e.target.value) || 0
                          updatePreferences({ saldoSeguranca: val })
                          confirm()
                        }}
                        sx={inputSx}
                      />

                      <Select
                        value={localPrefs?.siglaMoedaUltimaInteracaoIA || ''}
                        onChange={(e) => {
                          const val = e.target.value
                          setLocalPrefs(p => ({ ...p, siglaMoedaUltimaInteracaoIA: val }))
                          updatePreferences({ siglaMoedaUltimaInteracaoIA: val })
                          confirm()
                        }}
                        size="small"
                        sx={{ ...selectSx, minWidth: 90 }}
                      >
                        <MenuItem value=""><em>--</em></MenuItem>
                        {moedas.map(m => (
                          <MenuItem key={m.sigla} value={m.sigla}>{m.sigla}</MenuItem>
                        ))}
                      </Select>
                    </Box>
                  ))}
                  {renderField(t('riskProfile'), (
                    <Select
                      value={localPrefs?.perfilRisco || RiskProfile.MODERATE}
                      onChange={(e) => {
                        const val = e.target.value
                        setLocalPrefs(p => ({ ...p, perfilRisco: val }))
                        updatePreferences({ perfilRisco: val })
                        confirm()
                      }}
                      size="small"
                      sx={selectSx}
                    >
                      <MenuItem value={RiskProfile.CONSERVATIVE}>{t('conservative')}</MenuItem>
                      <MenuItem value={RiskProfile.MODERATE}>{t('moderate')}</MenuItem>
                      <MenuItem value={RiskProfile.AGGRESSIVE}>{t('aggressive')}</MenuItem>
                    </Select>
                  ))}
                </Box>
              </Grid>
            </Grid>
          ))}
        </div>

        <div style={{ gridColumn: '1 / -1' }}>
          {renderPanel(<MdLock />, t('security') || 'SEGURANÇA', (
            <Box component="form" onSubmit={handleTrocarSenha} sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', mb: 1 }}>
                {t('changePasswordDescription') || 'Mantenha sua conta segura alterando sua senha periodicamente.'}
              </Typography>
              <Grid container spacing={3}>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label={t('currentPassword') || 'Senha Atual'}
                    type="password"
                    value={senha.atual}
                    onChange={(e) => setSenha(p => ({ ...p, atual: e.target.value }))}
                    sx={inputSx}
                    InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.5)' } }}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label={t('newPassword') || 'Nova Senha'}
                    type="password"
                    value={senha.nova}
                    onChange={(e) => setSenha(p => ({ ...p, nova: e.target.value }))}
                    sx={inputSx}
                    InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.5)' } }}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label={t('confirmNewPassword') || 'Confirmar Nova Senha'}
                    type="password"
                    value={senha.confirma}
                    onChange={(e) => setSenha(p => ({ ...p, confirma: e.target.value }))}
                    sx={inputSx}
                    InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.5)' } }}
                  />
                </Grid>
              </Grid>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={loadingSenha}
                  sx={{
                    bgcolor: 'var(--color-primary)',
                    color: '#000',
                    fontWeight: 800,
                    px: 4,
                    py: 1.2,
                    borderRadius: '10px',
                    '&:hover': {
                      bgcolor: '#e6c200',
                      boxShadow: '0 0 20px rgba(255, 215, 0, 0.4)'
                    },
                    '&.Mui-disabled': {
                      bgcolor: 'rgba(255, 215, 0, 0.3)',
                    }
                  }}
                >
                  {loadingSenha ? (t('saving') || 'SALVANDO...') : (t('updatePassword') || 'ATUALIZAR SENHA')}
                </Button>
              </Box>
            </Box>
          ))}
        </div>
      </div>

      <Box className={`toast${toast ? ' show' : ''}`} sx={{
        background: 'rgba(255, 215, 0, 0.9)',
        color: '#000',
        fontWeight: 700,
        borderRadius: '12px',
        px: 3, py: 1.5,
        boxShadow: '0 10px 30px rgba(255, 215, 0, 0.3)'
      }}>
        {toast}
      </Box>

      <PlanosPagamentoModal
        visible={modalPlanosOpen}
        onClose={() => setModalPlanosOpen(false)}
        token={token}
        user={user}
        onRefresh={carregarPlanoAtivo}
      />
    </Box>
  )
}

export default Settings

