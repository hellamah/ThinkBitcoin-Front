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
import { decodeAuthenticationToken, isAuthenticationTokenExpired } from '../utils/authentication'
import { apiRequest, HttpMethod, PreferencesEndpoint } from '../utils/apiClient'

// Lê o token armazenado descartando (e limpando) tokens já expirados, para o
// usuário não permanecer "logado" até levar o primeiro 401.
const lerTokenValido = () => {
  const stored = getStoredToken()
  if (stored && isAuthenticationTokenExpired(stored)) {
    clearStoredToken()
    return null
  }
  return stored
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
  const [token, setToken] = useState(lerTokenValido)
  const [user, setUser] = useState(() => decodeAuthenticationToken(token))
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

  const logout = useCallback(() => {
    setToken(null)
    clearStoredToken()
    setUser(null)
    const defaults = getInitialPreferences()
    setPrefs(defaults)
    applyTheme(defaults.tema)
  }, [applyTheme])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.addEventListener('auth-expired', logout)
    return () => {
      window.removeEventListener('auth-expired', logout)
    }
  }, [logout])

  const login = async (t) => {
    // Grava antes de setToken: o efeito abaixo dispara a carga de preferências
    // e o apiClient lê o token do storage.
    setStoredToken(t)
    setToken(t)
    setUser(decodeAuthenticationToken(t))
  }

  // Única fonte de carga das preferências: cobre login e sessão restaurada.
  useEffect(() => {
    if (!token) return
    const carregarPreferencias = async () => {
      try {
        const json = await apiRequest(PreferencesEndpoint.MINE)
        const resData = json?.resultado || json
        if (resData) {
          setPrefs((atual) => sanitizePreferences({ ...atual, ...resData }))
        }
      } catch {
        /* ignore */
      }
    }
    carregarPreferencias()
  }, [token])

  const updatePreferences = async (novo) => {
    const atual = sanitizePreferences({ ...prefs, ...novo })
    setPrefs(atual)
    applyTheme(atual.tema)
    if (!token) return
    try {
      await apiRequest(PreferencesEndpoint.ALL, {
        method: HttpMethod.PUT,
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
