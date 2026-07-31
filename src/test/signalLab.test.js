import { describe, expect, it } from 'vitest'
import { analisarSinais, MIN_OCCURRENCES, SignalKey } from '../src/utils/signalLab'
import { CandlePattern } from '../src/utils/candlePatterns'

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

  it('deve marcar como pouco confiável a amostra abaixo do mínimo', () => {
    const r = analisarSinais(comoDaApi([reg(100, MARTELO), reg(110), reg(121)]))
    const martelo = r.sinais.find((s) => s.chave === CandlePattern.MARTELO)
    expect(martelo.ocorrencias).toBeLessThan(MIN_OCCURRENCES)
    expect(martelo.confiavel).toBe(false)
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
