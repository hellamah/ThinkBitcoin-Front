import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
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
import { clearAllCache } from '../utils/cache'

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
  // O usuário É o token decodificado, então é derivado dele — e não um segundo
  // estado mantido em sincronia por efeito. Com o efeito, cada troca de token
  // produzia dois objetos `user` em renders seguidos (o do login() e o do
  // efeito), iguais no conteúdo e diferentes na identidade, e quem tivesse
  // `user` como dependência de efeito podia rodar de novo à toa.
  const user = useMemo(() => decodeAuthenticationToken(token), [token])
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
    applyTheme(prefs.tema)
  }, [prefs.tema, applyTheme])

  // O cache de respostas do apiClient é chaveado por endpoint, não por usuário
  // (`api_cache_${endpoint}`). Enquanto ele sobreviver à troca de sessão, os
  // dados de uma conta podem ser servidos à seguinte no mesmo navegador,
  // dentro do TTL. Hoje só o heatmap de trend usa cache — dado público de
  // mercado —, mas basta alguém marcar `useCache: true` num endpoint de
  // patrimônio para isso virar vazamento. Limpar aqui é o que torna a regra
  // "cache é por sessão" verdadeira em vez de sorte.
  const logout = useCallback(() => {
    setToken(null)
    clearStoredToken()
    clearAllCache()
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

  const login = useCallback(async (t) => {
    // Também na entrada, e não só no logout: quem fecha a aba sem sair deixa o
    // cache para trás, e o próximo a entrar herdaria aquilo. Toda sessão começa
    // limpa.
    clearAllCache()
    // Grava antes de setToken: o efeito abaixo dispara a carga de preferências
    // e o apiClient lê o token do storage.
    setStoredToken(t)
    setToken(t)
  }, [])

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

  // Devolve se a mudança chegou à API. A preferência é aplicada na hora — o
  // tema troca no clique, sem esperar a rede —, mas quem chama precisa saber se
  // ela foi guardada: o Settings confirmava "salvo" sem perguntar, e quando o
  // PUT falhava a escolha valia até a próxima sessão e sumia sem explicação.
  const updatePreferences = useCallback(async (novo) => {
    const atual = sanitizePreferences({ ...prefs, ...novo })
    setPrefs(atual)
    applyTheme(atual.tema)
    // Sem sessão não há onde guardar: a mudança local é tudo o que se pede.
    if (!token) return true
    try {
      await apiRequest(PreferencesEndpoint.ALL, {
        method: HttpMethod.PUT,
        body: atual,
      })
      return true
    } catch (err) {
      console.error('Erro ao salvar preferências:', err)
      return false
    }
  }, [prefs, token, applyTheme])

  // Memoizado: um objeto novo a cada render re-renderizava todos os consumidores
  // mesmo quando nada do que eles leem tinha mudado — trocar o tema, por
  // exemplo, recria só o `theme` do MUI, que nem está aqui dentro.
  const valor = useMemo(
    () => ({ token, user, prefs, login, logout, updatePreferences }),
    [token, user, prefs, login, logout, updatePreferences]
  )

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthContext.Provider value={valor}>
        {children}
      </AuthContext.Provider>
    </ThemeProvider>
  )
}

export const useAuth = () => useContext(AuthContext)
