import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import {
  Theme,
  getInitialPreferences,
  getStoredTheme,
  getStoredToken,
  sanitizePreferences,
  setStoredTheme,
  setStoredToken,
  clearStoredToken,
} from '../utils/preferences'
import { decodeAuthenticationToken } from '../utils/authentication'
import { apiRequest, HttpMethod, UserEndpoint, PreferencesEndpoint } from '../utils/apiClient'

const AuthContext = createContext({
  token: null,
  user: null,
  prefs: null,
  login: () => {},
  logout: () => {},
  updatePreferences: () => {},
})

export function AuthProvider({ children }) {
  const initialToken = getStoredToken()
  const [token, setToken] = useState(initialToken)
  const [user, setUser] = useState(() =>
    decodeAuthenticationToken(initialToken)
  )
  const [prefs, setPrefs] = useState(() => getInitialPreferences())
  const buildTheme = useCallback(
    (tema) =>
      createTheme({
        palette: {
          mode: tema === Theme.LIGHT ? 'light' : 'dark',
          primary: { main: '#ffd700' },
        },
      }),
    []
  )
  const [theme, setTheme] = useState(() => buildTheme(getStoredTheme()))

  const applyTheme = useCallback(
    (tema) => {
      if (typeof document !== 'undefined') {
        document.body.classList.toggle('light', tema === Theme.LIGHT)
      }
      setStoredTheme(tema)
      setTheme(buildTheme(tema))
    },
    [buildTheme]
  )

  useEffect(() => {
    setUser(decodeAuthenticationToken(token))
  }, [token])

  useEffect(() => {
    applyTheme(prefs.tema)
  }, [prefs.tema, applyTheme])

  useEffect(() => {
    const handleAuthExpired = () => {
      logout()
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('auth-expired', handleAuthExpired)
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('auth-expired', handleAuthExpired)
      }
    }
  }, [])

  const carregarPreferencias = async (t) => {
    try {
      const json = await apiRequest(PreferencesEndpoint.MINE, {
        headers: { Authorization: `Bearer ${t}` },
      })
      const resData = json?.resultado || json?.Resultado || json
      if (resData) {
        setPrefs((atual) =>
          sanitizePreferences({ ...atual, ...resData })
        )
      }
    } catch {
      /* ignore */
    }
  }

  const login = async (t) => {
    setToken(t)
    setStoredToken(t)
    setUser(decodeAuthenticationToken(t))
    await carregarPreferencias(t)
  }

  const logout = () => {
    setToken(null)
    clearStoredToken()
    setUser(null)
    const defaults = getInitialPreferences()
    setPrefs(defaults)
    applyTheme(defaults.tema)
  }

  useEffect(() => {
    if (token) carregarPreferencias(token)
  }, [token])

  const updatePreferences = async (novo) => {
    const atual = sanitizePreferences({ ...prefs, ...novo })
    setPrefs(atual)
    applyTheme(atual.tema)
    if (!token) return
    try {
      await apiRequest(PreferencesEndpoint.ALL, {
        method: HttpMethod.PUT,
        headers: { Authorization: `Bearer ${token}` },
        body: atual,
      })
    } catch {
      /* ignore */
    }
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthContext.Provider value={{ token, user, prefs, login, logout, updatePreferences }}>
        {children}
      </AuthContext.Provider>
    </ThemeProvider>
  )
}

export const useAuth = () => useContext(AuthContext)
