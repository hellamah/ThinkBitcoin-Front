import { describe, expect, it } from 'vitest'
import { avaliarAnomalia, calcularDesempenho, calcularLimites } from '../src/utils/marketStats'

// A API entrega do mais recente ao mais antigo (ordemAsc=false); os helpers
// abaixo montam nessa mesma ordem para o teste refletir o contrato real.
const serieDecrescente = (fechamentos, variacoes = []) =>
  fechamentos.map((precoFechamento, i) => ({
    precoFechamento,
    precoPercentualVariacao: variacoes[i] ?? 0,
  }))

describe('utils/marketStats › calcularDesempenho', () => {
  it('deve medir o retorno do mais antigo para o mais recente', () => {
    // Cronologicamente: 100 → 110, ou seja +10%.
    const r = calcularDesempenho(serieDecrescente([110, 100]))
    expect(r.retorno).toBeCloseTo(10, 5)
  })

  it('deve registrar retorno negativo quando o período fecha em queda', () => {
    const r = calcularDesempenho(serieDecrescente([80, 100]))
    expect(r.retorno).toBeCloseTo(-20, 5)
  })

  it('deve medir o drawdown a partir do pico, não do início', () => {
    // Cronológico: 100 → 200 → 150. A queda vale a partir de 200, não de 100.
    const r = calcularDesempenho(serieDecrescente([150, 200, 100]))
    expect(r.drawdown).toBeCloseTo(-25, 5)
  })

  it('deve devolver drawdown zero em série sempre crescente', () => {
    expect(calcularDesempenho(serieDecrescente([300, 200, 100])).drawdown).toBe(0)
  })

  it('deve calcular a taxa de alta a partir das variações', () => {
    const r = calcularDesempenho(serieDecrescente([1, 2, 3, 4], [5, -2, 3, -1]))
    expect(r.winRate).toBeCloseTo(50, 5)
  })

  it('deve expor o melhor e o pior candle', () => {
    const r = calcularDesempenho(serieDecrescente([1, 2, 3], [5, -8, 2]))
    expect(r.melhor).toBe(5)
    expect(r.pior).toBe(-8)
  })

  it('deve descartar fechamentos inválidos', () => {
    const r = calcularDesempenho([
      { precoFechamento: 110 },
      { precoFechamento: 0 },
      { precoFechamento: null },
      { precoFechamento: 100 },
    ])
    expect(r.amostras).toBe(2)
    expect(r.retorno).toBeCloseTo(10, 5)
  })

  it('deve retornar null sem dado utilizável', () => {
    expect(calcularDesempenho([])).toBeNull()
    expect(calcularDesempenho(null)).toBeNull()
    expect(calcularDesempenho([{ precoFechamento: null }])).toBeNull()
  })
})

// Nove candles de rotina (variação 1, volume 100) e um destoante. Com esses
// números média = 1,9, desvio = 2,7 e mediana de volume = 100, então o candle
// atípico cai exatamente em 3σ e 5× — bem além dos limites de 2σ e 3×.
const serieComOutlier = () => {
  const registros = Array.from({ length: 9 }, () => ({
    precoPercentualVariacao: 1,
    precoVolume: 100,
  }))
  registros.push({ precoPercentualVariacao: 10, precoVolume: 500 })
  return registros
}

describe('utils/marketStats › calcularLimites', () => {
  it('deve descrever a normalidade do período', () => {
    const limites = calcularLimites(serieComOutlier())
    expect(limites.mediaVariacao).toBeCloseTo(1.9, 10)
    expect(limites.desvioVariacao).toBeCloseTo(2.7, 10)
    expect(limites.medianaVolume).toBe(100)
    expect(limites.amostras).toBe(10)
  })

  it('deve recusar séries curtas demais para descrever normalidade', () => {
    const curta = Array.from({ length: 7 }, () => ({ precoPercentualVariacao: 1 }))
    expect(calcularLimites(curta)).toBeNull()
    expect(calcularLimites([])).toBeNull()
    expect(calcularLimites(null)).toBeNull()
  })

  it('deve devolver null quando nenhuma variação é utilizável', () => {
    const semDado = Array.from({ length: 10 }, () => ({ precoPercentualVariacao: null }))
    expect(calcularLimites(semDado)).toBeNull()
  })
})

describe('utils/marketStats › avaliarAnomalia', () => {
  const limites = calcularLimites(serieComOutlier())

  it('deve marcar o candle que passa de 2σ', () => {
    const r = avaliarAnomalia({ precoPercentualVariacao: 10, precoVolume: 500 }, limites)
    expect(r.variacao).toBe(true)
    expect(r.sigmas).toBeCloseTo(3, 10)
  })

  it('deve marcar o volume acima de 3× a mediana', () => {
    const r = avaliarAnomalia({ precoPercentualVariacao: 1, precoVolume: 500 }, limites)
    expect(r.volume).toBe(true)
    expect(r.razaoVolume).toBeCloseTo(5, 10)
  })

  it('não deve marcar o candle de rotina', () => {
    const r = avaliarAnomalia({ precoPercentualVariacao: 1, precoVolume: 100 }, limites)
    expect(r.variacao).toBe(false)
    expect(r.volume).toBe(false)
  })

  it('deve marcar queda atípica, não só alta', () => {
    // -7 fica a (−7 − 1,9)/2,7 ≈ −3,3σ: atípico para baixo.
    const r = avaliarAnomalia({ precoPercentualVariacao: -7 }, limites)
    expect(r.variacao).toBe(true)
    expect(r.sigmas).toBeLessThan(0)
  })

  it('não deve marcar nada quando o período não oscila', () => {
    const constante = Array.from({ length: 10 }, () => ({
      precoPercentualVariacao: 2,
      precoVolume: 0,
    }))
    const semOscilacao = calcularLimites(constante)
    const r = avaliarAnomalia({ precoPercentualVariacao: 2, precoVolume: 0 }, semOscilacao)
    expect(r.variacao).toBe(false)
    expect(r.volume).toBe(false)
    expect(r.sigmas).toBeNull()
    expect(r.razaoVolume).toBeNull()
  })

  it('deve retornar null sem régua ou sem registro', () => {
    expect(avaliarAnomalia({ precoPercentualVariacao: 10 }, null)).toBeNull()
    expect(avaliarAnomalia(null, limites)).toBeNull()
  })
})
