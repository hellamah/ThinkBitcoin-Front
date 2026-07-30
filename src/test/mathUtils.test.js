/**
 * Testes unitários para utils/mathUtils.
 * 
 * Este conjunto de testes valida a precisão dos cálculos matemáticos e 
 * formatações de exibição do laboratório ThinkBitcoin.
 */
import { describe, expect, it } from 'vitest'
import {
  normalizeToBase100,
  normalizeMinMax,
  normalizeZScore,
  formatCurrency,
  formatPercent,
  mean,
  median,
  stdDev,
} from '../src/utils/mathUtils'

// Utilitário de comparação com tolerância para aritmética de ponto flutuante
const expectClose = (valor, esperado, precisao = 6) =>
  expect(valor).toBeCloseTo(esperado, precisao)

describe('utils/mathUtils › normalizeToBase100 (Normalização Base 100)', () => {
  it('deve retornar o próprio valor para array vazio', () => {
    expect(normalizeToBase100([])).toEqual([])
  })

  it('deve lidar com entradas que não são arrays graciosamente', () => {
    expect(normalizeToBase100(null)).toBeNull()
    expect(normalizeToBase100(undefined)).toBeUndefined()
    expect(normalizeToBase100(42)).toBe(42)
  })

  it('deve manter o array original se todos os valores forem nulos ou zero', () => {
    const entrada = [null, null, 0, null]
    expect(normalizeToBase100(entrada)).toEqual(entrada)
  })

  it('deve normalizar um único elemento para a base 100', () => {
    expect(normalizeToBase100([250])).toEqual([100])
  })

  it('deve normalizar corretamente uma série de ativos com base no primeiro valor', () => {
    const resultado = normalizeToBase100([100, 200, 50])
    expectClose(resultado[0], 100)
    expectClose(resultado[1], 200)
    expectClose(resultado[2], 50)
  })

  it('deve usar o primeiro valor não nulo e não zero como âncora da base', () => {
    const resultado = normalizeToBase100([null, 0, 200, 400])
    expect(resultado[0]).toBeNull()
    expect(resultado[1]).toBe(0) 
    expectClose(resultado[2], 100) // Âncora (200)
    expectClose(resultado[3], 200)
  })

  it('deve preservar lacunas de dados (nulos) no meio da série', () => {
    const resultado = normalizeToBase100([100, null, 150])
    expectClose(resultado[0], 100)
    expect(resultado[1]).toBeNull()
    expectClose(resultado[2], 150)
  })
  
  it('deve lidar com valores extremamente altos (estatística de volume)', () => {
    const grandeVolume = [1e12, 2e12, 0.5e12]
    const resultado = normalizeToBase100(grandeVolume)
    expectClose(resultado[0], 100)
    expectClose(resultado[1], 200)
    expectClose(resultado[2], 50)
  })
})

describe('utils/mathUtils › normalizeMinMax (Escalonamento 0 a 1)', () => {
  it('deve retornar array vazio se a entrada for vazia', () => {
    expect(normalizeMinMax([])).toEqual([])
  })

  it('deve retornar 1 para todos os elementos se o intervalo for zero', () => {
    const resultado = normalizeMinMax([50, 50, 50])
    expect(resultado.every(v => v === 1)).toBe(true)
  })

  it('deve normalizar corretamente valores negativos (osciladores)', () => {
    const resultado = normalizeMinMax([-10, 0, 10])
    expectClose(resultado[0], 0)
    expectClose(resultado[1], 0.5)
    expectClose(resultado[2], 1)
  })

  it('deve garantir que os valores estão sempre no intervalo [0, 1]', () => {
    const serie = [12, 45, 7, 88, null, 100]
    const resultado = normalizeMinMax(serie)
    resultado.forEach(v => {
      if (v !== null) {
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(1)
      }
    })
  })
})

describe('utils/mathUtils › formatCurrency (Formatação Monetária)', () => {
  it('deve formatar valores USD com precisão padrão', () => {
    expect(formatCurrency(1234.56)).toBe('$1,234.56')
  })

  it('deve lidar com zero corretamente', () => {
    expect(formatCurrency(0)).toBe('$0.00')
  })

  it('deve retornar um placeholder de fallback para valores inválidos', () => {
    expect(formatCurrency('erro')).toBe('-')
    expect(formatCurrency(null)).toBe('-')
  })
  
  it('deve lidar com frações de centavos em cripto-ativos pequenos', () => {
    // Nota: formatCurrency usa toLocaleString padrão que pode arredondar para 2 casas
    // Verificando o comportamento atual do sistema
    const valorPequeno = 0.000123
    const formatado = formatCurrency(valorPequeno)
    expect(formatado).toContain('.00') 
  })
})

describe('utils/mathUtils › formatPercent (Formatação Percentual)', () => {
  it('deve aplicar sinal positivo para ganhos', () => {
    expect(formatPercent(5.2)).toBe('+5.20%')
  })

  it('deve manter o sinal negativo para perdas', () => {
    expect(formatPercent(-1.5)).toBe('-1.50%')
  })

  it('deve permitir customização da precisão decimal', () => {
    expect(formatPercent(5.2678, 3)).toBe('+5.268%')
    expect(formatPercent(5, 0)).toBe('+5%')
  })

  it('deve retornar placeholder para entradas não numéricas', () => {
    expect(formatPercent('NaN')).toBe('-')
  })
})

describe('utils/mathUtils › median (Mediana)', () => {
  it('deve retornar o valor central em séries de tamanho ímpar', () => {
    expect(median([5, 1, 3])).toBe(3)
  })

  it('deve retornar a média dos dois centrais em séries de tamanho par', () => {
    expect(median([4, 1, 3, 2])).toBe(2.5)
  })

  it('não deve ser distorcida por um valor atípico, ao contrário da média', () => {
    // A média desta série é 204,4; a mediana ignora o candle fora da curva.
    expect(median([1, 2, 3, 4, 1012])).toBe(3)
  })

  it('deve descartar valores nulos e não numéricos', () => {
    expect(median([1, null, 3, undefined, 'abc', 5])).toBe(3)
  })

  it('não deve alterar o array recebido', () => {
    const original = [3, 1, 2]
    median(original)
    expect(original).toEqual([3, 1, 2])
  })

  it('deve retornar null quando não houver valor válido', () => {
    expect(median([])).toBeNull()
    expect(median([null, 'abc'])).toBeNull()
    expect(median(null)).toBeNull()
  })
})

describe('utils/mathUtils › mean (Média)', () => {
  it('deve calcular a média aritmética', () => {
    expect(mean([2, 4, 6])).toBe(4)
  })

  it('deve descartar valores nulos e não numéricos', () => {
    // A média é sobre 2 e 4; se null virasse zero o resultado cairia para 2.
    expect(mean([2, null, 4, undefined, 'abc', ''])).toBe(3)
  })

  it('deve retornar null quando não houver valor válido', () => {
    expect(mean([])).toBeNull()
    expect(mean([null, 'abc'])).toBeNull()
    expect(mean(null)).toBeNull()
  })
})

describe('utils/mathUtils › stdDev (Desvio Padrão)', () => {
  it('deve calcular o desvio padrão populacional', () => {
    // Média 4; desvios -2, 0, 2 → variância 8/3.
    expectClose(stdDev([2, 4, 6]), Math.sqrt(8 / 3))
  })

  it('deve retornar zero em série constante', () => {
    expect(stdDev([5, 5, 5])).toBe(0)
  })

  it('deve descartar valores nulos e não numéricos', () => {
    expect(stdDev([2, null, 4, 'abc', 6])).toBe(stdDev([2, 4, 6]))
  })

  it('deve retornar null quando não houver valor válido', () => {
    expect(stdDev([])).toBeNull()
    expect(stdDev(null)).toBeNull()
  })
})
