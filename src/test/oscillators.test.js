import { describe, expect, it } from 'vitest'
import {
  BAND_PERIOD,
  calcularBollinger,
  calcularRsi,
  detectarExtremosRsi,
  detectarRompimentos,
  OscillatorSignal,
  resumirOsciladores,
  RSI_PERIOD,
} from '../src/utils/oscillators'

const reg = (precoFechamento) => ({ precoFechamento })
const serie = (precos) => precos.map(reg)

// A API entrega do mais recente ao mais antigo.
const comoDaApi = (cronologico) => [...cronologico].reverse()

// Série que sobe sempre, o suficiente para o RSI existir.
const subindo = (n, passo = 1) =>
  serie(Array.from({ length: n }, (_, i) => 100 + i * passo))

describe('utils/oscillators › calcularRsi', () => {
  it('deve devolver 100 numa série que só sobe', () => {
    // Sem nenhuma perda no período a força relativa é infinita; por convenção
    // o índice satura em 100.
    const rsi = calcularRsi(subindo(RSI_PERIOD + 5))
    expect(rsi[RSI_PERIOD]).toBeCloseTo(100, 6)
  })

  it('deve devolver 0 numa série que só cai', () => {
    const rsi = calcularRsi(subindo(RSI_PERIOD + 5, -1))
    expect(rsi[RSI_PERIOD]).toBeCloseTo(0, 6)
  })

  it('deve ficar perto de 50 numa série que alterna simetricamente', () => {
    const precos = Array.from({ length: RSI_PERIOD + 10 }, (_, i) => 100 + (i % 2))
    const rsi = calcularRsi(serie(precos))
    expect(rsi[rsi.length - 1]).toBeGreaterThan(40)
    expect(rsi[rsi.length - 1]).toBeLessThan(60)
  })

  it('não deve produzir leitura antes de completar o período', () => {
    // Número calculado sobre histórico de menos é pior do que número nenhum.
    const rsi = calcularRsi(subindo(RSI_PERIOD + 3))
    expect(rsi.slice(0, RSI_PERIOD).every((v) => v === null)).toBe(true)
    expect(rsi[RSI_PERIOD]).not.toBeNull()
  })

  it('deve devolver tudo nulo sem histórico suficiente', () => {
    const rsi = calcularRsi(subindo(RSI_PERIOD))
    expect(rsi.every((v) => v === null)).toBe(true)
  })

  it('deve manter o índice dentro de 0 e 100', () => {
    const precos = [100, 120, 90, 130, 85, 140, 80, 150, 75, 160, 70, 170, 65, 180, 60, 190]
    calcularRsi(serie(precos)).forEach((v) => {
      if (v === null) return
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(100)
    })
  })

  it('deve tolerar entrada vazia', () => {
    expect(calcularRsi([])).toEqual([])
    expect(calcularRsi(null)).toEqual([])
  })
})

describe('utils/oscillators › calcularBollinger', () => {
  it('deve colapsar as bandas na média quando não há oscilação', () => {
    // Desvio zero: as três linhas coincidem.
    const b = calcularBollinger(serie(new Array(BAND_PERIOD).fill(100)))
    const ultima = b[BAND_PERIOD - 1]
    expect(ultima.media).toBeCloseTo(100, 10)
    expect(ultima.superior).toBeCloseTo(100, 10)
    expect(ultima.inferior).toBeCloseTo(100, 10)
  })

  it('deve abrir as bandas simetricamente em torno da média', () => {
    const precos = Array.from({ length: BAND_PERIOD }, (_, i) => 100 + (i % 2) * 10)
    const b = calcularBollinger(serie(precos))[BAND_PERIOD - 1]
    expect(b.superior - b.media).toBeCloseTo(b.media - b.inferior, 10)
    expect(b.superior).toBeGreaterThan(b.media)
  })

  it('não deve produzir banda antes de completar o período', () => {
    const b = calcularBollinger(subindo(BAND_PERIOD + 2))
    expect(b.slice(0, BAND_PERIOD - 1).every((v) => v === null)).toBe(true)
    expect(b[BAND_PERIOD - 1]).not.toBeNull()
  })

  it('deve tolerar entrada vazia', () => {
    expect(calcularBollinger([])).toEqual([])
    expect(calcularBollinger(null)).toEqual([])
  })
})

describe('utils/oscillators › detectarExtremosRsi', () => {
  it('deve marcar a entrada na sobrecompra', () => {
    expect(detectarExtremosRsi([65, 68, 72])[2]).toBe(OscillatorSignal.RSI_OVERBOUGHT)
  })

  it('deve marcar a entrada na sobrevenda', () => {
    expect(detectarExtremosRsi([35, 32, 28])[2]).toBe(OscillatorSignal.RSI_OVERSOLD)
  })

  it('não deve remarcar quem permanece na zona', () => {
    // Um ativo pode ficar sobrecomprado por semanas; marcar todo candle
    // produziria uma linha quase igual à taxa base.
    const marcas = detectarExtremosRsi([65, 75, 80, 85])
    expect(marcas[1]).toBe(OscillatorSignal.RSI_OVERBOUGHT)
    expect(marcas.slice(2).every((m) => m === null)).toBe(true)
  })

  it('deve pular buracos sem inventar travessia', () => {
    expect(detectarExtremosRsi([65, null, 75])[2]).toBeNull()
  })

  it('deve tolerar entrada vazia', () => {
    expect(detectarExtremosRsi([])).toEqual([])
    expect(detectarExtremosRsi(null)).toEqual([])
  })
})

describe('utils/oscillators › detectarRompimentos', () => {
  const bandas = (n, sup, inf) =>
    new Array(n).fill(null).map(() => ({ media: (sup + inf) / 2, superior: sup, inferior: inf }))

  it('deve marcar o rompimento da banda superior', () => {
    const marcas = detectarRompimentos(serie([100, 105, 130]), bandas(3, 120, 80))
    expect(marcas[2]).toBe(OscillatorSignal.BAND_BREAK_UP)
  })

  it('deve marcar o rompimento da banda inferior', () => {
    const marcas = detectarRompimentos(serie([100, 95, 70]), bandas(3, 120, 80))
    expect(marcas[2]).toBe(OscillatorSignal.BAND_BREAK_DOWN)
  })

  it('não deve remarcar quem continua fora da banda', () => {
    const marcas = detectarRompimentos(serie([100, 130, 140, 150]), bandas(4, 120, 80))
    expect(marcas[1]).toBe(OscillatorSignal.BAND_BREAK_UP)
    expect(marcas.slice(2).every((m) => m === null)).toBe(true)
  })

  it('não deve marcar quem fica dentro', () => {
    const marcas = detectarRompimentos(serie([100, 105, 110]), bandas(3, 120, 80))
    expect(marcas.every((m) => m === null)).toBe(true)
  })

  it('deve ignorar posições sem banda calculada', () => {
    expect(detectarRompimentos(serie([100, 130]), [null, null]).every((m) => m === null)).toBe(true)
  })
})

describe('utils/oscillators › resumirOsciladores', () => {
  it('deve reportar o estado do candle mais recente', () => {
    const r = resumirOsciladores(comoDaApi(subindo(BAND_PERIOD + 5)))
    expect(r.rsiAtual).toBeCloseTo(100, 6)
    expect(r.bandaAtual).not.toBeNull()
    expect(r.historicoSuficiente).toBe(true)
  })

  it('deve sinalizar histórico insuficiente sem inventar número', () => {
    const r = resumirOsciladores(comoDaApi(subindo(5)))
    expect(r.historicoSuficiente).toBe(false)
    expect(r.rsiAtual).toBeNull()
    expect(r.bandaAtual).toBeNull()
  })

  it('deve guardar as marcas por posição, permitindo mais de uma', () => {
    const r = resumirOsciladores(comoDaApi(subindo(BAND_PERIOD + 5)))
    expect(r.marcas).toHaveLength(BAND_PERIOD + 5)
    expect(Array.isArray(r.marcas[0])).toBe(true)
  })

  it('deve tolerar entrada vazia', () => {
    expect(resumirOsciladores([])).toBeNull()
    expect(resumirOsciladores(null)).toBeNull()
  })
})
