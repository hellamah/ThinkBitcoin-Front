import { describe, expect, it } from 'vitest'
import { montarPontosDaCurva, folgaDoEixo } from '../src/utils/equityChart'

const ponto = (
  capital,
  emPosicao = false,
  instante = '2026-01-01T00:00:00Z',
  precoFechamento = null
) => ({
  instante,
  capital,
  emPosicao,
  precoFechamento,
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

  it('deve desenhar o buy and hold em unidades de capital, partindo do inicial', () => {
    // As duas linhas dividem o mesmo eixo, então a régua precisa sair em
    // capital e não em percentual. E precisa PARTIR do capital inicial: se
    // começassem em pontos diferentes, a distância entre elas mostraria
    // diferença de escala em vez de diferença de desempenho.
    const p = montarPontosDaCurva(
      [
        ponto(1000, false, '2026-01-01T00:00:00Z', 100),
        ponto(1000, false, '2026-01-01T01:00:00Z', 110),
        ponto(1000, false, '2026-01-01T02:00:00Z', 120),
      ],
      1000
    )

    expect(p.buyAndHold).toEqual([1000, 1100, 1200])
  })

  it('deve medir a régua a partir do primeiro preço, igual à métrica do card', () => {
    // O card calcula buyAndHold do primeiro ao último fechamento da janela. Se
    // o gráfico usasse outro ponto de partida, a tela discutiria consigo mesma
    // sobre o mesmo número — a linha terminaria num lugar que o card desmente.
    const p = montarPontosDaCurva(
      [
        ponto(1000, false, '2026-01-01T00:00:00Z', 200),
        ponto(1000, false, '2026-01-01T01:00:00Z', 150),
      ],
      1000
    )

    const buyHoldDoCard = ((150 - 200) / 200) * 100
    const finalDaLinha = p.buyAndHold[p.buyAndHold.length - 1]
    expect(((finalDaLinha - 1000) / 1000) * 100).toBeCloseTo(buyHoldDoCard, 10)
  })

  it('deve caber a régua dentro dos limites do eixo', () => {
    // Fora dos limites, uma alta forte do ativo sairia cortada pelo topo e a
    // estratégia parada pareceria estar acompanhando o mercado.
    const p = montarPontosDaCurva(
      [
        ponto(1000, false, '2026-01-01T00:00:00Z', 100),
        ponto(1000, false, '2026-01-01T01:00:00Z', 300),
      ],
      1000
    )

    expect(p.maximo).toBeGreaterThanOrEqual(3000)
  })

  it('deve sair toda null quando a curva não traz preço', () => {
    // Curva antiga, ou candle sem fechamento utilizável: o gráfico simplesmente
    // não desenha a régua. Inventar um preço ali seria desenhar uma comparação
    // que ninguém mediu.
    const p = montarPontosDaCurva([ponto(1000), ponto(1050)], 1000)

    expect(p.buyAndHold).toEqual([null, null])
    // E sem a régua os limites continuam sendo os de antes.
    expect(p.maximo).toBe(1050)
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
