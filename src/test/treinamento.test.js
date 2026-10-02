import { describe, it, expect } from 'vitest'
import {
  PERIODO_PADRAO,
  UM_MINUTO_MS,
  UMA_HORA_MS,
  cicloDoEpisodio,
  cicloQueContem,
  cortesEntreCiclos,
  decisaoDaAvaliacao,
  detectarCiclos,
  duracaoDoParam,
  duracaoParaParam,
  enquadrarCiclo,
  episodiosParaCSV,
  estatisticas,
  evolucaoPorMoeda,
  faixaDe,
  filtrarJanela,
  janelaDoPeriodo,
  janelaParaMistura,
  limiarDeLacuna,
  mediaMovel,
  mesclarEpisodios,
  ordenarPorData,
  paramsDoPeriodo,
  patamaresDosCiclos,
  periodoDaUrl,
  periodoDoCiclo,
  pisoDoEpsilon,
  pontosBrutos,
  posicaoEntre,
  proporcaoDeAcoes,
  reduzirPontos,
  resumirCiclos,
  resumirPorMoeda,
  resumirVersoes,
  resumoDasAvaliacoes,
  ritmoPorHora,
  rodadaDoEpisodio,
  serieDasAvaliacoes,
  serieSuavizada,
  statusDoTreino,
  tendencia,
  treinoTerminou,
  variacao,
  variacaoEntreVelas,
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

  // A API repete o episódio da virada entre dois blocos de 4h (fim inclusivo)
  // e entre páginas; o lote novo junta os dois.
  it('não duplica episódio repetido dentro do próprio lote novo', () => {
    const a = ep(1, 0)
    const b = ep(2, 1)
    expect(mesclarEpisodios([], [a, b, b])).toEqual([a, b])
    expect(mesclarEpisodios([a], [b, b, a])).toEqual([a, b])
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

  // Nos dados reais o treino grava vários episódios no mesmo segundo, e a API
  // os devolve em ordem decrescente: #189 antes de #187 às 01:49:23. Ordenado
  // só pela hora, isso parecia um reinício e partia o ciclo em pedaços.
  it('não abre ciclo por episódios gravados no mesmo segundo fora de ordem', () => {
    const mesmoSegundo = (n) => ep(n, 2, { idTreinamentoEpisodio: `mesmo-${n}` })
    const timeline = ordenarPorData([ep(1, 0), ep(2, 1), mesmoSegundo(5), mesmoSegundo(3), mesmoSegundo(4), ep(6, 3)])
    expect(timeline.map((r) => r.episodio)).toEqual([1, 2, 3, 4, 5, 6])
    expect(detectarCiclos(timeline)).toHaveLength(1)
  })

  it('tolera um recuo pequeno colado no anterior, mesmo em segundos diferentes', () => {
    const s = (n, segundo) => ({ ...ep(n, 0), idTreinamentoEpisodio: `s-${n}`, dataHora: iso(BASE + segundo * 1000) })
    const timeline = [s(10, 0), s(12, 1), s(11, 2), s(13, 3)]
    expect(detectarCiclos(timeline)).toHaveLength(1)
  })

  it('segue abrindo ciclo no reinício de verdade, como 300 → 1', () => {
    const timeline = [ep(299, 0), ep(300, 1), ep(1, 7), ep(2, 8)]
    expect(detectarCiclos(timeline).map((c) => [c.epInicio, c.epFim])).toEqual([[299, 300], [1, 2]])
  })
})

describe('treinamento › cicloQueContem', () => {
  // A janela corta o ciclo da borda: dentro dela, ele "começa" no meio.
  it('acha o ciclo inteiro de um trecho cortado pela janela', () => {
    const timeline = [ep(1, 0), ep(2, 1), ep(3, 2), ep(1, 9), ep(2, 10)]
    const inteiros = detectarCiclos(timeline)
    const naJanela = detectarCiclos(filtrarJanela(timeline, BASE + UM_MINUTO_MS, BASE + 10 * UM_MINUTO_MS))
    expect(naJanela[0].inicio).toBe(BASE + UM_MINUTO_MS)
    expect(cicloQueContem(inteiros, naJanela[0].inicio)).toMatchObject({ inicio: BASE, total: 3 })
  })

  it('é null fora de qualquer ciclo', () => {
    expect(cicloQueContem(detectarCiclos([ep(1, 0), ep(2, 1)]), BASE + UMA_HORA_MS)).toBeNull()
  })
})

describe('treinamento › limiarDeLacuna', () => {
  it('tem piso de 30 minutos', () => {
    expect(limiarDeLacuna([ep(1, 0), ep(2, 1)])).toBe(30 * UM_MINUTO_MS)
  })
})

describe('treinamento › serieSuavizada', () => {
  it('quebra a linha e recomeça a média numa pausa longa', () => {
    // Um episódio por minuto, e uma pausa de 97 min sem reinício da numeração.
    const timeline = [
      ep(1, 0, { rewardMedio: 0 }),
      ep(2, 1, { rewardMedio: 1 }),
      ep(3, 2, { rewardMedio: 2 }),
      ep(4, 100, { rewardMedio: 10 }),
      ep(5, 101, { rewardMedio: 20 }),
    ]
    const cortes = cortesEntreCiclos(detectarCiclos(timeline))
    const pontos = serieSuavizada(timeline, 'rewardMedio', 5, cortes)
    expect(pontos.map((p) => p.y)).toEqual([0, 0.5, 1, null, 10, 15])
  })

  // O caso dos dados reais: 300 → 1 com 7 min entre um treino e o outro,
  // abaixo do limiar de lacuna. Cortando só em pausa longa, a média do começo
  // do treino novo carregava o fim do anterior.
  it('quebra a linha no reinício do treino mesmo sem pausa longa', () => {
    const timeline = [
      ep(299, 0, { rewardMedio: 0.5 }),
      ep(300, 1, { rewardMedio: 0.5 }),
      ep(1, 8, { rewardMedio: -0.1 }),
      ep(2, 9, { rewardMedio: -0.1 }),
    ]
    const cortes = cortesEntreCiclos(detectarCiclos(timeline))
    expect(cortes).toEqual([BASE + 8 * UM_MINUTO_MS])
    expect(serieSuavizada(timeline, 'rewardMedio', 5, cortes).map((p) => p.y)).toEqual([0.5, 0.5, null, -0.1, -0.1])
  })

  it('corta a série de uma moeda nos ciclos da timeline inteira', () => {
    const timeline = [
      ep(299, 0, { moeda: 'BTC', rewardMedio: 1 }),
      ep(300, 1, { moeda: 'ETH', rewardMedio: 1 }),
      ep(1, 8, { moeda: 'ETH', rewardMedio: 0 }),
      ep(2, 9, { moeda: 'BTC', rewardMedio: 0 }),
    ]
    const cortes = cortesEntreCiclos(detectarCiclos(timeline))
    const doBtc = timeline.filter((r) => r.moeda === 'BTC')
    expect(serieSuavizada(doBtc, 'rewardMedio', 5, cortes).map((p) => p.y)).toEqual([1, null, 0])
  })

  it('não corta antes do primeiro ponto', () => {
    const timeline = [ep(1, 10, { rewardMedio: 1 }), ep(2, 11, { rewardMedio: 3 })]
    expect(serieSuavizada(timeline, 'rewardMedio', 5, [BASE]).map((p) => p.y)).toEqual([1, 2])
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
    const s = estatisticas([ep(1, 0, { acertoTrades: 0.2 }), ep(2, 1, { acertoTrades: undefined })])
    expect(s.total).toBe(2)
    expect(s.acertoTrades).toBeCloseTo(0.2)
  })

  it('o acerto é por trade: episódio sem contagem de trades não entra como zero', () => {
    const s = estatisticas([ep(1, 0, { acertoTrades: 0.6, winRate: 0.3 }), ep(2, 1, { acertoTrades: null, winRate: 0.5 })])
    expect(s.acertoTrades).toBeCloseTo(0.6)
    expect(s).not.toHaveProperty('winRate')
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

  // Nos dados reais, 5 a 8 min sem episódio entre um treino e o seguinte:
  // passava do piso de 5 min, e a tela dizia "Parado" a cada virada.
  it('fica entre treinos quando o último terminou um treino, até 15 min', () => {
    const agora = BASE + UMA_HORA_MS
    expect(statusDoTreino(agora - 7 * UM_MINUTO_MS, agora, 20_000, true)).toMatchObject({ ativo: false, entreTreinos: true })
    expect(statusDoTreino(agora - 20 * UM_MINUTO_MS, agora, 20_000, true).entreTreinos).toBe(false)
    expect(statusDoTreino(agora - 7 * UM_MINUTO_MS, agora, 20_000, false).entreTreinos).toBe(false)
    expect(statusDoTreino(agora - 60_000, agora, 20_000, true)).toMatchObject({ ativo: true, entreTreinos: false })
  })
})

// Um treino de 10 episódios, um por minuto: o epsilon cai de 1 e chega ao
// piso (0,05) nos quatro últimos, que é onde o reward vira o patamar.
const treino = (inicioMin, rewardNoPiso, extra = {}) =>
  Array.from({ length: 10 }, (_, i) => ep(i + 1, inicioMin + i, {
    epsilon: i < 6 ? 1 - i * 0.15 : 0.05,
    rewardMedio: i < 6 ? -0.1 : rewardNoPiso,
    ...extra,
  }))

describe('treinamento › patamares entre treinos', () => {
  const tresTreinos = [...treino(0, 0.3), ...treino(12, 0.35), ...treino(24, 0.45)]

  it('o piso é o menor epsilon da série', () => {
    expect(pisoDoEpsilon(tresTreinos)).toBe(0.05)
    expect(pisoDoEpsilon([])).toBeNull()
  })

  it('o patamar de cada ciclo é o reward com o epsilon no piso, não o do começo', () => {
    const p = patamaresDosCiclos(tresTreinos, detectarCiclos(tresTreinos), 0.05)
    expect(p.map((x) => x.reward)).toEqual([0.3, 0.35, 0.45])
  })

  it('treino que ainda está explorando não tem patamar', () => {
    const timeline = [...treino(0, 0.3), ...treino(12, 0.35).slice(0, 5)]
    expect(patamaresDosCiclos(timeline, detectarCiclos(timeline), 0.05)).toHaveLength(1)
  })

  it('sem nenhum treino no fim do decaimento, não há piso para comparar', () => {
    const soExplorando = treino(0, 0.3).slice(0, 5)
    expect(patamaresDosCiclos(soExplorando, detectarCiclos(soExplorando), pisoDoEpsilon(soExplorando))).toEqual([])
  })

  it('por moeda: a mudança entre treinos pela reta, e o último patamar', () => {
    const e = evolucaoPorMoeda(tresTreinos, detectarCiclos(tresTreinos), 0.05).get('BTC')
    expect(e.patamares).toEqual([0.3, 0.35, 0.45])
    expect(e.tendencia).toBeCloseTo(0.15)
    expect(e.ultimo).toBe(0.45)
  })

  it('com dois treinos, a mudança é a diferença entre eles', () => {
    const dois = [...treino(0, 0.3), ...treino(12, 0.35)]
    expect(evolucaoPorMoeda(dois, detectarCiclos(dois), 0.05).get('BTC').tendencia).toBeCloseTo(0.05)
  })
})

describe('treinamento › treinoTerminou', () => {
  it('é verdade quando o último episódio fecha um treino como os anteriores', () => {
    expect(treinoTerminou([...treino(0, 0.3), ...treino(12, 0.35)])).toBe(true)
  })

  it('é falso no meio de um treino e sem treino completo para comparar', () => {
    expect(treinoTerminou([...treino(0, 0.3), ...treino(12, 0.35).slice(0, 5)])).toBe(false)
    expect(treinoTerminou(treino(0, 0.3))).toBe(false)
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

describe('treinamento › ritmoPorHora', () => {
  // O caso que motivou a conta: ciclo de 45min, um episódio por minuto, dentro
  // de uma janela de 1h. Total ÷ janela dava 45/h para um treino de 60/h.
  it('mede o ritmo pelo tempo em que o treino rodava, não pela janela', () => {
    const timeline = Array.from({ length: 46 }, (_, i) => ep(i + 1, i))
    expect(ritmoPorHora(timeline)).toBeCloseTo(60)
  })

  it('não conta a pausa entre ciclos como tempo de treino', () => {
    const ciclo1 = Array.from({ length: 11 }, (_, i) => ep(i + 1, i))
    const ciclo2 = Array.from({ length: 11 }, (_, i) => ep(i + 1, 100 + i))
    expect(ritmoPorHora([...ciclo1, ...ciclo2])).toBeCloseTo(60)
  })

  it('é null sem intervalo para medir', () => {
    expect(ritmoPorHora([])).toBeNull()
    expect(ritmoPorHora([ep(1, 0)])).toBeNull()
  })
})

describe('treinamento › periodoDoCiclo', () => {
  it('enquadra o ciclo com folga curta e fim fixo', () => {
    const ciclo = { inicio: BASE, fim: BASE + 100 * UM_MINUTO_MS }
    // 2% de 100min = 2min de cada lado.
    expect(periodoDoCiclo(ciclo)).toEqual({ duracaoMs: 104 * UM_MINUTO_MS, fimMs: BASE + 102 * UM_MINUTO_MS })
  })

  it('não deixa a folga passar de um minuto para baixo', () => {
    const ciclo = { inicio: BASE, fim: BASE + 10 * UM_MINUTO_MS }
    expect(periodoDoCiclo(ciclo)).toEqual({ duracaoMs: 12 * UM_MINUTO_MS, fimMs: BASE + 11 * UM_MINUTO_MS })
  })

  it('cobre o ciclo inteiro na janela que gera', () => {
    const ciclo = { inicio: BASE, fim: BASE + 90 * UM_MINUTO_MS }
    const j = janelaDoPeriodo(periodoDoCiclo(ciclo), BASE + 10 * UMA_HORA_MS)
    expect(j.inicio).toBeLessThan(ciclo.inicio)
    expect(j.fim).toBeGreaterThan(ciclo.fim)
  })
})

describe('treinamento › enquadrarCiclo', () => {
  const ciclo = (min) => ({ inicio: BASE + min * UM_MINUTO_MS, fim: BASE + (min + 90) * UM_MINUTO_MS })

  it('guarda o ciclo e o período de antes, para a volta', () => {
    const p = enquadrarCiclo(PERIODO_PADRAO.analise, ciclo(0))
    expect(p).toMatchObject(periodoDoCiclo(ciclo(0)))
    expect(p.foco).toEqual({ inicio: BASE, anterior: { duracaoMs: 24 * UMA_HORA_MS, fimMs: null } })
  })

  it('enquadrar outro ciclo a partir de um enquadramento mantém o período original', () => {
    const original = { duracaoMs: 72 * UMA_HORA_MS, fimMs: BASE }
    const segundo = enquadrarCiclo(enquadrarCiclo(original, ciclo(0)), ciclo(200))
    expect(segundo.foco).toEqual({ inicio: BASE + 200 * UM_MINUTO_MS, anterior: original })
  })
})

describe('treinamento › período na URL', () => {
  const analise = { padrao: PERIODO_PADRAO.analise, maximoMs: 72 * UMA_HORA_MS, aceitaCiclo: true }
  const url = (texto) => new URLSearchParams(texto)

  it('escreve horas quando fecha a hora e minutos, para cima, quando não', () => {
    expect(duracaoParaParam(4 * UMA_HORA_MS)).toBe('4h')
    expect(duracaoParaParam(15 * UM_MINUTO_MS)).toBe('15m')
    expect(duracaoParaParam(62.4 * UM_MINUTO_MS)).toBe('63m')
  })

  it('lê a duração dentro de [1 min, teto] e recusa o resto', () => {
    expect(duracaoDoParam('24h', 72 * UMA_HORA_MS)).toBe(24 * UMA_HORA_MS)
    expect(duracaoDoParam('63m', 72 * UMA_HORA_MS)).toBe(63 * UM_MINUTO_MS)
    expect(duracaoDoParam('9999h', 72 * UMA_HORA_MS)).toBeNull()
    expect(duracaoDoParam('0m', 72 * UMA_HORA_MS)).toBeNull()
    expect(duracaoDoParam('4 h', 72 * UMA_HORA_MS)).toBeNull()
    expect(duracaoDoParam(null, 72 * UMA_HORA_MS)).toBeNull()
  })

  it('o padrão da aba não escreve nada na URL', () => {
    expect(paramsDoPeriodo(PERIODO_PADRAO.analise, PERIODO_PADRAO.analise)).toEqual({})
    expect(periodoDaUrl(url(''), analise)).toEqual(PERIODO_PADRAO.analise)
  })

  it('ida e volta de uma janela navegada para trás', () => {
    const periodo = { duracaoMs: 4 * UMA_HORA_MS, fimMs: BASE }
    const params = paramsDoPeriodo(periodo, PERIODO_PADRAO.analise)
    expect(params).toEqual({ periodo: '4h', ate: '2026-09-22T12:00:00Z' })
    expect(periodoDaUrl(url(params), analise)).toEqual(periodo)
  })

  it('ida e volta de um ciclo enquadrado, sem encolher a janela', () => {
    const ciclo = { inicio: BASE + 12_345, fim: BASE + 90 * UM_MINUTO_MS + 678 }
    const periodo = enquadrarCiclo(PERIODO_PADRAO.analise, ciclo)
    const lido = periodoDaUrl(url(paramsDoPeriodo(periodo, PERIODO_PADRAO.analise)), analise)
    expect(lido.fimMs).toBeGreaterThanOrEqual(periodo.fimMs)
    expect(lido.fimMs - lido.duracaoMs).toBeLessThanOrEqual(periodo.fimMs - periodo.duracaoMs)
    expect(lido.foco).toEqual({ inicio: BASE + 13_000, anterior: PERIODO_PADRAO.analise })
  })

  it('recusa instante sem fuso, que seria lido na hora local de quem abre', () => {
    expect(periodoDaUrl(url('periodo=4h&ate=2026-09-22T12:00:00'), analise)).toEqual({ duracaoMs: 4 * UMA_HORA_MS, fimMs: null })
  })

  it('ciclo só vale com fim e onde a aba aceita', () => {
    const comCiclo = 'periodo=93m&ate=2026-09-22T13:31:00Z&ciclo=2026-09-22T12:00:00Z'
    expect(periodoDaUrl(url(comCiclo), analise).foco).toBeDefined()
    expect(periodoDaUrl(url(comCiclo), { ...analise, aceitaCiclo: false }).foco).toBeUndefined()
    expect(periodoDaUrl(url('ciclo=2026-09-22T12:00:00Z'), analise).foco).toBeUndefined()
  })
})

describe('treinamento › pontosBrutos', () => {
  it('leva o id do episódio no ponto e pula quem não tem a métrica', () => {
    const timeline = [ep(1, 0, { winRate: 0.4 }), ep(2, 1, { winRate: null }), ep(3, 2, { winRate: 0.6 })]
    expect(pontosBrutos(timeline, 'winRate').map((p) => p.id)).toEqual([timeline[0].idTreinamentoEpisodio, timeline[2].idTreinamentoEpisodio])
  })
})

describe('treinamento › episodiosParaCSV', () => {
  it('sai em ordem cronológica, com cabeçalho pelos campos da API', () => {
    const csv = episodiosParaCSV([ep(2, 1), ep(1, 0)])
    const [cabecalho, primeira, segunda] = csv.split('\r\n')
    expect(cabecalho.split(',').slice(0, 4)).toEqual(['idTreinamentoEpisodio', 'episodio', 'dataHora', 'moeda'])
    expect(primeira.split(',')[1]).toBe('1')
    expect(segunda.split(',')[1]).toBe('2')
  })

  // Formatado no idioma da tela, "0,612" partiria a célula ao meio.
  it('grava números crus, com ponto, e a data em ISO UTC', () => {
    const [, linha] = episodiosParaCSV([ep(1, 0, { rewardMedio: 0.612 })]).split('\r\n')
    const celulas = linha.split(',')
    expect(celulas[2]).toBe('2026-09-22T12:00:00.000Z')
    expect(celulas[5]).toBe('0.612')
  })

  it('deixa vazio o que falta, em vez de escrever "null"', () => {
    const [, linha] = episodiosParaCSV([ep(1, 0, { winRate: null })]).split('\r\n')
    expect(linha.split(',')[9]).toBe('')
    expect(linha).not.toContain('null')
    expect(linha).not.toContain('undefined')
  })

  // O win rate por step continua no arquivo, ao lado do acerto por trade.
  it('leva o acerto por trade no fim, com o win rate por step mantido', () => {
    const [cabecalho, linha] = episodiosParaCSV([
      ep(1, 0, { trades: 12, tradesVencedores: 5, acertoTrades: 5 / 12, retornoMedioTrade: 0.0042 }),
    ]).split('\r\n')
    const colunas = cabecalho.split(',')
    expect(colunas).toContain('winRate')
    expect(colunas.slice(-4)).toEqual(['trades', 'tradesVencedores', 'acertoTrades', 'retornoMedioTrade'])
    expect(linha.split(',').slice(-4)).toEqual(['12', '5', String(5 / 12), '0.0042'])
  })
})

describe('treinamento › validação das sessões', () => {
  const sessao = (horas, score, promovido) => ({
    idAvaliacaoSessaoTreino: `s-${horas}`,
    dataHora: iso(BASE + horas * UMA_HORA_MS),
    score,
    promovido,
  })
  // Chegam da API da mais recente para a mais antiga.
  const avaliacoes = [sessao(6, 0.01, false), sessao(4, 0.04, true), sessao(2, -0.02, false), sessao(0, 0.03, true)]

  it('ordena no tempo e acompanha o modelo ao vivo de cada momento', () => {
    const serie = serieDasAvaliacoes(avaliacoes)
    expect(serie.map((a) => a.ms)).toEqual([0, 2, 4, 6].map((h) => BASE + h * UMA_HORA_MS))
    expect(serie.map((a) => a.campeaoVigente)).toEqual([0.03, 0.03, 0.04, 0.04])
  })

  it('sem promoção entre as carregadas, não há modelo ao vivo conhecido', () => {
    expect(serieDasAvaliacoes([sessao(0, -0.01, false)])[0].campeaoVigente).toBeNull()
    expect(resumoDasAvaliacoes([sessao(0, -0.01, false)]).aoVivo).toBeNull()
  })

  it('resume a última sessão, o modelo ao vivo e quantas batem o passivo', () => {
    const r = resumoDasAvaliacoes(avaliacoes)
    expect(r.ultima.idAvaliacaoSessaoTreino).toBe('s-6')
    expect(r.aoVivo.idAvaliacaoSessaoTreino).toBe('s-4')
    expect(r).toMatchObject({ batendoPassivo: 3, total: 4 })
    expect(resumoDasAvaliacoes([])).toBeNull()
  })

  it('traduz a decisão: perder para o campeão sai dos números, não do texto', () => {
    const naoPromovida = { score: 0.012, promovido: false }
    expect(decisaoDaAvaliacao({ ...naoPromovida, promovido: true, scoreCampeao: 0.01 }))
      .toEqual({ chave: 'treinamento.decisionPromoted' })
    expect(decisaoDaAvaliacao({
      ...naoPromovida, scoreCampeao: 0.0182, motivo: 'o campeão atual rende +1.82% na mesma validação',
    })).toEqual({ chave: 'treinamento.decisionBelowChampion', campeao: 0.0182 })
    expect(decisaoDaAvaliacao({ score: -0.004, promovido: false, scoreCampeao: null, motivo: 'não bate o passivo na moeda mediana' }))
      .toEqual({ chave: 'treinamento.decisionBelowPassive' })
    // Bateu o campeão, mas a cópia falhou: o motivo é a falha, não o campeão.
    expect(decisaoDaAvaliacao({ ...naoPromovida, scoreCampeao: 0.01, motivo: 'falha ao guardar a cópia do melhor modelo' }))
      .toEqual({ chave: 'treinamento.decisionSaveFailed' })
    expect(decisaoDaAvaliacao({ ...naoPromovida, scoreCampeao: null, motivo: 'falha ao medir o campeão atual' }))
      .toEqual({ chave: 'treinamento.decisionChampionFailed' })
    expect(decisaoDaAvaliacao({ ...naoPromovida, motivo: 'TB_GUARDAR_MELHOR desligado' }))
      .toEqual({ chave: 'treinamento.decisionPromotionOff' })
  })

  it('um motivo que a tela não conhece aparece como veio', () => {
    expect(decisaoDaAvaliacao({ score: 0.01, promovido: false, motivo: 'motivo novo' })).toEqual({ texto: 'motivo novo' })
    expect(decisaoDaAvaliacao({ score: 0.01, promovido: false, motivo: null })).toBeNull()
    expect(decisaoDaAvaliacao(null)).toBeNull()
  })
})

describe('treinamento › rodada do mesmo lote', () => {
  // Lote como a API devolve: com o "Z" que o apiClient acrescenta.
  const LOTE = { dataInicioDados: '2024-12-06T00:00:00Z', dataFimDados: '2025-01-16T15:00:00Z' }
  const OUTRO = { dataInicioDados: '2024-10-25T09:00:00Z', dataFimDados: '2024-12-05T23:00:00Z' }
  const doLote = (n, minuto, moeda, rewardMedio, lote = LOTE) => ep(n, minuto, { moeda, rewardMedio, ...lote })

  it('junta os episódios da mesma janela e ordena pelo reward', () => {
    const item = doLote(3, 2, 'ETH', 0.2)
    const episodios = [
      doLote(1, 0, 'BTC', 0.1),
      doLote(2, 1, 'SOL', 0.4),
      item,
      doLote(4, 3, 'ADA', null),
      doLote(5, 4, 'BTC', 0.9, OUTRO), // a rodada seguinte, em outro lote
    ]
    const rodada = rodadaDoEpisodio(item, episodios)
    expect(rodada.episodios.map((r) => r.moeda)).toEqual(['SOL', 'ETH', 'BTC', 'ADA'])
    expect(rodada).toMatchObject({ posicao: 2, total: 4 })
    expect(rodada.media).toBeCloseTo((0.1 + 0.4 + 0.2) / 3)
    expect(rodada.ultimoMs).toBe(BASE + 3 * UM_MINUTO_MS)
  })

  it('o mesmo lote numa passagem seguinte pelo dataset é outra rodada', () => {
    const item = doLote(21, 0, 'SOL', 0.05)
    const episodios = [
      item,
      doLote(22, 1, 'BTC', 0.14),
      doLote(23, 2, 'ETH', 0.1, OUTRO), // o lote andou
      doLote(151, 30, 'BTC', 0.35), // o dataset deu a volta: modelo em outro ponto
    ]
    expect(rodadaDoEpisodio(item, episodios).episodios.map((r) => r.episodio)).toEqual([22, 21])
  })

  it('a rodada atravessa a pausa entre treinos, que não tem episódio', () => {
    const item = doLote(299, 0, 'SOL', 0.2)
    const episodios = [doLote(298, -1, 'BTC', 0.1), item, doLote(300, 1, 'ETH', 0.3), doLote(1, 9, 'ADA', 0.05)]
    expect(rodadaDoEpisodio(item, episodios).total).toBe(4)
  })

  it('compara a janela pelo instante, e não pelo texto', () => {
    const item = doLote(1, 0, 'BTC', 0.1)
    const semZ = ep(2, 1, { moeda: 'ETH', dataInicioDados: '2024-12-06T00:00:00.000Z', dataFimDados: '2025-01-16T15:00:00.000Z' })
    expect(rodadaDoEpisodio(item, [semZ]).total).toBe(2)
  })

  it('o episódio entra mesmo fora da lista, e sem repetir', () => {
    const item = doLote(1, 0, 'BTC', 0.1)
    expect(rodadaDoEpisodio(item, []).total).toBe(1)
    expect(rodadaDoEpisodio(item, [item, { ...item }]).total).toBe(1)
  })

  it('episódio sem janela não tem rodada', () => {
    expect(rodadaDoEpisodio(ep(1, 0), [doLote(2, 1, 'ETH', 0.3)])).toBeNull()
  })

  it('a variação vai do primeiro ao último fechamento, em qualquer ordem', () => {
    const vela = (hora, preco) => ({ horaReferencia: `2024-12-06T0${hora}:00:00Z`, precoFechamento: preco })
    // Do mais recente para o mais antigo, como o modo demo devolve.
    expect(variacaoEntreVelas([vela(1, 110), vela(0, 100)], [vela(8, 120), vela(9, 125)])).toBeCloseTo(0.25)
    expect(variacaoEntreVelas([], [vela(9, 125)])).toBeNull()
    expect(variacaoEntreVelas([vela(0, 0)], [vela(9, 125)])).toBeNull()
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
