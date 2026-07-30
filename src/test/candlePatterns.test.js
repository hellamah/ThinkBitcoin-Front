import { describe, expect, it } from 'vitest'
import { CandlePattern, classificarCandle } from '../src/utils/candlePatterns'

// Monta o registro no formato que o backend entrega: anatomia já calculada.
const candle = ({ corpo, superior, inferior }) => ({
  precoCorpoCandle: corpo,
  precoSombraSuperior: superior,
  precoSombraInferior: inferior,
  precoAmplitude: corpo + superior + inferior,
})

describe('utils/candlePatterns › classificarCandle', () => {
  it('deve reconhecer martelo pela sombra inferior longa', () => {
    expect(classificarCandle(candle({ corpo: 10, superior: 2, inferior: 30 })))
      .toBe(CandlePattern.MARTELO)
  })

  it('deve reconhecer estrela cadente pela sombra superior longa', () => {
    expect(classificarCandle(candle({ corpo: 10, superior: 30, inferior: 2 })))
      .toBe(CandlePattern.ESTRELA)
  })

  it('deve reconhecer doji pelo corpo mínimo', () => {
    // Corpo em 2% da amplitude, com sombras equilibradas para não virar
    // martelo nem estrela.
    expect(classificarCandle(candle({ corpo: 2, superior: 49, inferior: 49 })))
      .toBe(CandlePattern.DOJI)
  })

  it('deve reconhecer marubozu pelo corpo dominante', () => {
    expect(classificarCandle(candle({ corpo: 90, superior: 5, inferior: 5 })))
      .toBe(CandlePattern.MARUBOZU)
  })

  it('deve devolver neutro no meio-termo', () => {
    expect(classificarCandle(candle({ corpo: 50, superior: 25, inferior: 25 })))
      .toBe(CandlePattern.NEUTRO)
  })

  it('deve priorizar a sombra dominante sobre o corpo pequeno', () => {
    // Corpo de 4% da amplitude cabe em doji, mas a assimetria das sombras diz
    // para que lado o preço foi rejeitado — informação que doji não carrega.
    expect(classificarCandle(candle({ corpo: 4, superior: 6, inferior: 90 })))
      .toBe(CandlePattern.MARTELO)
  })

  it('deve exigir que a sombra seja o dobro do corpo', () => {
    // Sombra inferior só 1,5× o corpo: não caracteriza rejeição.
    expect(classificarCandle(candle({ corpo: 20, superior: 10, inferior: 30 })))
      .not.toBe(CandlePattern.MARTELO)
  })

  it('deve devolver null sem amplitude utilizável', () => {
    // Amplitude zero não tem proporção definida; dividir daria Infinity e
    // classificaria qualquer coisa como marubozu.
    expect(classificarCandle({
      precoCorpoCandle: 0, precoSombraSuperior: 0,
      precoSombraInferior: 0, precoAmplitude: 0,
    })).toBeNull()
  })

  it('deve devolver null sem anatomia', () => {
    expect(classificarCandle(null)).toBeNull()
    expect(classificarCandle({ precoAmplitude: 10 })).toBeNull()
  })
})
