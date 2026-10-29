import { describe, expect, it } from 'vitest'
import {
  bootstrapRetorno,
  retornoSemMelhores,
  custoDeEquilibrio,
  resumirExcursoes,
  resultadoPorMes,
  serieSubmersa,
  EquilibrioCusto,
} from '../src/utils/robustez'
import { ExitReason, TradeDirection } from '../src/utils/enums'

const trade = (retornoLiquido, extra = {}) => ({
  retornoLiquido,
  motivoSaida: ExitReason.TEMPO,
  fracaoCapital: 1,
  ...extra,
})

describe('utils/robustez › bootstrap do retorno', () => {
  it('deve dar o mesmo intervalo para a mesma semente', () => {
    const trades = [5, -2, 3, -1, 4, -3, 2].map((r) => trade(r))
    expect(bootstrapRetorno(trades)).toEqual(bootstrapRetorno(trades))
  })

  it('deve ficar inteiro acima de zero quando toda operação ganhou', () => {
    const r = bootstrapRetorno([1, 2, 3, 4, 5].map((v) => trade(v)))
    expect(r.inferior).toBeGreaterThan(0)
    expect(r.probabilidadePositivo).toBe(100)
    expect(r.inferior).toBeLessThanOrEqual(r.mediana)
    expect(r.mediana).toBeLessThanOrEqual(r.superior)
  })

  it('deve deixar de fora a operação que a janela não viu terminar', () => {
    const r = bootstrapRetorno([
      trade(1),
      trade(2),
      trade(-50, { motivoSaida: ExitReason.FIM_DA_SERIE }),
    ])
    expect(r.operacoes).toBe(2)
    expect(r.inferior).toBeGreaterThan(0)
  })

  it('deve recusar menos de duas operações', () => {
    expect(bootstrapRetorno([trade(3)])).toBeNull()
  })
})

describe('utils/robustez › retorno sem as melhores', () => {
  it('deve recompor o capital sem as três melhores', () => {
    const r = retornoSemMelhores([10, 5, 1, -2].map((v) => trade(v)))
    expect(r.retorno).toBeCloseTo(-2, 10)
    expect(r.retiradas).toBe(3)
  })

  it('deve respeitar a fração comprometida', () => {
    const r = retornoSemMelhores([trade(10), trade(9), trade(8), trade(-4, { fracaoCapital: 0.5 })])
    expect(r.retorno).toBeCloseTo(-2, 10)
  })

  it('deve recusar quando não sobraria nenhuma', () => {
    expect(retornoSemMelhores([1, 2, 3].map((v) => trade(v)))).toBeNull()
  })
})

describe('utils/robustez › custo de equilíbrio', () => {
  const operacao = (saida) => ({ precoEntrada: 100, precoSaida: saida, fracaoCapital: 1 })

  it('deve achar a taxa em que o alfa zera', () => {
    // 102 × (1 − c) = 100 × (1 + c) → c = 2/202.
    const r = custoDeEquilibrio([operacao(102)], { direcao: TradeDirection.COMPRA, buyAndHold: 0 })
    expect(r.situacao).toBe(EquilibrioCusto.ENCONTRADO)
    expect(r.custo).toBeCloseTo((2 / 202) * 100, 6)
  })

  it('deve dizer quando nem custo zero salva a regra', () => {
    const r = custoDeEquilibrio([operacao(99)], { direcao: TradeDirection.COMPRA, buyAndHold: 0 })
    expect(r.situacao).toBe(EquilibrioCusto.NUNCA)
    expect(r.custo).toBeNull()
  })

  it('deve parar no teto quando a regra aguenta qualquer taxa realista', () => {
    const r = custoDeEquilibrio([operacao(150)], { direcao: TradeDirection.COMPRA, buyAndHold: 0 })
    expect(r.situacao).toBe(EquilibrioCusto.ACIMA)
  })

  it('deve medir contra o buy & hold, não contra zero', () => {
    // A operação rende 2%, mas segurar rendeu 3%: perde antes de qualquer taxa.
    const r = custoDeEquilibrio([operacao(102)], { direcao: TradeDirection.COMPRA, buyAndHold: 3 })
    expect(r.situacao).toBe(EquilibrioCusto.NUNCA)
  })
})

describe('utils/robustez › excursões', () => {
  it('deve ler o recuo das vencedoras e o avanço das perdedoras', () => {
    const trades = [
      ...[1, 2, 3, 4, 5].map((a) => trade(2, { excursaoAdversa: a, excursaoFavoravel: 3 })),
      trade(-1, { excursaoAdversa: 2, excursaoFavoravel: 1 }),
      trade(-1, { excursaoAdversa: 2, excursaoFavoravel: 3 }),
    ]
    const r = resumirExcursoes(trades)

    expect(r.vencedoras).toBe(5)
    expect(r.perdedoras).toBe(2)
    expect(r.adversaVencedoras).toBeCloseTo(4.2, 10)
    expect(r.favoravelPerdedoras).toBeCloseTo(2, 10)
    expect(r.pontos).toHaveLength(7)
  })
})

describe('utils/robustez › resultado por mês', () => {
  // Quatro horas em janeiro e quatro em fevereiro. O capital sobe 10% em
  // janeiro e cai 10% em fevereiro; o preço sobe 20% e depois fica parado.
  const H = 3600000
  const inicio = Date.UTC(2026, 0, 31, 20)
  const pontos = [
    [1000, 100], [1050, 110], [1080, 115], [1100, 120],
    [1050, 120], [1000, 120], [990, 120], [990, 120],
  ]
  const curva = pontos.map(([capital, preco], i) => ({
    instante: new Date(inicio + i * H).toISOString(),
    capital,
    precoFechamento: preco,
  }))

  it('deve separar os meses e recompor o total', () => {
    const r = resultadoPorMes(curva, [], 1000)

    expect(r.meses).toHaveLength(2)
    expect(r.meses[0].estrategia).toBeCloseTo(10, 10)
    expect(r.meses[0].buyAndHold).toBeCloseTo(20, 10)
    expect(r.meses[1].estrategia).toBeCloseTo(-10, 10)
    expect(r.meses[1].buyAndHold).toBeCloseTo(0, 10)

    const total = r.meses.reduce((c, m) => c * (1 + m.estrategia / 100), 1)
    expect((total - 1) * 100).toBeCloseTo(-1, 10)
  })

  it('deve contar quantos meses superaram o buy & hold', () => {
    const r = resultadoPorMes(curva, [], 1000)
    expect(r.vencidos).toBe(0)
    expect(r.comparaveis).toBe(2)
  })

  it('deve marcar como parcial o mês que a curva mal cobre', () => {
    const r = resultadoPorMes(curva, [], 1000)
    expect(r.meses.every((m) => m.parcial)).toBe(true)
  })

  it('deve contar a operação no mês em que ela fechou', () => {
    const r = resultadoPorMes(curva, [
      trade(1, { instanteSaida: new Date(inicio + 5 * H).toISOString() }),
    ], 1000)
    expect(r.meses[0].operacoes).toBe(0)
    expect(r.meses[1].operacoes).toBe(1)
  })
})

describe('utils/robustez › distância do pico', () => {
  it('deve medir cada ponto contra o maior valor até ali', () => {
    const r = serieSubmersa([
      { capital: 100, precoFechamento: 10 },
      { capital: 110, precoFechamento: 8 },
      { capital: 99, precoFechamento: 12 },
      { capital: 120, precoFechamento: 6 },
    ])
    expect(r.estrategia[0]).toBe(0)
    expect(r.estrategia[2]).toBeCloseTo(-10, 10)
    expect(r.estrategia[3]).toBe(0)
    expect(r.buyAndHold[1]).toBeCloseTo(-20, 10)
    expect(r.buyAndHold[3]).toBeCloseTo(-50, 10)
  })
})
