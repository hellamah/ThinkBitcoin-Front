/**
 * Testes unitários para utils/preferences.
 *
 * Cobre:
 * - Enums Theme, Language, AlgorithmStyle, RiskProfile, ReviewFrequency
 * - sanitizePreferences: normalização e fallback para valores inválidos
 * - sanitizePreferences: campos de perfil de risco e frequência
 * - sanitizePreferences: passagem de campos opcionais (id, nome, email)
 * - getStoredTheme / setStoredTheme: leitura e persistência de tema
 * - getStoredToken / setStoredToken / clearStoredToken: ciclo de vida do token
 * - getInitialPreferences: combinação com tema armazenado
 */
import { describe, it, expect, beforeEach } from 'vitest'
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

// Mock de localStorage para ambiente Node (sem DOM real)
const criarMockStorage = () => ({
  store: {},
  getItem(key) { return this.store[key] ?? null },
  setItem(key, value) { this.store[key] = value },
  removeItem(key) { delete this.store[key] },
})

describe('utils/preferences › Enums', () => {
  it('Theme expõe light e dark como constantes', () => {
    expect(Theme.LIGHT).toBe('light')
    expect(Theme.DARK).toBe('dark')
  })

  it('Language expõe pt e en como constantes', () => {
    expect(Language.PT).toBe('pt')
    expect(Language.EN).toBe('en')
  })

  it('AlgorithmStyle expõe os três estilos como constantes', () => {
    expect(AlgorithmStyle.CONSERVATIVE).toBe('conservador')
    expect(AlgorithmStyle.BALANCED).toBe('equilibrado')
    expect(AlgorithmStyle.AGGRESSIVE).toBe('agressivo')
  })

  it('RiskProfile expõe os três perfis como constantes', () => {
    expect(RiskProfile.CONSERVATIVE).toBe('conservador')
    expect(RiskProfile.MODERATE).toBe('moderado')
    expect(RiskProfile.AGGRESSIVE).toBe('agressivo')
  })

  it('ReviewFrequency expõe as três frequências como constantes', () => {
    expect(ReviewFrequency.DAILY).toBe('diaria')
    expect(ReviewFrequency.WEEKLY).toBe('semanal')
    expect(ReviewFrequency.MONTHLY).toBe('mensal')
  })
})

describe('utils/preferences › DEFAULT_PREFERENCES', () => {
  it('define tema escuro como padrão', () => {
    expect(DEFAULT_PREFERENCES.tema).toBe(Theme.DARK)
  })

  it('define idioma português como padrão', () => {
    expect(DEFAULT_PREFERENCES.idioma).toBe(Language.PT)
  })

  it('define notificações desabilitadas por padrão', () => {
    expect(DEFAULT_PREFERENCES.notificacoes).toBe(false)
  })

  it('define estilo de algoritmo equilibrado por padrão', () => {
    expect(DEFAULT_PREFERENCES.estiloAlgoritmo).toBe(AlgorithmStyle.BALANCED)
  })
})

describe('utils/preferences › sanitizePreferences', () => {
  it('usa os padrões quando chamado sem argumentos', () => {
    const prefs = sanitizePreferences()
    expect(prefs.tema).toBe(DEFAULT_PREFERENCES.tema)
    expect(prefs.idioma).toBe(DEFAULT_PREFERENCES.idioma)
    expect(prefs.notificacoes).toBe(DEFAULT_PREFERENCES.notificacoes)
    expect(prefs.estiloAlgoritmo).toBe(DEFAULT_PREFERENCES.estiloAlgoritmo)
  })

  it('mantém valores válidos informados', () => {
    const prefs = sanitizePreferences({
      tema: Theme.DARK,
      idioma: Language.EN,
      notificacoes: true,
      estiloAlgoritmo: AlgorithmStyle.CONSERVATIVE,
    })

    expect(prefs.tema).toBe(Theme.DARK)
    expect(prefs.idioma).toBe(Language.EN)
    expect(prefs.notificacoes).toBe(true)
    expect(prefs.estiloAlgoritmo).toBe(AlgorithmStyle.CONSERVATIVE)
  })

  it('normaliza tema maiúsculo para minúsculo', () => {
    expect(sanitizePreferences({ tema: 'LIGHT' }).tema).toBe(Theme.LIGHT)
    expect(sanitizePreferences({ tema: 'DARK' }).tema).toBe(Theme.DARK)
  })

  it('substitui tema inválido pelo padrão', () => {
    expect(sanitizePreferences({ tema: 'roxo' }).tema).toBe(DEFAULT_PREFERENCES.tema)
  })

  it('normaliza idioma maiúsculo para minúsculo', () => {
    expect(sanitizePreferences({ idioma: 'EN' }).idioma).toBe(Language.EN)
    expect(sanitizePreferences({ idioma: 'PT' }).idioma).toBe(Language.PT)
  })

  it('substitui idioma inválido pelo padrão', () => {
    expect(sanitizePreferences({ idioma: 'ES' }).idioma).toBe(DEFAULT_PREFERENCES.idioma)
  })

  it('substitui estiloAlgoritmo inválido pelo padrão', () => {
    expect(sanitizePreferences({ estiloAlgoritmo: 'ultra' }).estiloAlgoritmo)
      .toBe(DEFAULT_PREFERENCES.estiloAlgoritmo)
  })

  it('aceita todas as variações de booleano positivo para notificações', () => {
    for (const valor of ['true', '1', 'yes', 'sim']) {
      expect(sanitizePreferences({ notificacoes: valor }).notificacoes).toBe(true)
    }
  })

  it('aceita todas as variações de booleano negativo para notificações', () => {
    for (const valor of ['false', '0', 'no', 'nao', 'não']) {
      expect(sanitizePreferences({ notificacoes: valor }).notificacoes).toBe(false)
    }
  })

  it('substitui notificações inválidas pelo padrão (false)', () => {
    expect(sanitizePreferences({ notificacoes: 'talvez' }).notificacoes)
      .toBe(DEFAULT_PREFERENCES.notificacoes)
  })

  it('persiste investimentoInicial e riscoMaximoPerda quando informados', () => {
    const prefs = sanitizePreferences({ investimentoInicial: 5000, riscoMaximoPerda: 3.5 })
    expect(prefs.investimentoInicial).toBe(5000)
    expect(prefs.riscoMaximoPerda).toBe(3.5)
  })

  it('aceita campos opcionais idPreferenciasUsuarioTB, nome e email', () => {
    const prefs = sanitizePreferences({
      idPreferenciasUsuarioTB: 'id-123',
      nome: 'Satoshi',
      email: 'satoshi@bitcoin.org',
    })
    expect(prefs.idPreferenciasUsuarioTB).toBe('id-123')
    expect(prefs.nome).toBe('Satoshi')
    expect(prefs.email).toBe('satoshi@bitcoin.org')
  })

  it('aceita siglaMoedaPreferida e siglaEmpresaExterna quando informados', () => {
    const prefs = sanitizePreferences({
      siglaMoedaPreferida: 'BTC',
      siglaEmpresaExterna: 'MB',
    })
    expect(prefs.siglaMoedaPreferida).toBe('BTC')
    expect(prefs.siglaEmpresaExterna).toBe('MB')
  })
})

describe('utils/preferences › localStorage', () => {
  beforeEach(() => {
    if (typeof window === 'undefined') {
      global.window = {}
    }
    window.localStorage = criarMockStorage()
  })

  describe('getStoredTheme / setStoredTheme', () => {
    it('persiste e recupera o tema light do localStorage', () => {
      setStoredTheme(Theme.LIGHT)
      expect(getStoredTheme()).toBe(Theme.LIGHT)
    })

    it('persiste e recupera o tema dark do localStorage', () => {
      setStoredTheme(Theme.DARK)
      expect(getStoredTheme()).toBe(Theme.DARK)
    })

    it('retorna o tema padrão quando não há valor no localStorage', () => {
      expect(getStoredTheme()).toBe(DEFAULT_PREFERENCES.tema)
    })

    it('lê o tema diretamente do localStorage sem passar por setter', () => {
      window.localStorage.store.theme = 'light'
      expect(getStoredTheme()).toBe(Theme.LIGHT)
    })

    it('retorna o tema padrão quando o valor armazenado é inválido', () => {
      window.localStorage.store.theme = 'azul'
      expect(getStoredTheme()).toBe(DEFAULT_PREFERENCES.tema)
    })
  })

  describe('getStoredToken / setStoredToken / clearStoredToken', () => {
    it('persiste e recupera o token de autenticação', () => {
      setStoredToken('jwt-token-123')
      expect(getStoredToken()).toBe('jwt-token-123')
    })

    it('retorna null quando não há token armazenado', () => {
      expect(getStoredToken()).toBeNull()
    })

    it('remove o token corretamente após clearStoredToken', () => {
      setStoredToken('jwt-token-456')
      clearStoredToken()
      expect(getStoredToken()).toBeNull()
    })
  })

  describe('getInitialPreferences', () => {
    it('retorna os padrões com o tema lido do localStorage', () => {
      window.localStorage.setItem('theme', 'light')
      const prefs = getInitialPreferences()
      expect(prefs).toMatchObject({
        ...DEFAULT_PREFERENCES,
        tema: Theme.LIGHT,
      })
    })

    it('retorna os padrões com tema dark quando localStorage está vazio', () => {
      const prefs = getInitialPreferences()
      expect(prefs.tema).toBe(DEFAULT_PREFERENCES.tema)
    })
  })
})
