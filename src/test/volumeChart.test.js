import { describe, expect, it } from 'vitest'
import { construirVolumes, estiloDasBarras } from '../src/utils/volumeChart'

const CORES = { corAlta: '#4caf50', corBaixa: '#f44336', corDestaque: '#FFD700' }

const vela = (abertura, fechamento) => ({ abertura, fechamento, maior: 0, menor: 0 })

describe('utils/volumeChart › construirVolumes', () => {
  it('deve alinhar o volume ao eixo de timestamps', () => {
    const historico = [
      { horaReferencia: 'B', precoVolume: 200 },
      { horaReferencia: 'A', precoVolume: 100 },
    ]
    expect(construirVolumes(historico, ['A', 'B'])).toEqual([100, 200])
  })

  it('deve deixar buraco onde não há registro', () => {
    const historico = [{ horaReferencia: 'A', precoVolume: 100 }]
    expect(construirVolumes(historico, ['A', 'B', 'C'])).toEqual([100, null, null])
  })

  it('deve tratar volume ausente como buraco, não como zero', () => {
    // Zero afirmaria que não houve negociação naquele candle, o que é uma
    // leitura diferente de "não temos o dado".
    const historico = [
      { horaReferencia: 'A', precoVolume: null },
      { horaReferencia: 'B', precoVolume: 'abc' },
      { horaReferencia: 'C', precoVolume: 0 },
    ]
    expect(construirVolumes(historico, ['A', 'B', 'C'])).toEqual([null, null, 0])
  })

  it('deve tolerar entrada vazia', () => {
    expect(construirVolumes(null, ['A'])).toEqual([null])
    expect(construirVolumes([], null)).toEqual([])
  })
})

describe('utils/volumeChart › estiloDasBarras', () => {
  it('deve tirar a cor da direção da vela correspondente', () => {
    const velas = [vela(10, 12), vela(12, 9)]
    const { fundo } = estiloDasBarras([100, 100], velas, 100, CORES)
    expect(fundo).toEqual(['#4caf50', '#f44336'])
  })

  it('deve destacar apenas o volume acima de 3× a mediana', () => {
    const velas = [vela(10, 12), vela(10, 12), vela(10, 12)]
    const { borda, espessura } = estiloDasBarras([100, 301, 299], velas, 100, CORES)
    expect(borda).toEqual(['transparent', '#FFD700', 'transparent'])
    expect(espessura).toEqual([0, 2, 0])
  })

  it('não deve destacar nada sem mediana utilizável', () => {
    const velas = [vela(10, 12)]
    expect(estiloDasBarras([9999], velas, 0, CORES).espessura).toEqual([0])
    expect(estiloDasBarras([9999], velas, null, CORES).espessura).toEqual([0])
  })

  it('deve usar a cor de alta quando não há vela para consultar', () => {
    // Ausência de direção não significa queda.
    const { fundo } = estiloDasBarras([100], [null], 100, CORES)
    expect(fundo).toEqual(['#4caf50'])
  })

  it('deve tratar doji como alta, igual ao plugin de candle', () => {
    // fechamento === abertura desenha vela de alta no candlestickPlugin.
    const { fundo } = estiloDasBarras([100], [vela(10, 10)], 100, CORES)
    expect(fundo).toEqual(['#4caf50'])
  })

  it('deve devolver listas vazias sem volume', () => {
    expect(estiloDasBarras([], [], 100, CORES)).toEqual({ fundo: [], borda: [], espessura: [] })
    expect(estiloDasBarras(null, null, 100, CORES).fundo).toEqual([])
  })
})
