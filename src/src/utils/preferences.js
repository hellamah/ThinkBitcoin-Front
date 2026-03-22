const getWindow = () =>
  typeof window !== 'undefined' ? window : undefined

const hasLocalStorage = () => {
  const win = getWindow()
  if (!win) return false
  try {
    return typeof win.localStorage !== 'undefined'
  } catch {
    return false
  }
}

export const Theme = Object.freeze({
  LIGHT: 'light',
  DARK: 'dark',
})

export const Language = Object.freeze({
  PT: 'pt',
  EN: 'en',
})

export const AlgorithmStyle = Object.freeze({
  CONSERVATIVE: 'conservador',
  BALANCED: 'equilibrado',
  AGGRESSIVE: 'agressivo',
})

export const RiskProfile = Object.freeze({
  CONSERVATIVE: 'conservador',
  MODERATE: 'moderado',
  AGGRESSIVE: 'agressivo',
})

export const ReviewFrequency = Object.freeze({
  DAILY: 'diaria',
  WEEKLY: 'semanal',
  MONTHLY: 'mensal',
})

export const DEFAULT_PREFERENCES = Object.freeze({
  tema: Theme.DARK,
  idioma: Language.PT,
  notificacoes: false,
  estiloAlgoritmo: AlgorithmStyle.BALANCED,
  investimentoInicial: 0,
  riscoMaximoPerda: 2,
  idMoedaPreferida: null,
  idCorretoraFavorita: null,
  saldoSeguranca: 0,
  idMoedaSaldoSeguranca: null,
  frequenciaReview: 'diaria',
  perfilRisco: 'moderado',
})

const getStorage = () => {
  if (!hasLocalStorage()) return null
  try {
    return getWindow().localStorage
  } catch {
    return null
  }
}

const normalizeTheme = (value) => {
  if (typeof value !== 'string') return null
  const normalized = value.toLowerCase()
  if (normalized === Theme.LIGHT) return Theme.LIGHT
  if (normalized === Theme.DARK) return Theme.DARK
  return null
}

const normalizeLanguage = (value) => {
  if (typeof value !== 'string') return null
  const normalized = value.toLowerCase()
  if (normalized === Language.PT) return Language.PT
  if (normalized === Language.EN) return Language.EN
  return null
}

const normalizeAlgorithmStyle = (value) => {
  if (typeof value !== 'string') return null
  const normalized = value.toLowerCase()
  if (Object.values(AlgorithmStyle).includes(normalized)) return normalized
  return null
}

const normalizeBoolean = (value) => {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const normalized = value.toLowerCase()
    if (['true', '1', 'yes', 'sim'].includes(normalized)) return true
    if (['false', '0', 'no', 'nao', 'não'].includes(normalized)) return false
  }
  return null
}

export const sanitizePreferences = (prefs = {}) => {
  const merged = {
    ...DEFAULT_PREFERENCES,
    ...prefs,
  }

  const tema = normalizeTheme(merged.tema)
  const idioma = normalizeLanguage(merged.idioma)
  const estilo = normalizeAlgorithmStyle(merged.estiloAlgoritmo)
  const notificacoes = normalizeBoolean(merged.notificacoes)

  return {
    tema: tema ?? DEFAULT_PREFERENCES.tema,
    idioma: idioma ?? DEFAULT_PREFERENCES.idioma,
    estiloAlgoritmo: estilo ?? DEFAULT_PREFERENCES.estiloAlgoritmo,
    notificacoes: notificacoes ?? DEFAULT_PREFERENCES.notificacoes,
    investimentoInicial: merged.investimentoInicial ?? DEFAULT_PREFERENCES.investimentoInicial,
    riscoMaximoPerda: merged.riscoMaximoPerda ?? DEFAULT_PREFERENCES.riscoMaximoPerda,
    idMoedaPreferida: merged.idMoedaPreferida ?? DEFAULT_PREFERENCES.idMoedaPreferida,
    idCorretoraFavorita: merged.idCorretoraFavorita ?? DEFAULT_PREFERENCES.idCorretoraFavorita,
    saldoSeguranca: merged.saldoSeguranca ?? DEFAULT_PREFERENCES.saldoSeguranca,
    idMoedaSaldoSeguranca: merged.idMoedaSaldoSeguranca ?? DEFAULT_PREFERENCES.idMoedaSaldoSeguranca,
    frequenciaReview: merged.frequenciaReview ?? DEFAULT_PREFERENCES.frequenciaReview,
    perfilRisco: merged.perfilRisco ?? DEFAULT_PREFERENCES.perfilRisco,
  }
}

export const getStoredTheme = () =>
  normalizeTheme(getStorage()?.getItem('theme')) ?? DEFAULT_PREFERENCES.tema

export const setStoredTheme = (theme) => {
  const storage = getStorage()
  if (!storage) return
  storage.setItem('theme', normalizeTheme(theme) ?? DEFAULT_PREFERENCES.tema)
}

export const getStoredToken = () => getStorage()?.getItem('token') ?? null

export const setStoredToken = (token) => {
  const storage = getStorage()
  if (!storage) return
  storage.setItem('token', token)
}

export const clearStoredToken = () => {
  const storage = getStorage()
  if (!storage) return
  storage.removeItem('token')
}

export const getInitialPreferences = () =>
  sanitizePreferences({ tema: getStoredTheme() })
