import { describe, expect, it } from 'vitest'
import {
  calcularVwap,
  desvioDoVwap,
  detectarCruzamentos,
  resumirVwap,
  VwapSignal,
} from '../src/utils/vwap'

// nocional = preço × volume, como o backend entrega.
const reg = (fechamento, volume, precoNegociado = fechamento) => ({
  precoFechamento: fechamento,
  precoVolume: volume,
  precoTotalNegociada: precoNegociado * volume,
})

// A API entrega do mais recente ao mais antigo.
const comoDaApi = (cronologico) => [...cronologico].reverse()

describe('utils/vwap › calcularVwap', () => {
  it('deve acumular nocional e volume, não tirar média dos VWAPs por candle', () => {
    // 10 a $100 e 90 a $200: a média simples daria $150, mas o peso está no
    // segundo candle, então o VWAP acumulado é $190.
    const v = calcularVwap([reg(100, 10), reg(200, 90)])
    expect(v[0]).toBeCloseTo(100, 10)
    expect(v[1]).toBeCloseTo(190, 10)
  })

  it('deve devolver null enquanto não houver volume acumulado', () => {
    expect(calcularVwap([reg(100, 0)])).toEqual([null])
  })

  it('deve ignorar candle sem nocional em vez de deslocar a média', () => {
    // Somar volume sem o nocional correspondente afundaria o VWAP para sempre,
    // porque o acumulado nunca se recupera.
    const v = calcularVwap([
      reg(100, 10),
      { precoFechamento: 100, precoVolume: 10, precoTotalNegociada: null },
      reg(100, 10),
    ])
    expect(v[2]).toBeCloseTo(100, 10)
  })

  it('deve tolerar entrada vazia', () => {
    expect(calcularVwap([])).toEqual([])
    expect(calcularVwap(null)).toEqual([])
  })
})

describe('utils/vwap › desvioDoVwap', () => {
  it('deve medir a distância percentual do fechamento ao VWAP', () => {
    const crono = [reg(100, 10), reg(110, 10)]
    const d = desvioDoVwap(crono, calcularVwap(crono))
    // VWAP acumulado no segundo candle é 105; 110 está 4,76% acima.
    expect(d[1]).toBeCloseTo(4.7619, 3)
  })

  it('deve devolver null sem VWAP utilizável', () => {
    expect(desvioDoVwap([reg(100, 10)], [null])).toEqual([null])
    expect(desvioDoVwap([reg(100, 10)], [0])).toEqual([null])
  })
})

describe('utils/vwap › detectarCruzamentos', () => {
  it('deve marcar a travessia para cima', () => {
    expect(detectarCruzamentos([-1, -0.5, 0.3])[2]).toBe(VwapSignal.CROSS_UP)
  })

  it('deve marcar a travessia para baixo', () => {
    expect(detectarCruzamentos([1, 0.5, -0.3])[2]).toBe(VwapSignal.CROSS_DOWN)
  })

  it('não deve marcar quem permanece do mesmo lado', () => {
    // Estado não é evento: ficar acima o tempo todo não é acontecimento.
    expect(detectarCruzamentos([1, 2, 3, 2]).every((m) => m === null)).toBe(true)
  })

  it('deve tratar zero exato como não estando acima', () => {
    // Encostar no VWAP não é atravessar; sair dele para cima é.
    expect(detectarCruzamentos([0, 0.5])[1]).toBe(VwapSignal.CROSS_UP)
    expect(detectarCruzamentos([0, -0.5])[1]).toBe(VwapSignal.CROSS_DOWN)
  })

  it('não deve avaliar a primeira posição, que não tem anterior', () => {
    expect(detectarCruzamentos([5])[0]).toBeNull()
  })

  it('deve pular buracos sem inventar travessia', () => {
    expect(detectarCruzamentos([-1, null, 1])[2]).toBeNull()
  })

  it('deve tolerar entrada vazia', () => {
    expect(detectarCruzamentos([])).toEqual([])
    expect(detectarCruzamentos(null)).toEqual([])
  })
})

describe('utils/vwap › resumirVwap', () => {
  it('deve reportar o estado do candle mais recente', () => {
    const r = resumirVwap(comoDaApi([reg(100, 10), reg(110, 10)]))
    expect(r.vwapAtual).toBeCloseTo(105, 10)
    expect(r.desvioAtual).toBeCloseTo(4.7619, 3)
    expect(r.acima).toBe(true)
  })

  it('deve indicar quando o preço está abaixo do VWAP', () => {
    const r = resumirVwap(comoDaApi([reg(110, 10), reg(100, 10)]))
    expect(r.acima).toBe(false)
    expect(r.desvioAtual).toBeLessThan(0)
  })

  it('deve tolerar entrada vazia', () => {
    expect(resumirVwap([])).toBeNull()
    expect(resumirVwap(null)).toBeNull()
  })
})
