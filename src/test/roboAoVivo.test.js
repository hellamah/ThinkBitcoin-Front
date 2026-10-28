import { describe, expect, it } from 'vitest'
import { HistoricoDecisaoEndpoint, SequenciaRetornoEndpoint } from '../src/utils/apiClient'
import { getMockResponse } from '../src/utils/mockApi'
import { CURVAS_ZOO_RECENTES, DECISOES_ROBO, SEQUENCIAS_ROBO } from '../src/utils/mockRoboAoVivo'
import {
  ATIVACAO_MOTOR,
  carteirasDoRobo,
  chaveDaAcao,
  criterioDoMotor,
  curvaDoRobo,
  curvaNoPeriodo,
  diaDaDecisao,
  doseDaRegra,
  estadoDeHoje,
  executouAoReligar,
  instanteUtc,
  noitesDoRobo,
  operacoesDoMotor,
  quedaMaxima,
  retornoDoPeriodo,
  sequenciasDaBusca,
  ultimoDiaDaCurva,
} from '../src/utils/roboAoVivo'

// As contas da tela do robô ao vivo (/robo-ao-vivo) e o modo demo dela. O
// robô é o motor de risco, que decide no BTC desde 23/10/2026 às 11:49 UTC;
// as operações de antes são do DQN encerrado e não entram.

const op = (acao, dataHora) => ({ idHistoricoDecisao: dataHora, acao, dataHora })

describe('utils/roboAoVivo', () => {
  it('lê a data sem fuso da API como UTC', () => {
    expect(instanteUtc('2026-10-24T00:00:00')).toBe(Date.UTC(2026, 9, 24))
    expect(instanteUtc('2026-10-24T00:00:00Z')).toBe(Date.UTC(2026, 9, 24))
  })

  it('fica só com as operações desde a ativação, da mais recente para a mais antiga', () => {
    const ops = operacoesDoMotor([
      op('ComprarTudo', '2026-10-22T23:00:00'),
      op('VenderTudo', '2026-10-24T00:00:00'),
      op('ComprarParcial', '2026-10-26T00:00:00'),
    ])
    expect(ops.map((o) => o.dataHora)).toEqual(['2026-10-26T00:00:00', '2026-10-24T00:00:00'])
  })

  it('diz dentro ou fora pela última operação, e pela dose da curva quando não há operação', () => {
    const curvaFora = { pontos: [{ exposicao: 1 }, { exposicao: 0 }] }
    expect(estadoDeHoje([op('VenderTudo', '2026-10-24T00:00:00')], curvaFora)).toEqual({ estado: 'fora', dose: 0 })
    expect(estadoDeHoje([op('ComprarParcial', '2026-10-26T00:00:00')], curvaFora).estado).toBe('dentro')
    expect(estadoDeHoje([], { pontos: [{ exposicao: 0.62 }] })).toEqual({ estado: 'dentro', dose: 0.62 })
    expect(estadoDeHoje([], null)).toEqual({ estado: null, dose: null })
  })

  it('a dose é a última exposição conhecida da curva', () => {
    expect(doseDaRegra({ pontos: [{ exposicao: 0.5 }, { exposicao: null }] })).toBe(0.5)
    expect(doseDaRegra(undefined)).toBeNull()
  })

  it('a curva do período começa em 1,0, e o retorno é o último ponto sobre o primeiro', () => {
    const pontos = curvaNoPeriodo({ pontos: [
      { data: '2026-10-22T00:00:00Z', patrimonio: 16.222079124306237 },
      { data: '2026-10-23T00:00:00Z', patrimonio: 16.205857045181929 },
      { data: '2026-10-24T00:00:00Z', patrimonio: 16.205857045181929 },
    ] })
    expect(pontos[0].y).toBe(1)
    expect(retornoDoPeriodo(pontos)).toBeCloseTo(-0.001, 4)
    expect(retornoDoPeriodo(pontos.slice(0, 1))).toBeNull()
  })

  it('traduz as ações do enum do .NET e deixa a desconhecida crua', () => {
    expect(chaveDaAcao('VenderParcial')).toBe('robo.acoes.VenderParcial')
    expect(chaveDaAcao('Outra')).toBeNull()
  })
})

// Os dados reais do banco (lidos em 25 e 28/10/2026, mockRoboAoVivo.js): a
// venda de 24/10 às 00h, que fechou a posição que o DQN deixou, e o zoo de 22
// a 27/10. A curva buy & hold do zoo é o fechamento das 23h sobre uma
// constante; o das 23h de 22/10 no banco é 81.416,09.
const DIA = 24 * 60 * 60 * 1000
const opsReais = operacoesDoMotor(DECISOES_ROBO)
const curvaReal = (estrategia) => ({
  estrategia,
  pontos: CURVAS_ZOO_RECENTES[`${estrategia}|BTC`]
    .filter(([dia]) => dia >= '2026-10-22')
    .map(([dia, patrimonio, exposicao]) => ({ data: `${dia}T00:00:00.000Z`, patrimonio, exposicao })),
})
const bhReal = curvaReal('buy_hold')

const operacao = (acao, dataHora, quantidade, preco, saldoAnterior, saldoPosterior, precoCompra = preco) => ({
  idHistoricoDecisao: `${acao}-${dataHora}`, acao, dataHora, quantidade, precoMercado: preco, precoCompra, saldoAnterior, saldoPosterior,
})
const bh = (valores, inicio = '2026-11-01') => ({
  pontos: valores.map((patrimonio, i) => ({ data: new Date(Date.parse(`${inicio}T00:00:00Z`) + i * DIA).toISOString(), patrimonio })),
})

describe('o placar do robô', () => {
  it('a operação executa a decisão da última vela das 23h antes dela', () => {
    expect(diaDaDecisao('2026-10-24T00:00:00')).toBe(Date.UTC(2026, 9, 23))
    // O PC desligado: o pod que subiu às 09h executou a decisão da noite.
    expect(diaDaDecisao('2026-10-25T09:00:00')).toBe(Date.UTC(2026, 9, 24))
    expect(diaDaDecisao('2026-10-24T23:00:00')).toBe(Date.UTC(2026, 9, 23))
    expect(executouAoReligar({ dataHora: '2026-10-24T00:00:00' })).toBe(false)
    expect(executouAoReligar({ dataHora: '2026-10-25T09:00:00' })).toBe(true)
  })

  it('a venda de tudo diz a posição de antes; o ajuste parcial grava só a parte movida', () => {
    const { inicial, depois } = carteirasDoRobo(opsReais)
    expect(inicial).toEqual({ caixa: 1000, quantidade: 0.01222, precoMedio: 81351.37 })
    expect(depois).toHaveLength(1)
    expect(depois[0]).toMatchObject({ dia: Date.UTC(2026, 9, 23), quantidade: 0, caixa: 997.02895837 })

    const sequencia = carteirasDoRobo([
      operacao('ComprarTudo', '2026-11-02T00:00:00', 10, 110, 1000, 999),
      operacao('ComprarParcial', '2026-11-03T00:00:00', 2, 120, 999, 998.8, 111.6667),
      operacao('VenderParcial', '2026-11-04T00:00:00', 5, 100, 998.8, 940, 111.6667),
      operacao('VenderTudo', '2026-11-05T00:00:00', 7, 90, 940, 788),
    ])
    expect(sequencia.inicial).toEqual({ caixa: 1000, quantidade: 0, precoMedio: 0 })
    expect(sequencia.depois.map((c) => c.quantidade)).toEqual([10, 12, 7, 0])
  })

  it('sem saber a posição de antes de um ajuste parcial, a curva começa na venda de tudo seguinte', () => {
    const ops = [
      operacao('VenderParcial', '2026-11-03T00:00:00', 5, 110, 1000, 1000.5),
      operacao('VenderTudo', '2026-11-05T00:00:00', 5, 130, 1000.5, 1100),
    ]
    expect(carteirasDoRobo(ops).inicial).toBeNull()
    const curva = curvaDoRobo(ops, bh([1, 1.1, 1.2, 1.3, 1.4]))
    expect(curva.map((p) => p.x)).toEqual([Date.UTC(2026, 10, 4), Date.UTC(2026, 10, 5)])
    expect(curva.map((p) => p.y)).toEqual([1, 1])
  })

  it('refaz o robô de 22 a 27/10 com o preço das 23h tirado da curva buy & hold', () => {
    const curva = curvaDoRobo(opsReais, bhReal)
    expect(curva.map((p) => new Date(p.x).toISOString().slice(0, 10)))
      .toEqual(['2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27'])
    // Em 22/10, a posição do DQN ao fechamento das 23h (81.416,09 no banco);
    // em 23/10, vendida a 81.189,43, e o caixa de 997,03 até o fim.
    const inicio = 1000 + 0.01222 * (81416.09 - 81351.37)
    expect(curva[0].y).toBe(1)
    expect(curva[1].y).toBeCloseTo(997.02895837 / inicio, 6)
    expect(curva.at(-1).y).toBeCloseTo(997.02895837 / inicio, 6)
  })

  it('com a posição aberta, o patrimônio anda com o preço das 23h', () => {
    // Compra de 10 a 110 decidida no 2º dia: a escala dá 100 no 1º e 121 no 3º.
    const ops = [operacao('ComprarTudo', '2026-11-03T00:00:00', 10, 110, 1000, 999)]
    const curva = curvaDoRobo(ops, bh([1, 1.1, 1.21]))
    expect(curva.map((p) => p.y)).toEqual([1, 0.999, expect.closeTo(1.109, 9)])
  })

  it('sem operação, o robô fica fora com a banca, e sem buy & hold não há curva', () => {
    expect(curvaDoRobo([], bh([1, 0.5])).map((p) => p.y)).toEqual([1, 1])
    expect(curvaDoRobo(opsReais, null)).toEqual([])
  })

  it('a queda máxima é a do topo ao fundo', () => {
    const pontos = [1, 1.2, 0.9, 1.1].map((y, x) => ({ x, y }))
    expect(quedaMaxima(pontos)).toBeCloseTo(0.25, 12)
    expect(quedaMaxima([])).toBeNull()
  })

  it('o critério nos dados reais: 0,28 ponto abaixo da regra, dentro de tudo', () => {
    const robo = curvaDoRobo(opsReais, bhReal)
    const regra = curvaNoPeriodo(curvaReal('media_50d_vol_alvo_40'))
    const c = criterioDoMotor(robo, regra, curvaNoPeriodo(bhReal))
    expect(c.distancia).toBeCloseTo(-0.00276, 4)
    expect(c).toMatchObject({ fidelidadeOk: true, quedaOk: true, relativaOk: null })
    expect(c.quedaBh).toBeLessThan(0.2)
  })

  it('o critério acusa a distância, a queda e a queda diante da do BTC', () => {
    const serie = (ys) => ys.map((y, x) => ({ x, y }))
    const longe = criterioDoMotor(serie([1, 1.0]), serie([1, 1.05]), serie([1, 1]))
    expect(longe.fidelidadeOk).toBe(false)
    // O buy & hold caiu 40%: o robô pode cair até 32%, e caiu 35%.
    const queda = criterioDoMotor(serie([1, 0.65]), serie([1, 0.65]), serie([1, 0.6]))
    expect(queda).toMatchObject({ quedaOk: true, relativaOk: false })
    expect(queda.limiteRelativo).toBeCloseTo(0.32, 12)
    expect(criterioDoMotor(serie([1, 0.45]), serie([1, 0.45]), serie([1, 0.4])).quedaOk).toBe(false)
  })
})

describe('as noites do robô', () => {
  const agora = Date.parse('2026-10-28T19:30:00Z')

  it('nos dados reais: a venda de 23/10 e quatro noites de manter, fora do mercado', () => {
    const noites = noitesDoRobo(SEQUENCIAS_ROBO, opsReais, { ultimoDiaDoZoo: ultimoDiaDaCurva(bhReal), agora })
    expect(noites.map((n) => new Date(n.dia).toISOString().slice(0, 10)))
      .toEqual(['2026-10-27', '2026-10-26', '2026-10-25', '2026-10-24', '2026-10-23'])
    expect(noites[0]).toMatchObject({ decisao: 'manter', rodou: true, operacoes: [], execucao: null, depois: 'fora' })
    expect(noites.at(-1)).toMatchObject({ decisao: 'vender', execucao: 'feita', depois: 'fora' })
    expect(noites.at(-1).operacoes[0].dataHora).toBe('2026-10-24T00:00:00')
  })

  it('a noite sem a linha das 23h é a noite em que o robô não rodou', () => {
    const sem25 = SEQUENCIAS_ROBO.filter((s) => !s.dataHora.startsWith('2026-10-25'))
    const noites = noitesDoRobo(sem25, opsReais, { agora })
    expect(noites.find((n) => n.dia === Date.UTC(2026, 9, 25))).toMatchObject({ rodou: false, decisao: null })
  })

  it('o zoo estende as noites até o dia dele, e a busca cortada não inventa noite perdida', () => {
    const noites = noitesDoRobo(SEQUENCIAS_ROBO, opsReais, { ultimoDiaDoZoo: Date.UTC(2026, 9, 28), agora })
    expect(noites[0]).toMatchObject({ dia: Date.UTC(2026, 9, 28), rodou: false })
    const cortada = noitesDoRobo(SEQUENCIAS_ROBO, opsReais, { desde: Date.UTC(2026, 9, 26), agora })
    expect(cortada.map((n) => n.dia)).toEqual([Date.UTC(2026, 9, 27), Date.UTC(2026, 9, 26)])
  })

  it('sem a lista de operações, não diz o que executou nem onde o robô ficou', () => {
    const noites = noitesDoRobo(SEQUENCIAS_ROBO, undefined, { agora })
    expect(noites.at(-1)).toMatchObject({ decisao: 'vender', operacoes: null, execucao: null, depois: null })
  })

  it('a compra sem operação espera a ativação seguinte e depois é dada como não executada', () => {
    const compra = [{ dataHora: '2026-10-29T23:00:00', tipo: 1 }]
    const noite = (momento) => noitesDoRobo(compra, [], { agora: Date.parse(momento) })[0]
    expect(noite('2026-10-30T00:30:00Z').execucao).toBe('pendente')
    expect(noite('2026-10-30T09:00:00Z').execucao).toBe('perdida')
  })

  it('a busca de velas diz quando veio cortada', () => {
    const registros = [{ dataHora: '2026-10-27T23:00:00' }, { dataHora: '2026-10-26T05:00:00' }]
    expect(sequenciasDaBusca({ totalRegistros: 2, registros }).desde).toBeNull()
    expect(sequenciasDaBusca({ totalRegistros: 900, registros }).desde).toBe(Date.UTC(2026, 9, 26))
    expect(sequenciasDaBusca(undefined)).toEqual({ registros: [], desde: null })
  })
})

describe('modo demo do robô ao vivo', () => {
  it('historicoDecisoes filtra pela moeda e pela data, como a API', () => {
    const resp = getMockResponse({
      endpoint: HistoricoDecisaoEndpoint.LIST({ siglaMoeda: 'BTC', dataInicio: ATIVACAO_MOTOR, quantidade: 200 }),
      method: 'GET',
    })
    expect(resp.resultado.totalRegistros).toBe(1)
    expect(resp.resultado.registros[0]).toMatchObject({ acao: 'VenderTudo', dataHora: '2026-10-24T00:00:00', moedaSigla: 'BTC' })
  })

  it('a curva do zoo pedida com data traz os pontos reais do período', () => {
    const resp = getMockResponse({
      endpoint: '/api/ZooEstrategia/curva?moeda=BTC&estrategias=media_50d_vol_alvo_40,buy_hold&dataInicio=2026-10-22',
      method: 'GET',
    })
    const regra = resp.resultado.find((c) => c.estrategia === 'media_50d_vol_alvo_40')
    expect(regra.pontos.map((p) => p.data.slice(0, 10)))
      .toEqual(['2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27'])
    expect(regra.pontos.at(-1).exposicao).toBe(0)
  })

  it('sequenciasRetorno do robô filtra pela moeda e pela data, como a API, da mais recente para a mais antiga', () => {
    const resp = getMockResponse({
      endpoint: SequenciaRetornoEndpoint.LIST({ siglaMoeda: 'BTC', dataInicio: '2026-10-25T00:00:00Z', quantidade: 400 }),
      method: 'GET',
    })
    expect(resp.resultado.totalRegistros).toBe(3)
    expect(resp.resultado.registros.map((r) => r.dataHora))
      .toEqual(['2026-10-27T23:00:00', '2026-10-26T23:00:00', '2026-10-25T23:00:00'])
    expect(resp.resultado.registros[0]).toMatchObject({ tipo: 0, moeda: 'BTC' })
  })

  it('a curva do zoo sem data continua a mesma de antes', () => {
    const resp = getMockResponse({ endpoint: '/api/ZooEstrategia/curva?moeda=BTC&estrategias=buy_hold', method: 'GET' })
    expect(resp.resultado[0].pontos.at(-1).data.slice(0, 10)).toBe('2026-10-05')
  })
})
