import { describe, expect, it } from 'vitest'
import { compararMoedas, derivarAnalytics, recortarJanela } from '../src/utils/marketAnalytics'

// A API entrega do mais recente ao mais antigo (ordemAsc=false).
const registro = (over = {}) => ({
  precoFechamento: 100,
  precoPercentualVariacao: 1,
  precoVolatilidadePercentual: 2,
  precoAmplitude: 5,
  precoRatioCompraVenda: 1.5,
  precoFinanceiroPorTrade: 400,
  precoTotalNegociada: 40000,
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

describe('utils/marketAnalytics › recortarJanela', () => {
  // A série carregada traz alguns dias ANTES do período escolhido para que
  // Bollinger e RSI cheguem aquecidos. Esses candles alimentam indicador, mas
  // não são período de análise: contá-los faz o painel anunciar mais candles do
  // que o filtro da tela pediu.
  const comHora = (hora) => registro({ horaReferencia: hora })

  const SERIE = [
    comHora('2026-01-01T05:00:00Z'),
    comHora('2026-01-01T04:00:00Z'),
    comHora('2026-01-01T03:00:00Z'),
    comHora('2026-01-01T02:00:00Z'), // aquecimento
    comHora('2026-01-01T01:00:00Z'), // aquecimento
  ]

  it('deve manter apenas o que está dentro da janela', () => {
    expect(recortarJanela(SERIE, '2026-01-01T03:00:00Z')).toHaveLength(3)
  })

  it('deve devolver a série inteira sem recorte pedido', () => {
    expect(recortarJanela(SERIE, null)).toHaveLength(5)
    expect(recortarJanela(SERIE, undefined)).toHaveLength(5)
  })

  it('deve degradar para a série inteira com recorte inutilizável', () => {
    // Carimbo em formato inesperado quase nunca significa "janela vazia";
    // significa que a leitura falhou. Apagar o painel seria pior do que voltar
    // ao comportamento anterior.
    expect(recortarJanela(SERIE, 'nao e data')).toHaveLength(5)
    expect(recortarJanela(SERIE, '2027-01-01T00:00:00Z')).toHaveLength(5)
  })

  it('deve recusar entrada que não é série', () => {
    expect(recortarJanela(null, '2026-01-01T03:00:00Z')).toEqual([])
  })
})

describe('utils/marketAnalytics › janela do desempenho', () => {
  const comPreco = (hora, preco) =>
    registro({ horaReferencia: hora, precoFechamento: preco })

  // Cronologicamente: 50 → 100 no aquecimento, depois 100 → 110 na janela.
  const SERIE = [
    comPreco('2026-01-01T04:00:00Z', 110),
    comPreco('2026-01-01T03:00:00Z', 100),
    comPreco('2026-01-01T02:00:00Z', 50),
  ]

  it('deve medir o retorno só do período escolhido', () => {
    const semRecorte = derivarAnalytics({
      historicosPorMoeda: { BTC: SERIE },
      fearGreedPorMoeda: { BTC: [] },
      moedasFiltro: ['BTC'],
    })
    // Sem recorte, o retorno pega o salto do aquecimento: 50 → 110.
    expect(semRecorte.desempenho.retorno).toBeCloseTo(120, 6)
    expect(semRecorte.desempenho.amostras).toBe(3)

    const comRecorte = derivarAnalytics({
      historicosPorMoeda: { BTC: SERIE },
      fearGreedPorMoeda: { BTC: [] },
      moedasFiltro: ['BTC'],
      aPartirDe: '2026-01-01T03:00:00Z',
    })
    // Com recorte, só 100 → 110.
    expect(comRecorte.desempenho.retorno).toBeCloseTo(10, 6)
    expect(comRecorte.desempenho.amostras).toBe(2)
  })

  it('deve manter as leituras de estado sobre a série inteira', () => {
    // ATR, VWAP e osciladores precisam do aquecimento; só o desempenho é
    // recortado.
    const r = derivarAnalytics({
      historicosPorMoeda: { BTC: SERIE },
      fearGreedPorMoeda: { BTC: [] },
      moedasFiltro: ['BTC'],
      aPartirDe: '2026-01-01T03:00:00Z',
    })
    // O VWAP percorre os três candles mesmo com a janela pedindo dois.
    expect(r.desempenho.amostras).toBe(2)
    expect(r.vwap.serie).toHaveLength(3)
  })

  it('deve recortar também o comparativo entre moedas', () => {
    const c = compararMoedas(
      { BTC: SERIE, ETH: SERIE },
      ['BTC', 'ETH'],
      '2026-01-01T03:00:00Z'
    )
    c.forEach((linha) => expect(linha.retorno).toBeCloseTo(10, 6))
  })
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

  it('deve medir o ticket contra a mediana do período', () => {
    // Atual 900, mediana dos cinco é 300 → 3×: o volume da hora veio de
    // poucas ordens grandes.
    const r = derivarAnalytics(entrada([
      registro({ precoFinanceiroPorTrade: 900 }),
      registro({ precoFinanceiroPorTrade: 200 }),
      registro({ precoFinanceiroPorTrade: 300 }),
      registro({ precoFinanceiroPorTrade: 300 }),
      registro({ precoFinanceiroPorTrade: 400 }),
    ]))
    expect(r.ticket.mediana).toBe(300)
    expect(r.ticket.razao).toBeCloseTo(3, 6)
  })

  it('deve derivar a contagem de trades do nocional sobre o ticket', () => {
    // O backend não manda a contagem; ela cai de 40000 / 400.
    const r = derivarAnalytics(entrada([
      registro({ precoTotalNegociada: 40000, precoFinanceiroPorTrade: 400 }),
    ]))
    expect(r.ticket.trades).toBe(100)
  })

  it('deve devolver contagem nula sem ticket para dividir', () => {
    const r = derivarAnalytics(entrada([registro({ precoFinanceiroPorTrade: 0 })]))
    expect(r.ticket.trades).toBeNull()
    expect(r.ticket.razao).toBeNull()
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

describe('utils/marketAnalytics › compararMoedas', () => {
  // Cronologicamente 100 → 110 é +10%; 100 → 90 é -10%.
  const historico = (fechamentos, volatilidade = 2) =>
    [...fechamentos].reverse().map((precoFechamento) => ({
      precoFechamento,
      precoVolatilidadePercentual: volatilidade,
      precoVolume: 10,
      precoTotalNegociada: precoFechamento * 10,
      precoPercentualVariacao: 0,
    }))

  const carteira = {
    BTC: historico([100, 110]),
    ETH: historico([100, 90]),
    SOL: historico([100, 130]),
  }

  it('deve ordenar por retorno, maior primeiro', () => {
    const r = compararMoedas(carteira, ['BTC', 'ETH', 'SOL'])
    expect(r.map((m) => m.sigla)).toEqual(['SOL', 'BTC', 'ETH'])
  })

  it('deve trazer as leituras que existem por moeda', () => {
    const r = compararMoedas(carteira, ['BTC', 'ETH'])
    const btc = r.find((m) => m.sigla === 'BTC')
    expect(btc.retorno).toBeCloseTo(10, 6)
    expect(btc.volatilidade).toBe(2)
    expect(btc.desvioVwap).not.toBeNull()
  })

  it('deve devolver null fora do modo comparativo', () => {
    // Com uma moeda o painel de desempenho já cobre, com mais detalhe.
    expect(compararMoedas(carteira, ['BTC'])).toBeNull()
    expect(compararMoedas(carteira, [])).toBeNull()
    expect(compararMoedas(carteira, null)).toBeNull()
  })

  it('deve descartar moeda sem histórico em vez de exibir linha vazia', () => {
    const r = compararMoedas({ ...carteira, XRP: [] }, ['BTC', 'XRP'])
    expect(r.map((m) => m.sigla)).toEqual(['BTC'])
  })

  it('deve devolver null quando nenhuma moeda tem histórico', () => {
    expect(compararMoedas({ BTC: [], ETH: [] }, ['BTC', 'ETH'])).toBeNull()
  })
})

describe('utils/marketAnalytics › fluxo do período contra fluxo de estado', () => {
  // O bloco de fluxo mistura dois tipos de leitura. Dominância atual, ratio e
  // delta do candle corrente são ESTADO. Acumulado e dominância do período
  // SOMAM candle a candle — e a soma tinha a margem de aquecimento dentro,
  // apesar de a tela chamar o número de "no período".

  const HORA = 3600e3
  const INICIO = Date.UTC(2026, 2, 1)
  const horaDe = (i) => new Date(INICIO + i * HORA).toISOString()

  const candle = (i, comprado, vendido) =>
    registro({
      horaReferencia: horaDe(i),
      volumeComprado: comprado,
      volumeVendido: vendido,
      volumeDelta: comprado - vendido,
    })

  // Dez candles: os seis de aquecimento vendem, os quatro da janela compram.
  // Montados em ordem cronológica e invertidos, que é como a API entrega.
  const SERIE = [
    ...Array.from({ length: 6 }, (_, i) => candle(i, 20, 80)),
    ...Array.from({ length: 4 }, (_, i) => candle(6 + i, 80, 20)),
  ].reverse()

  const PRIMEIRO_DA_JANELA = horaDe(6)

  it('deve acumular o delta só dentro da janela, invertendo o sinal', () => {
    const semJanela = derivarAnalytics(entrada(SERIE))
    const comJanela = derivarAnalytics({ ...entrada(SERIE), aPartirDe: PRIMEIRO_DA_JANELA })

    // 6 x (-60) + 4 x (+60) = -120: o aquecimento decidia o sinal sozinho.
    expect(semJanela.fluxo.deltaAcumulado).toBe(-120)
    expect(comJanela.fluxo.deltaAcumulado).toBe(240)
  })

  it('deve medir a dominância do período pedido, não da série carregada', () => {
    const semJanela = derivarAnalytics(entrada(SERIE))
    const comJanela = derivarAnalytics({ ...entrada(SERIE), aPartirDe: PRIMEIRO_DA_JANELA })

    // 440/1000 contra 320/400: "média do período" e o período são coisas
    // diferentes enquanto o aquecimento entra na conta.
    expect(semJanela.fluxo.dominanciaCompradoraPeriodo).toBeCloseTo(44, 6)
    expect(comJanela.fluxo.dominanciaCompradoraPeriodo).toBeCloseTo(80, 6)
  })

  it('não deve mexer nas leituras de estado', () => {
    // O que descreve "agora" sai do candle mais recente e independe da janela.
    const semJanela = derivarAnalytics(entrada(SERIE))
    const comJanela = derivarAnalytics({ ...entrada(SERIE), aPartirDe: PRIMEIRO_DA_JANELA })

    expect(comJanela.fluxo.deltaAtual).toBe(semJanela.fluxo.deltaAtual)
    expect(comJanela.fluxo.dominanciaCompradora).toBe(semJanela.fluxo.dominanciaCompradora)
    expect(comJanela.fluxo.ratioCompraVenda).toBe(semJanela.fluxo.ratioCompraVenda)
    expect(comJanela.volatilidade.mediana).toBe(semJanela.volatilidade.mediana)
    expect(comJanela.ticket.mediana).toBe(semJanela.ticket.mediana)
  })

  it('deve manter os dois cards de acumulado com o mesmo número', () => {
    // "Delta de Volume" e "Delta Acumulado" exibem a mesma soma em cards
    // vizinhos. Eram duas contas independentes; agora saem da mesma.
    const r = derivarAnalytics({ ...entrada(SERIE), aPartirDe: PRIMEIRO_DA_JANELA })
    expect(r.fluxo.deltaAcumulado).toBe(r.fluxo.divergencia.cvd)
  })
})
