import { useState, useEffect } from 'react'
import {
  MdBrightness4,
  MdLanguage,
  MdNotifications,
  MdTune,
} from 'react-icons/md'
import Button from '@mui/material/Button'
import Switch from '@mui/material/Switch'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import '../App.css'
import { useAuth } from '../context/AuthContext'
import useTranslation from '../hooks/useTranslation'
import { API_URL } from '../api'
import {
  AlgorithmStyle,
  Language,
  Theme,
} from '../utils/preferences'
import { isNotificationSupported } from '../utils/browser'

function Settings() {
  const { prefs, updatePreferences, token } = useAuth()
  const { t } = useTranslation()
  const [light, setLight] = useState(prefs.tema === Theme.LIGHT)
  const [idioma, setIdioma] = useState(prefs.idioma)
  const [notifs, setNotifs] = useState(prefs.notificacoes)
  const [estilo, setEstilo] = useState(prefs.estiloAlgoritmo)
  const [toast, setToast] = useState('')

  useEffect(() => {
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
    const val = e.target.checked
    setNotifs(val)
    updatePreferences({ notificacoes: val })
    if (val) {
      if (!isNotificationSupported()) {
        setNotifs(false)
        updatePreferences({ notificacoes: false })
        setToast(t('notificationsUnsupported'))
        setTimeout(() => setToast(''), 2000)
        return
      }
      try {
        const perm = await Notification.requestPermission()
        if (perm !== 'granted') {
          setNotifs(false)
          updatePreferences({ notificacoes: false })
          setToast(t('notificationsDenied'))
          setTimeout(() => setToast(''), 2000)
          return
        }
        if (token) {
          await fetch(`${API_URL}/ThinkBitcoin/notificacoes/subscribe`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          })
        }
        setToast(t('notificationsOn'))
      } catch {
        setToast(t('notificationsError'))
      }
    } else {
      setToast(t('notificationsOff'))
    }
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

      <div className={`toast${toast ? ' show' : ''}`}>{toast}</div>
    </div>
  )
}

export default Settings
