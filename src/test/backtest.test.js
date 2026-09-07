import { describe, expect, it } from 'vitest'
import {
  simular,
  dividirParaValidacao,
  compararEstrategias,
  riscoDaCurva,
  stopPorAtr,
  CUSTO_PADRAO_PERCENTUAL,
  FRACAO_VALIDACAO_PADRAO,
  ATR_STOP_MINIMO_PERCENTUAL,
  ATR_STOP_MAXIMO_PERCENTUAL,
} from '../src/utils/backtest'
import { montarSerieDeSinais } from '../src/utils/signalLab'
import { montarPontosDaCurva } from '../src/utils/equityChart'
import { ExitReason, StopMode, TradeDirection } from '../src/utils/enums'
import { ATR_PERIOD, calcularAtrSerie } from '../src/utils/marketStats'
import { CandlePattern } from '../src/utils/candlePatterns'

// O martelo é o sinal de entrada de toda a suíte: é puramente geométrico e
// avaliado candle a candle, então dá para colocá-lo numa posição exata sem
// depender do resto da série. Divergência, VWAP e osciladores dependem de
// janela e não serviriam para cravar "o sinal está NESTE candle".
const HORA_MS = 3600000

const candle = ({
  abertura,
  maior,
  menor,
  fechamento,
  hora,
  martelo = false,
  estrela = false,
  volume = 100,
  // A amplitude alimenta DUAS coisas: a proporção que classifica o candle e o
  // ATR. Por padrão ela acompanha a geometria fixa do padrão (42 no martelo,
  // 100 no neutro), porque é isso que a maioria dos casos precisa. Quem testa
  // volatilidade passa o valor explicitamente.
  amplitude = null,
}) => ({
  precoAbertura: abertura,
  precoMaior: maior,
  precoMenor: menor,
  precoFechamento: fechamento,
  precoVolume: volume,
  precoTotalNegociada: volume * fechamento,
  horaReferencia: hora,
  // Sombra inferior ≥ 2× o corpo e maior que a superior: martelo.
  // Corpo no meio da amplitude, sombras iguais: neutro.
  precoCorpoCandle: martelo || estrela ? 10 : 50,
  // Estrela cadente e o espelho do martelo: sombra SUPERIOR longa.
  precoSombraSuperior: estrela ? 30 : martelo ? 2 : 25,
  precoSombraInferior: martelo ? 30 : estrela ? 2 : 25,
  precoAmplitude: amplitude ?? (martelo || estrela ? 42 : 100),
  // Constantes em toda a série para que nenhuma anomalia dispare sem ser
  // pedida: desvio zero na variação, razão 1 no volume e no ticket.
  precoPercentualVariacao: 0,
  precoFinanceiroPorTrade: 10,
  volumeDelta: 0,
})

/**
 * Monta a série na ordem da API a partir de definições cronológicas.
 *
 * @param {Array<object>} defs - Um candle por hora, do mais antigo ao mais novo.
 * @param {{inicio?: string, sufixoZ?: boolean, saltos?: object}} opcoes
 *   `saltos` mapeia índice → horas puladas antes daquele candle.
 */
const serie = (defs, { inicio = '2026-01-01T00:00:00Z', sufixoZ = true, saltos = {} } = {}) => {
  const base = new Date(inicio).getTime()
  let deslocamento = 0
  const cronologico = defs.map((d, i) => {
    deslocamento += (saltos[i] ?? 1) - 1
    const t = new Date(base + (i + deslocamento) * HORA_MS).toISOString()
    return candle({ ...d, hora: sufixoZ ? t : t.replace('Z', '') })
  })
  // A API entrega do mais recente ao mais antigo.
  return [...cronologico].reverse()
}

// Candle parado, sem sinal: preenche a série em volta do que está sendo medido.
const parado = (preco) => ({
  abertura: preco,
  maior: preco,
  menor: preco,
  fechamento: preco,
})

const PADRAO = { sinalEntrada: CandlePattern.MARTELO, custoPercentual: 0 }

describe('utils/backtest › causalidade da entrada', () => {
  it('deve entrar na ABERTURA do candle seguinte, não no fechamento do sinal', () => {
    // O martelo fecha em 100. O candle seguinte abre em 110 — um salto que só
    // existe para separar as duas hipóteses: entrar no fechamento do sinal
    // renderia +10%, entrar na abertura do próximo rende 0.
    const r = simular(
      serie([
        { ...parado(100), martelo: true },
        { abertura: 110, maior: 110, menor: 110, fechamento: 110 },
        parado(110),
      ]),
      { ...PADRAO, saidaPorTempo: 1 }
    )

    expect(r.trades).toHaveLength(1)
    expect(r.trades[0].precoEntrada).toBe(110)
    expect(r.trades[0].indiceEntrada).toBe(1)
    expect(r.trades[0].retornoLiquido).toBeCloseTo(0, 10)
  })

  it('não deve abrir com sinal no último candle', () => {
    // Não há candle seguinte para executar a entrada.
    const r = simular(
      serie([parado(100), parado(100), { ...parado(100), martelo: true }]),
      { ...PADRAO, saidaPorTempo: 1 }
    )

    expect(r.trades).toHaveLength(0)
  })

  it('deve segurar exatamente o número de candles pedido', () => {
    // Entrada na abertura do candle 1; segurar 3 candles é sair no fechamento
    // do candle 3.
    const r = simular(
      serie([
        { ...parado(100), martelo: true },
        parado(101), parado(102), parado(103), parado(104),
      ]),
      { ...PADRAO, saidaPorTempo: 3 }
    )

    expect(r.trades[0].indiceEntrada).toBe(1)
    expect(r.trades[0].indiceSaida).toBe(3)
    expect(r.trades[0].barrasSeguradas).toBe(3)
    expect(r.trades[0].motivoSaida).toBe(ExitReason.TEMPO)
  })
})

describe('utils/backtest › saídas', () => {
  it('deve fechar pelo stop quando o candle toca stop e alvo', () => {
    // Entrada em 100, stop em 98, alvo em 102. O candle vai de 95 a 105:
    // tocou os dois. O OHLC não diz qual veio primeiro — e supor o alvo é a
    // escolha que faz qualquer estratégia parecer boa.
    const r = simular(
      serie([
        { ...parado(100), martelo: true },
        { abertura: 100, maior: 105, menor: 95, fechamento: 100 },
        parado(100),
      ]),
      { ...PADRAO, saidaPorTempo: null, stopPercentual: 2, alvoPercentual: 2 }
    )

    expect(r.trades[0].motivoSaida).toBe(ExitReason.STOP)
    expect(r.trades[0].precoSaida).toBeCloseTo(98, 10)
    expect(r.trades[0].retornoLiquido).toBeCloseTo(-2, 10)
  })

  it('deve fechar no alvo quando só o alvo é tocado', () => {
    const r = simular(
      serie([
        { ...parado(100), martelo: true },
        { abertura: 100, maior: 105, menor: 99.5, fechamento: 104 },
        parado(104),
      ]),
      { ...PADRAO, saidaPorTempo: null, stopPercentual: 2, alvoPercentual: 2 }
    )

    expect(r.trades[0].motivoSaida).toBe(ExitReason.ALVO)
    expect(r.trades[0].precoSaida).toBeCloseTo(102, 10)
  })

  it('deve marcar posição aberta no fim da janela e mantê-la fora do win rate', () => {
    // Segurar 10 candles numa série que acaba antes disso.
    const r = simular(
      serie([{ ...parado(100), martelo: true }, parado(110), parado(120)]),
      { ...PADRAO, saidaPorTempo: 10 }
    )

    expect(r.trades).toHaveLength(1)
    expect(r.trades[0].motivoSaida).toBe(ExitReason.FIM_DA_SERIE)
    // O trade existe e move a curva, mas não é acerto nem erro: não terminou.
    expect(r.metricas.totalTrades).toBe(1)
    expect(r.metricas.tradesConcluidos).toBe(0)
    expect(r.metricas.winRate).toBeNull()
    expect(r.metricas.intervalo).toBeNull()
  })
})

describe('utils/backtest › custo', () => {
  it('deve cobrar nas duas pernas de uma compra', () => {
    // Entrada e saída no mesmo preço: todo o resultado é custo.
    const r = simular(
      serie([{ ...parado(100), martelo: true }, parado(100), parado(100)]),
      { sinalEntrada: CandlePattern.MARTELO, saidaPorTempo: 1, custoPercentual: 0.1 }
    )

    // entrada efetiva 100,1 e saída efetiva 99,9 → (99,9-100,1)/100,1.
    expect(r.trades[0].retornoLiquido).toBeCloseTo(-0.1998002, 6)
    expect(r.trades[0].retornoBruto).toBeCloseTo(0, 10)
    expect(r.trades[0].custoPago).toBeGreaterThan(0)
  })

  it('deve cobrar contra o operador também na venda', () => {
    // Vendido, o custo entra pelo outro lado: vende mais barato, recompra mais
    // caro. O sinal do resultado tem de ser o mesmo da compra.
    const r = simular(
      serie([{ ...parado(100), martelo: true }, parado(100), parado(100)]),
      {
        sinalEntrada: CandlePattern.MARTELO,
        direcao: TradeDirection.VENDA,
        saidaPorTempo: 1,
        custoPercentual: 0.1,
      }
    )

    expect(r.trades[0].retornoLiquido).toBeLessThan(0)
    expect(r.trades[0].retornoLiquido).toBeCloseTo(-0.2002002, 6)
  })

  it('deve usar 0,1% por perna como padrão', () => {
    expect(CUSTO_PADRAO_PERCENTUAL).toBe(0.1)
  })
})

describe('utils/backtest › direção', () => {
  const QUEDA = [
    { ...parado(100), martelo: true },
    parado(100),
    parado(90),
  ]

  it('deve perder comprado numa queda', () => {
    const r = simular(serie(QUEDA), { ...PADRAO, saidaPorTempo: 2 })
    expect(r.trades[0].retornoLiquido).toBeCloseTo(-10, 6)
  })

  it('deve ganhar vendido na mesma queda', () => {
    const r = simular(serie(QUEDA), {
      ...PADRAO,
      direcao: TradeDirection.VENDA,
      saidaPorTempo: 2,
    })
    expect(r.trades[0].retornoLiquido).toBeCloseTo(10, 6)
  })

  it('deve espelhar o stop na venda', () => {
    // Vendido em 100 com stop de 2%: o stop fica ACIMA, em 102, e dispara
    // quando a máxima o alcança.
    const r = simular(
      serie([
        { ...parado(100), martelo: true },
        { abertura: 100, maior: 103, menor: 100, fechamento: 103 },
        parado(103),
      ]),
      {
        ...PADRAO,
        direcao: TradeDirection.VENDA,
        saidaPorTempo: null,
        stopPercentual: 2,
      }
    )

    expect(r.trades[0].motivoSaida).toBe(ExitReason.STOP)
    expect(r.trades[0].precoSaida).toBeCloseTo(102, 10)
    expect(r.trades[0].retornoLiquido).toBeCloseTo(-2, 10)
  })
})

describe('utils/backtest › janela de aquecimento', () => {
  it('não deve abrir posição antes de aPartirDe', () => {
    // Dois martelos: um dentro da margem de aquecimento, outro depois. Só o
    // segundo pode virar operação.
    const registros = serie([
      { ...parado(100), martelo: true }, // 00:00 — aquecimento
      parado(100),
      parado(100),
      { ...parado(100), martelo: true }, // 03:00 — janela
      parado(100),
      parado(100),
    ])

    const r = simular(registros, {
      ...PADRAO,
      saidaPorTempo: 1,
      aPartirDe: '2026-01-01T03:00:00Z',
    })

    expect(r.trades).toHaveLength(1)
    expect(r.trades[0].indiceEntrada).toBe(4)
  })

  it('deve desenhar a curva apenas sobre a janela escolhida', () => {
    const registros = serie([
      parado(100), parado(100), parado(100),
      parado(100), parado(100), parado(100),
    ])

    const r = simular(registros, {
      ...PADRAO,
      saidaPorTempo: 1,
      aPartirDe: '2026-01-01T03:00:00Z',
    })

    // Seis candles entraram; três estão na janela.
    expect(r.metricas.candlesSimulados).toBe(3)
  })
})

describe('utils/backtest › descontinuidade', () => {
  it('deve recusar a entrada que atravessaria um buraco', () => {
    // Martelo às 01:00 e o candle seguinte só às 07:00. A abertura dele não é
    // a continuação do candle que gerou o sinal.
    const registros = serie(
      [
        parado(100),
        { ...parado(100), martelo: true },
        parado(150),
        parado(150),
      ],
      { saltos: { 2: 6 } }
    )

    const r = simular(registros, { ...PADRAO, saidaPorTempo: 1 })

    expect(r.trades).toHaveLength(0)
    expect(r.descontinuidades).toHaveLength(1)
    expect(r.descontinuidades[0].horasFaltando).toBe(6)
  })

  it('deve fechar no último preço conhecido quando o buraco chega', () => {
    const registros = serie(
      [
        { ...parado(100), martelo: true },
        parado(105),
        parado(200),
        parado(200),
      ],
      { saltos: { 2: 6 } }
    )

    const r = simular(registros, { ...PADRAO, saidaPorTempo: 10 })

    expect(r.trades).toHaveLength(1)
    expect(r.trades[0].motivoSaida).toBe(ExitReason.DESCONTINUIDADE)
    // Fechou em 105, o último preço antes do buraco — e não em 200.
    expect(r.trades[0].precoSaida).toBe(105)
    // Saída a preço real, então o trade conta como concluído.
    expect(r.metricas.tradesConcluidos).toBe(1)
  })

  it('deve tratar candle sem negociação como descontinuidade', () => {
    const registros = serie([
      { ...parado(100), martelo: true },
      parado(100),
      { ...parado(100), volume: 0 },
      parado(100),
    ])

    const r = simular(registros, { ...PADRAO, saidaPorTempo: 10 })

    expect(r.trades[0].motivoSaida).toBe(ExitReason.DESCONTINUIDADE)
  })
})

describe('utils/backtest › carimbo de hora', () => {
  it('deve produzir o mesmo resultado com e sem sufixo Z', () => {
    // A API .NET serializa DateTime sem marca de fuso; o mock usa toISOString()
    // e emite o Z. A detecção de buraco opera sobre DIFERENÇAS entre carimbos,
    // então é imune à forma — e este teste é o que garante isso.
    const defs = [
      { ...parado(100), martelo: true },
      parado(105),
      parado(110),
      parado(115),
    ]
    const opcoes = { ...PADRAO, saidaPorTempo: 2 }

    const comZ = simular(serie(defs, { sufixoZ: true }), opcoes)
    const semZ = simular(serie(defs, { sufixoZ: false }), opcoes)

    expect(semZ.trades).toHaveLength(comZ.trades.length)
    expect(semZ.trades[0].precoEntrada).toBe(comZ.trades[0].precoEntrada)
    expect(semZ.trades[0].retornoLiquido).toBeCloseTo(comZ.trades[0].retornoLiquido, 10)
    expect(semZ.parametros.cadenciaMs).toBe(comZ.parametros.cadenciaMs)
    expect(semZ.descontinuidades).toHaveLength(0)
  })
})

describe('utils/backtest › métricas', () => {
  it('deve calcular buy and hold SEM custo', () => {
    // Régua deliberadamente idealizada: a estratégia precisa vencer o cenário
    // mais favorável possível ao "não fazer nada".
    const r = simular(
      serie([{ ...parado(100), martelo: true }, parado(105), parado(110)]),
      { sinalEntrada: CandlePattern.MARTELO, saidaPorTempo: 1, custoPercentual: 0.1 }
    )

    // 100 → 110, sem desconto nenhum.
    expect(r.metricas.buyAndHold).toBeCloseTo(10, 10)
    expect(r.metricas.alfa).toBeCloseTo(r.metricas.retornoTotal - 10, 10)
  })

  it('deve medir drawdown sobre o capital, marcado a mercado', () => {
    // A posição afunda no meio e recupera no fim. Uma curva que só registrasse
    // fechamentos de trade mostraria drawdown zero.
    const r = simular(
      serie([
        { ...parado(100), martelo: true },
        parado(100),
        parado(50),
        parado(100),
      ]),
      { ...PADRAO, saidaPorTempo: 3 }
    )

    expect(r.trades[0].retornoLiquido).toBeCloseTo(0, 6)
    expect(r.metricas.drawdownMaximo).toBeCloseTo(-50, 6)
  })

  it('deve marcar amostra insuficiente abaixo de 20 trades concluídos', () => {
    const r = simular(
      serie([{ ...parado(100), martelo: true }, parado(100), parado(100)]),
      { ...PADRAO, saidaPorTempo: 1 }
    )

    expect(r.metricas.tradesConcluidos).toBe(1)
    expect(r.metricas.amostraInsuficiente).toBe(true)
  })

  it('não deve devolver profit factor infinito sem nenhuma perda', () => {
    const r = simular(
      serie([{ ...parado(100), martelo: true }, parado(100), parado(110)]),
      { ...PADRAO, saidaPorTempo: 2 }
    )

    expect(r.trades[0].retornoLiquido).toBeGreaterThan(0)
    expect(r.metricas.profitFactor).toBeNull()
  })

  it('deve medir exposição como fração dos candles em posição', () => {
    const r = simular(
      serie([
        { ...parado(100), martelo: true },
        parado(100), parado(100), parado(100),
      ]),
      { ...PADRAO, saidaPorTempo: 1 }
    )

    // Quatro candles na curva, um deles em posição.
    expect(r.metricas.candlesSimulados).toBe(4)
    expect(r.metricas.exposicao).toBeCloseTo(25, 6)
  })
})

describe('utils/backtest › stop por ATR', () => {
  it('deve dobrar o ATR percentual, como o ambiente do backend', () => {
    // ATR de 20 sobre preço 1000 é 2%; a fórmula copiada do backend é ×2.
    expect(stopPorAtr(20, 1000)).toBeCloseTo(4, 10)
  })

  it('deve respeitar o piso em período de calmaria', () => {
    // Sem piso, um ativo parado produziria um stop de 0,04% — que qualquer
    // oscilação normal derruba, transformando a proteção em gerador de perdas.
    expect(stopPorAtr(0.2, 1000)).toBe(ATR_STOP_MINIMO_PERCENTUAL)
  })

  it('deve respeitar o teto em candle de pânico', () => {
    // Sem teto, um candle violento produziria um stop de 60%, que não protege
    // de nada — só garante que a perda seja grande antes de fechar.
    expect(stopPorAtr(300, 1000)).toBe(ATR_STOP_MAXIMO_PERCENTUAL)
  })

  it('deve recusar entrada sem ATR ou sem preço', () => {
    expect(stopPorAtr(null, 1000)).toBeNull()
    expect(stopPorAtr(0, 1000)).toBeNull()
    expect(stopPorAtr(20, 0)).toBeNull()
  })

  // O título dizia "daquele candle", e o candle da entrada é justamente o que o
  // motor não pode consultar — ver o bloco de causalidade no fim do arquivo. O
  // que este caso mede é outra coisa, e continua valendo: a distância acompanha
  // o REGIME de volatilidade em que a entrada acontece.
  it('deve dimensionar cada entrada pela volatilidade do regime em que ocorre', () => {
    // Série calma que fica violenta na segunda metade. Dois martelos, um em
    // cada regime: se o motor usasse um ATR único, os dois trades sairiam com
    // a mesma distância de stop.
    // Regime calmo: amplitude 1 sobre preço 100 = 1% → stop de 2%.
    const defs = []
    for (let i = 0; i < ATR_PERIOD + 4; i++) {
      defs.push({ abertura: 100, maior: 100.5, menor: 99.5, fechamento: 100, amplitude: 1 })
    }
    defs[ATR_PERIOD] = { ...defs[ATR_PERIOD], martelo: true, amplitude: 1 }
    // Regime agitado: amplitude 4 sobre preço 100 = 4% → stop tenderia a 8%.
    for (let i = 0; i < ATR_PERIOD * 3; i++) {
      defs.push({ abertura: 100, maior: 102, menor: 98, fechamento: 100, amplitude: 4 })
    }
    defs[defs.length - 6] = { ...defs[defs.length - 6], martelo: true, amplitude: 4 }

    const r = simular(serie(defs), {
      sinalEntrada: CandlePattern.MARTELO,
      modoStop: StopMode.ATR,
      saidaPorTempo: 2,
      custoPercentual: 0,
    })

    expect(r.trades.length).toBeGreaterThanOrEqual(2)
    const primeiro = r.trades[0].stopPercentualAplicado
    const ultimo = r.trades[r.trades.length - 1].stopPercentualAplicado
    // O regime violento tem de produzir um stop mais largo que o calmo.
    expect(ultimo).toBeGreaterThan(primeiro)
    // E ambos dentro dos limites.
    ;[primeiro, ultimo].forEach((d) => {
      expect(d).toBeGreaterThanOrEqual(ATR_STOP_MINIMO_PERCENTUAL)
      expect(d).toBeLessThanOrEqual(ATR_STOP_MAXIMO_PERCENTUAL)
    })
  })

  it('deve abrir sem stop enquanto o ATR não existe', () => {
    // No começo da série a média ainda não fechou. Inventar uma distância ali
    // seria pior do que sair pelo tempo.
    const defs = [{ ...parado(100), martelo: true }, parado(100), parado(100)]
    const r = simular(serie(defs), {
      sinalEntrada: CandlePattern.MARTELO,
      modoStop: StopMode.ATR,
      saidaPorTempo: 1,
      custoPercentual: 0,
    })

    expect(r.trades).toHaveLength(1)
    expect(r.trades[0].stopPercentualAplicado).toBeNull()
    expect(r.trades[0].motivoSaida).toBe(ExitReason.TEMPO)
  })

  it('deve aceitar o modo ATR como única regra de saída', () => {
    // No percentual, sem stop, alvo e tempo a posição nunca fecharia — e a
    // função recusa. No modo ATR o stop existe sempre, então é regra bastante.
    const defs = Array.from({ length: ATR_PERIOD + 6 }, () => parado(100))
    defs[2] = { ...parado(100), martelo: true }

    expect(
      simular(serie(defs), {
        sinalEntrada: CandlePattern.MARTELO,
        modoStop: StopMode.ATR,
        saidaPorTempo: null,
      })
    ).not.toBeNull()
  })
})

describe('utils/backtest › divisão para validação', () => {
  const dez = () => serie(Array.from({ length: 10 }, () => parado(100)))

  it('deve reservar a parte MAIS RECENTE para validação', () => {
    // Reservar o passado inverteria a seta do tempo: o ajuste enxergaria o
    // futuro daquilo que deveria validá-lo.
    const registros = dez()
    const d = dividirParaValidacao(registros, 0.2)

    expect(d.candlesValidacao).toBe(2)
    expect(d.candlesAjuste).toBe(8)

    // A série chega do mais recente para o mais antigo: a validação é o começo
    // do array, e o ajuste vai do corte para trás.
    const maisRecente = registros[0].horaReferencia
    const corte = d.aPartirDeValidacao
    expect(new Date(corte).getTime()).toBeLessThan(new Date(maisRecente).getTime())
    // Nenhum candle do ajuste é posterior ao corte.
    d.registrosAjuste.forEach((r) => {
      expect(new Date(r.horaReferencia).getTime()).toBeLessThan(new Date(corte).getTime())
    })
  })

  it('deve cortar o ajuste, mas entregar a série inteira para a validação', () => {
    // O ajuste não pode ver a validação nem como aquecimento. A validação, ao
    // contrário, precisa do histórico anterior para chegar com RSI e Bollinger
    // aquecidos no instante do corte.
    const registros = dez()
    const d = dividirParaValidacao(registros, 0.2)

    expect(d.registrosAjuste).toHaveLength(8)
    expect(d.registrosValidacao).toHaveLength(10)
    expect(d.registrosValidacao).toBe(registros)
  })

  it('deve usar 20% como fração padrão', () => {
    expect(FRACAO_VALIDACAO_PADRAO).toBe(0.2)
    expect(dividirParaValidacao(dez()).candlesValidacao).toBe(2)
  })

  it('deve medir a fração sobre a janela, não sobre o aquecimento', () => {
    // 20 candles no array; a janela começa no 11º. Os 10 primeiros são
    // aquecimento e não são período de análise: contá-los faria a validação
    // reservar 4 candles onde deveria reservar 2.
    const registros = serie(Array.from({ length: 20 }, () => parado(100)))

    const semJanela = dividirParaValidacao(registros, 0.2)
    expect(semJanela.candlesValidacao).toBe(4)

    const comJanela = dividirParaValidacao(registros, 0.2, {
      aPartirDe: '2026-01-01T10:00:00Z',
    })
    expect(comJanela.candlesValidacao).toBe(2)

    // O ajuste continua carregando o aquecimento inteiro: o indicador de
    // janela móvel precisa dele, e cortá-lo trocaria um viés por outro.
    expect(comJanela.registrosAjuste).toHaveLength(18)
  })

  it('deve recusar corte que deixaria algum lado curto demais', () => {
    // Cinco candles a 20% dariam uma validação de 1 — insuficiente até para
    // uma entrada, que consome dois candles.
    expect(dividirParaValidacao(serie(Array.from({ length: 5 }, () => parado(100))), 0.2)).toBeNull()
    expect(dividirParaValidacao(dez(), 0.95)).toBeNull()
    expect(dividirParaValidacao(dez(), 0)).toBeNull()
    expect(dividirParaValidacao(dez(), 1)).toBeNull()
    expect(dividirParaValidacao(null)).toBeNull()
  })

  it('deve produzir duas simulações que não compartilham operação', () => {
    // Martelo em dois pontos: um no trecho de ajuste, outro no de validação.
    const defs = Array.from({ length: 20 }, () => parado(100))
    defs[2] = { ...parado(100), martelo: true }
    defs[17] = { ...parado(100), martelo: true }
    const registros = serie(defs)

    const d = dividirParaValidacao(registros, 0.2)
    const ajuste = simular(d.registrosAjuste, { ...PADRAO, saidaPorTempo: 1 })
    const validacao = simular(d.registrosValidacao, {
      ...PADRAO,
      saidaPorTempo: 1,
      aPartirDe: d.aPartirDeValidacao,
    })

    expect(ajuste.trades).toHaveLength(1)
    expect(validacao.trades).toHaveLength(1)

    // O trade do ajuste é anterior ao corte; o da validação, posterior.
    const corte = new Date(d.aPartirDeValidacao).getTime()
    expect(new Date(ajuste.trades[0].instanteEntrada).getTime()).toBeLessThan(corte)
    expect(new Date(validacao.trades[0].instanteEntrada).getTime()).toBeGreaterThanOrEqual(corte)
  })
})

describe('utils/backtest › curva e a régua do buy & hold', () => {
  it('deve levar o fechamento junto de cada ponto da curva', () => {
    // O gráfico desenha a régua a partir daqui. Sem este campo, `buyAndHold`
    // sai todo null e a linha some da tela sem nenhum erro — o modo de falha
    // mais silencioso possível, e o motivo de a asserção estar no motor e não
    // só no util de gráfico.
    const r = simular(
      serie([{ ...parado(100), martelo: true }, parado(110), parado(120)]),
      { ...PADRAO, saidaPorTempo: 1 }
    )

    expect(r.curva.length).toBeGreaterThan(0)
    r.curva.forEach((ponto) => expect(ponto.precoFechamento).toBeGreaterThan(0))
  })

  it('deve fazer a régua do gráfico terminar onde a métrica do card diz', () => {
    // A ponte entre o motor e o desenho. Os testes de `equityChart` rodam sobre
    // pontos sintéticos: se o motor parasse de emitir preço, ou emitisse a
    // partir de outro candle, eles continuariam passando e a tela mostraria uma
    // régua que o card ao lado desmente.
    const r = simular(
      serie([{ ...parado(100), martelo: true }, parado(110), parado(90), parado(130)]),
      { ...PADRAO, saidaPorTempo: 1 }
    )

    const pontos = montarPontosDaCurva(r.curva, r.parametros.capitalInicial)
    const finalDaLinha = pontos.buyAndHold[pontos.buyAndHold.length - 1]
    const emPercentual = ((finalDaLinha - r.parametros.capitalInicial) /
      r.parametros.capitalInicial) * 100

    expect(emPercentual).toBeCloseTo(r.metricas.buyAndHold, 8)
  })
})

describe('utils/backtest › risco da curva', () => {
  const HORA = 3600000
  const curvaDe = (capitais) => capitais.map((capital) => ({ capital }))

  it('deve anualizar pela cadência recebida, não por uma constante horária', () => {
    // Mesma curva, cadências diferentes: candle diário tem menos períodos por
    // ano que candle horário, então o mesmo padrão de retorno anualiza menos.
    // Assumir "é sempre horário" numa constante daria o mesmo número para as
    // duas, e a métrica passaria a mentir se a coleta mudasse de cadência.
    const curva = curvaDe([1000, 1010, 1005, 1020, 1015, 1030])

    const horaria = riscoDaCurva(curva, HORA)
    const diaria = riscoDaCurva(curva, 24 * HORA)

    expect(horaria.sharpe).toBeGreaterThan(diaria.sharpe)
    // A razão é a dos períodos por ano sob a raiz: sqrt(24).
    expect(horaria.sharpe / diaria.sharpe).toBeCloseTo(Math.sqrt(24), 8)
    expect(horaria.volatilidade / diaria.volatilidade).toBeCloseTo(Math.sqrt(24), 8)
  })

  it('deve recusar curva que nunca se moveu em vez de devolver infinito', () => {
    // Desvio zero: dividir por ele daria Infinity, que a tela leria como
    // excelência. Mesmo tratamento do profit factor sem nenhuma perda.
    const parada = riscoDaCurva(curvaDe([1000, 1000, 1000, 1000]), HORA)

    expect(parada.sharpe).toBeNull()
    expect(parada.volatilidade).toBe(0)
  })

  it('deve dar Sharpe negativo para curva que só perde', () => {
    const perdendo = riscoDaCurva(curvaDe([1000, 990, 980, 970, 960]), HORA)
    expect(perdendo.sharpe).toBeLessThan(0)
  })

  it('deve medir a curva inteira, incluindo os trechos sem posição', () => {
    // A diferença entre "o que o meu capital fez" e "como foram as operações".
    // Duas curvas com o MESMO desfecho e o mesmo par de saltos: uma anda o tempo
    // todo, a outra fica parada entre eles. A parada tem desvio menor, então
    // Sharpe maior — é a distorção que a exposição existe para acompanhar, e ela
    // só aparece se os candles parados forem contados.
    const semPausa = riscoDaCurva(curvaDe([1000, 1010, 1020, 1030, 1040]), HORA)
    const comPausa = riscoDaCurva(curvaDe([1000, 1040, 1040, 1040, 1040]), HORA)

    expect(comPausa.volatilidade).toBeGreaterThan(0)
    expect(semPausa.volatilidade).toBeLessThan(comPausa.volatilidade)
  })

  it('deve recusar entrada sem o que medir', () => {
    expect(riscoDaCurva([], HORA).sharpe).toBeNull()
    expect(riscoDaCurva(null, HORA).sharpe).toBeNull()
    expect(riscoDaCurva(curvaDe([1000, 1010]), HORA).sharpe).toBeNull()
    // Sem cadência não há como anualizar, e um fator inventado seria pior.
    expect(riscoDaCurva(curvaDe([1000, 1010, 1020]), null).sharpe).toBeNull()
    expect(riscoDaCurva(curvaDe([1000, 1010, 1020]), 0).sharpe).toBeNull()
  })

  it('deve chegar às métricas de uma simulação de verdade', () => {
    // A ponte: o motor precisa passar a cadência que mediu para o cálculo. Sem
    // ela, `sharpe` sai null em toda simulação e o card nasce vazio — falha
    // silenciosa que nenhum teste sobre a função pura pegaria.
    //
    // O candle SEGURADO precisa andar entre a abertura e o fechamento. Com
    // `parado()` os dois são iguais, toda operação rende exatamente zero e a
    // curva fica plana — foi assim que a primeira versão deste teste falhou, e
    // a curva plana é justamente o caso em que o Sharpe é null de propósito.
    const movimento = (abertura, fechamento) => ({
      abertura,
      maior: Math.max(abertura, fechamento) * 1.01,
      menor: Math.min(abertura, fechamento) * 0.99,
      fechamento,
    })

    const r = simular(
      serie([
        { ...parado(100), martelo: true },
        movimento(100, 103),
        { ...parado(103), martelo: true },
        movimento(103, 100),
        { ...parado(100), martelo: true },
        movimento(100, 105),
        parado(105),
      ]),
      { ...PADRAO, saidaPorTempo: 1 }
    )

    // Três operações com desfechos diferentes: a curva se move, então há
    // dispersão para medir.
    expect(r.trades.length).toBe(3)
    expect(r.metricas.sharpe).not.toBeNull()
    expect(Number.isFinite(r.metricas.sharpe)).toBe(true)
    expect(r.metricas.volatilidade).toBeGreaterThan(0)
  })
})

describe('utils/backtest › comparação de estratégias', () => {
  // Série com dois sinais distintos e desfechos opostos: o martelo é sempre
  // seguido de alta, a estrela cadente sempre de queda. A comparação tem de
  // separar os dois e colocar o martelo em cima.
  const serieComDoisSinais = () => {
    const defs = []
    let preco = 100
    for (let i = 0; i < 60; i++) {
      const anterior = defs[i - 1]

      // O candle SEGUINTE ao sinal é o que a estratégia segura, então o
      // movimento precisa acontecer DENTRO dele — entre a abertura e o
      // fechamento. Numa versão anterior desta fixture abertura e fechamento
      // eram iguais e o preço só mudava entre candles: toda operação rendia
      // exatamente zero, os quatro sinais empatavam em alfa e o teste de
      // ordenação passava com o `sort` invertido.
      let fechamento = preco
      if (anterior?.martelo) fechamento = preco * 1.03
      else if (anterior?.estrela) fechamento = preco * 0.97

      defs.push({
        abertura: preco,
        maior: Math.max(preco, fechamento) * 1.001,
        menor: Math.min(preco, fechamento) * 0.999,
        fechamento,
        martelo: i % 6 === 0,
        estrela: i % 6 === 3,
      })
      preco = fechamento
    }
    return serie(defs)
  }

  const PARAMS = { saidaPorTempo: 1, custoPercentual: 0 }

  it('deve testar todos os sinais presentes na série', () => {
    const r = compararEstrategias(serieComDoisSinais(), PARAMS)
    const chaves = r.linhas.map((l) => l.sinal)
    expect(chaves).toContain(CandlePattern.MARTELO)
    expect(chaves).toContain(CandlePattern.ESTRELA)
  })

  it('deve ordenar por alfa, maior primeiro', () => {
    const r = compararEstrategias(serieComDoisSinais(), PARAMS)

    const martelo = r.linhas.find((l) => l.sinal === CandlePattern.MARTELO)
    const estrela = r.linhas.find((l) => l.sinal === CandlePattern.ESTRELA)

    // Antes da ordem, o pré-requisito: os dois sinais precisam ter alfas
    // DIFERENTES. Com todos empatados qualquer ordenação satisfaz a
    // comparação, e o teste não testa nada.
    expect(martelo.metricas.alfa).toBeGreaterThan(estrela.metricas.alfa)

    for (let i = 1; i < r.linhas.length; i++) {
      expect(r.linhas[i - 1].metricas.alfa).toBeGreaterThanOrEqual(r.linhas[i].metricas.alfa)
    }

    // E o sinal seguido de alta tem de estar acima do seguido de queda.
    expect(r.linhas.indexOf(martelo)).toBeLessThan(r.linhas.indexOf(estrela))
  })

  it('deve separar estratégia que ganha da que perde', () => {
    // O martelo é sempre seguido de +3% dentro do candle segurado; a estrela,
    // de -3%. Se os dois saíssem parecidos, a tabela inteira seria decorativa.
    const r = compararEstrategias(serieComDoisSinais(), PARAMS)
    const martelo = r.linhas.find((l) => l.sinal === CandlePattern.MARTELO)
    const estrela = r.linhas.find((l) => l.sinal === CandlePattern.ESTRELA)

    expect(martelo.metricas.retornoTotal).toBeGreaterThan(0)
    expect(estrela.metricas.retornoTotal).toBeLessThan(0)
  })

  it('não deve testar sinal que não ocorre na série', () => {
    // Pedir explicitamente um sinal ausente devolveria uma linha vazia, que o
    // usuário leria como "não presta" em vez de "não aconteceu".
    const r = compararEstrategias(serieComDoisSinais(), {
      ...PARAMS,
      sinais: [CandlePattern.MARTELO, CandlePattern.MARUBOZU],
    })
    expect(r.linhas.map((l) => l.sinal)).toEqual([CandlePattern.MARTELO])
  })

  it('deve devolver o mesmo resultado que simular chamado direto', () => {
    // A série de sinais compartilhada é otimização, não mudança de semântica.
    const registros = serieComDoisSinais()
    const r = compararEstrategias(registros, { ...PARAMS, sinais: [CandlePattern.MARTELO] })
    const direto = simular(registros, { ...PARAMS, sinalEntrada: CandlePattern.MARTELO })

    expect(r.linhas[0].metricas.retornoTotal).toBeCloseTo(direto.metricas.retornoTotal, 10)
    expect(r.linhas[0].trades).toBe(direto.trades.length)
  })

  it('deve recusar série de sinais que não descreve estes registros', () => {
    // Série indexada por posição vinda de outro array alinharia sinais com
    // candles errados — o motor precisa detectar e montar a sua.
    const registros = serieComDoisSinais()
    const alheia = [{ registro: {}, sinais: [CandlePattern.MARTELO] }]
    const comAlheia = simular(registros, {
      ...PARAMS,
      sinalEntrada: CandlePattern.MARTELO,
      serieDeSinais: alheia,
    })
    const normal = simular(registros, { ...PARAMS, sinalEntrada: CandlePattern.MARTELO })
    expect(comAlheia.trades.length).toBe(normal.trades.length)
  })

  it('deve aceitar as séries de sinais já montadas sem mudar o resultado', () => {
    // O painel monta a série de sinais uma vez e a repassa: sem isso ela era
    // remontada cinco vezes por troca de parâmetro sobre os mesmos candles.
    // Reaproveitar é otimização, e otimização que muda número é defeito.
    const registros = serieComDoisSinais()
    const corte = dividirParaValidacao(registros, FRACAO_VALIDACAO_PADRAO, { aPartirDe: null })

    const semReuso = compararEstrategias(registros, PARAMS)
    const comReuso = compararEstrategias(registros, {
      ...PARAMS,
      serieDeSinais: montarSerieDeSinais(registros),
      serieDeSinaisAjuste: montarSerieDeSinais(corte.registrosAjuste),
    })

    expect(comReuso.linhas.map((l) => l.sinal)).toEqual(semReuso.linhas.map((l) => l.sinal))
    comReuso.linhas.forEach((linha, i) => {
      expect(linha.metricas.retornoTotal).toBeCloseTo(semReuso.linhas[i].metricas.retornoTotal, 10)
      expect(linha.alfaValidacao).toBe(semReuso.linhas[i].alfaValidacao)
      expect(linha.alfaAjuste).toBe(semReuso.linhas[i].alfaAjuste)
    })
  })

  it('deve recusar séries de sinais que não descrevem estes registros', () => {
    // Mesma régua de `simular`: a série é indexada por posição, e uma de outro
    // array alinharia sinais com candles errados. Não batendo o tamanho, o certo
    // é remontar — nunca confiar no que veio.
    const registros = serieComDoisSinais()
    const alheia = [{ registro: {}, sinais: [CandlePattern.MARTELO] }]

    const comAlheia = compararEstrategias(registros, {
      ...PARAMS,
      serieDeSinais: alheia,
      serieDeSinaisAjuste: alheia,
    })
    const normal = compararEstrategias(registros, PARAMS)

    expect(comAlheia.linhas.map((l) => l.sinal)).toEqual(normal.linhas.map((l) => l.sinal))
    comAlheia.linhas.forEach((linha, i) => {
      expect(linha.metricas.retornoTotal).toBeCloseTo(normal.linhas[i].metricas.retornoTotal, 10)
      expect(linha.alfaAjuste).toBe(normal.linhas[i].alfaAjuste)
    })
  })

  it('deve separar o alfa da validação do alfa da janela cheia', () => {
    const r = compararEstrategias(serieComDoisSinais(), PARAMS)
    const linha = r.linhas[0]
    expect(linha).toHaveProperty('alfaValidacao')
    expect(linha).toHaveProperty('tradesValidacao')
    // A validação é medida em outro trecho, então não pode ser cópia.
    expect(r.candlesValidacao).toBeGreaterThan(0)
  })

  it('deve expor o buy and hold uma vez, como régua comum', () => {
    const r = compararEstrategias(serieComDoisSinais(), PARAMS)
    // Mesma janela e mesmo ativo para todas as linhas.
    r.linhas.forEach((l) => expect(l.metricas.buyAndHold).toBeCloseTo(r.buyAndHold, 10))
  })

  it('deve recusar entrada sem sinal nenhum', () => {
    const paradas = serie(Array.from({ length: 10 }, () => parado(100)))
    expect(compararEstrategias(paradas, PARAMS)).toBeNull()
    expect(compararEstrategias([], PARAMS)).toBeNull()
    expect(compararEstrategias(null, PARAMS)).toBeNull()
  })
})

describe('utils/backtest › entrada inutilizável', () => {
  it('deve recusar série vazia ou curta demais', () => {
    expect(simular([], PADRAO)).toBeNull()
    expect(simular(null, PADRAO)).toBeNull()
    expect(simular(serie([parado(100)]), PADRAO)).toBeNull()
  })

  it('deve recusar parâmetros que não descrevem estratégia', () => {
    const s = serie([parado(100), parado(100), parado(100)])

    // Sem sinal de entrada.
    expect(simular(s, { saidaPorTempo: 1 })).toBeNull()
    // Sem nenhuma regra de saída: a posição nunca fecharia.
    expect(
      simular(s, { sinalEntrada: CandlePattern.MARTELO, saidaPorTempo: null })
    ).toBeNull()
    // Direção inexistente.
    expect(
      simular(s, { sinalEntrada: CandlePattern.MARTELO, direcao: 0 })
    ).toBeNull()
    // Horizonte inválido.
    expect(
      simular(s, { sinalEntrada: CandlePattern.MARTELO, saidaPorTempo: 0 })
    ).toBeNull()
  })
})

describe('utils/backtest › o que ordena o ranking', () => {
  // A ordenação era pelo alfa da JANELA CHEIA, e a janela cheia contém o trecho
  // de validação. Ou seja: a melhor era escolhida usando também os candles
  // reservados para julgar a escolha, e a coluna de validação então
  // "confirmava" a subida que ela mesma havia causado.
  //
  // Esta série é o caso que separa os dois protocolos. Cem candles: os oitenta
  // mais antigos são ajuste, os vinte mais novos, validação.
  //
  //   martelo  dez entradas, todas no AJUSTE, cada uma rendendo +2%
  //   estrela  dez entradas perdendo 1% no ajuste, e DUAS de +40% na validação
  //
  // Pelo ajuste o martelo ganha; pela janela cheia a estrela ganha, porque as
  // duas operações do trecho reservado dominam a conta.
  const TOTAL = 100
  const MARTELO_EM = new Set([0, 8, 16, 24, 32, 40, 48, 56, 64, 72])
  const ESTRELA_EM = new Set([4, 12, 20, 28, 36, 44, 52, 60, 68, 76, 84, 92])

  const serieComReversao = () => {
    const defs = []
    let preco = 100

    for (let i = 0; i < TOTAL; i++) {
      // `saidaPorTempo: 1` entra na abertura do candle seguinte ao sinal e sai
      // no fechamento DELE, então o retorno da operação é o movimento dentro
      // deste candle — decidido pelo sinal do candle anterior.
      const anterior = defs[i - 1]
      let ganho = 0
      if (anterior?.martelo) ganho = 0.02
      else if (anterior?.estrela) ganho = i >= 80 ? 0.4 : -0.01

      const fechamento = preco * (1 + ganho)

      defs.push({
        abertura: preco,
        maior: Math.max(preco, fechamento) * 1.001,
        menor: Math.min(preco, fechamento) * 0.999,
        fechamento,
        martelo: MARTELO_EM.has(i),
        estrela: ESTRELA_EM.has(i),
      })
      preco = fechamento
    }

    return serie(defs)
  }

  const PARAMS_REVERSAO = { saidaPorTempo: 1, custoPercentual: 0 }

  const posicaoDe = (r, sinal) => r.linhas.findIndex((l) => l.sinal === sinal)

  it('deve ordenar pelo alfa do ajuste, não pelo da janela cheia', () => {
    const r = compararEstrategias(serieComReversao(), PARAMS_REVERSAO)
    const alfas = r.linhas.map((l) => l.alfaAjuste ?? -Infinity)

    expect(alfas).toEqual([...alfas].sort((a, b) => b - a))
  })

  it('deve pôr em cima a regra que venceu no trecho em que foi escolhida', () => {
    const r = compararEstrategias(serieComReversao(), PARAMS_REVERSAO)
    expect(posicaoDe(r, CandlePattern.MARTELO)).toBeLessThan(
      posicaoDe(r, CandlePattern.ESTRELA)
    )
  })

  it('deve contrariar o critério antigo neste caso, e não por acaso', () => {
    // A rede de segurança do teste acima: sem esta verificação, uma fixture em
    // que os dois critérios concordam faria a ordenação passar com qualquer um
    // deles. Aqui a estrela TEM o maior alfa na janela cheia — era ela que
    // subia ao topo antes — e ainda assim fica abaixo.
    const r = compararEstrategias(serieComReversao(), PARAMS_REVERSAO)
    const martelo = r.linhas.find((l) => l.sinal === CandlePattern.MARTELO)
    const estrela = r.linhas.find((l) => l.sinal === CandlePattern.ESTRELA)

    expect(estrela.metricas.alfa).toBeGreaterThan(martelo.metricas.alfa)
    expect(estrela.alfaAjuste).toBeLessThan(martelo.alfaAjuste)
  })

  it('deve cair para a janela cheia quando não há corte', () => {
    // Sem trecho de ajuste não existe critério limpo, e a janela cheia é tudo
    // o que há. Aí a estrela volta ao topo — e está certo, porque ali não se
    // prometeu nenhuma separação.
    const r = compararEstrategias(serieComReversao(), {
      ...PARAMS_REVERSAO,
      fracaoValidacao: null,
    })

    expect(r.linhas[0].sinal).toBe(CandlePattern.ESTRELA)
    expect(r.linhas.every((l) => l.alfaAjuste === null)).toBe(true)
  })
})

describe('utils/backtest › causalidade do stop por volatilidade', () => {
  // O `calcularAtrSerie` devolve, em cada posição, o ATR JÁ INCLUINDO a
  // amplitude daquele candle. A entrada acontece na abertura do candle — a essa
  // altura ninguém sabe qual vai ser a máxima nem a mínima dele. O stop tem de
  // sair do último candle FECHADO.
  //
  // O erro ia sempre para o mesmo lado: candle largo produzia stop largo
  // justamente quando o stop largo salvava a operação.

  const PRECO = 10000

  // Amplitude 100 sobre preço 10000 é 1%, que dobrado dá stop de 2% — dentro da
  // faixa de 1% a 10%, longe dos dois limites. Preso num deles, o teste passaria
  // com qualquer índice, porque o clamp apagaria a diferença.
  const neutro = (amplitude = 100) => ({
    abertura: PRECO,
    maior: PRECO * 1.02,
    menor: PRECO * 0.98,
    fechamento: PRECO,
    amplitude,
  })

  const K = ATR_PERIOD + 2

  const serieComEntradaLarga = () => {
    const defs = Array.from({ length: ATR_PERIOD + 10 }, () => neutro())
    // Sinal em K: a entrada será na abertura de K + 1.
    defs[K] = { ...neutro(42), martelo: true }
    // O candle DA ENTRADA é muito mais largo que os demais. É o dado que o
    // motor não pode usar — e é grande o bastante para a diferença aparecer.
    defs[K + 1] = neutro(350)
    return serie(defs)
  }

  const simulacao = () =>
    simular(serieComEntradaLarga(), {
      sinalEntrada: CandlePattern.MARTELO,
      modoStop: StopMode.ATR,
      saidaPorTempo: 3,
      custoPercentual: 0,
    })

  it('deve dimensionar o stop pelo ATR do último candle fechado', () => {
    const registros = serieComEntradaLarga()
    const atrPorPosicao = calcularAtrSerie(registros)
    const trade = simulacao().trades[0]

    const ultimoFechado = trade.indiceEntrada - 1
    expect(trade.stopPercentualAplicado).toBeCloseTo(
      stopPorAtr(atrPorPosicao[ultimoFechado], trade.precoEntrada),
      10
    )
  })

  it('não deve usar o ATR do candle em que entra', () => {
    // A rede de segurança do teste acima: sem ela, uma série em que os dois
    // ATRs coincidem faria a asserção passar com qualquer um dos índices.
    const registros = serieComEntradaLarga()
    const atrPorPosicao = calcularAtrSerie(registros)
    const trade = simulacao().trades[0]

    const doCandleDaEntrada = stopPorAtr(atrPorPosicao[trade.indiceEntrada], trade.precoEntrada)

    expect(trade.stopPercentualAplicado).not.toBeCloseTo(doCandleDaEntrada, 4)
    // E o stop errado seria MAIOR — o candle largo afrouxaria a proteção
    // exatamente na hora em que ela seria testada.
    expect(doCandleDaEntrada).toBeGreaterThan(trade.stopPercentualAplicado)
  })

  it('deve manter o stop dentro da faixa, para o teste medir o que pretende', () => {
    const trade = simulacao().trades[0]
    expect(trade.stopPercentualAplicado).toBeGreaterThan(ATR_STOP_MINIMO_PERCENTUAL)
    expect(trade.stopPercentualAplicado).toBeLessThan(ATR_STOP_MAXIMO_PERCENTUAL)
  })
})


describe('utils/backtest › extensão real da janela analisada', () => {
  // O painel anunciava a janela PEDIDA — 180 dias, constante — ao lado da
  // contagem de candles que de fato chegou. Nos dados de demonstração a coleta
  // cobre 120 dias, então a linha dizia "180 dias" sobre uma série que não os
  // tinha. É o mesmo defeito que o aviso de corte do dashboard denuncia, e que
  // o comentário do simulationWindow.js já apontava como faltando aqui.

  const cemHoras = (n) =>
    serie(Array.from({ length: n }, (_, i) => (i === 2 ? { ...parado(100), martelo: true } : parado(100))))

  it('deve medir os dias que a curva de fato cobre', () => {
    // 49 candles horários = 48 horas de ponta a ponta = 2 dias.
    const r = simular(cemHoras(49), { ...PADRAO, saidaPorTempo: 1 })
    expect(r.metricas.diasAnalisados).toBeCloseTo(2, 6)
  })

  it('deve medir a JANELA ANALISADA, sem o aquecimento', () => {
    // A curva começa em `aPartirDe`, não no primeiro candle recebido: os
    // candles de aquecimento alimentam indicador e não são período analisado.
    const registros = cemHoras(73) // 3 dias de ponta a ponta
    const cronologico = [...registros].reverse()
    const meio = cronologico[36].horaReferencia

    const r = simular(registros, { ...PADRAO, saidaPorTempo: 1, aPartirDe: meio })

    expect(r.metricas.diasAnalisados).toBeCloseTo(1.5, 6)
  })

  it('deve medir a extensão mesmo quando ela é de poucas horas', () => {
    // Dois candles horários são uma hora de ponta a ponta. Arredondar isso para
    // zero, ou devolver null, esconderia que a janela é curta demais para
    // qualquer conclusão — que é justamente o que a tela precisa dizer.
    const r = simular(serie([{ ...parado(100), martelo: true }, parado(100)]), {
      ...PADRAO,
      saidaPorTempo: 1,
    })
    expect(r.metricas.diasAnalisados).toBeCloseTo(1 / 24, 6)
  })

  it('deve acompanhar a série recebida, e não a pedida', () => {
    // É o ponto todo: a mesma requisição de 180 dias devolve o que a coleta
    // tem. Duas séries de tamanhos diferentes têm de produzir dois números
    // diferentes aqui — senão a tela volta a anunciar uma constante.
    const curta = simular(cemHoras(49), { ...PADRAO, saidaPorTempo: 1 })
    const longa = simular(cemHoras(145), { ...PADRAO, saidaPorTempo: 1 })

    expect(curta.metricas.diasAnalisados).toBeLessThan(longa.metricas.diasAnalisados)
    expect(longa.metricas.diasAnalisados).toBeCloseTo(6, 6)
  })
})
