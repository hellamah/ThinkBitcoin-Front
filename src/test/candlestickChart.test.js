/**
 * Testes de utils/candlestickChart.
 *
 * Cobrem a preparação dos dados do candle. O desenho em si é canvas e fica
 * fora do escopo unitário.
 */
import { describe, expect, it } from 'vitest'
import { construirVelas, faixaDasVelas } from '../src/utils/candlestickChart'

const registro = (horaReferencia, abertura, maior, menor, fechamento) => ({
  horaReferencia,
  precoAbertura: abertura,
  precoMaior: maior,
  precoMenor: menor,
  precoFechamento: fechamento,
})

describe('utils/candlestickChart › construirVelas', () => {
  it('deve alinhar o OHLC à ordem do eixo do gráfico', () => {
    const historico = [
      registro('2026-07-02T00:00:00Z', 20, 25, 18, 24),
      registro('2026-07-01T00:00:00Z', 10, 15, 8, 12),
    ]
    const timestamps = ['2026-07-01T00:00:00Z', '2026-07-02T00:00:00Z']

    // O histórico chega em ordem decrescente; o eixo é cronológico.
    expect(construirVelas(historico, timestamps)).toEqual([
      { abertura: 10, maior: 15, menor: 8, fechamento: 12 },
      { abertura: 20, maior: 25, menor: 18, fechamento: 24 },
    ])
  })

  it('deve devolver null onde o eixo não tem registro correspondente', () => {
    const historico = [registro('2026-07-01T00:00:00Z', 10, 15, 8, 12)]
    const timestamps = ['2026-07-01T00:00:00Z', '2026-07-02T00:00:00Z']

    expect(construirVelas(historico, timestamps)[1]).toBeNull()
  })

  it('deve descartar registros com OHLC incompleto', () => {
    // Sem a máxima, o pavio seria desenhado ancorado no zero.
    const incompleto = { horaReferencia: '2026-07-01T00:00:00Z', precoAbertura: 10, precoMenor: 8, precoFechamento: 12 }

    expect(construirVelas([incompleto], ['2026-07-01T00:00:00Z'])).toEqual([null])
  })

  it('deve tolerar entradas ausentes', () => {
    expect(construirVelas(null, null)).toEqual([])
    expect(construirVelas([null, undefined], ['2026-07-01T00:00:00Z'])).toEqual([null])
  })
})

describe('utils/candlestickChart › faixaDasVelas', () => {
  it('deve cobrir mínima e máxima com folga, não apenas os fechamentos', () => {
    const velas = [
      { abertura: 10, maior: 15, menor: 8, fechamento: 12 },
      { abertura: 12, maior: 20, menor: 11, fechamento: 19 },
    ]
    const faixa = faixaDasVelas(velas)

    expect(faixa.min).toBeLessThan(8)
    expect(faixa.max).toBeGreaterThan(20)
  })

  it('deve ignorar posições vazias do eixo', () => {
    const faixa = faixaDasVelas([null, { abertura: 5, maior: 6, menor: 4, fechamento: 5 }, null])

    expect(faixa.min).toBeLessThan(4)
    expect(faixa.max).toBeGreaterThan(6)
  })

  it('deve produzir faixa não degenerada quando a série é constante', () => {
    const faixa = faixaDasVelas([{ abertura: 100, maior: 100, menor: 100, fechamento: 100 }])

    expect(faixa.max).toBeGreaterThan(faixa.min)
  })

  it('deve retornar null quando não houver vela', () => {
    expect(faixaDasVelas([])).toBeNull()
    expect(faixaDasVelas([null, null])).toBeNull()
    expect(faixaDasVelas(null)).toBeNull()
  })
})
