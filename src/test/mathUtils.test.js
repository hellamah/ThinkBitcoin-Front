/**
 * Testes unitários para utils/mathUtils.
 *
 * Cobre:
 * - normalizeToBase100: normalização relativa ao primeiro valor válido
 * - normalizeMinMax: normalização entre 0 e 1
 * - normalizeZScore: normalização por desvios padrão da média
 *
 * Todos os casos testam: entrada vazia, valores nulos/undefined,
 * arrays de um único elemento, range zero e casos nominais.
 */
import { describe, expect, it } from 'vitest'
import {
  normalizeToBase100,
  normalizeMinMax,
  normalizeZScore,
} from '../src/utils/mathUtils'

// Utilitário de comparação com tolerância para aritmética de ponto flutuante
const expectClose = (valor, esperado, precisao = 6) =>
  expect(valor).toBeCloseTo(esperado, precisao)

describe('utils/mathUtils › normalizeToBase100', () => {
  it('retorna o próprio valor para array vazio', () => {
    expect(normalizeToBase100([])).toEqual([])
  })

  it('retorna o próprio valor para entrada que não é array', () => {
    expect(normalizeToBase100(null)).toBeNull()
    expect(normalizeToBase100(undefined)).toBeUndefined()
    expect(normalizeToBase100(42)).toBe(42)
  })

  it('retorna o próprio array quando todos os valores são nulos ou zero', () => {
    const entrada = [null, null, 0, null]
    expect(normalizeToBase100(entrada)).toEqual(entrada)
  })

  it('normaliza um único elemento para 100', () => {
    expect(normalizeToBase100([250])).toEqual([100])
  })

  it('normaliza corretamente uma série simples relativa ao primeiro valor', () => {
    const resultado = normalizeToBase100([100, 200, 50])
    expectClose(resultado[0], 100)
    expectClose(resultado[1], 200)
    expectClose(resultado[2], 50)
  })

  it('usa o primeiro valor válido (não nulo e não zero) como base', () => {
    const resultado = normalizeToBase100([null, 0, 200, 400])
    expect(resultado[0]).toBeNull()
    expect(resultado[1]).toBe(0) // zero mantém proporção: 0/200*100 = 0
    expectClose(resultado[2], 100) // base = 200
    expectClose(resultado[3], 200)
  })

  it('preserva os nulos no meio da série', () => {
    const resultado = normalizeToBase100([100, null, 150])
    expectClose(resultado[0], 100)
    expect(resultado[1]).toBeNull()
    expectClose(resultado[2], 150)
  })

  it('normaliza corretamente valores de BTC', () => {
    const precos = [60000, 65000, 70000, null, 63000]
    const resultado = normalizeToBase100(precos)
    expectClose(resultado[0], 100)
    expectClose(resultado[1], (65000 / 60000) * 100)
    expectClose(resultado[2], (70000 / 60000) * 100)
    expect(resultado[3]).toBeNull()
    expectClose(resultado[4], (63000 / 60000) * 100)
  })
})

describe('utils/mathUtils › normalizeMinMax', () => {
  it('retorna o próprio valor para array vazio', () => {
    expect(normalizeMinMax([])).toEqual([])
  })

  it('retorna o próprio valor para entrada que não é array', () => {
    expect(normalizeMinMax(null)).toBeNull()
    expect(normalizeMinMax(undefined)).toBeUndefined()
  })

  it('retorna o próprio array quando não há valores válidos (todos nulos)', () => {
    const entrada = [null, null]
    expect(normalizeMinMax(entrada)).toEqual(entrada)
  })

  it('retorna 1 para todos os elementos quando o range é zero (todos valores iguais)', () => {
    const resultado = normalizeMinMax([50, 50, 50])
    expect(resultado.every(v => v === 1)).toBe(true)
  })

  it('normaliza um único valor não nulo para 1 (range zero)', () => {
    expect(normalizeMinMax([42])).toEqual([1])
  })

  it('normaliza série simples entre 0 e 1', () => {
    const resultado = normalizeMinMax([0, 50, 100])
    expectClose(resultado[0], 0)
    expectClose(resultado[1], 0.5)
    expectClose(resultado[2], 1)
  })

  it('normaliza série com valores negativos corretamente', () => {
    const resultado = normalizeMinMax([-10, 0, 10])
    expectClose(resultado[0], 0)
    expectClose(resultado[1], 0.5)
    expectClose(resultado[2], 1)
  })

  it('preserva os nulos e normaliza os demais', () => {
    const resultado = normalizeMinMax([0, null, 100])
    expectClose(resultado[0], 0)
    expect(resultado[1]).toBeNull()
    expectClose(resultado[2], 1)
  })

  it('garante que todo resultado está entre 0 e 1', () => {
    const serie = [12, 45, 7, 88, 33, null, 60, 5, 100]
    const resultado = normalizeMinMax(serie)
    resultado.forEach(v => {
      if (v !== null) {
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(1)
      }
    })
  })
})

describe('utils/mathUtils › normalizeZScore', () => {
  it('retorna o próprio valor para array vazio', () => {
    expect(normalizeZScore([])).toEqual([])
  })

  it('retorna o próprio valor para entrada que não é array', () => {
    expect(normalizeZScore(null)).toBeNull()
    expect(normalizeZScore(undefined)).toBeUndefined()
  })

  it('retorna o próprio array quando não há valores válidos (todos nulos)', () => {
    const entrada = [null, null]
    expect(normalizeZScore(entrada)).toEqual(entrada)
  })

  it('retorna 0 para todos os elementos quando o desvio padrão é zero (valores idênticos)', () => {
    const resultado = normalizeZScore([10, 10, 10])
    expect(resultado.every(v => v === 0)).toBe(true)
  })

  it('normaliza um único valor para 0 (desvio padrão = 0)', () => {
    expect(normalizeZScore([99])).toEqual([0])
  })

  it('normaliza série simples com média zero e desvio 1', () => {
    // Para [-1, 0, 1], mean=0, variance=2/3, stdDev≈0.816
    const resultado = normalizeZScore([-1, 0, 1])
    expectClose(resultado[1], 0, 5) // elemento da média deve ser próximo de 0
    expect(resultado[0]).toBeLessThan(0) // abaixo da média → Z negativo
    expect(resultado[2]).toBeGreaterThan(0) // acima da média → Z positivo
  })

  it('o valor da média retorna Z-score próximo a 0', () => {
    const serie = [10, 20, 30, 40, 50]
    const media = 30
    const resultado = normalizeZScore(serie)
    const indiceMedia = serie.indexOf(media)
    expectClose(resultado[indiceMedia], 0, 5)
  })

  it('preserva os nulos e normaliza os demais', () => {
    const resultado = normalizeZScore([10, null, 20, 30])
    expect(resultado[1]).toBeNull()
    expect(typeof resultado[0]).toBe('number')
    expect(typeof resultado[2]).toBe('number')
    expect(typeof resultado[3]).toBe('number')
  })

  it('a soma dos Z-scores de uma série sem nulos deve ser próxima de zero', () => {
    const serie = [5, 15, 25, 35, 45, 55]
    const resultado = normalizeZScore(serie)
    const soma = resultado.reduce((acc, v) => acc + v, 0)
    expectClose(soma, 0, 4)
  })
})
