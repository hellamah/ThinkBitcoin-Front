import { describe, expect, it } from 'vitest'
import {
  ATR_PERIOD,
  avaliarAnomalia,
  calcularAtr,
  calcularAtrSerie,
  calcularDesempenho,
  calcularLimites,
} from '../src/utils/marketStats'

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
    precoFinanceiroPorTrade: 400,
  }))
  registros.push({
    precoPercentualVariacao: 10,
    precoVolume: 500,
    precoFinanceiroPorTrade: 1200,
  })
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

  it('deve marcar o ticket acima de 2× a mediana', () => {
    // Mediana do ticket é 400; 1200 é 3×.
    const r = avaliarAnomalia({ precoFinanceiroPorTrade: 1200 }, limites)
    expect(r.ticket).toBe(true)
    expect(r.razaoTicket).toBeCloseTo(3, 10)
  })

  it('não deve marcar ticket dentro do limiar', () => {
    // 2× é o limiar; 2× exato não passa, porque a comparação é estrita.
    expect(avaliarAnomalia({ precoFinanceiroPorTrade: 800 }, limites).ticket).toBe(false)
  })

  it('deve separar ticket alto de volume alto', () => {
    // Volume de rotina com ordens grandes: poucas ordens, cada uma pesada.
    const r = avaliarAnomalia(
      { precoVolume: 100, precoFinanceiroPorTrade: 1200 },
      limites
    )
    expect(r.volume).toBe(false)
    expect(r.ticket).toBe(true)
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

describe('utils/marketStats › calcularAtr', () => {
  // A API entrega do mais recente ao mais antigo.
  const serie = (amplitudes, fechamento = 1000) =>
    [...amplitudes].reverse().map((precoAmplitude) => ({ precoAmplitude, precoFechamento: fechamento }))

  it('deve devolver a própria amplitude quando ela é constante', () => {
    // Suavização de uma série constante não desloca a média.
    const r = calcularAtr(serie(new Array(ATR_PERIOD).fill(50)))
    expect(r.valor).toBeCloseTo(50, 10)
  })

  it('deve expor o ATR como percentual do preço atual', () => {
    // Em dólar BTC e DOGE não se comparam; em percentual, sim.
    const r = calcularAtr(serie(new Array(ATR_PERIOD).fill(50), 1000))
    expect(r.percentual).toBeCloseTo(5, 10)
  })

  it('deve suavizar em vez de acompanhar o último candle', () => {
    // Um candle de 500 no fim de uma série de 50 puxa pouco: (50*13 + 500)/14.
    const amplitudes = [...new Array(ATR_PERIOD).fill(50), 500]
    const r = calcularAtr(serie(amplitudes))
    expect(r.valor).toBeCloseTo((50 * 13 + 500) / 14, 6)
    expect(r.valor).toBeLessThan(500)
  })

  it('deve recusar histórico curto demais em vez de estimar', () => {
    expect(calcularAtr(serie(new Array(ATR_PERIOD - 1).fill(50)))).toBeNull()
    expect(calcularAtr([])).toBeNull()
    expect(calcularAtr(null)).toBeNull()
  })

  it('deve devolver percentual nulo sem preço para comparar', () => {
    const registros = new Array(ATR_PERIOD).fill(null).map(() => ({ precoAmplitude: 50 }))
    expect(calcularAtr(registros).percentual).toBeNull()
  })
})

describe('utils/marketStats › calcularAtrSerie', () => {
  const serie = (amplitudes) =>
    [...amplitudes].reverse().map((precoAmplitude) => ({ precoAmplitude, precoFechamento: 1000 }))

  it('deve preservar a posição de cada candle', () => {
    // O alinhamento é o motivo de esta função existir: quem dimensiona um stop
    // no instante da entrada precisa do ATR daquele candle, não do último.
    const s = calcularAtrSerie(serie(new Array(ATR_PERIOD + 5).fill(50)))
    expect(s).toHaveLength(ATR_PERIOD + 5)
  })

  it('deve ficar null enquanto não houver histórico para semear', () => {
    const s = calcularAtrSerie(serie(new Array(ATR_PERIOD + 3).fill(50)))
    // A média simples só fecha no candle de índice ATR_PERIOD - 1.
    expect(s.slice(0, ATR_PERIOD - 1).every((v) => v === null)).toBe(true)
    expect(s[ATR_PERIOD - 1]).toBeCloseTo(50, 10)
  })

  it('deve concordar com calcularAtr no último candle', () => {
    // As duas funções descrevem a mesma grandeza; divergir aqui significaria
    // que o card e o stop da simulação leem volatilidades diferentes.
    const amplitudes = [...new Array(ATR_PERIOD).fill(50), 500, 60, 40]
    const registros = serie(amplitudes)
    const s = calcularAtrSerie(registros)
    expect(s[s.length - 1]).toBeCloseTo(calcularAtr(registros).valor, 8)
  })

  it('deve suavizar ao longo da série, não acompanhar o candle', () => {
    const amplitudes = [...new Array(ATR_PERIOD).fill(50), 500]
    const s = calcularAtrSerie(serie(amplitudes))
    expect(s[ATR_PERIOD]).toBeCloseTo((50 * 13 + 500) / 14, 6)
  })

  it('deve carregar o valor anterior quando a amplitude falta', () => {
    // Amplitude ausente não é amplitude zero. Tratá-la como zero puxaria o ATR
    // para baixo por uma medição que ninguém fez — e é justamente num buraco de
    // coleta que o stop não pode encolher sem motivo.
    const amplitudes = [...new Array(ATR_PERIOD).fill(50), null, null]
    const s = calcularAtrSerie(serie(amplitudes))
    expect(s[ATR_PERIOD]).toBeCloseTo(50, 10)
    expect(s[ATR_PERIOD + 1]).toBeCloseTo(50, 10)
  })

  it('deve recusar série sem amplitude válida suficiente', () => {
    expect(calcularAtrSerie(serie(new Array(ATR_PERIOD - 1).fill(50))).every((v) => v === null)).toBe(true)
    expect(calcularAtrSerie([])).toEqual([])
    expect(calcularAtrSerie(null)).toEqual([])
  })
})
