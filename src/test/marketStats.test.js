import { describe, expect, it } from 'vitest'
import { calcularDesempenho } from '../src/utils/marketStats'

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
