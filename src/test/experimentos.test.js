import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  lerTentativas,
  registrarTentativa,
  zerarTentativas,
  lerDiario,
  guardarNoDiario,
  removerDoDiario,
  MAX_DIARIO,
} from '../src/utils/experimentos'

// Ambiente Node: sem window. O acesso ao storage passa pelo getStorage do
// preferences.js, que procura `window.localStorage`.
const criarStorage = () => {
  const dados = new Map()
  return {
    getItem: (k) => (dados.has(k) ? dados.get(k) : null),
    setItem: (k, v) => dados.set(k, String(v)),
    removeItem: (k) => dados.delete(k),
  }
}

const windowOriginal = globalThis.window

beforeEach(() => {
  globalThis.window = { localStorage: criarStorage() }
})

afterEach(() => {
  if (windowOriginal === undefined) delete globalThis.window
  else globalThis.window = windowOriginal
})

describe('utils/experimentos › tentativas', () => {
  it('deve contar cada configuração uma vez só', () => {
    registrarTentativa('BTC', 'a')
    registrarTentativa('BTC', 'b')
    registrarTentativa('BTC', 'a')
    expect(lerTentativas('BTC')).toEqual(['a', 'b'])
  })

  it('deve separar por moeda', () => {
    registrarTentativa('BTC', 'a')
    expect(lerTentativas('ETH')).toEqual([])
  })

  it('deve zerar', () => {
    registrarTentativa('BTC', 'a')
    zerarTentativas('BTC')
    expect(lerTentativas('BTC')).toEqual([])
  })

  it('não deve quebrar com o storage bloqueado', () => {
    globalThis.window = {
      localStorage: {
        getItem: () => { throw new Error('bloqueado') },
        setItem: () => { throw new Error('bloqueado') },
        removeItem: () => { throw new Error('bloqueado') },
      },
    }
    expect(() => registrarTentativa('BTC', 'a')).not.toThrow()
    expect(lerTentativas('BTC')).toEqual([])
  })
})

describe('utils/experimentos › diário', () => {
  const entrada = (impressao, retorno = 1) => ({
    impressao,
    parametros: { sinalEntrada: 'martelo' },
    resumo: { retornoTotal: retorno },
  })

  it('deve guardar e ler de volta', () => {
    guardarNoDiario('BTC', entrada('a'))
    const lista = lerDiario('BTC')
    expect(lista).toHaveLength(1)
    expect(lista[0].impressao).toBe('a')
  })

  it('deve substituir a mesma configuração em vez de duplicar', () => {
    guardarNoDiario('BTC', entrada('a', 1))
    const { lista } = guardarNoDiario('BTC', entrada('a', 2))
    expect(lista).toHaveLength(1)
    expect(lista[0].resumo.retornoTotal).toBe(2)
  })

  it('deve recusar configuração nova com o diário cheio', () => {
    for (let i = 0; i < MAX_DIARIO; i++) guardarNoDiario('BTC', entrada(`c${i}`))
    const r = guardarNoDiario('BTC', entrada('nova'))
    expect(r.cheio).toBe(true)
    expect(r.lista).toHaveLength(MAX_DIARIO)
  })

  it('deve remover pelo id', () => {
    const { lista } = guardarNoDiario('BTC', entrada('a'))
    expect(removerDoDiario('BTC', lista[0].id)).toEqual([])
  })

  it('deve descartar entradas malformadas que estejam no storage', () => {
    window.localStorage.setItem('tb_sim_diario_BTC', JSON.stringify([{ id: 1 }, null, 'x']))
    expect(lerDiario('BTC')).toEqual([])
  })
})
