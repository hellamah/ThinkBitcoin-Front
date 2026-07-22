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
    (tema) => {
      const isLight = tema === Theme.LIGHT
      return createTheme({
        palette: {
          mode: isLight ? 'light' : 'dark',
          // O ouro da marca só sobrevive como cor de texto no tema escuro;
          // sobre branco cai para ~1.4:1 de contraste, então clareia/escurece
          // junto com --accent-ink.
          // No claro o ouro precisa ser escuro para servir de cor de texto —
          // e aí o preenchimento pede texto branco, não o preto do tema escuro.
          primary: isLight
            ? { main: '#8a6a00', contrastText: '#ffffff' }
            : { main: '#ffd700', contrastText: '#000000' },
          background: isLight
            ? { default: '#f4f5f7', paper: '#ffffff' }
            : { default: '#0d0d0d', paper: '#1a1a1a' },
          // secondary acompanha --text-muted: 0.58 reprovava em contraste (4.3:1).
          text: isLight
            ? { primary: '#16181d', secondary: 'rgba(22,24,29,0.72)' }
            : { primary: '#ffffff', secondary: 'rgba(255,255,255,0.6)' },
        },
      })
    },
    []
  )
  const [theme, setTheme] = useState(() => buildTheme(getStoredTheme()))

  const applyTheme = useCallback(
    (tema) => {
      if (typeof document !== 'undefined') {
        // A classe vai também no <html>: os tokens ficam disponíveis para o
        // próprio elemento raiz, senão o fundo dele continua escuro e vaza
        // atrás do body em páginas mais curtas que a viewport.
        const isLight = tema === Theme.LIGHT
        document.body.classList.toggle('light', isLight)
        document.documentElement.classList.toggle('light', isLight)
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
