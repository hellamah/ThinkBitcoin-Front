import { describe, it, expect, beforeEach } from 'vitest'
import {
  AlgorithmStyle,
  DEFAULT_PREFERENCES,
  Language,
  Theme,
  getInitialPreferences,
  getStoredTheme,
  sanitizePreferences,
  setStoredTheme,
} from '../src/utils/preferences'

describe('utils/preferences', () => {
  beforeEach(() => {
    if (typeof window === 'undefined') {
      global.window = {}
    }
    window.localStorage = {
      store: {},
      getItem(key) {
        return this.store[key] ?? null
      },
      setItem(key, value) {
        this.store[key] = value
      },
      removeItem(key) {
        delete this.store[key]
      },
    }
  })

  it('normaliza valores inválidos para os padrões', () => {
    const prefs = sanitizePreferences({
      tema: 'LIGHT',
      idioma: 'ES',
      notificacoes: 'talvez',
      estiloAlgoritmo: 'ultra',
    })

    expect(prefs.tema).toBe(Theme.LIGHT)
    expect(prefs.idioma).toBe(DEFAULT_PREFERENCES.idioma)
    expect(prefs.notificacoes).toBe(DEFAULT_PREFERENCES.notificacoes)
    expect(prefs.estiloAlgoritmo).toBe(DEFAULT_PREFERENCES.estiloAlgoritmo)
  })

  it('mantém os valores válidos informados', () => {
    const prefs = sanitizePreferences({
      tema: Theme.DARK,
      idioma: Language.EN,
      notificacoes: true,
      estiloAlgoritmo: AlgorithmStyle.CONSERVATIVE,
    })

    expect(prefs).toEqual({
      tema: Theme.DARK,
      idioma: Language.EN,
      notificacoes: true,
      estiloAlgoritmo: AlgorithmStyle.CONSERVATIVE,
    })
  })

  it('lê e persiste o tema no localStorage', () => {
    setStoredTheme(Theme.LIGHT)
    expect(getStoredTheme()).toBe(Theme.LIGHT)

    window.localStorage.store.theme = 'DARK'
    expect(getStoredTheme()).toBe(Theme.DARK)
  })

  it('combina preferências iniciais com o tema armazenado', () => {
    window.localStorage.setItem('theme', 'light')
    expect(getInitialPreferences()).toEqual({
      ...DEFAULT_PREFERENCES,
      tema: Theme.LIGHT,
    })
  })
})
