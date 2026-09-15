import { describe, expect, it } from 'vitest'
import {
  simular,
  oportunidadesDeEntrada,
  ultimoDisparo,
  JANELA_CONFIRMACAO,
  PERIODO_MEDIA_TENDENCIA,
} from '../src/utils/backtest'
import { montarSerieDeSinais } from '../src/utils/signalLab'
import { ExitReason, StopMode, TradeDirection, TrendFilter } from '../src/utils/enums'
import { ATR_PERIOD } from '../src/utils/marketStats'
import { CandlePattern } from '../src/utils/candlePatterns'
import { HORA_MS, serie, parado } from './fixtures/candlesSimulacao'

// Regras que entraram depois do motor original: saída por sinal, stop móvel,
// stop que abre além do preço, excursão, filtros de entrada, dimensionamento
// pelo risco, entradas por posição e o modo enxuto. Suíte à parte para o
// backtest.test.js continuar descrevendo o contrato de sempre.

const PADRAO = { sinalEntrada: CandlePattern.MARTELO, custoPercentual: 0 }

describe('utils/backtest › stop que abre além do preço', () => {
  it('deve sair na ABERTURA quando o candle já começa abaixo do stop comprado', () => {
    // Entrada em 100, stop em 98. O candle seguinte abre em 95: a ordem de stop
    // vira ordem a mercado, e o primeiro preço disponível é 95, não 98.
    const r = simular(
      serie([
        { ...parado(100), martelo: true },
        parado(100),
        { abertura: 95, maior: 96, menor: 94, fechamento: 95 },
        parado(95),
      ]),
      { ...PADRAO, saidaPorTempo: null, stopPercentual: 2 }
    )

    expect(r.trades[0].motivoSaida).toBe(ExitReason.STOP)
    expect(r.trades[0].precoSaida).toBe(95)
    expect(r.trades[0].retornoLiquido).toBeCloseTo(-5, 10)
  })

  it('deve espelhar na venda: abertura acima do stop sai na abertura', () => {
    const r = simular(
      serie([
        { ...parado(100), martelo: true },
        parado(100),
        { abertura: 105, maior: 106, menor: 104, fechamento: 105 },
        parado(105),
      ]),
      { ...PADRAO, direcao: TradeDirection.VENDA, saidaPorTempo: null, stopPercentual: 2 }
    )

    expect(r.trades[0].precoSaida).toBe(105)
    expect(r.trades[0].retornoLiquido).toBeCloseTo(-5, 10)
  })

  it('deve continuar saindo no preço do stop quando a abertura está do lado certo', () => {
    // Abre em 99, acima do stop, e só depois desce: o stop é tocado no caminho.
    const r = simular(
      serie([
        { ...parado(100), martelo: true },
        parado(100),
        { abertura: 99, maior: 99, menor: 96, fechamento: 97 },
        parado(97),
      ]),
      { ...PADRAO, saidaPorTempo: null, stopPercentual: 2 }
    )

    expect(r.trades[0].precoSaida).toBeCloseTo(98, 10)
  })
})

describe('utils/backtest › saída por sinal', () => {
  const COM_ESTRELA = [
    { ...parado(100), martelo: true },
    parado(100),
    { ...parado(105), estrela: true },
    { abertura: 106, maior: 107, menor: 105, fechamento: 106 },
    parado(106),
  ]

  it('deve sair na abertura do candle seguinte ao sinal de saída', () => {
    // A estrela fecha em 105; a saída é na abertura do candle seguinte, 106 —
    // pelo mesmo motivo que a entrada não acontece no fechamento do martelo.
    const r = simular(serie(COM_ESTRELA), {
      ...PADRAO,
      saidaPorTempo: null,
      sinalSaida: CandlePattern.ESTRELA,
    })

    expect(r.trades).toHaveLength(1)
    expect(r.trades[0].motivoSaida).toBe(ExitReason.SINAL)
    expect(r.trades[0].indiceSaida).toBe(3)
    expect(r.trades[0].precoSaida).toBe(106)
  })

  it('deve bastar como única regra de saída', () => {
    // Sem tempo, sem stop e sem alvo o motor recusava. Com sinal de saída a
    // posição tem como fechar, então a simulação existe.
    const r = simular(serie(COM_ESTRELA), {
      ...PADRAO,
      saidaPorTempo: null,
      sinalSaida: CandlePattern.ESTRELA,
    })
    expect(r).not.toBeNull()
  })

  it('não deve fechar pelo sinal quando outra saída vem antes', () => {
    const r = simular(serie(COM_ESTRELA), {
      ...PADRAO,
      saidaPorTempo: 1,
      sinalSaida: CandlePattern.ESTRELA,
    })
    expect(r.trades[0].motivoSaida).toBe(ExitReason.TEMPO)
  })
})

describe('utils/backtest › stop móvel por ATR', () => {
  // ATR constante de 1 sobre preço 100: 1% × 2 = stop a 2%.
  const base = (preco = 100) => ({
    abertura: preco, maior: preco + 0.5, menor: preco - 0.5, fechamento: preco, amplitude: 1,
  })
  const montar = () => {
    const defs = Array.from({ length: ATR_PERIOD + 3 }, () => base())
    defs[ATR_PERIOD + 2] = { ...base(), martelo: true }
    // Candle da entrada: sobe até 110. O stop, que nasceu em 98, passa a
    // valer 110 × 0,98 = 107,8 a partir do candle seguinte.
    defs.push({ abertura: 100, maior: 110, menor: 99.5, fechamento: 109, amplitude: 1 })
    // Recua até 107: toca o stop móvel, não o original.
    defs.push({ abertura: 108, maior: 108.5, menor: 107, fechamento: 107.5, amplitude: 1 })
    defs.push(base(107.5), base(107.5))
    return serie(defs)
  }

  it('deve subir o stop com o melhor preço e sair nele', () => {
    const r = simular(montar(), { ...PADRAO, saidaPorTempo: null, modoStop: StopMode.ATR_MOVEL })

    const trade = r.trades[0]
    expect(trade.motivoSaida).toBe(ExitReason.STOP)
    expect(trade.precoSaida).toBeCloseTo(107.8, 8)
    expect(trade.precoStopFinal).toBeCloseTo(107.8, 8)
    expect(trade.retornoLiquido).toBeCloseTo(7.8, 8)
  })

  it('não deve sair ali com o stop por ATR fixo', () => {
    const r = simular(montar(), { ...PADRAO, saidaPorTempo: null, modoStop: StopMode.ATR })
    expect(r.trades[0].motivoSaida).toBe(ExitReason.FIM_DA_SERIE)
  })
})

describe('utils/backtest › excursão das operações', () => {
  it('deve medir o pior e o melhor momento da operação', () => {
    const r = simular(
      serie([
        { ...parado(100), martelo: true },
        { abertura: 100, maior: 103, menor: 97, fechamento: 101 },
        { abertura: 101, maior: 108, menor: 95, fechamento: 104 },
        { abertura: 104, maior: 106, menor: 101, fechamento: 104 },
        parado(104),
      ]),
      { ...PADRAO, saidaPorTempo: 3 }
    )

    expect(r.trades[0].excursaoAdversa).toBeCloseTo(5, 10)
    expect(r.trades[0].excursaoFavoravel).toBeCloseTo(8, 10)
  })

  it('não deve atribuir ao trade a máxima do candle em que o stop fechou', () => {
    // O candle da saída vai a 112, mas o OHLC não diz se isso veio antes ou
    // depois do stop em 98. A excursão favorável fica com o que é certo: a
    // máxima do candle anterior (101).
    const r = simular(
      serie([
        { ...parado(100), martelo: true },
        { abertura: 100, maior: 101, menor: 99.5, fechamento: 100.5 },
        { abertura: 100.5, maior: 112, menor: 97, fechamento: 98 },
        parado(98),
      ]),
      { ...PADRAO, saidaPorTempo: null, stopPercentual: 2 }
    )

    expect(r.trades[0].excursaoFavoravel).toBeCloseTo(1, 10)
    expect(r.trades[0].excursaoAdversa).toBeCloseTo(2, 10)
  })
})

describe('utils/backtest › filtro de tendência', () => {
  // 55 candles em 100 e um martelo que fecha em 90: a média de 50 está em
  // 99,8, então o martelo está ABAIXO dela.
  const montar = () => {
    const defs = Array.from({ length: 55 }, () => parado(100))
    defs.push({ ...parado(90), martelo: true }, parado(90), parado(90))
    return serie(defs)
  }

  it('deve barrar a entrada contra o filtro e deixar a favor dele', () => {
    const opcoes = { ...PADRAO, saidaPorTempo: 1 }
    expect(simular(montar(), opcoes).trades).toHaveLength(1)
    expect(simular(montar(), { ...opcoes, filtroTendencia: TrendFilter.ALTA }).trades).toHaveLength(0)
    expect(simular(montar(), { ...opcoes, filtroTendencia: TrendFilter.BAIXA }).trades).toHaveLength(1)
  })

  it('deve reprovar enquanto a média ainda não existe', () => {
    // Sem 50 candles de histórico não se sabe de que lado da média o preço
    // está — e "não sei" não é "está em alta".
    const defs = Array.from({ length: PERIODO_MEDIA_TENDENCIA - 10 }, () => parado(100))
    defs[5] = { ...parado(100), martelo: true }
    const r = simular(serie(defs), { ...PADRAO, saidaPorTempo: 1, filtroTendencia: TrendFilter.ALTA })
    expect(r.trades).toHaveLength(0)
  })
})

describe('utils/backtest › confirmação por segundo sinal', () => {
  const montar = (distancia) => {
    const defs = Array.from({ length: 30 }, () => parado(100))
    defs[10] = { ...parado(100), estrela: true }
    defs[10 + distancia] = { ...parado(100), martelo: true }
    return serie(defs)
  }
  const opcoes = { ...PADRAO, saidaPorTempo: 1, sinalConfirmacao: CandlePattern.ESTRELA }

  it('deve entrar com a confirmação dentro da janela', () => {
    expect(simular(montar(JANELA_CONFIRMACAO - 1), opcoes).trades).toHaveLength(1)
  })

  it('não deve entrar com a confirmação velha demais', () => {
    expect(simular(montar(JANELA_CONFIRMACAO), opcoes).trades).toHaveLength(0)
  })
})

describe('utils/backtest › dimensionamento pelo risco', () => {
  const QUEDA = serie([
    { ...parado(100), martelo: true },
    { abertura: 100, maior: 100, menor: 97, fechamento: 97 },
    parado(97),
  ])

  it('deve comprometer só a fração que faz o stop custar o risco pedido', () => {
    // Stop de 2%, risco de 1%: metade do capital. O stop cai −2% sobre essa
    // metade, que é −1% do capital.
    const r = simular(QUEDA, { ...PADRAO, saidaPorTempo: null, stopPercentual: 2, riscoPorOperacao: 1 })

    expect(r.trades[0].fracaoCapital).toBeCloseTo(0.5, 10)
    expect(r.metricas.retornoTotal).toBeCloseTo(-1, 10)
  })

  it('não deve alavancar quando o risco pedido passa da distância do stop', () => {
    const r = simular(QUEDA, { ...PADRAO, saidaPorTempo: null, stopPercentual: 2, riscoPorOperacao: 5 })
    expect(r.trades[0].fracaoCapital).toBe(1)
    expect(r.metricas.retornoTotal).toBeCloseTo(-2, 10)
  })
})

describe('utils/backtest › entradas por posição e modo enxuto', () => {
  it('deve entrar onde a máscara manda, sem olhar o sinal', () => {
    const registros = serie([
      parado(100),
      { abertura: 100, maior: 110, menor: 100, fechamento: 110 },
      parado(110),
    ])
    const r = simular(registros, {
      custoPercentual: 0,
      saidaPorTempo: 1,
      posicoesDeEntrada: [1, 0, 0],
    })

    expect(r.trades).toHaveLength(1)
    expect(r.trades[0].retornoLiquido).toBeCloseTo(10, 10)
  })

  it('deve devolver no modo enxuto o mesmo desfecho da simulação completa', () => {
    const defs = []
    for (let i = 0; i < 60; i++) {
      const p = 100 + Math.sin(i / 3) * 5
      defs.push({ abertura: p, maior: p + 2, menor: p - 2, fechamento: p + 1, martelo: i % 7 === 0 })
    }
    const registros = serie(defs)
    const opcoes = { sinalEntrada: CandlePattern.MARTELO, saidaPorTempo: 3, stopPercentual: 1.5 }

    const completo = simular(registros, opcoes)
    const enxuto = simular(registros, { ...opcoes, enxuto: true })

    expect(enxuto.retornoTotal).toBeCloseTo(completo.metricas.retornoTotal, 10)
    expect(enxuto.alfa).toBeCloseTo(completo.metricas.alfa, 10)
    expect(enxuto.tradesConcluidos).toBe(completo.metricas.tradesConcluidos)
    expect(enxuto.curva).toBeUndefined()
  })

  it('deve respeitar a tolerância de cada chamada mesmo reaproveitando a série', () => {
    // O preparo da série é guardado por série de sinais. A tolerância de buraco
    // é parâmetro, então duas chamadas com a mesma série e tolerâncias
    // diferentes não podem compartilhar o resultado.
    const registros = serie(
      Array.from({ length: 8 }, (_, i) => (i === 2 ? { ...parado(100), martelo: true } : parado(100))),
      { saltos: { 4: 4 } }
    )
    const serieDeSinais = montarSerieDeSinais(registros)
    const opcoes = { ...PADRAO, saidaPorTempo: 1, serieDeSinais }

    expect(simular(registros, opcoes).descontinuidades).toHaveLength(1)
    expect(simular(registros, { ...opcoes, toleranciaBuracoMs: 5 * HORA_MS }).descontinuidades).toHaveLength(0)
    expect(simular(registros, opcoes).descontinuidades).toHaveLength(1)
  })
})

describe('utils/backtest › oportunidades e último disparo', () => {
  const montar = () => {
    const defs = Array.from({ length: 10 }, () => parado(100))
    defs[2] = { ...parado(100), martelo: true }
    defs[5] = { ...parado(100), martelo: true }
    return serie(defs)
  }

  it('deve contar as candidatas só dentro da janela e com candle seguinte', () => {
    // Janela a partir da hora 3: candidatas de 3 a 8 (a 9 é o último candle,
    // sem seguinte). O martelo da hora 2 fica de fora; o da 5 conta.
    const op = oportunidadesDeEntrada(montar(), {
      sinalEntrada: CandlePattern.MARTELO,
      aPartirDe: '2026-01-01T03:00:00Z',
    })
    expect(op.candidatas).toEqual([3, 4, 5, 6, 7, 8])
    expect(op.comSinal).toBe(1)
  })

  it('deve achar o último disparo e a distância até o fim da série', () => {
    const d = ultimoDisparo(montar(), { sinalEntrada: CandlePattern.MARTELO })
    expect(d.candlesAtras).toBe(4)
    expect(d.instante).toBe('2026-01-01T05:00:00.000Z')
  })

  it('deve devolver null quando o sinal nunca passa pelo filtro', () => {
    const d = ultimoDisparo(montar(), {
      sinalEntrada: CandlePattern.MARTELO,
      filtroTendencia: TrendFilter.ALTA,
    })
    expect(d).toBeNull()
  })
})
