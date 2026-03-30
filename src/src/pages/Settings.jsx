import { useState, useEffect } from 'react'
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
import '../App.css'
import { useAuth } from '../context/AuthContext'
import useTranslation from '../hooks/useTranslation'
import { apiRequest, MarketEndpoint } from '../utils/apiClient'
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

function Settings() {
  const { t } = useTranslation()
  const { token, prefs, updatePreferences } = useAuth()
  const [localPrefs, setLocalPrefs] = useState(prefs)
  const [toast, setToast] = useState('')
  const [moedas, setMoedas] = useState([])
  const [exchanges, setExchanges] = useState([])

  useEffect(() => {
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

  const renderPanel = (icon, title, children) => (
    <Box className="panel settings-panel" sx={{ 
        padding: '32px', 
        marginBottom: '32px',
        background: 'rgba(20, 20, 20, 0.8)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 215, 0, 0.12)',
        borderRadius: '24px',
        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
        '&:hover': {
            borderColor: 'rgba(255, 215, 0, 0.3)',
            transform: 'translateY(-4px)'
        }
    }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
        <div style={{ 
            color: 'var(--color-primary)', 
            fontSize: '1.5rem', 
            display: 'flex',
            background: 'rgba(255, 215, 0, 0.08)',
            padding: '12px',
            borderRadius: '16px',
            boxShadow: '0 0 15px rgba(255, 215, 0, 0.1)'
        }}>
            {icon}
        </div>
        <Typography variant="h6" sx={{ margin: 0, fontWeight: 800, color: '#fff', letterSpacing: '-0.3px' }}>{title}</Typography>
      </header>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', flex: 1 }}>
        {children}
      </div>
    </Box>
  )


  const renderField = (label, component) => (
    <Box sx={{ 
        display: 'flex', 
        flexDirection: { xs: 'column', sm: 'row' }, 
        justifyContent: 'space-between', 
        alignItems: { xs: 'flex-start', sm: 'center' }, 
        gap: 2,
        width: '100%',
        py: 0.5
    }}>
      <Typography sx={fieldLabelStyle}>
          {label}
      </Typography>
      <Box sx={{ width: { xs: '100%', sm: 'auto' }, display: 'flex', justifyContent: 'flex-end' }}>
        {component}
      </Box>
    </Box>
  )

  const selectSx = { 
    minWidth: 160, 
    bgcolor: 'rgba(255,255,255,0.03)',
    borderRadius: '12px',
    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.08)' },
    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--color-primary)' },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--color-primary)' },
    '& .MuiSelect-select': { py: 1.2, color: 'rgba(255,255,255,0.9)' }
  }

  const fieldLabelStyle = { 
    color: 'rgba(255,255,255,0.5)', 
    fontSize: '0.85rem',
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  }

  return (
    <Box className="settings-page" sx={{ 
      py: 6, 
      width: '100%', 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center' 
    }}>
      <header style={{ marginBottom: '64px', textAlign: 'center', width: '100%' }}>
        <Typography variant="h2" sx={{ fontWeight: 800, color: '#fff', letterSpacing: '-1px', mb: 1 }}>{t('settingsTitle')}</Typography>
        <Box sx={{ width: '60px', height: '4px', bgcolor: 'var(--color-primary)', margin: '16px auto', borderRadius: '4px', boxShadow: '0 0 10px var(--color-primary)' }} />
        <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '1.1rem' }}>
            {t('settingsSubtitle') || 'Configurações e personalização da sua plataforma de trade'}
        </Typography>
      </header>

      <Grid container spacing={4} alignItems="stretch" sx={{ width: '100%', margin: 0 }}>
        <Grid item xs={12} md={6} style={{ display: 'flex', flexDirection: 'column' }}>
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
        </Grid>

        <Grid item xs={12} md={6} style={{ display: 'flex', flexDirection: 'column' }}>
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
                  sx={{ 
                      width: 160, 
                      '& .MuiOutlinedInput-root': { bgcolor: 'rgba(255,255,255,0.04)', borderRadius: '10px' } 
                  }}
                  InputProps={{ startAdornment: <Box sx={{ mr: 1, opacity: 0.5, fontSize: '0.8rem' }}>$</Box> }}
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
        </Grid>

        <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'center' }}>
            <Box sx={{ width: '100%', maxWidth: '900px' }}>
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
                                    sx={{ width: 140, '& .MuiOutlinedInput-root': { bgcolor: 'rgba(255,255,255,0.04)', borderRadius: '10px' } }}
                                    InputProps={{ endAdornment: <Box sx={{ ml: 1, opacity: 0.5 }}>%</Box> }}
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
                                <Box sx={{ display: 'flex', gap: 1 }}>
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
                                        sx={{ width: 100, '& .MuiOutlinedInput-root': { bgcolor: 'rgba(255,255,255,0.04)', borderRadius: '10px' } }}
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
            </Box>
        </Grid>

      </Grid>


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
    </Box>
  )
}

export default Settings

