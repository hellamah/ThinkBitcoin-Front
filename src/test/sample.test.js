/**
 * Testes de sanidade da infraestrutura de testes.
 * Verifica que o ambiente Vitest está corretamente configurado.
 */
import { describe, it, expect, vi } from 'vitest'
import {
  AlgorithmStyle,
  Language,
  Theme,
  RiskProfile,
  ReviewFrequency,
} from '../src/utils/preferences'

describe('infraestrutura › enums são imutáveis (Object.freeze)', () => {
  it('Theme está congelado', () => {
    expect(Object.isFrozen(Theme)).toBe(true)
  })

  it('Language está congelado', () => {
    expect(Object.isFrozen(Language)).toBe(true)
  })

  it('AlgorithmStyle está congelado', () => {
    expect(Object.isFrozen(AlgorithmStyle)).toBe(true)
  })

  it('RiskProfile está congelado', () => {
    expect(Object.isFrozen(RiskProfile)).toBe(true)
  })

  it('ReviewFrequency está congelado', () => {
    expect(Object.isFrozen(ReviewFrequency)).toBe(true)
  })
})

describe('infraestrutura › mock global de fetch está disponível', () => {
  it('fetch é uma função de mock do Vitest', () => {
    expect(vi.isMockFunction(global.fetch)).toBe(true)
  })

  it('mocks são resetados entre os testes (fetch não tem chamadas pendentes)', () => {
    expect(fetch.mock.calls).toHaveLength(0)
  })
})
