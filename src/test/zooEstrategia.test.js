import { describe, expect, it } from 'vitest'
import { getMockResponse } from '../src/utils/mockApi'
import { RODADA_ZOO } from '../src/utils/mockZooEstrategia'
import {
  estrategiaDaRodada,
  estrategiaPadrao,
  formatarDiaUtc,
  HORAS_PARA_ATRASO,
  horasDesdeARodada,
  linhaDaMoeda,
  moedaPadrao,
  moedasDaRodada,
  noDiaLocal,
  nomeDaEstrategia,
  piorQueda,
  pontosDaCurva,
  quedaDaCurva,
  resultadoDoAno,
  rodadaAtrasada,
  subtituloDaQueda,
} from '../src/utils/zooEstrategia'

describe('zoo › rodada atrasada', () => {
  // A rodada de 08/10/2026, às 00:31 UTC, como a API entrega depois do apiClient.
  const rodadaDe = '2026-10-08T00:31:00Z'
  const horasDepois = (h) => new Date(rodadaDe).getTime() + h * 3_600_000

  it('conta as horas inteiras desde a rodada', () => {
    expect(horasDesdeARodada(rodadaDe, horasDepois(5.9))).toBe(5)
    expect(horasDesdeARodada(rodadaDe, horasDepois(52))).toBe(52)
    expect(horasDesdeARodada('não é data', horasDepois(1))).toBeNull()
    expect(horasDesdeARodada(undefined, horasDepois(1))).toBeNull()
  })

  it('a rodada de ontem não é atraso; passada a seguinte, com folga, é', () => {
    // Às 23:59 UTC do mesmo dia: a próxima ainda nem era para ter saído.
    expect(rodadaAtrasada(rodadaDe, horasDepois(23.5))).toBe(false)
    // A das 00:30 do dia seguinte pode levar uns minutos, e a máquina pode ter
    // ligado de manhã e rodado a perdida: até 30 h, sem aviso.
    expect(rodadaAtrasada(rodadaDe, horasDepois(HORAS_PARA_ATRASO - 0.1))).toBe(false)
    expect(rodadaAtrasada(rodadaDe, horasDepois(HORAS_PARA_ATRASO))).toBe(true)
    expect(rodadaAtrasada(rodadaDe, horasDepois(72))).toBe(true)
  })

  it('sem data válida não acusa atraso', () => {
    expect(rodadaAtrasada(null, horasDepois(100))).toBe(false)
  })
})

const rodada = {
  estrategias: [
    { estrategia: 'buy_hold', porMoeda: [{ moeda: 'ETH' }, { moeda: 'BTC' }] },
    { estrategia: 'media_50d_vol_alvo_40', porMoeda: [{ moeda: 'BTC', cagr: 0.39 }, { moeda: 'ADA' }] },
    { estrategia: 'caixa', porMoeda: [] },
  ],
}

describe('zoo › escolhas padrão', () => {
  it('escolhe a primeira estratégia do ranking que não é referência', () => {
    expect(estrategiaPadrao(rodada)).toBe('media_50d_vol_alvo_40')
  })

  it('sem estratégia de verdade, fica na primeira referência; sem nada, nulo', () => {
    expect(estrategiaPadrao({ estrategias: [{ estrategia: 'buy_hold' }, { estrategia: 'caixa' }] })).toBe('buy_hold')
    expect(estrategiaPadrao({ estrategias: [] })).toBeNull()
    expect(estrategiaPadrao(null)).toBeNull()
  })

  it('junta as moedas de todas as estratégias, em ordem, e prefere BTC', () => {
    expect(moedasDaRodada(rodada)).toEqual(['ADA', 'BTC', 'ETH'])
    expect(moedaPadrao(['ADA', 'BTC'])).toBe('BTC')
    expect(moedaPadrao(['ADA', 'ETH'])).toBe('ADA')
    expect(moedaPadrao([])).toBeNull()
  })

  it('acha a linha de uma moeda dentro da estratégia', () => {
    expect(linhaDaMoeda(rodada, 'media_50d_vol_alvo_40', 'BTC')).toEqual({ moeda: 'BTC', cagr: 0.39 })
    expect(linhaDaMoeda(rodada, 'media_50d_vol_alvo_40', 'ETH')).toBeNull()
  })
})

describe('zoo › nome da estratégia', () => {
  it('usa o dicionário quando ele conhece a estratégia', () => {
    const t = (chave) => (chave === 'zoo.nomes.caixa' ? 'Caixa' : chave)
    expect(nomeDaEstrategia(t, 'caixa', 'fora o tempo todo')).toBe('Caixa')
  })

  it('estratégia nova cai na descrição do worker e, sem ela, no identificador', () => {
    const t = (chave) => chave
    expect(nomeDaEstrategia(t, 'nova_regra', 'uma regra nova')).toBe('uma regra nova')
    expect(nomeDaEstrategia(t, 'nova_regra', null)).toBe('nova_regra')
  })
})

describe('zoo › curva e queda', () => {
  it('converte a curva para pontos do gráfico, sem os nulos', () => {
    const curva = {
      pontos: [
        { data: '2018-03-04T00:00:00Z', patrimonio: 0.999 },
        { data: '2018-03-11T00:00:00Z', patrimonio: null },
        { data: '2018-03-18T00:00:00Z', patrimonio: 1.1 },
      ],
    }
    expect(pontosDaCurva(curva)).toEqual([
      { x: Date.UTC(2018, 2, 4), y: 0.999 },
      { x: Date.UTC(2018, 2, 18), y: 1.1 },
    ])
    expect(pontosDaCurva(null)).toEqual([])
  })

  it('mede a queda a partir do topo, contando o capital inicial como o primeiro topo', () => {
    const pontos = [0.999, 1.2, 0.6, 1.3].map((y, x) => ({ x, y }))
    const queda = quedaDaCurva(pontos)
    expect(queda.map((p) => Number(p.y.toFixed(4)))).toEqual([-0.001, 0, -0.5, 0])
    expect(piorQueda(queda)).toBeCloseTo(-0.5)
    expect(piorQueda([])).toBe(0)
  })
})

describe('zoo › subtítulo da queda', () => {
  // O formato das células da tela, uma casa: -0,4569 -> "-45,7%".
  const formatar = (v) => `${(v * 100).toFixed(1).replace('.', ',')}%`
  const queda = (pior) => [{ x: 0, y: 0 }, { x: 1, y: pior }]

  // A SOL na média de 50 dias + vol-alvo de 40%, rodada de 09/11/2026: a tabela
  // "Por moeda" deu -45,7% (fundo diário numa terça, 18/08/2026) e o gráfico,
  // com os pontos de domingo, -44,8%. Reproduzido com os candles reais e o
  // próprio zoo do worker: -45,69% na curva diária, -44,81% nos 310 pontos.
  const solDaRodada = { quedaMaxima: -0.4569, quedaMaximaBuyHold: -0.9627 }

  it('mostra as duas contas quando a diária da tabela difere da semanal do gráfico', () => {
    const sub = subtituloDaQueda({ queda: queda(-0.4481), quedaBh: queda(-0.96), linha: solDaRodada, formatar })
    expect(sub).toEqual({
      chave: 'zoo.drawdownSubDiaria',
      vars: { pior: '-44,8%', piorBh: '-96,0%', piorDiaria: '-45,7%', piorBhDiaria: '-96,3%' },
    })
  })

  it('basta o buy & hold diferir para mostrar as duas', () => {
    const linha = { quedaMaxima: -0.4481, quedaMaximaBuyHold: -0.9627 }
    expect(subtituloDaQueda({ queda: queda(-0.4481), quedaBh: queda(-0.96), linha, formatar }).chave).toBe('zoo.drawdownSubDiaria')
  })

  it('diz que é a mesma da tabela quando os números formatados batem', () => {
    const linha = { quedaMaxima: -0.44812, quedaMaximaBuyHold: -0.96004 }
    const sub = subtituloDaQueda({ queda: queda(-0.4481), quedaBh: queda(-0.96), linha, formatar })
    expect(sub).toEqual({ chave: 'zoo.drawdownSubIgual', vars: { pior: '-44,8%', piorBh: '-96,0%' } })
  })

  it('sem a linha da tabela, fica o aviso dos pontos semanais', () => {
    for (const linha of [null, { quedaMaxima: null }]) {
      expect(subtituloDaQueda({ queda: queda(-0.4481), quedaBh: queda(-0.96), linha, formatar }).chave).toBe('zoo.drawdownSub')
    }
  })
})

describe('zoo › datas de fechamento', () => {
  it('mostra o dia UTC com o ano, sem cair na véspera do fuso local', () => {
    expect(formatarDiaUtc('2018-03-04T00:00:00Z', 'pt-BR')).toBe('04/03/2018')
    expect(formatarDiaUtc('2018-03-04T00:00:00Z', 'en-US')).toBe('03/04/2018')
    expect(formatarDiaUtc('não é data', 'pt-BR')).toBe('–')
  })

  it('leva o dia UTC para a meia-noite local do mesmo dia do calendário', () => {
    const local = new Date(noDiaLocal(Date.UTC(2018, 2, 4)))
    expect([local.getFullYear(), local.getMonth(), local.getDate(), local.getHours()]).toEqual([2018, 2, 4, 0])
  })
})

describe('zoo › veredito do ano', () => {
  it.each([
    [true, true, 'ok'],
    [false, true, 'retorno'],
    [true, false, 'queda'],
    [false, false, 'ambas'],
  ])('retornoOk=%s, quedaOk=%s → %s', (retornoOk, quedaOk, esperado) => {
    expect(resultadoDoAno({ retornoOk, quedaOk })).toBe(esperado)
  })
})

describe('zoo › modo demo', () => {
  it('entrega a rodada com as estratégias em ordem de ranking', () => {
    const { resultado } = getMockResponse({ endpoint: '/api/ZooEstrategia/rodada', method: 'GET' })
    expect(resultado.estrategias.length).toBeGreaterThan(2)
    const aprovadas = resultado.estrategias.map((e) => e.moedasAprovadas)
    expect(aprovadas).toEqual([...aprovadas].sort((a, b) => b - a))
    expect(resultado.estrategias.every((e) => e.porMoeda.length > 0)).toBe(true)
  })

  it('entrega uma curva por estratégia pedida, em ordem de nome e com data ISO', () => {
    const { resultado } = getMockResponse({
      endpoint: '/api/ZooEstrategia/curva?moeda=btc&estrategias=media_50d_vol_alvo_40,buy_hold',
      method: 'GET',
    })
    expect(resultado.map((c) => c.estrategia)).toEqual(['buy_hold', 'media_50d_vol_alvo_40'])
    const [primeiro, segundo] = resultado[0].pontos
    expect(resultado[0].moeda).toBe('BTC')
    expect(new Date(primeiro.data).getTime()).toBeLessThan(new Date(segundo.data).getTime())
    expect(primeiro.patrimonio).toBeGreaterThan(0)
  })

  it('recusa a curva sem moeda, como a API', () => {
    expect(() => getMockResponse({ endpoint: '/api/ZooEstrategia/curva', method: 'GET' })).toThrow(/moeda/)
  })

})

describe('zoo › escolha guardada', () => {
  it('a escolha que não existe na rodada cai na padrão', () => {
    const historico = { estrategias: [{ estrategia: 'buy_hold' }, { estrategia: 'acima_media_50d' }] }
    expect(estrategiaDaRodada(historico, 'agente_dqn')).toBe('acima_media_50d')
    expect(estrategiaDaRodada(historico, 'buy_hold')).toBe('buy_hold')
    expect(estrategiaDaRodada(null, 'agente_dqn')).toBeNull()
  })
})

describe('as rodadas gravadas do modo demonstração', () => {
  // São a gravação de uma rodada real, e o número dali não se altera: o PR 120 pôs 10/10 no resumo
  // de uma estratégia com as 10 moedas reprovadas, e o Trader passou a ver a contradição na tela.
  it.each([
    ['zoo', RODADA_ZOO],
  ])('o resumo de cada estratégia bate com as moedas dela (%s)', (_, rodada) => {
    rodada.estrategias.forEach((e) => {
      const aprovadas = e.porMoeda.filter((m) => m.aprovada).length
      expect(e.moedasAprovadas, e.estrategia).toBe(aprovadas)
      expect(e.aprovada, e.estrategia).toBe(aprovadas > 0 && aprovadas === e.moedas)
    })
  })
})
