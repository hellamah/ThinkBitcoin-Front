import { describe, expect, it } from 'vitest'
import { HistoricoDecisaoEndpoint, RoboAoVivoEndpoint, SequenciaRetornoEndpoint } from '../src/utils/apiClient'
import { getMockResponse } from '../src/utils/mockApi'
import { DECISOES_ROBO, PLACAR_ROBO, SEQUENCIAS_ROBO } from '../src/utils/mockRoboAoVivo'
import {
  ATIVACAO_MOTOR,
  carteirasDoRobo,
  chaveDaAcao,
  diaDaDecisao,
  estadoDeHoje,
  executouAoReligar,
  instanteUtc,
  noitesDoRobo,
  operacoesDoMotor,
  sequenciasDaBusca,
  seriesDoPlacar,
  ultimoDiaDoPlacar,
} from '../src/utils/roboAoVivo'

// As contas da tela do robô ao vivo (/robo-ao-vivo) e o modo demo dela. O
// robô é o motor de risco, que decide no BTC desde 23/10/2026 às 11:49 UTC;
// as operações de antes são do DQN encerrado e não entram.
//
// A conta do placar (a curva do robô, as do zoo e o critério) saiu daqui em
// 28/10/2026 e foi para o .NET; os casos dela, com os mesmos números reais,
// estão em RoboAoVivo/CalculoPlacarRoboTests.cs daquele repositório.

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

  it('diz dentro ou fora pela última operação, e pela dose da regra quando não há operação', () => {
    expect(estadoDeHoje([op('VenderTudo', '2026-10-24T00:00:00')], 0)).toEqual({ estado: 'fora', dose: 0 })
    expect(estadoDeHoje([op('ComprarParcial', '2026-10-26T00:00:00')], 0).estado).toBe('dentro')
    expect(estadoDeHoje([], 0.62)).toEqual({ estado: 'dentro', dose: 0.62 })
    expect(estadoDeHoje([], null)).toEqual({ estado: null, dose: null })
  })

  it('traduz as ações do enum do .NET e deixa a desconhecida crua', () => {
    expect(chaveDaAcao('VenderParcial')).toBe('robo.acoes.VenderParcial')
    expect(chaveDaAcao('Outra')).toBeNull()
  })
})

describe('o placar do .NET na tela', () => {
  it('vira três séries para o gráfico, cada uma só nos dias em que existe', () => {
    const series = seriesDoPlacar({ pontos: [
      { data: '2026-10-22T00:00:00', robo: null, regra: 1, buyHold: 1 },
      { data: '2026-10-23T00:00:00', robo: 1, regra: 0.999, buyHold: 0.997 },
    ] })
    expect(series.robo).toEqual([{ x: Date.UTC(2026, 9, 23), y: 1 }])
    expect(series.regra.map((p) => p.y)).toEqual([1, 0.999])
    expect(series.bh.map((p) => p.x)).toEqual([Date.UTC(2026, 9, 22), Date.UTC(2026, 9, 23)])
    expect(seriesDoPlacar(undefined)).toEqual({ robo: [], regra: [], bh: [] })
  })

  it('o último fechamento do placar estende as noites', () => {
    expect(ultimoDiaDoPlacar(PLACAR_ROBO)).toBe(Date.UTC(2026, 9, 27))
    expect(ultimoDiaDoPlacar(null)).toBeNull()
  })
})

// As operações reais do banco (lidas em 25/10/2026, mockRoboAoVivo.js): a venda
// de 24/10 às 00h, que fechou a posição que o DQN deixou.
const opsReais = operacoesDoMotor(DECISOES_ROBO)

const operacao = (acao, dataHora, quantidade, preco, saldoAnterior, saldoPosterior, precoCompra = preco) => ({
  idHistoricoDecisao: `${acao}-${dataHora}`, acao, dataHora, quantidade, precoMercado: preco, precoCompra, saldoAnterior, saldoPosterior,
})

describe('a carteira e o dia de cada operação', () => {
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
})

describe('as noites do robô', () => {
  const agora = Date.parse('2026-10-28T19:30:00Z')

  it('nos dados reais: a venda de 23/10 e quatro noites de manter, fora do mercado', () => {
    const noites = noitesDoRobo(SEQUENCIAS_ROBO, opsReais, { ultimoDiaDoZoo: ultimoDiaDoPlacar(PLACAR_ROBO), agora })
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

  it('o placar estende as noites até o dia dele, e a busca cortada não inventa noite perdida', () => {
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

  it('o placar vem pronto, com os números do .NET nos dados reais', () => {
    const resp = getMockResponse({ endpoint: RoboAoVivoEndpoint.PLACAR, method: 'GET' })
    expect(resp.resultado.pontos).toHaveLength(6)
    expect(resp.resultado.criterio).toMatchObject({ situacao: 'dentro', fidelidadeOk: true, relativaOk: null })
    // Os mesmos de CalculoPlacarRoboTests.cs: robô 0,28 ponto abaixo da regra.
    expect(resp.resultado.criterio.distancia).toBeCloseTo(-0.00276, 4)
    expect(resp.resultado.ultimaConferencia).toBeNull()
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
