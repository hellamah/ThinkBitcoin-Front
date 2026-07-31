import { describe, expect, it } from 'vitest'
import { derivarAnalytics } from '../src/utils/marketAnalytics'

// A API entrega do mais recente ao mais antigo (ordemAsc=false).
const registro = (over = {}) => ({
  precoFechamento: 100,
  precoPercentualVariacao: 1,
  precoVolatilidadePercentual: 2,
  precoAmplitude: 5,
  precoRatioCompraVenda: 1.5,
  volumeComprado: 60,
  volumeVendido: 40,
  volumeDelta: 20,
  dominanciaCompradoraPercentual: 60,
  dominanciaVendedoraPercentual: 40,
  ...over,
})

const entrada = (historico, fg = []) => ({
  historicosPorMoeda: { BTC: historico },
  fearGreedPorMoeda: { BTC: fg },
  moedasFiltro: ['BTC'],
})

describe('utils/marketAnalytics › derivarAnalytics', () => {
  it('deve ler o fluxo do registro mais recente, que é o índice 0', () => {
    const r = derivarAnalytics(entrada([
      registro({ dominanciaCompradoraPercentual: 70 }),
      registro({ dominanciaCompradoraPercentual: 10 }),
    ]))
    expect(r.fluxo.dominanciaCompradora).toBe(70)
  })

  it('deve acumular o delta do período inteiro', () => {
    const r = derivarAnalytics(entrada([
      registro({ volumeDelta: 20 }),
      registro({ volumeDelta: -5 }),
    ]))
    expect(r.fluxo.deltaAcumulado).toBe(15)
  })

  it('deve calcular a dominância compradora sobre o volume do período', () => {
    // 60+30 comprado contra 40+70 vendido → 90/200.
    const r = derivarAnalytics(entrada([
      registro({ volumeComprado: 60, volumeVendido: 40 }),
      registro({ volumeComprado: 30, volumeVendido: 70 }),
    ]))
    expect(r.fluxo.dominanciaCompradoraPeriodo).toBeCloseTo(45, 6)
  })

  it('deve devolver dominância nula quando não houve volume', () => {
    const r = derivarAnalytics(entrada([registro({ volumeComprado: 0, volumeVendido: 0 })]))
    expect(r.fluxo.dominanciaCompradoraPeriodo).toBeNull()
  })

  it('deve medir a volatilidade contra a mediana do período', () => {
    // Atual 6, mediana dos cinco valores é 2 → 3×.
    const r = derivarAnalytics(entrada([
      registro({ precoVolatilidadePercentual: 6 }),
      registro({ precoVolatilidadePercentual: 1 }),
      registro({ precoVolatilidadePercentual: 2 }),
      registro({ precoVolatilidadePercentual: 2 }),
      registro({ precoVolatilidadePercentual: 3 }),
    ]))
    expect(r.volatilidade.mediana).toBe(2)
    expect(r.volatilidade.razao).toBeCloseTo(3, 6)
  })

  it('deve devolver razão nula sem mediana utilizável', () => {
    const r = derivarAnalytics(entrada([registro({ precoVolatilidadePercentual: 0 })]))
    expect(r.volatilidade.razao).toBeNull()
  })

  it('deve inverter a série do sparkline para ler do antigo ao atual', () => {
    const r = derivarAnalytics(entrada([registro()], [
      { valor: 70 }, { valor: 60 }, { valor: 50 },
    ]))
    expect(r.fearGreed.valor).toBe(70)
    expect(r.fearGreed.serie).toEqual([50, 60, 70])
  })

  it('deve limitar o sparkline e manter o corte no lado mais antigo', () => {
    // 50 leituras, 40 pontos: sobram as 40 mais recentes, em ordem crescente.
    const fg = Array.from({ length: 50 }, (_, i) => ({ valor: i }))
    const r = derivarAnalytics(entrada([registro()], fg))
    expect(r.fearGreed.serie).toHaveLength(40)
    expect(r.fearGreed.serie[39]).toBe(0)
    expect(r.fearGreed.serie[0]).toBe(39)
  })

  it('deve descartar leitura de sentimento não numérica sem virar zero', () => {
    const r = derivarAnalytics(entrada([registro()], [
      { valor: 70 }, { valor: null }, { valor: 50 },
    ]))
    expect(r.fearGreed.serie).toEqual([50, 70])
  })

  it('deve devolver sentimento nulo quando não há leitura', () => {
    expect(derivarAnalytics(entrada([registro()], [])).fearGreed).toBeNull()
  })

  it('deve recusar modo comparativo', () => {
    // Somar fluxo de moedas diferentes não produz número interpretável.
    expect(derivarAnalytics({
      historicosPorMoeda: { BTC: [registro()], ETH: [registro()] },
      fearGreedPorMoeda: {},
      moedasFiltro: ['BTC', 'ETH'],
    })).toBeNull()
  })

  it('deve recusar entrada sem histórico', () => {
    expect(derivarAnalytics(entrada([]))).toBeNull()
    expect(derivarAnalytics({ moedasFiltro: [] })).toBeNull()
    expect(derivarAnalytics({ moedasFiltro: null })).toBeNull()
  })
})
