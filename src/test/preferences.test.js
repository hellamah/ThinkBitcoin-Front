/**
 * Testes unitários para utils/preferences.
 * 
 * Este conjunto de testes valida a persistência de configurações, saneamento 
 * de entradas e o ciclo de vida de preferências do investidor no ThinkBitcoin.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  AlgorithmStyle,
  DEFAULT_PREFERENCES,
  Language,
  ReviewFrequency,
  RiskProfile,
  Theme,
  clearStoredToken,
  getInitialPreferences,
  getStoredTheme,
  getStoredToken,
  sanitizePreferences,
  setStoredTheme,
  setStoredToken,
} from '../src/utils/preferences'

// Mock robusto de localStorage e window para ambiente node
const criarMockStorage = () => {
  let store = {}
  return {
    getItem: vi.fn(key => store[key] || null),
    setItem: vi.fn((key, value) => { store[key] = value.toString() }),
    removeItem: vi.fn(key => { delete store[key] }),
    clear: vi.fn(() => { store = {} }),
    store
  }
}

describe('utils/preferences › Enums & Constantes', () => {
  it('deve expor temas (Light/Dark) como constantes imutáveis', () => {
    expect(Theme.LIGHT).toBe('light')
    expect(Theme.DARK).toBe('dark')
  })

  it('deve expor os estilos de algoritmos do laboratório corretamente', () => {
    expect(AlgorithmStyle.CONSERVATIVE).toBe('conservador')
    expect(AlgorithmStyle.BALANCED).toBe('equilibrado')
    expect(AlgorithmStyle.AGGRESSIVE).toBe('agressivo')
  })

  it('deve carregar as configurações padrão (Dark/PT) corretamente', () => {
    expect(DEFAULT_PREFERENCES.tema).toBe(Theme.DARK)
    expect(DEFAULT_PREFERENCES.idioma).toBe(Language.PT)
  })
})

describe('utils/preferences › sanitizePreferences (Saneamento de Dados)', () => {
  it('deve aplicar valores padrão para entradas vazias ou indefinidas', () => {
    const prefs = sanitizePreferences({})
    expect(prefs.tema).toBe(DEFAULT_PREFERENCES.tema)
    expect(prefs.idioma).toBe(DEFAULT_PREFERENCES.idioma)
  })

  it('deve normalizar strings de tema e idioma para minúsculo', () => {
    const prefs = sanitizePreferences({ tema: 'LIGHT', idioma: 'EN' })
    expect(prefs.tema).toBe(Theme.LIGHT)
    expect(prefs.idioma).toBe(Language.EN)
  })

  it('deve substituir valores de tema inválidos pelo padrão de segurança (Dark)', () => {
    const prefs = sanitizePreferences({ tema: 'invalid_theme' })
    expect(prefs.tema).toBe(Theme.DARK)
  })

  it('deve converter variações de "sim/não" para booleanos em notificações', () => {
    expect(sanitizePreferences({ notificacoes: 'sim' }).notificacoes).toBe(true)
    expect(sanitizePreferences({ notificacoes: 'não' }).notificacoes).toBe(false)
    expect(sanitizePreferences({ notificacoes: '1' }).notificacoes).toBe(true)
  })

  it('deve preservar campos de identificação (ID, Nome, Email) quando presentes', () => {
    const data = { nome: 'Trader X', email: 'x@think.com', idPreferenciasUsuarioTB: 'P001' }
    const prefs = sanitizePreferences(data)
    expect(prefs.nome).toBe('Trader X')
    expect(prefs.idPreferenciasUsuarioTB).toBe('P001')
  })
})

describe('utils/preferences › Persistência (LocalStorage)', () => {
  beforeEach(() => {
    const mockStorage = criarMockStorage()
    // Como vitest roda em ambiente 'node' conforme config, stubbamos o global window
    vi.stubGlobal('window', { localStorage: mockStorage })
    vi.stubGlobal('localStorage', mockStorage)
  })

  it('deve persistir e recuperar o token de acesso (JWT)', () => {
    setStoredToken('secure-token')
    expect(localStorage.setItem).toHaveBeenCalledWith('token', 'secure-token')
    expect(getStoredToken()).toBe('secure-token')
  })

  it('deve limpar o token do armazenamento ao executar o logout', () => {
    setStoredToken('old-token')
    clearStoredToken()
    expect(getStoredToken()).toBeNull()
  })

  it('deve persistir a escolha de tema do usuário', () => {
    setStoredTheme(Theme.LIGHT)
    expect(getStoredTheme()).toBe(Theme.LIGHT)
  })

  it('deve retornar o tema padrão se o valor no armazenamento for corrupto ou inválido', () => {
    localStorage.setItem('theme', 'corrupt_value')
    expect(getStoredTheme()).toBe(Theme.DARK)
  })

  it('deve inicializar as preferências combinando valores padrão e persistidos', () => {
    localStorage.setItem('theme', 'light')
    const initial = getInitialPreferences()
    expect(initial.tema).toBe(Theme.LIGHT)
    expect(initial.idioma).toBe(Language.PT) // Padrão pois não estava no storage
  })
})
