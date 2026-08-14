import { describe, expect, it } from 'vitest'
import { analisarSinais, SignalKey } from '../src/utils/signalLab'
import { CandlePattern } from '../src/utils/candlePatterns'
import { DivergenceKind } from '../src/utils/flowDivergence'
import { VwapSignal } from '../src/utils/vwap'
import { OscillatorSignal } from '../src/utils/oscillators'

// Geometrias fixas: martelo tem sombra inferior longa, neutro fica no meio.
const MARTELO = { corpo: 10, sup: 2, inf: 30 }
const NEUTRO = { corpo: 50, sup: 25, inf: 25 }

const reg = (close, forma = NEUTRO, volume = 100) => ({
  precoFechamento: close,
  precoCorpoCandle: forma.corpo,
  precoSombraSuperior: forma.sup,
  precoSombraInferior: forma.inf,
  precoAmplitude: forma.corpo + forma.sup + forma.inf,
  precoVolume: volume,
  precoPercentualVariacao: 0,
})

// A API entrega do mais recente ao mais antigo; os testes descrevem a série em
// ordem cronológica e invertem na entrada, como o dashboard recebe.
const comoDaApi = (cronologico) => [...cronologico].reverse()

describe('utils/signalLab › analisarSinais', () => {
  it('deve medir o retorno para frente, não para trás', () => {
    // Cronologicamente 100 → 110 → 121: duas altas de 10%.
    const r = analisarSinais(comoDaApi([reg(100), reg(110), reg(121)]))
    expect(r.base.ocorrencias).toBe(2)
    expect(r.base.taxaAlta).toBeCloseTo(100, 6)
    expect(r.base.retornoMedio).toBeCloseTo(10, 6)
  })

  it('deve respeitar o horizonte pedido', () => {
    // Com horizonte 2, só o primeiro candle tem futuro: 100 → 121.
    const r = analisarSinais(comoDaApi([reg(100), reg(110), reg(121)]), { horizonte: 2 })
    expect(r.horizonte).toBe(2)
    expect(r.base.ocorrencias).toBe(1)
    expect(r.base.retornoMedio).toBeCloseTo(21, 6)
  })

  it('deve excluir da base os candles sem futuro na janela', () => {
    // 4 candles, horizonte 1 → o último não tem desfecho medível.
    const r = analisarSinais(comoDaApi([reg(100), reg(110), reg(105), reg(100)]))
    expect(r.base.ocorrencias).toBe(3)
  })

  it('deve isolar o desfecho de cada padrão e compará-lo com a base', () => {
    const r = analisarSinais(comoDaApi([
      reg(100, MARTELO), // → 110 = +10%
      reg(110, NEUTRO),  // → 105 = -4,55%
      reg(105, MARTELO), // → 100 = -4,76%
      reg(100, NEUTRO),  // sem futuro
    ]))

    expect(r.base.taxaAlta).toBeCloseTo(33.3333, 3)

    const martelo = r.sinais.find((s) => s.chave === CandlePattern.MARTELO)
    expect(martelo.ocorrencias).toBe(2)
    expect(martelo.taxaAlta).toBeCloseTo(50, 6)
    expect(martelo.retornoMedio).toBeCloseTo(2.6190476, 5)
    // O delta é a leitura útil: o martelo deslocou a taxa em ~16,7 pontos.
    expect(martelo.deltaTaxa).toBeCloseTo(16.6667, 3)
  })

  it('não deve criar linha para candles sem padrão', () => {
    const r = analisarSinais(comoDaApi([reg(100), reg(110), reg(121)]))
    expect(r.sinais.find((s) => s.chave === CandlePattern.NEUTRO)).toBeUndefined()
  })

  it('não deve dar significância a uma ocorrência isolada', () => {
    // Wilson trata amostra pequena por construção: o intervalo fica largo
    // demais para excluir a base, sem precisar de um limiar de n à parte.
    const r = analisarSinais(comoDaApi([reg(100, MARTELO), reg(110), reg(121)]))
    const martelo = r.sinais.find((s) => s.chave === CandlePattern.MARTELO)
    expect(martelo.ocorrencias).toBe(1)
    expect(martelo.significante).toBe(false)
  })

  it('deve captar volume atípico quando a série sustenta a régua', () => {
    // calcularLimites exige 8 registros; o pico de volume é 10× a mediana.
    const cronologico = Array.from({ length: 9 }, (_, i) => reg(100 + i, NEUTRO, 100))
    cronologico[2] = reg(102, NEUTRO, 1000)

    const r = analisarSinais(comoDaApi(cronologico))
    const vol = r.sinais.find((s) => s.chave === SignalKey.VOLUME_ATIPICO)
    expect(vol.ocorrencias).toBe(1)
  })

  it('deve ordenar pelo maior deslocamento em relação à base', () => {
    const r = analisarSinais(comoDaApi([
      reg(100, MARTELO), reg(110, NEUTRO), reg(105, MARTELO), reg(100, NEUTRO),
    ]))
    for (let i = 1; i < r.sinais.length; i++) {
      expect(Math.abs(r.sinais[i - 1].deltaTaxa)).toBeGreaterThanOrEqual(
        Math.abs(r.sinais[i].deltaTaxa)
      )
    }
  })

  it('deve recusar entrada inutilizável', () => {
    expect(analisarSinais([])).toBeNull()
    expect(analisarSinais(null)).toBeNull()
    // Um único candle não tem futuro para medir.
    expect(analisarSinais([reg(100)])).toBeNull()
    expect(analisarSinais(comoDaApi([reg(100), reg(110)]), { horizonte: 0 })).toBeNull()
  })
})

describe('utils/signalLab › significância estatística', () => {
  // Série longa o bastante para o martelo acumular ocorrências: metade dos
  // candles é martelo e todos eles sobem, contra base próxima de 50%.
  const serieComEdge = (n) => {
    const out = []
    for (let i = 0; i < n; i++) {
      const ehMartelo = i % 2 === 0
      // Martelo sempre seguido de alta; neutro sempre seguido de queda.
      const preco = 100 + (ehMartelo ? 0 : 10)
      out.push(reg(preco, ehMartelo ? MARTELO : NEUTRO))
    }
    return out
  }

  it('deve devolver intervalo de confiança para cada sinal', () => {
    const r = analisarSinais(comoDaApi(serieComEdge(40)))
    r.sinais.forEach((s) => {
      expect(s.intervalo.inferior).toBeGreaterThanOrEqual(0)
      expect(s.intervalo.superior).toBeLessThanOrEqual(100)
      expect(s.intervalo.inferior).toBeLessThanOrEqual(s.intervalo.superior)
    })
  })

  it('não deve considerar significante uma amostra minúscula', () => {
    // Um único martelo que subiu não distingue nada, por mais que a taxa
    // isolada seja 100%.
    const r = analisarSinais(comoDaApi([reg(100, MARTELO), reg(110), reg(105), reg(100)]))
    const martelo = r.sinais.find((s) => s.chave === CandlePattern.MARTELO)
    expect(martelo.ocorrencias).toBe(1)
    expect(martelo.significante).toBe(false)
  })

  it('deve reconhecer significância quando o intervalo exclui a base', () => {
    const r = analisarSinais(comoDaApi(serieComEdge(40)))
    const martelo = r.sinais.find((s) => s.chave === CandlePattern.MARTELO)
    // A base fora do intervalo é exatamente a definição usada.
    const dentro =
      r.base.taxaAlta >= martelo.intervalo.inferior &&
      r.base.taxaAlta <= martelo.intervalo.superior
    expect(martelo.significante).toBe(!dentro)
  })

  it('deve contar os positivos que sustentam a taxa', () => {
    const r = analisarSinais(comoDaApi([reg(100), reg(110), reg(121)]))
    expect(r.base.positivos).toBe(2)
    expect(r.base.ocorrencias).toBe(2)
  })
})

describe('utils/signalLab › famílias de alinhamento posicional', () => {
  // Por que este bloco existe:
  //
  // Martelo e volume atípico são classificados registro a registro, dentro do
  // próprio laço. Divergência, VWAP e osciladores não: chegam prontos, como
  // ARRAY indexado por posição cronológica, montado antes do laço. São as
  // únicas famílias em que a marca pode ser atribuída ao candle errado — e um
  // deslocamento de uma posição não quebra nada visível, só troca o número.
  //
  // Cada série abaixo é construída para que o retorno seguinte a cada sinal
  // seja ÚNICO. Isso transforma `retornoMedio` em prova de alinhamento: se a
  // marca escorregar um candle, o valor muda. Conferir só `ocorrencias` não
  // bastaria — no meio de uma sequência a contagem se mantém.

  const NEUTRO = { corpo: 50, sup: 25, inf: 25 }

  // Registro com os campos que estas famílias exigem e que o `reg` do bloco
  // acima não precisa carregar: fluxo (volumeDelta), nocional
  // (precoTotalNegociada, para o VWAP) e ticket.
  const regCompleto = (close, opts = {}) => {
    const { forma = NEUTRO, volume = 100, delta = 0, variacao = 0, ticket = 10 } = opts
    return {
      precoFechamento: close,
      precoCorpoCandle: forma.corpo,
      precoSombraSuperior: forma.sup,
      precoSombraInferior: forma.inf,
      precoAmplitude: forma.corpo + forma.sup + forma.inf,
      precoVolume: volume,
      precoPercentualVariacao: variacao,
      volumeDelta: delta,
      precoTotalNegociada: volume * close,
      precoFinanceiroPorTrade: ticket,
    }
  }

  const daApi = (cronologico) => [...cronologico].reverse()
  const acharSinal = (r, chave) => r.sinais.find((s) => s.chave === chave)

  // Serrilhado de 20 candles: deixa o RSI perto de 50 para que a alta (ou a
  // queda) seguinte ATRAVESSE o limiar. Sem isso o RSI já nasce saturado e
  // `detectarExtremosRsi` não marca nada — o evento é a travessia, não o nível.
  const preambuloNeutro = () =>
    Array.from({ length: 20 }, (_, i) => (i % 2 === 0 ? 100 : 102))

  describe('divergência de fluxo', () => {
    it('deve marcar divergência baixista no candle certo', () => {
      // Preço sobe 1 por candle e o fluxo é negativo o tempo todo: alta sem
      // lastro de compra em toda janela a partir da 5ª posição.
      const cron = Array.from({ length: 14 }, (_, i) => regCompleto(100 + i, { delta: -20 }))
      const d = acharSinal(analisarSinais(daApi(cron)), DivergenceKind.BEARISH)

      // Marcado das posições 5 a 12: antes da 5 não há janela, e a 13 fica de
      // fora por não ter futuro dentro da série.
      expect(d.ocorrencias).toBe(8)
      // Média de 1/105, 1/106 … 1/112. Escorregar uma posição em qualquer
      // direção muda tanto a contagem quanto esta média.
      expect(d.retornoMedio).toBeCloseTo(0.92207, 5)
    })

    it('deve marcar divergência altista no candle certo', () => {
      const cron = Array.from({ length: 14 }, (_, i) => regCompleto(120 - i, { delta: 20 }))
      const d = acharSinal(analisarSinais(daApi(cron)), DivergenceKind.BULLISH)

      expect(d.ocorrencias).toBe(8)
      expect(d.retornoMedio).toBeCloseTo(-0.89724, 5)
    })
  })

  describe('cruzamentos de VWAP', () => {
    // O VWAP é acumulado desde o início da janela, então a travessia depende de
    // toda a série anterior — não dá para montar por candle isolado.
    const SERIE = [100, 100, 100, 100, 90, 95, 99, 120, 132, 100, 105, 105]

    it('deve atribuir o cruzamento para cima ao candle certo', () => {
      const r = analisarSinais(daApi(SERIE.map((p) => regCompleto(p))))
      const alta = acharSinal(r, VwapSignal.CROSS_UP)

      // Posições 6 e 10.
      expect(alta.ocorrencias).toBe(2)
      // 99 → 120 (+21,21%) e 105 → 105 (0%).
      expect(alta.retornoMedio).toBeCloseTo(10.60606, 5)
    })

    it('deve atribuir o cruzamento para baixo ao candle certo', () => {
      const r = analisarSinais(daApi(SERIE.map((p) => regCompleto(p))))
      const baixa = acharSinal(r, VwapSignal.CROSS_DOWN)

      // Posições 4 e 9.
      expect(baixa.ocorrencias).toBe(2)
      // 90 → 95 (+5,56%) e 100 → 105 (+5%).
      expect(baixa.retornoMedio).toBeCloseTo(5.27778, 5)
    })
  })

  describe('osciladores', () => {
    it('deve atribuir RSI em sobrecompra e rompimento de banda superior', () => {
      const precos = [...preambuloNeutro()]
      for (let i = 0; i < 12; i++) precos.push(103 + i * 4)
      const r = analisarSinais(daApi(precos.map((p) => regCompleto(p))))

      const rsi = acharSinal(r, OscillatorSignal.RSI_OVERBOUGHT)
      expect(rsi.ocorrencias).toBe(1)
      // Marcado na posição 23: 115 → 119.
      expect(rsi.retornoMedio).toBeCloseTo(3.47826, 5)

      // A banda rompe antes do RSI saturar — posição 21: 107 → 111. Os dois
      // saem do mesmo array de marcas, e valores diferentes provam que cada um
      // foi para a sua posição.
      const banda = acharSinal(r, OscillatorSignal.BAND_BREAK_UP)
      expect(banda.ocorrencias).toBe(1)
      expect(banda.retornoMedio).toBeCloseTo(3.73832, 5)
    })

    it('deve atribuir RSI em sobrevenda e rompimento de banda inferior', () => {
      const precos = [...preambuloNeutro()]
      for (let i = 0; i < 12; i++) precos.push(99 - i * 4)
      const r = analisarSinais(daApi(precos.map((p) => regCompleto(p))))

      const rsi = acharSinal(r, OscillatorSignal.RSI_OVERSOLD)
      expect(rsi.ocorrencias).toBe(1)
      // Posição 24: 83 → 79.
      expect(rsi.retornoMedio).toBeCloseTo(-4.81928, 5)

      const banda = acharSinal(r, OscillatorSignal.BAND_BREAK_DOWN)
      expect(banda.ocorrencias).toBe(1)
      // Posição 21: 95 → 91.
      expect(banda.retornoMedio).toBeCloseTo(-4.21053, 5)
    })

    it('não deve marcar RSI que já nasce fora do limiar', () => {
      // Série que só sobe: o RSI satura em 100 na primeira posição calculável e
      // nunca ATRAVESSA o limiar vindo de baixo. Comportamento deliberado —
      // permanecer sobrecomprado é estado, não evento — e fica registrado aqui
      // para não ser "corrigido" por engano.
      const precos = Array.from({ length: 30 }, (_, i) => 100 + i * 3)
      const r = analisarSinais(daApi(precos.map((p) => regCompleto(p))))

      expect(acharSinal(r, OscillatorSignal.RSI_OVERBOUGHT)).toBeUndefined()
    })
  })

  describe('anomalias por registro', () => {
    // Ticket e variação atípica são avaliados registro a registro, como o
    // volume. Entram aqui porque nenhum teste os cobria — o alinhamento não é
    // o risco, a ausência de cobertura era.
    const serieComPico = () => {
      const cron = Array.from({ length: 12 }, (_, i) =>
        regCompleto(100 + i, { ticket: 10, variacao: 1 })
      )
      // Posição 3: ticket 5× a mediana e variação a mais de 3σ da média.
      cron[3] = regCompleto(103, { ticket: 50, variacao: 40 })
      return cron
    }

    it('deve captar ticket alto', () => {
      const t = acharSinal(analisarSinais(daApi(serieComPico())), SignalKey.TICKET_ALTO)
      expect(t.ocorrencias).toBe(1)
      // 103 → 104.
      expect(t.retornoMedio).toBeCloseTo(0.97087, 5)
    })

    it('deve captar variação atípica', () => {
      const v = acharSinal(analisarSinais(daApi(serieComPico())), SignalKey.VARIACAO_ATIPICA)
      expect(v.ocorrencias).toBe(1)
      expect(v.retornoMedio).toBeCloseTo(0.97087, 5)
    })
  })
})
