/**
 * Testes unitários para utils/cache.
 *
 * Valida o comportamento do mecanismo de cache local (localStorage + TTL)
 * utilizado pelo ThinkBitcoin para reduzir chamadas redundantes à API.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  setCache,
  getCache,
  hasCacheValid,
  clearCache,
  clearCacheByPrefix,
  clearAllCache,
} from '../src/utils/cache'

// ---------------------------------------------------------------------------
// Configuração: substitui localStorage por mock em memória
// ---------------------------------------------------------------------------
const createLocalStorageMock = () => {
  let store = {}
  return {
    getItem: vi.fn((key) => store[key] ?? null),
    setItem: vi.fn((key, value) => { store[key] = String(value) }),
    removeItem: vi.fn((key) => { delete store[key] }),
    clear: vi.fn(() => { store = {} }),
    get length() { return Object.keys(store).length },
    keys: () => Object.keys(store),
  }
}

let localStorageMock

beforeEach(() => {
  localStorageMock = createLocalStorageMock()
  // Sobrepõe Object.keys para que funcione com o mock
  vi.stubGlobal('localStorage', {
    ...localStorageMock,
    // Necessário para clearAllCache / clearCacheByPrefix que chamam Object.keys(localStorage)
    [Symbol.iterator]: undefined,
  })
  Object.defineProperty(globalThis.localStorage, 'keys', {
    value: () => Object.keys(localStorageMock.keys()),
    configurable: true,
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

// ---------------------------------------------------------------------------
// Helper: obtém o store interno do mock via getItem
// ---------------------------------------------------------------------------
const TB_PREFIX = 'tb_cache_'

describe('utils/cache › setCache / getCache', () => {
  it('deve salvar e recuperar um valor simples dentro do TTL', () => {
    setCache('teste_chave', { info: 42 })
    const resultado = getCache('teste_chave')
    expect(resultado).toEqual({ info: 42 })
  })

  it('deve retornar null para chave inexistente', () => {
    expect(getCache('chave_inexistente')).toBeNull()
  })

  it('deve retornar null e remover a entrada quando o TTL expirar', () => {
    vi.useFakeTimers()
    setCache('expirada', 'valor', 1000) // TTL de 1 segundo

    vi.advanceTimersByTime(1001) // avança além do TTL

    const resultado = getCache('expirada')
    expect(resultado).toBeNull()
    expect(localStorageMock.removeItem).toHaveBeenCalledWith(`${TB_PREFIX}expirada`)
  })

  it('deve aceitar qualquer tipo serializável em JSON', () => {
    setCache('numero', 99)
    setCache('array', [1, 2, 3])
    setCache('booleano', true)
    setCache('nulo', null)

    expect(getCache('numero')).toBe(99)
    expect(getCache('array')).toEqual([1, 2, 3])
    expect(getCache('booleano')).toBe(true)
    expect(getCache('nulo')).toBeNull() // null é serializado mas null também é o valor de "não encontrado"
  })

  it('deve usar o prefixo tb_cache_ ao persistir no localStorage', () => {
    setCache('minha_chave', 'valor')
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      `${TB_PREFIX}minha_chave`,
      expect.any(String)
    )
  })
})

describe('utils/cache › hasCacheValid', () => {
  it('deve retornar true quando a entrada existir e estiver dentro do TTL', () => {
    setCache('valida', { ok: true })
    expect(hasCacheValid('valida')).toBe(true)
  })

  it('deve retornar false para chave inexistente', () => {
    expect(hasCacheValid('nao_existe')).toBe(false)
  })

  it('deve retornar false quando o TTL expirar', () => {
    vi.useFakeTimers()
    setCache('expirada_valid', 'x', 500)
    vi.advanceTimersByTime(501)
    expect(hasCacheValid('expirada_valid')).toBe(false)
  })

  it('deve retornar false sem fazer throw quando localStorage lançar exceção', () => {
    localStorageMock.getItem.mockImplementationOnce(() => { throw new Error('Bloqueado') })
    expect(() => hasCacheValid('qualquer')).not.toThrow()
    expect(hasCacheValid('qualquer')).toBe(false)
  })
})

describe('utils/cache › clearCache', () => {
  it('deve remover a entrada correta do localStorage', () => {
    setCache('para_remover', 'x')
    clearCache('para_remover')
    expect(getCache('para_remover')).toBeNull()
  })

  it('não deve lançar erro ao tentar remover chave inexistente', () => {
    expect(() => clearCache('nao_existe')).not.toThrow()
  })
})

describe('utils/cache › clearCacheByPrefix', () => {
  it('deve remover todas as entradas que começam com o prefixo informado', () => {
    // Simula entradas diretas no mock de localStorage (com prefixo completo)
    localStorageMock.setItem(`${TB_PREFIX}heatmap_BTC_24h`, JSON.stringify({ dados: 1, expira: Date.now() + 99999 }))
    localStorageMock.setItem(`${TB_PREFIX}heatmap_BTC_7d`, JSON.stringify({ dados: 2, expira: Date.now() + 99999 }))
    localStorageMock.setItem(`${TB_PREFIX}heatmap_ETH_24h`, JSON.stringify({ dados: 3, expira: Date.now() + 99999 }))
    localStorageMock.setItem(`${TB_PREFIX}outra_chave`, JSON.stringify({ dados: 4, expira: Date.now() + 99999 }))

    // Sobrepõe Object.keys para o mock retornar as chaves inseridas
    vi.spyOn(Object, 'keys').mockImplementation((obj) => {
      if (obj === globalThis.localStorage) {
        return [
          `${TB_PREFIX}heatmap_BTC_24h`,
          `${TB_PREFIX}heatmap_BTC_7d`,
          `${TB_PREFIX}heatmap_ETH_24h`,
          `${TB_PREFIX}outra_chave`,
        ]
      }
      return Object.getOwnPropertyNames(obj)
    })

    clearCacheByPrefix('heatmap_BTC')

    expect(localStorageMock.removeItem).toHaveBeenCalledWith(`${TB_PREFIX}heatmap_BTC_24h`)
    expect(localStorageMock.removeItem).toHaveBeenCalledWith(`${TB_PREFIX}heatmap_BTC_7d`)
    expect(localStorageMock.removeItem).not.toHaveBeenCalledWith(`${TB_PREFIX}heatmap_ETH_24h`)
    expect(localStorageMock.removeItem).not.toHaveBeenCalledWith(`${TB_PREFIX}outra_chave`)

    vi.restoreAllMocks()
  })
})

describe('utils/cache › clearAllCache', () => {
  it('deve remover apenas as entradas prefixadas com tb_cache_', () => {
    localStorageMock.setItem(`${TB_PREFIX}a`, '{}')
    localStorageMock.setItem(`${TB_PREFIX}b`, '{}')
    localStorageMock.setItem('outro_dado', '{}')

    vi.spyOn(Object, 'keys').mockImplementation((obj) => {
      if (obj === globalThis.localStorage) {
        return [`${TB_PREFIX}a`, `${TB_PREFIX}b`, 'outro_dado']
      }
      return Object.getOwnPropertyNames(obj)
    })

    clearAllCache()

    expect(localStorageMock.removeItem).toHaveBeenCalledWith(`${TB_PREFIX}a`)
    expect(localStorageMock.removeItem).toHaveBeenCalledWith(`${TB_PREFIX}b`)
    expect(localStorageMock.removeItem).not.toHaveBeenCalledWith('outro_dado')

    vi.restoreAllMocks()
  })
})

describe('utils/cache › tolerância a falhas de localStorage', () => {
  it('setCache não deve lançar exceção quando localStorage estiver indisponível', () => {
    localStorageMock.setItem.mockImplementation(() => { throw new DOMException('QuotaExceededError') })
    expect(() => setCache('fail', 'x')).not.toThrow()
  })

  it('getCache não deve lançar exceção quando localStorage retornar JSON inválido', () => {
    localStorageMock.getItem.mockReturnValueOnce('JSON_INVALIDO{{{')
    expect(() => getCache('corrompida')).not.toThrow()
    expect(getCache('corrompida')).toBeNull()
  })
})
