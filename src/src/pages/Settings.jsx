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
import '../App.css'
import { useAuth } from '../context/AuthContext'
import useTranslation from '../hooks/useTranslation'
import { apiRequest } from '../utils/apiClient'
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
  const [light, setLight] = useState(prefs?.tema === Theme.LIGHT)
  const [idioma, setIdioma] = useState(prefs?.idioma || Language.PT)
  const [notifs, setNotifs] = useState(prefs?.notificacoes || false)
  const [estilo, setEstilo] = useState(prefs?.estiloAlgoritmo || AlgorithmStyle.BALANCED)

  useEffect(() => {
    const carregarDados = async () => {
      try {
        const [resMoedas, resExchanges] = await Promise.all([
          apiRequest('/ThinkBitcoin/moedas'),
          apiRequest('/ThinkBitcoin/exchanges')
        ])
        if (resMoedas.sucesso) setMoedas(resMoedas.resultado)
        if (resExchanges.sucesso) setExchanges(resExchanges.resultado)
      } catch (err) {
        console.error('Erro ao carregar dados:', err)
      }
    }
    carregarDados()
  }, [])

  useEffect(() => {
    if (!prefs) return
    setLight(prefs.tema === Theme.LIGHT)
    setIdioma(prefs.idioma)
    setNotifs(prefs.notificacoes)
    setEstilo(prefs.estiloAlgoritmo)
  }, [prefs])

  useEffect(() => {
    document.body.classList.toggle('light', light)
  }, [light])

  const toggleTheme = () => {
    const novo = light ? Theme.DARK : Theme.LIGHT
    setLight(!light)
    updatePreferences({ tema: novo })
    setToast(novo === Theme.LIGHT ? t('lightOn') : t('darkOn'))
    setTimeout(() => setToast(''), 2000)
  }

  const confirm = () => {
    setToast(t('settingsSaved'))
    setTimeout(() => setToast(''), 2000)
  }

  const changeLang = (e) => {
    const lang = e.target.value
    if (!Object.values(Language).includes(lang)) return
    setIdioma(lang)
    updatePreferences({ idioma: lang })
    confirm()
  }

  const changeAlerts = async (e) => {
    const enabled = e.target.checked
    setNotifs(enabled)

    const result = await executeNotificationWorkflow({
      enabled,
      token,
      isNotificationSupported,
      notificationApi: Notification,
      baseUrl: API_URL,
    })

    setNotifs(result.shouldEnableNotifications)
    updatePreferences({ notificacoes: result.shouldEnableNotifications })
    setToast(t(result.messageKey))
    setTimeout(() => setToast(''), 2000)
  }

  const changeEstilo = (e) => {
    const val = e.target.value
    if (!Object.values(AlgorithmStyle).includes(val)) return
    setEstilo(val)
    updatePreferences({ estiloAlgoritmo: val })
    confirm()
  }

  return (
    <div className="settings-container">
      <h1>{t('settingsTitle')}</h1>

      <section className="panel">
        <h2>{t('themeTitle')}</h2>
        <div className="setting-item">
          <label htmlFor="theme-toggle">
            <MdBrightness4 /> {t('themeSite')}
          </label>
          <Button id="theme-toggle" variant="contained" color="primary" onClick={toggleTheme}>
            {light ? t('lightMode') : t('darkMode')}
          </Button>
        </div>
      </section>

      <section className="panel">
        <h2>{t('preferredLanguage')}</h2>
        <div className="setting-item">
          <label htmlFor="lang-select">
            <MdLanguage /> {t('language')}
          </label>
          <Select
            id="lang-select"
            value={idioma}
            onChange={changeLang}
            variant="filled"
            color="primary"
            sx={{ minWidth: 120, backgroundColor: 'var(--color-bg)' }}
            inputProps={{ style: { color: 'var(--color-text)' } }}
            MenuProps={{
              PaperProps: { sx: { bgcolor: 'var(--color-bg-card)' } },
            }}
          >
            <MenuItem value={Language.PT}>{t('portuguese')}</MenuItem>
            <MenuItem value={Language.EN}>{t('english')}</MenuItem>
          </Select>
        </div>
      </section>

      <section className="panel">
        <h2>{t('notifications')}</h2>
        <div className="setting-item">
          <label htmlFor="alerts-toggle">
            <MdNotifications /> {t('emailNotifications')}
          </label>
          <Switch
            id="alerts-toggle"
            checked={notifs}
            onChange={changeAlerts}
            color="primary"
          />
        </div>
      </section>

      <section className="panel">
        <h2>{t('algorithmStyle')}</h2>
        <div className="setting-item">
          <label htmlFor="algo-config">
            <MdTune /> {t('algorithmStyle')}
          </label>
          <Select
            id="algo-config"
            value={estilo}
            onChange={changeEstilo}
            variant="filled"
            color="primary"
            sx={{ minWidth: 140, backgroundColor: 'var(--color-bg)' }}
            inputProps={{ style: { color: 'var(--color-text)' } }}
            MenuProps={{
              PaperProps: { sx: { bgcolor: 'var(--color-bg-card)' } },
            }}
          >
            <MenuItem value={AlgorithmStyle.CONSERVATIVE}>{t('conservative')}</MenuItem>
            <MenuItem value={AlgorithmStyle.BALANCED}>{t('balanced')}</MenuItem>
            <MenuItem value={AlgorithmStyle.AGGRESSIVE}>{t('aggressive')}</MenuItem>
          </Select>
        </div>
      </section>

      <section className="panel">
        <h2>{t('traderLabTitle')}</h2>
        <div className="setting-item">
          <label><MdAccountBalanceWallet /> {t('initialInvestment')}</label>
          <input
            type="number"
            value={prefs.investimentoInicial}
            onChange={(e) => updatePreferences({ investimentoInicial: Number(e.target.value) })}
          />
        </div>
        <div className="setting-item">
          <label><MdCurrencyBitcoin /> {t('preferredCoin')}</label>
          <Select
            value={prefs.idMoedaPreferida || ''}
            onChange={(e) => updatePreferences({ idMoedaPreferida: e.target.value })}
            variant="filled" size="small"
            sx={{ minWidth: 120, backgroundColor: 'var(--color-bg)' }}
            inputProps={{ style: { color: 'var(--color-text)' } }}
          >
            <MenuItem value=""><em>{t('none') || 'Nenhuma'}</em></MenuItem>
            {moedas.map(m => (
              <MenuItem key={m.id} value={m.id}>{m.sigla} - {m.nome}</MenuItem>
            ))}
          </Select>
        </div>
        <div className="setting-item">
          <label><MdStore /> {t('preferredExchange')}</label>
          <Select
            value={prefs.idCorretoraFavorita || ''}
            onChange={(e) => updatePreferences({ idCorretoraFavorita: e.target.value })}
            variant="filled" size="small"
            sx={{ minWidth: 120, backgroundColor: 'var(--color-bg)' }}
            inputProps={{ style: { color: 'var(--color-text)' } }}
          >
            <MenuItem value=""><em>{t('none') || 'Nenhuma'}</em></MenuItem>
            {exchanges.map(e => (
              <MenuItem key={e.id} value={e.id}>{e.nome}</MenuItem>
            ))}
          </Select>
        </div>
      </section>

      <section className="panel">
        <h2>{t('riskManagementTitle')}</h2>
        <div className="setting-item">
          <label><MdTrendingDown /> {t('maxRiskPerTrade')}</label>
          <input
            type="number"
            value={prefs.riscoMaximoPerda}
            onChange={(e) => updatePreferences({ riscoMaximoPerda: Number(e.target.value) })}
          />
        </div>
        <div className="setting-item">
          <label><MdSecurity /> {t('safetyBalance')}</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="number"
              style={{ width: '100px' }}
              value={prefs.saldoSeguranca}
              onChange={(e) => updatePreferences({ saldoSeguranca: Number(e.target.value) })}
            />
            <Select
              value={prefs.idMoedaSaldoSeguranca || ''}
              onChange={(e) => updatePreferences({ idMoedaSaldoSeguranca: e.target.value })}
              variant="filled" size="small"
              sx={{ minWidth: 100, backgroundColor: 'var(--color-bg)' }}
              inputProps={{ style: { color: 'var(--color-text)' } }}
            >
              <MenuItem value=""><em>{t('none') || 'Asset'}</em></MenuItem>
              {moedas.map(m => (
                <MenuItem key={m.id} value={m.id}>{m.sigla}</MenuItem>
              ))}
            </Select>
          </div>
        </div>
        <div className="setting-item">
          <label><MdHistory /> {t('reviewFrequency')}</label>
          <Select
            value={prefs.frequenciaReview}
            onChange={(e) => updatePreferences({ frequenciaReview: e.target.value })}
            variant="filled" size="small"
            sx={{ minWidth: 120, backgroundColor: 'var(--color-bg)' }}
            inputProps={{ style: { color: 'var(--color-text)' } }}
          >
            <MenuItem value={ReviewFrequency.DAILY}>{t('daily')}</MenuItem>
            <MenuItem value={ReviewFrequency.WEEKLY}>{t('weekly')}</MenuItem>
            <MenuItem value={ReviewFrequency.MONTHLY}>{t('monthly')}</MenuItem>
          </Select>
        </div>
        <div className="setting-item">
          <label><MdAssessment /> {t('riskProfile')}</label>
          <Select
            value={prefs.perfilRisco}
            onChange={(e) => updatePreferences({ perfilRisco: e.target.value })}
            variant="filled" size="small"
            sx={{ minWidth: 120, backgroundColor: 'var(--color-bg)' }}
            inputProps={{ style: { color: 'var(--color-text)' } }}
          >
            <MenuItem value={RiskProfile.CONSERVATIVE}>{t('conservative')}</MenuItem>
            <MenuItem value={RiskProfile.MODERATE}>{t('moderate')}</MenuItem>
            <MenuItem value={RiskProfile.AGGRESSIVE}>{t('aggressive')}</MenuItem>
          </Select>
        </div>
      </section>

      <div className={`toast${toast ? ' show' : ''}`}>{toast}</div>
    </div>
  )
}

export default Settings
