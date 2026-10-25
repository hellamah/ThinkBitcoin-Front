import { describe, expect, it } from 'vitest'
import { HistoricoDecisaoEndpoint } from '../src/utils/apiClient'
import { getMockResponse } from '../src/utils/mockApi'
import {
  ATIVACAO_MOTOR,
  chaveDaAcao,
  curvaNoPeriodo,
  doseDaRegra,
  estadoDeHoje,
  instanteUtc,
  operacoesDoMotor,
  retornoDoPeriodo,
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
    expect(regra.pontos.map((p) => p.data.slice(0, 10))).toEqual(['2026-10-22', '2026-10-23', '2026-10-24'])
    expect(regra.pontos.at(-1).exposicao).toBe(0)
  })

  it('a curva do zoo sem data continua a mesma de antes', () => {
    const resp = getMockResponse({ endpoint: '/api/ZooEstrategia/curva?moeda=BTC&estrategias=buy_hold', method: 'GET' })
    expect(resp.resultado[0].pontos.at(-1).data.slice(0, 10)).toBe('2026-10-05')
  })
})
