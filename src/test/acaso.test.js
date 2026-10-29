import { describe, expect, it } from 'vitest'
import { compararComAcaso, sorteDoRanking, limiarPorTentativas } from '../src/utils/acaso'
import { simular } from '../src/utils/backtest'
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

// Sinal sem valor nenhum, em rajadas: cinco martelos seguidos a cada 25
// candles, e o preço nunca se move. Segurando 5 candles, cada rajada vira UMA
// operação — os quatro martelos seguintes chegam com a posição aberta.
//
// É o formato dos sinais de verdade: RSI em sobrecompra, rompimento de banda e
// divergência disparam em candles consecutivos enquanto a condição dura.
const RAJADAS = 10
const sinalEmRajadas = () =>
  serie(
    Array.from({ length: RAJADAS * 25 }, (_, i) =>
      i % 25 >= 5 && i % 25 < 10 ? { ...parado(100), martelo: true } : parado(100)
    )
  )
const OPCOES_RAJADAS = { sinalEntrada: CandlePattern.MARTELO, saidaPorTempo: 5, custoPercentual: 0.1 }

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

  it('deve comparar o sinal com sorteios que operam o mesmo tanto que ele', () => {
    const r = compararComAcaso(sinalEmRajadas(), OPCOES_RAJADAS)
    expect(r.entradas).toBe(RAJADAS * 5)
    expect(r.operacoesReais).toBe(RAJADAS)
    // Cinquenta entradas espalhadas ao acaso viram umas trinta operações, e
    // pagam o triplo de custo. A rotação mantém as rajadas: dez operações.
    expect(Math.abs(r.operacoesMedianas - r.operacoesReais)).toBeLessThanOrEqual(1)
  })

  it('não deve pôr acima do acaso um sinal que só opera menos', () => {
    // O preço não se move: o único resultado possível é o custo. Contra
    // sorteios que operam três vezes mais, este sinal "superava" todos eles.
    const r = compararComAcaso(sinalEmRajadas(), OPCOES_RAJADAS)
    expect(r.percentil).toBeLessThan(90)
  })

  it('não deve usar deslocamentos que quase repetem o sinal', () => {
    // Um martelo só, seguido de três candles de alta de 5%. Deslocado em um ou
    // dois candles, o sinal ainda é o sinal: entra no meio da mesma alta e colhe
    // os mesmos 5%. Se esses deslocamentos entrassem na régua, empatariam com o
    // sinal e o tirariam do topo — a régua seria feita de cópias dele.
    let preco = 100
    const defs = Array.from({ length: 200 }, (_, i) => {
      if (i === 100) return { ...parado(preco), martelo: true }
      if (i >= 101 && i <= 103) {
        const abertura = preco
        preco *= 1.05
        return { abertura, maior: preco, menor: abertura, fechamento: preco }
      }
      return parado(preco)
    })
    const r = compararComAcaso(serie(defs), OPCOES)
    expect(r.retornoReal).toBeCloseTo(5, 6)
    expect(r.percentil).toBe(100)
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

  it('não deve marcar como acima da sorte um sinal que só opera menos', () => {
    const { sinalEntrada: _s, ...comuns } = OPCOES_RAJADAS
    const alfaReal = simular(sinalEmRajadas(), OPCOES_RAJADAS).metricas.alfa
    const r = sorteDoRanking(sinalEmRajadas(), comuns, [CandlePattern.MARTELO], { iteracoes: 60 })
    // O ▲ do ranking é "alfa acima do p95 da sorte". Com sorteios que pagam o
    // triplo de custo, o p95 ficava abaixo do sinal e a marca aparecia.
    expect(r.p95).toBeGreaterThanOrEqual(alfaReal)
  })
})

describe('utils/acaso › limiar por tentativas', () => {
  it('deve começar no percentil 95 e subir com a correção de Bonferroni', () => {
    expect(limiarPorTentativas(1)).toBeCloseTo(95, 10)
    expect(limiarPorTentativas(10)).toBeCloseTo(99.5, 10)
    expect(limiarPorTentativas(0)).toBeCloseTo(95, 10)
  })
})
