import { describe, expect, it } from 'vitest'
import { quantil, geradorAleatorio } from '../src/utils/mathUtils'

describe('utils/mathUtils › quantil', () => {
  it('deve interpolar entre vizinhos', () => {
    expect(quantil([1, 2, 3, 4], 0.5)).toBeCloseTo(2.5, 10)
    expect(quantil([1, 2, 3, 4], 0)).toBe(1)
    expect(quantil([1, 2, 3, 4], 1)).toBe(4)
  })

  it('deve recusar série vazia e p fora de [0, 1]', () => {
    expect(quantil([], 0.5)).toBeNull()
    expect(quantil([1, 2], 1.5)).toBeNull()
  })
})

describe('utils/mathUtils › gerador aleatório', () => {
  it('deve repetir a sequência para a mesma semente', () => {
    const a = geradorAleatorio(42)
    const b = geradorAleatorio(42)
    const seqA = Array.from({ length: 5 }, a)
    const seqB = Array.from({ length: 5 }, b)
    expect(seqA).toEqual(seqB)
  })

  it('deve variar com a semente e ficar em [0, 1)', () => {
    const a = Array.from({ length: 200 }, geradorAleatorio(1))
    const b = Array.from({ length: 200 }, geradorAleatorio(2))
    expect(a).not.toEqual(b)
    a.forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    })
  })
})
