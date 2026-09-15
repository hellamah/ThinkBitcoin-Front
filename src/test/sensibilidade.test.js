import { describe, expect, it } from 'vitest'
import { mapaDeSensibilidade, vizinhancaDe, STOPS_MAPA, ALVOS_MAPA } from '../src/utils/sensibilidade'
import { CandlePattern } from '../src/utils/candlePatterns'
import { serie, parado } from './fixtures/candlesSimulacao'

const registros = () => {
  const defs = []
  for (let i = 0; i < 80; i++) {
    const p = 100 + Math.sin(i / 4) * 6
    defs.push({ abertura: p, maior: p + 3, menor: p - 3, fechamento: p + 1, martelo: i % 6 === 0 })
  }
  return serie(defs)
}

describe('utils/sensibilidade › mapa', () => {
  it('deve ter uma célula por combinação de stop e alvo', () => {
    const mapa = mapaDeSensibilidade(registros(), {
      sinalEntrada: CandlePattern.MARTELO,
      saidaPorTempo: 5,
    })
    expect(mapa.celulas).toHaveLength(STOPS_MAPA.length)
    mapa.celulas.forEach((linha) => expect(linha).toHaveLength(ALVOS_MAPA.length))
  })

  it('deve deixar vazia a célula sem nenhuma regra de saída', () => {
    // Sem tempo, sem stop e sem alvo o motor recusa — a célula não finge zero.
    const mapa = mapaDeSensibilidade(registros(), {
      sinalEntrada: CandlePattern.MARTELO,
      saidaPorTempo: null,
    })
    expect(mapa.celulas[0][0].alfa).toBeNull()
    expect(mapa.celulas[1][1].alfa).not.toBeNull()
  })

  it('deve devolver null quando nada opera', () => {
    const semSinal = serie(Array.from({ length: 20 }, () => parado(100)))
    expect(mapaDeSensibilidade(semSinal, { sinalEntrada: CandlePattern.MARTELO })).toBeNull()
  })
})

describe('utils/sensibilidade › vizinhança', () => {
  const celula = (alfa) => ({ alfa })
  const mapa = {
    stops: [1, 2, 3],
    alvos: [1, 2, 3],
    celulas: [
      [celula(1), celula(-1), celula(2)],
      [celula(3), celula(4), celula(null)],
      [celula(-2), celula(5), celula(1)],
    ],
  }

  it('deve contar as vizinhas de mesmo sinal, ignorando as vazias', () => {
    expect(vizinhancaDe(mapa, 2, 2)).toEqual({ concordam: 5, total: 7 })
  })

  it('deve olhar só as vizinhas que existem na borda', () => {
    expect(vizinhancaDe(mapa, 1, 1)).toEqual({ concordam: 2, total: 3 })
  })

  it('deve devolver null fora da grade', () => {
    expect(vizinhancaDe(mapa, 7, 2)).toBeNull()
  })
})
