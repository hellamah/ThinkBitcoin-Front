import { describe, expect, it } from 'vitest'
import {
  caminharParaFrente,
  periodosDaCaminhada,
} from '../src/utils/escolhaPeloPassado'
import { CandlePattern } from '../src/utils/candlePatterns'
import { serie, parado, HORA_MS } from './fixtures/candlesSimulacao'

// Treino de 2 dias e teste de 1, sobre candles horários: a mesma mecânica dos
// 90 e 30 dias da tela, numa série que cabe num teste.
const JANELAS = { diasTreino: 2, diasTeste: 1 }
const SINAIS = [CandlePattern.MARTELO, CandlePattern.ESTRELA]
const REGRA = { saidaPorTempo: 1, custoPercentual: 0 }

// Martelo a cada 6 candles, seguido de uma alta de 2% que devolve no candle
// seguinte: quem entra depois do martelo ganha, e o buy & hold fica parado.
// Estrela a cada 24, seguida de candle parado: não ganha nada, e opera menos.
// O escolhido pelo alfa é o martelo; o controle (menos operações), a estrela.
const serieDeDias = (dias, { marteloPerde = () => false } = {}) =>
  serie(
    Array.from({ length: dias * 24 }, (_, i) => {
      const perde = marteloPerde(i)
      if (i % 6 === 0) return { ...parado(100), martelo: true }
      if (i % 6 === 1) return perde
        ? { abertura: 100, maior: 100, menor: 90, fechamento: 90 }
        : { abertura: 100, maior: 102, menor: 100, fechamento: 102 }
      if (i % 6 === 2) return perde
        ? { abertura: 90, maior: 100, menor: 90, fechamento: 100 }
        : { abertura: 102, maior: 102, menor: 100, fechamento: 100 }
      if (i % 24 === 4) return { ...parado(100), estrela: true }
      return parado(100)
    })
  )

describe('utils/escolhaPeloPassado › períodos', () => {
  it('deve encadear testes que não se sobrepõem, cada um depois do seu treino', () => {
    const DIA = 24 * HORA_MS
    const p = periodosDaCaminhada(0, 6 * DIA, JANELAS)
    expect(p).toEqual([
      { treino: 0, teste: 2 * DIA, fim: 3 * DIA },
      { treino: DIA, teste: 3 * DIA, fim: 4 * DIA },
      { treino: 2 * DIA, teste: 4 * DIA, fim: 5 * DIA },
      { treino: 3 * DIA, teste: 5 * DIA, fim: 6 * DIA },
    ])
  })
})

describe('utils/escolhaPeloPassado › caminhada', () => {
  it('deve escolher pelo alfa do treino e comparar com o controle que opera menos', () => {
    const r = caminharParaFrente(serieDeDias(10), REGRA, { ...JANELAS, sinais: SINAIS, minimo: 1 })

    expect(r.periodos.length).toBeGreaterThan(3)
    r.periodos.forEach((p) => {
      expect(p.escolhido.sinal).toBe(CandlePattern.MARTELO)
      expect(p.controle.sinal).toBe(CandlePattern.ESTRELA)
    })
    expect(r.escolhido.retorno).toBeGreaterThan(r.controle.retorno)
    expect(r.escolhido.posicaoMedia).toBe(1)
    expect(r.controle.posicaoMedia).toBe(0)
  })

  it('não deve deixar o mês de teste influir na escolha feita antes dele', () => {
    // Do sexto dia em diante o martelo perde 10% a cada operação. O período
    // cujo teste começa na virada escolheu olhando os dias 4 e 5, em que o
    // martelo só ganhou: ele tem de ter escolhido o martelo — e perdido.
    // Um treino que enxergasse o teste veria o tombo e escolheria a estrela.
    const VIRADA = 6
    const r = caminharParaFrente(
      serieDeDias(10, { marteloPerde: (i) => i >= VIRADA * 24 }),
      REGRA,
      { ...JANELAS, sinais: SINAIS, minimo: 1 }
    )
    const naVirada = r.periodos.find(
      (p) => Date.parse(p.inicio) === Date.parse('2026-01-01T00:00:00Z') + VIRADA * 24 * HORA_MS
    )

    expect(naVirada.escolhido.sinal).toBe(CandlePattern.MARTELO)
    expect(naVirada.escolhido.retorno).toBeLessThan(0)
  })

  it('deve parar onde começa o trecho reservado da validação', () => {
    const registros = serieDeDias(10)
    const ate = new Date(Date.parse('2026-01-01T00:00:00Z') + 7 * 24 * HORA_MS).toISOString()
    const r = caminharParaFrente(registros, REGRA, { ...JANELAS, sinais: SINAIS, ate, minimo: 1 })
    expect(r.periodos.length).toBeGreaterThan(0)
    r.periodos.forEach((p) => expect(Date.parse(p.fim)).toBeLessThanOrEqual(Date.parse(ate)))
  })

  it('deve dizer quando o histórico não sustenta a leitura', () => {
    const r = caminharParaFrente(serieDeDias(10), REGRA, { ...JANELAS, sinais: SINAIS, minimo: 50 })
    expect(r.suficiente).toBe(false)
  })

  it('deve devolver null sem série', () => {
    expect(caminharParaFrente([], REGRA)).toBeNull()
  })
})
