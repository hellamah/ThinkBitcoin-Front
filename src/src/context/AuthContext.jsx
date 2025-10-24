import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { API_URL } from '../api'
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

const decodeToken = (t) => {
  try {
    const payload = JSON.parse(atob(t.split('.')[1]))
    return {
      nome:
        payload[
          'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'
        ],
      email:
        payload[
          'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'
        ],
    }
  } catch {
    return null
  }
}

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
    initialToken ? decodeToken(initialToken) : null
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
    if (token) setUser(decodeToken(token))
    else setUser(null)
  }, [token])

  useEffect(() => {
    applyTheme(prefs.tema)
  }, [prefs.tema, applyTheme])

  const carregarPreferencias = async (t) => {
    try {
      const resp = await fetch(`${API_URL}/ThinkBitcoin/me`, {
        headers: { Authorization: `Bearer ${t}` },
      })
      if (!resp.ok) return
      const json = await resp.json()
      if (json.resultado) {
        setPrefs((atual) =>
          sanitizePreferences({ ...atual, ...json.resultado })
        )
      }
    } catch {
      /* ignore */
    }
  }

  const login = async (t) => {
    setToken(t)
    setStoredToken(t)
    setUser(decodeToken(t))
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
      await fetch(`${API_URL}/ThinkBitcoin/usuariosTB/atualizarPreferencias`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(atual),
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
