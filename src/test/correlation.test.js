import { describe, expect, it } from 'vitest'
import {
  corDaCorrelacao,
  correlacaoComPares,
  limiarDeSignificancia,
  matrizCorrelacao,
  pearson,
} from '../src/utils/correlation'

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
    // A diagonal ancora a grade e não repousa sobre amostra nenhuma, então
    // não tem número de pares nem precisa de teste de significância.
    matriz.forEach((linha, i) => expect(linha[i]).toEqual({ r: 1, pares: null, significante: true }))
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
    expect(matriz[0][1].r).toBeCloseTo(1, 10)
    expect(matriz[0][2].r).toBeCloseTo(-1, 10)
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

describe('utils/correlation › limiarDeSignificancia', () => {
  // O coeficiente sozinho não diz se a relação existe: r = 0,10 sobre 168
  // pontos e r = 0,10 sobre 8 querem dizer coisas diferentes, e a matriz
  // pintava os dois do mesmo verde.

  it('deve exigir menos de amostra grande e mais de amostra pequena', () => {
    expect(limiarDeSignificancia(168)).toBeLessThan(limiarDeSignificancia(30))
    expect(limiarDeSignificancia(30)).toBeLessThan(limiarDeSignificancia(10))
  })

  it('deve concordar com o teste t nas faixas que a tela usa', () => {
    // Valores de referência do teste t bicaudal a 95%: |r| crítico ~0,151 com
    // n = 168 e ~0,878 com n = 5. A transformação de Fisher chega aos mesmos
    // números — é a razão de ela servir aqui no lugar de uma tabela invertida.
    expect(limiarDeSignificancia(168)).toBeCloseTo(0.151, 2)
    expect(limiarDeSignificancia(5)).toBeCloseTo(0.878, 2)
  })

  it('não deve deixar nada passar sem amostra que sustente', () => {
    // Devolver 1 é dizer "nem uma correlação perfeita se distingue aqui".
    expect(limiarDeSignificancia(3)).toBe(1)
    expect(limiarDeSignificancia(0)).toBe(1)
    expect(limiarDeSignificancia(null)).toBe(1)
  })
})

describe('utils/correlation › correlacaoComPares', () => {
  it('deve informar quantos pontos sustentaram o coeficiente', () => {
    // O descarte é par a par: o que conta é a interseção, não o comprimento.
    const r = correlacaoComPares([1, 2, 3, 4, 5, 6], [2, 4, null, 8, 10, 12])
    expect(r.pares).toBe(5)
    expect(r.r).toBeCloseTo(1, 10)
  })

  it('deve recusar amostra abaixo do mínimo', () => {
    expect(correlacaoComPares([1, 2, 3, 4], [2, 4, 6, 8])).toBeNull()
  })
})

describe('utils/correlation › significância na matriz', () => {
  // Um par com relação forte e outro com relação praticamente nula, ambos
  // sobre a mesma quantidade de pontos: o que os separa é o coeficiente, e a
  // matriz precisa dizer qual dos dois sustenta leitura.
  const alternado = (n, f) => Array.from({ length: n }, (_, i) => f(i))

  const series = [
    { sigla: 'A', valores: alternado(40, (i) => (i % 2 ? 1 : -1)) },
    // Copia exata de A: correlação 1.
    { sigla: 'B', valores: alternado(40, (i) => (i % 2 ? 1 : -1)) },
    // Período 4 contra período 2: ortogonal, r em torno de zero.
    { sigla: 'C', valores: alternado(40, (i) => (i % 4 < 2 ? 1 : -1)) },
  ]

  it('deve marcar como significante o par que a amostra sustenta', () => {
    const { matriz } = matrizCorrelacao(series)
    expect(matriz[0][1].r).toBeCloseTo(1, 10)
    expect(matriz[0][1].significante).toBe(true)
  })

  it('deve marcar como não significante o coeficiente indistinguível de zero', () => {
    const { matriz } = matrizCorrelacao(series)
    expect(Math.abs(matriz[0][2].r)).toBeLessThan(limiarDeSignificancia(40))
    expect(matriz[0][2].significante).toBe(false)
  })

  it('deve carregar o número de pares em cada célula', () => {
    const { matriz } = matrizCorrelacao(series)
    expect(matriz[0][1].pares).toBe(40)
    expect(matriz[0][2].pares).toBe(40)
  })

  it('deve dar veredictos opostos para o MESMO coeficiente conforme a amostra', () => {
    // É o ponto todo. Um r de 0,30 sobre seis pontos não se distingue de zero;
    // sobre duzentos, se distingue com folga. A tela pintava os dois do mesmo
    // verde, com a mesma opacidade, porque só olhava o coeficiente.
    const r = 0.3
    expect(r > limiarDeSignificancia(6)).toBe(false)
    expect(r > limiarDeSignificancia(200)).toBe(true)
  })
})
