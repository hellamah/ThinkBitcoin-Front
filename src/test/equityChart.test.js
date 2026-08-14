import { describe, expect, it } from 'vitest'
import { montarPontosDaCurva, folgaDoEixo } from '../src/utils/equityChart'

const ponto = (capital, emPosicao = false, instante = '2026-01-01T00:00:00Z') => ({
  instante,
  capital,
  emPosicao,
})

describe('utils/equityChart › montarPontosDaCurva', () => {
  it('deve devolver uma série paralela só com os trechos em posição', () => {
    // A série `emPosicao` existe para o gráfico poder pintar por cima apenas
    // onde havia exposição. Fora desses trechos ela precisa ser null — no
    // Chart.js o null interrompe a linha, e um zero ligaria os dois trechos
    // passando pelo fundo do gráfico.
    const p = montarPontosDaCurva(
      [ponto(1000), ponto(1050, true), ponto(1020, true), ponto(1020)],
      1000
    )

    expect(p.capital).toEqual([1000, 1050, 1020, 1020])
    expect(p.emPosicao).toEqual([null, 1050, 1020, null])
  })

  it('deve incluir o capital inicial nos limites mesmo sem a curva tocá-lo', () => {
    // Estratégia que só perdeu: sem a referência, o eixo começaria em 900 e a
    // queda pareceria o percurso inteiro.
    const p = montarPontosDaCurva([ponto(950), ponto(920), ponto(900)], 1000)

    expect(p.minimo).toBe(900)
    expect(p.maximo).toBe(1000)
  })

  it('deve preservar os instantes como rótulos, na ordem recebida', () => {
    const p = montarPontosDaCurva(
      [
        ponto(1000, false, '2026-01-01T00:00:00Z'),
        ponto(1010, false, '2026-01-01T01:00:00Z'),
      ],
      1000
    )

    expect(p.rotulos).toEqual(['2026-01-01T00:00:00Z', '2026-01-01T01:00:00Z'])
  })

  it('deve recusar curva vazia ou sem valor utilizável', () => {
    expect(montarPontosDaCurva([], 1000)).toBeNull()
    expect(montarPontosDaCurva(null, 1000)).toBeNull()
    expect(montarPontosDaCurva([ponto(null), ponto(undefined)], 1000)).toBeNull()
  })
})

describe('utils/equityChart › folgaDoEixo', () => {
  it('deve dar folga proporcional à amplitude', () => {
    expect(folgaDoEixo(900, 1100, 0.1)).toBeCloseTo(20, 10)
  })

  it('deve dar folga mesmo com a curva completamente plana', () => {
    // Simulação sem nenhuma operação: min e max coincidem. Folga zero coloria
    // a linha exatamente sobre a borda do gráfico.
    expect(folgaDoEixo(1000, 1000, 0.08)).toBeCloseTo(80, 10)
    expect(folgaDoEixo(0, 0)).toBe(1)
  })
})
