import { describe, it, expect } from 'vitest'
import {
  UM_MINUTO_MS,
  UMA_HORA_MS,
  cicloDoEpisodio,
  detectarCiclos,
  estatisticas,
  faixaDe,
  filtrarJanela,
  janelaDoPeriodo,
  janelaParaMistura,
  limiarDeLacuna,
  mediaMovel,
  mesclarEpisodios,
  posicaoEntre,
  proporcaoDeAcoes,
  reduzirPontos,
  resumirCiclos,
  resumirPorMoeda,
  resumirVersoes,
  serieSuavizada,
  statusDoTreino,
  tendencia,
  variacao,
  vereditoDoEpisodio,
  vizinhosDe,
} from '../src/utils/treinamento'

const BASE = Date.UTC(2026, 8, 22, 12, 0, 0)
const iso = (ms) => new Date(ms).toISOString()

// Episódio mínimo: o que as funções leem, e nada além.
const ep = (n, minuto, extra = {}) => ({
  idTreinamentoEpisodio: `ep-${n}-${minuto}`,
  episodio: n,
  dataHora: iso(BASE + minuto * UM_MINUTO_MS),
  moeda: 'BTC',
  versaoModelo: 'v1',
  rewardMedio: 0.5,
  winRate: 0.5,
  lossMedia: 1,
  epsilon: 0.5,
  duracaoSegundos: 10,
  ...extra,
})

describe('treinamento › mediaMovel', () => {
  it('usa a janela parcial no começo e a janela cheia depois', () => {
    expect(mediaMovel([1, 2, 3, 4, 5], 3)).toEqual([1, 1.5, 2, 3, 4])
  })

  it('devolve lista vazia para série vazia', () => {
    expect(mediaMovel([], 5)).toEqual([])
  })
})

describe('treinamento › tendencia', () => {
  it('mede a variação total pela reta, não só pelas pontas', () => {
    expect(tendencia([0, 1, 2, 3, 4])).toBeCloseTo(4)
    expect(tendencia([4, 3, 2, 1, 0])).toBeCloseTo(-4)
  })

  it('é zero para série plana e null com menos de 3 pontos', () => {
    expect(tendencia([2, 2, 2, 2])).toBeCloseTo(0)
    expect(tendencia([1, 2])).toBeNull()
  })
})

describe('treinamento › reduzirPontos', () => {
  it('não mexe em série curta', () => {
    expect(reduzirPontos([1, 2, 3], 10)).toEqual([1, 2, 3])
  })

  it('resume série longa pela média de cada fatia', () => {
    const longa = Array.from({ length: 100 }, (_, i) => i)
    const curta = reduzirPontos(longa, 10)
    expect(curta).toHaveLength(10)
    expect(curta[0]).toBeCloseTo(4.5)
    expect(curta[9]).toBeCloseTo(94.5)
  })
})

describe('treinamento › mesclarEpisodios', () => {
  it('acrescenta só o que é novo', () => {
    const a = ep(1, 0)
    const b = ep(2, 1)
    expect(mesclarEpisodios([a], [a, b])).toEqual([a, b])
  })

  it('devolve a mesma lista quando não há novidade, para não re-renderizar', () => {
    const atuais = [ep(1, 0)]
    expect(mesclarEpisodios(atuais, [ep(1, 0)])).toBe(atuais)
    expect(mesclarEpisodios(atuais, [])).toBe(atuais)
  })
})

describe('treinamento › filtrarJanela', () => {
  it('inclui as duas bordas', () => {
    const itens = [ep(1, 0), ep(2, 10), ep(3, 20)]
    const r = filtrarJanela(itens, BASE, BASE + 10 * UM_MINUTO_MS)
    expect(r.map((i) => i.episodio)).toEqual([1, 2])
  })
})

describe('treinamento › detectarCiclos', () => {
  it('abre ciclo novo quando a numeração do episódio cai', () => {
    const timeline = [ep(1, 0), ep(2, 1), ep(3, 2), ep(1, 3), ep(2, 4)]
    const ciclos = detectarCiclos(timeline)
    expect(ciclos.map((c) => [c.de, c.ate, c.total])).toEqual([[0, 2, 3], [3, 4, 2]])
  })

  it('abre ciclo novo numa pausa maior que o limiar, mesmo sem reset', () => {
    const timeline = [ep(1, 0), ep(2, 1), ep(3, 2), ep(4, 60), ep(5, 61)]
    expect(detectarCiclos(timeline)).toHaveLength(2)
  })

  it('não quebra ciclo por um episódio só um pouco lento', () => {
    // Cadência de 1min com um intervalo de 5min: bem abaixo do piso de 30min.
    const timeline = [ep(1, 0), ep(2, 1), ep(3, 2), ep(4, 7), ep(5, 8)]
    expect(detectarCiclos(timeline)).toHaveLength(1)
  })

  it('devolve lista vazia sem episódios', () => {
    expect(detectarCiclos([])).toEqual([])
  })
})

describe('treinamento › limiarDeLacuna', () => {
  it('tem piso de 30 minutos', () => {
    expect(limiarDeLacuna([ep(1, 0), ep(2, 1)])).toBe(30 * UM_MINUTO_MS)
  })
})

describe('treinamento › serieSuavizada', () => {
  it('quebra a linha e recomeça a média numa pausa longa', () => {
    const timeline = [
      ep(1, 0, { rewardMedio: 0 }),
      ep(2, 1, { rewardMedio: 1 }),
      ep(3, 100, { rewardMedio: 10 }),
    ]
    const pontos = serieSuavizada(timeline, 'rewardMedio', 5, 30 * UM_MINUTO_MS)
    expect(pontos.map((p) => p.y)).toEqual([0, 0.5, null, 10])
  })

  it('ignora episódios sem a métrica em vez de contá-los como zero', () => {
    const timeline = [ep(1, 0, { winRate: 0.6 }), ep(2, 1, { winRate: null }), ep(3, 2, { winRate: 0.4 })]
    const pontos = serieSuavizada(timeline, 'winRate', 5)
    expect(pontos).toHaveLength(2)
    expect(pontos[1].y).toBeCloseTo(0.5)
  })
})

describe('treinamento › janelaParaMistura', () => {
  it('cobre duas voltas pelas moedas, entre 5 e 30', () => {
    expect(janelaParaMistura(1)).toBe(5)
    expect(janelaParaMistura(9)).toBe(18)
    expect(janelaParaMistura(40)).toBe(30)
  })
})

describe('treinamento › estatisticas e variacao', () => {
  it('faz a média ignorando valores ausentes', () => {
    const s = estatisticas([ep(1, 0, { winRate: 0.2 }), ep(2, 1, { winRate: undefined })])
    expect(s.total).toBe(2)
    expect(s.winRate).toBeCloseTo(0.2)
  })

  it('não inventa variação quando falta a janela anterior', () => {
    expect(variacao(0.5, null)).toBeNull()
    expect(variacao(0.5, 0.2)).toBeCloseTo(0.3)
  })
})

describe('treinamento › proporcaoDeAcoes', () => {
  it('devolve frações que somam 1', () => {
    const p = proporcaoDeAcoes([ep(1, 0, { acoesHold: 2, acoesCompra: 1, acoesVenda: 1 })])
    expect(p).toMatchObject({ hold: 0.5, compra: 0.25, venda: 0.25, total: 4 })
  })

  it('é null sem nenhuma ação', () => {
    expect(proporcaoDeAcoes([ep(1, 0)])).toBeNull()
  })
})

describe('treinamento › resumirPorMoeda', () => {
  it('separa por moeda, em ordem alfabética, com o melhor episódio de cada uma', () => {
    const timeline = [
      ep(1, 0, { moeda: 'ETH', rewardMedio: 0.1 }),
      ep(2, 1, { moeda: 'BTC', rewardMedio: 0.3 }),
      ep(3, 2, { moeda: 'ETH', rewardMedio: 0.9 }),
      ep(4, 3, { moeda: 'BTC', rewardMedio: 0.2 }),
    ]
    const r = resumirPorMoeda(timeline)
    expect(r.map((m) => m.moeda)).toEqual(['BTC', 'ETH'])
    expect(r[1].melhor.episodio).toBe(3)
    expect(r[0].total).toBe(2)
    expect(r[0].rewardMedio).toBeCloseTo(0.25)
  })
})

describe('treinamento › resumirCiclos', () => {
  it('compara o começo e o fim de cada ciclo', () => {
    const timeline = Array.from({ length: 10 }, (_, i) => ep(i + 1, i, { rewardMedio: i / 10 }))
    const [ciclo] = resumirCiclos(timeline, detectarCiclos(timeline))
    // k = ceil(10/5) = 2 → média de [0, 0.1] e de [0.8, 0.9]
    expect(ciclo.rewardInicio).toBeCloseTo(0.05)
    expect(ciclo.rewardFim).toBeCloseTo(0.85)
    expect(ciclo.duracaoMs).toBe(9 * UM_MINUTO_MS)
    expect(ciclo.versoes).toEqual(['v1'])
  })
})

describe('treinamento › resumirVersoes', () => {
  it('agrupa por versão com o período de cada uma', () => {
    const timeline = [ep(1, 0, { versaoModelo: 'v1' }), ep(2, 1, { versaoModelo: 'v2' }), ep(3, 2, { versaoModelo: 'v2' })]
    const r = resumirVersoes(timeline)
    expect(r.map((v) => [v.versao, v.total])).toEqual([['v1', 1], ['v2', 2]])
    expect(r[1].inicio).toBe(BASE + UM_MINUTO_MS)
  })
})

describe('treinamento › statusDoTreino', () => {
  it('está ativo dentro do limite e parado fora dele', () => {
    const agora = BASE + UMA_HORA_MS
    expect(statusDoTreino(agora - 60_000, agora, 20_000).ativo).toBe(true)
    expect(statusDoTreino(agora - 10 * UM_MINUTO_MS, agora, 20_000).ativo).toBe(false)
  })

  it('usa dez cadências quando isso passa do piso de 5 minutos', () => {
    const agora = BASE + UMA_HORA_MS
    // Cadência de 2min → limite de 20min.
    expect(statusDoTreino(agora - 15 * UM_MINUTO_MS, agora, 2 * UM_MINUTO_MS).ativo).toBe(true)
  })

  it('é null sem episódio', () => {
    expect(statusDoTreino(null, BASE, 1000)).toBeNull()
  })
})

describe('treinamento › janelaDoPeriodo', () => {
  it('ancora no episódio mais recente, não no relógio', () => {
    const j = janelaDoPeriodo({ duracaoMs: UMA_HORA_MS, fimMs: null }, BASE)
    expect(j).toMatchObject({ inicio: BASE - UMA_HORA_MS, fim: BASE, ancorada: true })
    expect(j.anterior).toEqual({ inicio: BASE - 2 * UMA_HORA_MS, fim: BASE - UMA_HORA_MS - 1 })
  })

  it('respeita o fim escolhido ao navegar para trás', () => {
    const j = janelaDoPeriodo({ duracaoMs: UMA_HORA_MS, fimMs: BASE - UMA_HORA_MS }, BASE)
    expect(j).toMatchObject({ fim: BASE - UMA_HORA_MS, ancorada: false })
  })

  it('é null sem nenhum episódio carregado', () => {
    expect(janelaDoPeriodo({ duracaoMs: UMA_HORA_MS, fimMs: null }, null)).toBeNull()
  })
})

describe('treinamento › vizinhosDe', () => {
  const serie = [0, 1, 2, 3, 4, 5, 6]

  it('pega até `raio` de cada lado, sem o próprio episódio', () => {
    expect(vizinhosDe(serie, 3, 2)).toEqual([1, 2, 4, 5])
  })

  it('corta nas pontas em vez de inventar vizinho', () => {
    expect(vizinhosDe(serie, 0, 2)).toEqual([1, 2])
    expect(vizinhosDe(serie, 6, 2)).toEqual([4, 5])
  })

  it('é vazio quando o episódio não está na série', () => {
    expect(vizinhosDe(serie, -1, 2)).toEqual([])
  })
})

describe('treinamento › faixaDe', () => {
  it('devolve mínimo, média e máximo ignorando ausentes', () => {
    expect(faixaDe([2, null, 4, undefined, 6])).toEqual({ min: 2, max: 6, media: 4, total: 3 })
  })

  it('é null sem números', () => {
    expect(faixaDe([null, undefined])).toBeNull()
  })
})

describe('treinamento › posicaoEntre e vereditoDoEpisodio', () => {
  it('conta quantos ficam abaixo, com empate valendo meio', () => {
    expect(posicaoEntre(3, [1, 2, 3, 4])).toEqual({ abaixo: 2, total: 4, percentil: 0.625 })
  })

  it('julga pelo percentil: 80% ou mais é acima, 20% ou menos é abaixo', () => {
    expect(vereditoDoEpisodio(posicaoEntre(10, [1, 2, 3, 4, 5]))).toBe('acima')
    expect(vereditoDoEpisodio(posicaoEntre(0, [1, 2, 3, 4, 5]))).toBe('abaixo')
    expect(vereditoDoEpisodio(posicaoEntre(3, [1, 2, 3, 4, 5]))).toBe('dentro')
  })

  it('não dá veredito com base pequena demais', () => {
    expect(vereditoDoEpisodio(posicaoEntre(10, [1, 2]))).toBeNull()
    expect(posicaoEntre(null, [1, 2, 3])).toBeNull()
  })
})

describe('treinamento › cicloDoEpisodio', () => {
  it('acha o ciclo e a posição do episódio dentro dele', () => {
    const timeline = [ep(1, 0), ep(2, 1), ep(1, 2), ep(2, 3), ep(3, 4)]
    const c = cicloDoEpisodio(timeline, timeline[3].idTreinamentoEpisodio)
    expect(c).toMatchObject({ de: 2, ate: 4, total: 3, posicao: 2 })
  })

  it('é null para episódio fora da timeline', () => {
    expect(cicloDoEpisodio([ep(1, 0)], 'outro')).toBeNull()
  })
})
