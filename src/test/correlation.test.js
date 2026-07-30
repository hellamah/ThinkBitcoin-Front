import { describe, expect, it } from 'vitest'
import { corDaCorrelacao, matrizCorrelacao, pearson } from '../src/utils/correlation'

describe('utils/correlation › pearson', () => {
  it('deve devolver 1 para séries que sobem na mesma proporção', () => {
    expect(pearson([1, 2, 3, 4, 5], [2, 4, 6, 8, 10])).toBeCloseTo(1, 10)
  })

  it('deve devolver -1 para séries que se movem em oposição', () => {
    expect(pearson([1, 2, 3, 4, 5], [10, 8, 6, 4, 2])).toBeCloseTo(-1, 10)
  })

  it('deve ficar perto de zero em séries sem relação', () => {
    // Simétrica em torno da média: o co-movimento se cancela.
    const r = pearson([1, 2, 3, 4, 5, 6], [1, -1, 1, -1, 1, -1])
    expect(Math.abs(r)).toBeLessThan(0.5)
  })

  it('deve descartar apenas o par incompleto, não a série inteira', () => {
    // Os cinco primeiros pares são perfeitamente correlacionados; o sexto tem
    // um buraco e some sem contaminar o resultado.
    expect(pearson([1, 2, 3, 4, 5, null], [2, 4, 6, 8, 10, 999])).toBeCloseTo(1, 10)
  })

  it('deve exigir um mínimo de pares para não reportar ruído', () => {
    expect(pearson([1, 2, 3, 4], [2, 4, 6, 8])).toBeNull()
  })

  it('deve devolver null quando uma das séries é constante', () => {
    // Sem variância a correlação é indefinida; zero sugeriria independência.
    expect(pearson([1, 1, 1, 1, 1], [1, 2, 3, 4, 5])).toBeNull()
  })

  it('deve manter o coeficiente dentro de [-1, 1]', () => {
    const r = pearson([0.1, 0.2, 0.3, 0.4, 0.5], [0.1, 0.2, 0.3, 0.4, 0.5])
    expect(r).toBeLessThanOrEqual(1)
    expect(r).toBeGreaterThanOrEqual(-1)
  })

  it('deve tolerar entradas inválidas', () => {
    expect(pearson(null, [1, 2, 3])).toBeNull()
    expect(pearson([1, 2, 3], undefined)).toBeNull()
    expect(pearson([], [])).toBeNull()
  })
})

describe('utils/correlation › matrizCorrelacao', () => {
  const series = [
    { sigla: 'BTC', valores: [1, 2, 3, 4, 5] },
    { sigla: 'ETH', valores: [2, 4, 6, 8, 10] },
    { sigla: 'DOGE', valores: [10, 8, 6, 4, 2] },
  ]

  it('deve manter 1 na diagonal', () => {
    const { matriz } = matrizCorrelacao(series)
    matriz.forEach((linha, i) => expect(linha[i]).toBe(1))
  })

  it('deve ser simétrica', () => {
    const { matriz } = matrizCorrelacao(series)
    for (let i = 0; i < matriz.length; i++) {
      for (let j = 0; j < matriz.length; j++) {
        expect(matriz[i][j]).toBe(matriz[j][i])
      }
    }
  })

  it('deve refletir a relação entre os pares', () => {
    const { siglas, matriz } = matrizCorrelacao(series)
    expect(siglas).toEqual(['BTC', 'ETH', 'DOGE'])
    expect(matriz[0][1]).toBeCloseTo(1, 10)
    expect(matriz[0][2]).toBeCloseTo(-1, 10)
  })

  it('deve devolver null sem par para comparar', () => {
    expect(matrizCorrelacao([series[0]])).toBeNull()
    expect(matrizCorrelacao([])).toBeNull()
    expect(matrizCorrelacao(null)).toBeNull()
  })
})

describe('utils/correlation › corDaCorrelacao', () => {
  it('deve usar verde para correlação positiva e vermelho para negativa', () => {
    expect(corDaCorrelacao(1)).toContain('76, 175, 80')
    expect(corDaCorrelacao(-1)).toContain('244, 67, 54')
  })

  it('deve escalar a opacidade com a intensidade', () => {
    const forte = Number(corDaCorrelacao(1).match(/([\d.]+)\)$/)[1])
    const fraca = Number(corDaCorrelacao(0.2).match(/([\d.]+)\)$/)[1])
    expect(forte).toBeGreaterThan(fraca)
  })

  it('deve ser transparente sem coeficiente', () => {
    expect(corDaCorrelacao(null)).toBe('transparent')
  })
})
