import { describe, expect, it } from 'vitest'
import { compararComAcaso, sorteDoRanking, limiarPorTentativas } from '../src/utils/acaso'
import { CandlePattern } from '../src/utils/candlePatterns'
import { serie, parado } from './fixtures/candlesSimulacao'

// Série em que o martelo é um sinal perfeito: todo martelo é seguido de um
// candle que sobe 10%, e fora deles o preço não se move. Entradas sorteadas só
// ganham quando, por acaso, caem num martelo.
const sinalPerfeito = () => {
  const defs = []
  for (let i = 0; i < 200; i++) {
    if (i % 20 === 5) defs.push({ ...parado(100), martelo: true })
    else if (i % 20 === 6) defs.push({ abertura: 100, maior: 110, menor: 100, fechamento: 110 })
    else defs.push(parado(100))
  }
  return serie(defs)
}

const OPCOES = { sinalEntrada: CandlePattern.MARTELO, saidaPorTempo: 1, custoPercentual: 0 }

describe('utils/acaso › régua aleatória', () => {
  it('deve pôr um sinal perfeito acima de quase todos os sorteios', () => {
    const r = compararComAcaso(sinalPerfeito(), OPCOES)
    expect(r.entradas).toBe(10)
    expect(r.percentil).toBeGreaterThan(95)
    expect(r.retornoReal).toBeGreaterThan(r.p95)
  })

  it('deve dar o mesmo resultado para a mesma semente', () => {
    const a = compararComAcaso(sinalPerfeito(), OPCOES, { iteracoes: 50, semente: 7 })
    const b = compararComAcaso(sinalPerfeito(), OPCOES, { iteracoes: 50, semente: 7 })
    expect(a).toEqual(b)
  })

  it('deve cair no meio quando o sinal está em toda candidata', () => {
    // Todo sorteio escolhe exatamente os mesmos candles do sinal: empate total,
    // que conta pela metade.
    const registros = serie(Array.from({ length: 30 }, () => ({ ...parado(100), martelo: true })))
    const r = compararComAcaso(registros, OPCOES, { iteracoes: 20 })
    expect(r.percentil).toBe(50)
  })

  it('deve devolver null quando o sinal não aparece', () => {
    const registros = serie(Array.from({ length: 30 }, () => parado(100)))
    expect(compararComAcaso(registros, OPCOES)).toBeNull()
  })
})

describe('utils/acaso › sorte esperada do ranking', () => {
  it('deve medir o máximo só entre os sinais que aparecem no trecho', () => {
    const r = sorteDoRanking(
      sinalPerfeito(),
      { saidaPorTempo: 1, custoPercentual: 0 },
      [CandlePattern.MARTELO, CandlePattern.ESTRELA],
      { iteracoes: 40 }
    )
    expect(r.sinais).toBe(1)
    expect(r.mediana).toBeLessThanOrEqual(r.p95)
  })
})

describe('utils/acaso › limiar por tentativas', () => {
  it('deve começar no percentil 95 e subir com a correção de Bonferroni', () => {
    expect(limiarPorTentativas(1)).toBeCloseTo(95, 10)
    expect(limiarPorTentativas(10)).toBeCloseTo(99.5, 10)
    expect(limiarPorTentativas(0)).toBeCloseTo(95, 10)
  })
})
