import { createContext, useContext, useState, useEffect } from 'react'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { API_URL } from '../api'

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
  const [token, setToken] = useState(() => localStorage.getItem('token'))
  const [user, setUser] = useState(() =>
    token ? decodeToken(token) : null
  )
  const [prefs, setPrefs] = useState({
    tema: localStorage.getItem('theme') || 'dark',
    idioma: 'pt',
    notificacoes: false,
    estiloAlgoritmo: 'equilibrado',
  })
  const [theme, setTheme] = useState(() =>
    createTheme({
      palette: {
        mode: (localStorage.getItem('theme') || 'dark') === 'light' ? 'light' : 'dark',
        primary: { main: '#ffd700' },
      },
    })
  )

  useEffect(() => {
    if (token) setUser(decodeToken(token))
    else setUser(null)
  }, [token])

  useEffect(() => {
    document.body.classList.toggle('light', prefs.tema === 'light')
    localStorage.setItem('theme', prefs.tema)
    setTheme(
      createTheme({
        palette: {
          mode: prefs.tema === 'light' ? 'light' : 'dark',
          primary: { main: '#ffd700' },
        },
      })
    )
  }, [prefs.tema])

  const carregarPreferencias = async (t) => {
    try {
      const resp = await fetch(`${API_URL}/ThinkBitcoin/me`, {
        headers: { Authorization: `Bearer ${t}` },
      })
      if (!resp.ok) return
      const json = await resp.json()
      if (json.resultado) {
        setPrefs({
          tema: json.resultado.tema,
          idioma: json.resultado.idioma,
          notificacoes: json.resultado.notificacoes,
          estiloAlgoritmo: json.resultado.estiloAlgoritmo,
        })
        document.body.classList.toggle('light', json.resultado.tema === 'light')
        localStorage.setItem('theme', json.resultado.tema)
      }
    } catch {
      /* ignore */
    }
  }

  const login = async (t) => {
    setToken(t)
    localStorage.setItem('token', t)
    setUser(decodeToken(t))
    await carregarPreferencias(t)
  }

  const logout = () => {
    setToken(null)
    localStorage.removeItem('token')
    setUser(null)
    setPrefs((p) => ({ ...p }))
  }

  useEffect(() => {
    if (token) carregarPreferencias(token)
  }, [token])

  const updatePreferences = async (novo) => {
    const atual = { ...prefs, ...novo }
    setPrefs(atual)
    document.body.classList.toggle('light', atual.tema === 'light')
    localStorage.setItem('theme', atual.tema)
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
