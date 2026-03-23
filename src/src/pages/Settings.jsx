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
import TextField from '@mui/material/TextField' // Adicionado
import Box from '@mui/material/Box' // Adicionado
import Grid from '@mui/material/Grid' // Adicionado
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
      }
    }
    carregarDados()
  }, [])

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
    <section className="panel settings-panel" style={{ 
        padding: '24px', 
        marginBottom: '24px',
        background: 'linear-gradient(145deg, rgba(40, 40, 40, 0.4), rgba(20, 20, 20, 0.6))',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        backdropFilter: 'blur(10px)',
        borderRadius: '16px',
        transition: 'all 0.3s ease',
        height: '100%',
        display: 'flex',
        flexDirection: 'column'
    }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '24px' }}>
        <div style={{ 
            color: 'var(--color-primary)', 
            fontSize: '1.6rem', 
            display: 'flex',
            background: 'rgba(255, 215, 0, 0.1)',
            padding: '8px',
            borderRadius: '12px'
        }}>
            {icon}
        </div>
        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.2px' }}>{title}</h2>
      </header>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>
        {children}
      </div>
    </section>
  )


  const renderField = (label, component) => (
    <Box sx={{ 
        display: 'flex', 
        flexDirection: { xs: 'column', sm: 'row' }, 
        justifyContent: 'space-between', 
        alignItems: { xs: 'flex-start', sm: 'center' }, 
        gap: 2,
        width: '100%'
    }}>
      <label style={{ 
          color: 'rgba(255,255,255,0.6)', 
          fontSize: '0.88rem',
          fontWeight: 500,
          whiteSpace: 'nowrap'
      }}>
          {label}
      </label>
      <Box sx={{ width: { xs: '100%', sm: 'auto' }, display: 'flex', justifyContent: 'flex-end' }}>
        {component}
      </Box>
    </Box>
  )

  const selectSx = { 
    minWidth: 160, 
    bgcolor: 'rgba(255,255,255,0.04)',
    borderRadius: '10px',
    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.1)' },
    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--color-primary)' },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--color-primary)' }
  }

  return (
    <div className="settings-page" style={{ padding: '0 16px 120px', maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
      <header style={{ marginBottom: '48px', textAlign: 'center' }}>
        <h1 className="page-title" style={{ fontSize: '2.5rem' }}>{t('settingsTitle')}</h1>
        <Box sx={{ width: '40px', height: '4px', bgcolor: 'var(--color-primary)', margin: '16px auto', borderRadius: '2px' }} />
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '1rem', opacity: 0.8 }}>
            Configurações e personalização da sua plataforma de trade
        </p>
      </header>

      <Grid container spacing={4} alignItems="stretch">
        <Grid item xs={12} md={6} style={{ display: 'flex', flexDirection: 'column' }}>
          {renderPanel(<MdBrightness4 />, t('themeTitle'), (


            <>
              {renderField(t('themeSite'), (
                <Button 
                    variant="contained" 
                    onClick={toggleTheme}
                    fullWidth
                    startIcon={<MdBrightness4 />}
                    sx={{ 
                        bgcolor: 'var(--color-primary)', 
                        color: '#000',
                        fontWeight: 700,
                        borderRadius: '10px',
                        '&:hover': { bgcolor: '#e0c200' }
                    }}
                >
                  {prefs?.tema === Theme.LIGHT ? t('lightMode') : t('darkMode')}
                </Button>
              ))}
              {renderField(t('language'), (
                <Select
                  value={prefs?.idioma || Language.PT}
                  onChange={changeLang}
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
                  <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>{prefs?.notificacoes ? t('enabled') : t('disabled')}</span>
                  <Switch
                    checked={!!prefs?.notificacoes}
                    onChange={changeAlerts}
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
                value={prefs?.estiloAlgoritmo || AlgorithmStyle.BALANCED}
                onChange={changeEstilo}
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
                  defaultValue={prefs?.investimentoInicial || 0}
                  onBlur={(e) => {
                      updatePreferences({ investimentoInicial: Number(e.target.value) })
                      confirm()
                  }}
                  sx={{ 
                      width: 160, 
                      '& .MuiOutlinedInput-root': { bgcolor: 'rgba(255,255,255,0.04)', borderRadius: '10px' } 
                  }}
                  InputProps={{ startAdornment: <Box sx={{ mr: 1, opacity: 0.5, fontSize: '0.8rem' }}>R$</Box> }}
                />
              ))}

              {renderField(t('preferredCoin'), (
                <Select
                  value={prefs?.idMoedaPreferida || ''}
                  onChange={(e) => updatePreferences({ idMoedaPreferida: e.target.value })}
                  size="small"
                  sx={selectSx}
                >
                  <MenuItem value=""><em>{t('none') || 'Padrão'}</em></MenuItem>
                  {moedas.map(m => (
                    <MenuItem key={m.id} value={m.id}>{m.sigla}</MenuItem>
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
                                    defaultValue={prefs?.riscoMaximoPerda || 0}
                                    onBlur={(e) => {
                                        updatePreferences({ riscoMaximoPerda: Number(e.target.value) })
                                        confirm()
                                    }}
                                    sx={{ width: 140, '& .MuiOutlinedInput-root': { bgcolor: 'rgba(255,255,255,0.04)', borderRadius: '10px' } }}
                                    InputProps={{ endAdornment: <Box sx={{ ml: 1, opacity: 0.5 }}>%</Box> }}
                                />
                            ))}

                            {renderField(t('reviewFrequency'), (
                                <Select
                                    value={prefs?.frequenciaReview || ReviewFrequency.DAILY}
                                    onChange={(e) => updatePreferences({ frequenciaReview: e.target.value })}
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
                                        defaultValue={prefs?.saldoSeguranca || 0}
                                        onBlur={(e) => {
                                            updatePreferences({ saldoSeguranca: Number(e.target.value) })
                                            confirm()
                                        }}
                                        sx={{ width: 100, '& .MuiOutlinedInput-root': { bgcolor: 'rgba(255,255,255,0.04)', borderRadius: '10px' } }}
                                    />

                                    <Select
                                        value={prefs?.idMoedaSaldoSeguranca || ''}
                                        onChange={(e) => updatePreferences({ idMoedaSaldoSeguranca: e.target.value })}
                                        size="small"
                                        sx={{ ...selectSx, minWidth: 90 }}
                                    >
                                        <MenuItem value=""><em>--</em></MenuItem>
                                        {moedas.map(m => (
                                            <MenuItem key={m.id} value={m.id}>{m.sigla}</MenuItem>
                                        ))}
                                    </Select>
                                </Box>
                            ))}
                            {renderField(t('riskProfile'), (
                                <Select
                                    value={prefs?.perfilRisco || RiskProfile.MODERATE}
                                    onChange={(e) => updatePreferences({ perfilRisco: e.target.value })}
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


      <div className={`toast${toast ? ' show' : ''}`}>{toast}</div>
    </div>
  )
}

export default Settings

