import { describe, expect, it } from 'vitest'
import {
  calcularCvd,
  detectarDivergencias,
  DivergenceKind,
  resumirFluxo,
} from '../src/utils/flowDivergence'

const reg = (precoFechamento, volumeDelta) => ({ precoFechamento, volumeDelta })

// A API entrega do mais recente ao mais antigo; os testes descrevem a série
// em ordem cronológica e invertem na entrada.
const comoDaApi = (cronologico) => [...cronologico].reverse()

// Janela de 5 candles: os cinco primeiros nunca são avaliados. Para uma
// divergência cair no índice 5, a série precisa de pelo menos 6 posições.
const serie = (precos, deltas) => precos.map((p, i) => reg(p, deltas[i]))

describe('utils/flowDivergence › calcularCvd', () => {
  it('deve acumular o delta ao longo da série', () => {
    expect(calcularCvd([reg(1, 10), reg(1, -4), reg(1, 6)])).toEqual([10, 6, 12])
  })

  it('deve tratar delta ausente como zero sem interromper o acúmulo', () => {
    // Aqui zero é o correto: sem leitura de delta, o acumulado não anda,
    // mas os candles seguintes continuam somando sobre o que já havia.
    expect(calcularCvd([reg(1, 10), reg(1, null), reg(1, 5)])).toEqual([10, 10, 15])
  })

  it('deve tolerar entrada vazia', () => {
    expect(calcularCvd([])).toEqual([])
    expect(calcularCvd(null)).toEqual([])
  })
})

describe('utils/flowDivergence › detectarDivergencias', () => {
  it('deve marcar divergência baixista quando o preço sobe sem fluxo', () => {
    // Preço de 100 a 110 (+10%) enquanto o CVD só cai.
    const marcas = detectarDivergencias(
      comoDaApi(serie([100, 102, 104, 106, 108, 110], [0, -20, -20, -20, -20, -20])),
      100
    )
    expect(marcas[5]).toBe(DivergenceKind.BEARISH)
  })

  it('deve marcar divergência altista quando o preço cai sem fluxo vendedor', () => {
    const marcas = detectarDivergencias(
      comoDaApi(serie([110, 108, 106, 104, 102, 100], [0, 20, 20, 20, 20, 20])),
      100
    )
    expect(marcas[5]).toBe(DivergenceKind.BULLISH)
  })

  it('não deve marcar quando preço e fluxo concordam', () => {
    const marcas = detectarDivergencias(
      comoDaApi(serie([100, 102, 104, 106, 108, 110], [0, 20, 20, 20, 20, 20])),
      100
    )
    expect(marcas[5]).toBeNull()
  })

  it('deve ignorar movimento de preço irrelevante', () => {
    // +0,2% no total: abaixo do piso de 0,5%, então não é leitura.
    const marcas = detectarDivergencias(
      comoDaApi(serie([100, 100, 100.1, 100.1, 100.2, 100.2], [0, -50, -50, -50, -50, -50])),
      100
    )
    expect(marcas[5]).toBeNull()
  })

  it('deve ignorar movimento de fluxo irrelevante', () => {
    // Fluxo de -10 contra mediana 100 = 0,1×, abaixo do piso de 0,5×.
    const marcas = detectarDivergencias(
      comoDaApi(serie([100, 102, 104, 106, 108, 110], [0, -2, -2, -2, -2, -2])),
      100
    )
    expect(marcas[5]).toBeNull()
  })

  it('não deve avaliar os candles antes de completar a janela', () => {
    const marcas = detectarDivergencias(
      comoDaApi(serie([100, 102, 104, 106, 108, 110], [0, -20, -20, -20, -20, -20])),
      100
    )
    expect(marcas.slice(0, 5)).toEqual([null, null, null, null, null])
  })

  it('deve devolver tudo nulo sem régua de volume', () => {
    // Sem mediana não dá para dizer se o fluxo se moveu de forma relevante;
    // marcar tudo seria pior do que não marcar nada.
    const entrada = comoDaApi(serie([100, 102, 104, 106, 108, 110], [0, -20, -20, -20, -20, -20]))
    expect(detectarDivergencias(entrada, 0).every((m) => m === null)).toBe(true)
    expect(detectarDivergencias(entrada, null).every((m) => m === null)).toBe(true)
  })

  it('deve devolver uma marca por candle', () => {
    const entrada = comoDaApi(serie([100, 102, 104, 106, 108, 110], [0, -20, -20, -20, -20, -20]))
    expect(detectarDivergencias(entrada, 100)).toHaveLength(6)
  })

  it('deve tolerar entrada vazia', () => {
    expect(detectarDivergencias([], 100)).toEqual([])
    expect(detectarDivergencias(null, 100)).toEqual([])
  })
})

describe('utils/flowDivergence › resumirFluxo', () => {
  it('deve reportar o acumulado e a divergência do candle mais recente', () => {
    const r = resumirFluxo(
      comoDaApi(serie([100, 102, 104, 106, 108, 110], [0, -20, -20, -20, -20, -20])),
      100
    )
    expect(r.cvd).toBe(-100)
    expect(r.divergenciaAtual).toBe(DivergenceKind.BEARISH)
    expect(r.ocorrencias).toBe(1)
  })

  it('deve reportar divergência nula quando o candle atual não tem', () => {
    const r = resumirFluxo(
      comoDaApi(serie([100, 102, 104, 106, 108, 110], [0, 20, 20, 20, 20, 20])),
      100
    )
    expect(r.divergenciaAtual).toBeNull()
    expect(r.cvd).toBe(100)
  })

  it('deve tolerar entrada vazia', () => {
    expect(resumirFluxo([], 100)).toBeNull()
    expect(resumirFluxo(null, 100)).toBeNull()
  })
})

describe('utils/flowDivergence › resumirFluxo dentro da janela', () => {
  // O acumulado responde "quanta compra líquida entrou na janela que eu
  // escolhi". A série carregada, porém, traz dias a mais só para aquecer os
  // indicadores — e somá-los faz o card responder por um período que ninguém
  // pediu. Num preset de 24 horas, os três dias de aquecimento são o triplo da
  // janela.

  const HORA = 3600e3
  const INICIO = Date.UTC(2026, 2, 1)
  const horaDe = (i) => new Date(INICIO + i * HORA).toISOString()

  /** Dez candles horários; os seis primeiros são aquecimento. */
  const dezCandles = (precos, deltas) =>
    comoDaApi(
      precos.map((p, i) => ({
        precoFechamento: p,
        volumeDelta: deltas[i],
        horaReferencia: horaDe(i),
      }))
    )

  const PRIMEIRO_DA_JANELA = horaDe(6)

  // Aquecimento vendendo forte, janela comprando: o sinal do acumulado depende
  // inteiramente de onde a conta começa.
  const PLANO = [100, 100, 100, 100, 100, 100, 100, 100, 100, 100]
  const DELTAS = [-50, -50, -50, -50, -50, -50, 10, 10, 10, 10]

  it('deve somar a série inteira quando não há janela', () => {
    // Comportamento anterior, preservado: sem `aPartirDe`, o período é tudo.
    expect(resumirFluxo(dezCandles(PLANO, DELTAS), 100).cvd).toBe(-260)
  })

  it('deve somar apenas a janela escolhida, invertendo o sinal do card', () => {
    const r = resumirFluxo(dezCandles(PLANO, DELTAS), 100, { aPartirDe: PRIMEIRO_DA_JANELA })
    // -260 contra +40: o card dizia "venda líquida" num período que só comprou.
    expect(r.cvd).toBe(40)
  })

  it('deve rebasear o sparkline para zero no início da janela', () => {
    const r = resumirFluxo(dezCandles(PLANO, DELTAS), 100, { aPartirDe: PRIMEIRO_DA_JANELA })
    // Sem o rebase a curva começaria em -290 e a forma dela descreveria o
    // aquecimento, não o período.
    expect(r.serie).toEqual([10, 20, 30, 40])
  })

  it('deve continuar detectando divergência no primeiro candle da janela', () => {
    // O detector compara janelas de cinco candles. O primeiro candle exibido só
    // pode ser avaliado porque os anteriores continuam na série — é a diferença
    // entre recortar ANTES de calcular e recortar depois.
    const precos = [100, 100, 101, 102, 103, 104, 105, 105, 105, 105]
    const deltas = new Array(10).fill(-50)

    const comAquecimento = resumirFluxo(dezCandles(precos, deltas), 100, {
      aPartirDe: PRIMEIRO_DA_JANELA,
    })
    expect(comAquecimento.ocorrencias).toBeGreaterThan(0)

    // Prova por contraste: recortada antes, a mesma janela não vê divergência
    // nenhuma — os candles que davam a referência deixaram de existir.
    const jaCortada = dezCandles(precos, deltas).slice(0, 4)
    expect(resumirFluxo(jaCortada, 100).ocorrencias).toBe(0)
  })

  it('deve degradar para a série inteira com recorte inutilizável', () => {
    // Mesma escolha do recortarJanela: carimbo em formato inesperado ou janela
    // vazia não pode apagar o painel.
    const serieToda = dezCandles(PLANO, DELTAS)
    expect(resumirFluxo(serieToda, 100, { aPartirDe: 'nao e data' }).cvd).toBe(-260)
    expect(resumirFluxo(serieToda, 100, { aPartirDe: horaDe(99) }).cvd).toBe(-260)
  })
})
