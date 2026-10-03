// Lógica pura da tela de treinamento de IA (/treinamento-episodios).
//
// Tudo aqui é função de dados, sem React e sem rede: janela de tempo, médias,
// ciclos, resumo por moeda. Morava dentro da página, espalhado por uma dúzia de
// useMemo, e por isso nada disso tinha teste — os erros de leitura que a tela
// acumulou (curva em serrote, eixo com três unidades) nasciam exatamente em
// contas que ninguém conseguia exercitar isoladamente.

import { celulaCSV } from './exportUtils'

export const UM_MINUTO_MS = 60 * 1000
export const UMA_HORA_MS = 60 * UM_MINUTO_MS
export const QUATRO_HORAS_MS = 4 * UMA_HORA_MS

// Durações oferecidas em cada aba. Ao vivo olha o agora e compara com o trecho
// imediatamente anterior; a análise precisa de horizonte para ver tendência.
export const PERIODOS_AO_VIVO = Object.freeze([15 * UM_MINUTO_MS, UMA_HORA_MS, QUATRO_HORAS_MS])
export const PERIODOS_ANALISE = Object.freeze([QUATRO_HORAS_MS, 24 * UMA_HORA_MS, 72 * UMA_HORA_MS])

// Período de cada aba quando a URL não diz outro: ancorado no mais recente.
export const PERIODO_PADRAO = Object.freeze({
  'ao-vivo': Object.freeze({ duracaoMs: UMA_HORA_MS, fimMs: null }),
  analise: Object.freeze({ duracaoMs: 24 * UMA_HORA_MS, fimMs: null }),
})

// As consultas trabalham em grupos de 4 horas, alinhados à hora local. O
// alinhamento é escolha de tela; o instante que vai na requisição continua em
// UTC (ver buscarPeriodo em hooks/useTreinamentoEpisodios).
export const inicioDoGrupo = (ts) => {
  const d = new Date(ts)
  d.setHours(Math.floor(d.getHours() / 4) * 4, 0, 0, 0)
  return d.getTime()
}

export const extrairLista = (resp) =>
  Array.isArray(resp?.resultado?.lista) ? resp.resultado.lista
    : Array.isArray(resp?.resultado) ? resp.resultado
      : []

// Junta episódios novos aos já carregados, sem duplicar. Devolve a MESMA lista
// quando não há novidade, para o setState não disparar render à toa a cada
// consulta do polling.
//
// Sem duplicar também DENTRO do lote novo: ele junta vários blocos de 4h e
// várias páginas, e a API repete registro entre eles — o fim do período é
// inclusivo, e a paginação ordena só pela hora, sem desempate. Comparando só
// com o que já estava carregado, o episódio da virada do bloco entrava duas
// vezes: 301 episódios num ciclo de 300, linha repetida na tabela e no CSV.
export const mesclarEpisodios = (atuais, novos) => {
  if (!novos || novos.length === 0) return atuais
  const ids = new Set(atuais.map((i) => i.idTreinamentoEpisodio))
  const extras = []
  for (const r of novos) {
    if (ids.has(r.idTreinamentoEpisodio)) continue
    ids.add(r.idTreinamentoEpisodio)
    extras.push(r)
  }
  return extras.length > 0 ? [...atuais, ...extras] : atuais
}

export const instanteDe = (r) => new Date(r?.dataHora).getTime()

// Desempate pelo número do episódio. O carimbo vem com precisão de segundo e o
// treino grava vários episódios no mesmo segundo; ordenados só pela hora, eles
// saíam na ordem em que a API os devolveu — que é decrescente — e a numeração
// parecia recuar dentro do segundo. Nos dados reais de um dia eram 4 recuos
// falsos para 4 reinícios de verdade, cada um virando um ciclo inventado.
export const ordenarPorData = (itens) =>
  [...itens].sort((a, b) => instanteDe(a) - instanteDe(b) || (a.episodio ?? 0) - (b.episodio ?? 0))

/** Episódios com dataHora em [inicio, fim], ambos inclusivos. */
export const filtrarJanela = (itens, inicio, fim) =>
  itens.filter((r) => {
    const t = instanteDe(r)
    return t >= inicio && t <= fim
  })

// Valor numérico de uma métrica, ou null. Métrica ausente não pode virar zero:
// um episódio sem win rate puxaria a média para baixo sem ter perdido nada.
const valorDe = (r, chave) => {
  const v = r?.[chave]
  if (v === null || v === undefined) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export const media = (valores) => {
  let soma = 0
  let n = 0
  for (const v of valores) {
    if (v === null || v === undefined || !Number.isFinite(v)) continue
    soma += v
    n += 1
  }
  return n > 0 ? soma / n : null
}

export const mediana = (valores) => {
  const ordenados = valores.filter(Number.isFinite).sort((a, b) => a - b)
  if (ordenados.length === 0) return null
  const meio = Math.floor(ordenados.length / 2)
  return ordenados.length % 2 === 1
    ? ordenados[meio]
    : (ordenados[meio - 1] + ordenados[meio]) / 2
}

// Métricas que são uma razão entre contagens do episódio. A média de um grupo
// soma os numeradores e os denominadores, em vez de tirar a média das razões:
// até 03/10/2026, no acerto por trade, um episódio com 1 trade pesava o mesmo
// que um com 50, e um único trade de sorte movia os cartões.
const RAZOES = {
  acertoTrades: { numerador: 'tradesVencedores', denominador: 'trades' },
}

/**
 * Com que peso o episódio entra na média da métrica: `{ num, den }`, ou null se
 * ele não tem a métrica. Métrica comum entra com peso 1; razão, com as contagens
 * (episódio sem trade fechado, ou de antes de o treinador contar, fica de fora).
 */
const parcelaDe = (r, chave) => {
  const razao = RAZOES[chave]
  if (!razao) {
    const v = valorDe(r, chave)
    return v === null ? null : { num: v, den: 1 }
  }
  const num = valorDe(r, razao.numerador)
  const den = valorDe(r, razao.denominador)
  return num !== null && den > 0 ? { num, den } : null
}

/** Média da métrica num conjunto de episódios; razões, pela soma (ver RAZOES). */
export const mediaDaMetrica = (itens, chave) => {
  let num = 0
  let den = 0
  for (const r of itens) {
    const p = parcelaDe(r, chave)
    if (p === null) continue
    num += p.num
    den += p.den
  }
  return den > 0 ? num / den : null
}

/**
 * Média móvel simples. Soma corrente em vez de fatiar a cada posição: com
 * alguns milhares de episódios por janela, o slice por ponto era quadrático.
 */
export const mediaMovel = (valores, janela = 5) => {
  const saida = new Array(valores.length)
  let soma = 0
  for (let i = 0; i < valores.length; i++) {
    soma += valores[i]
    if (i >= janela) soma -= valores[i - janela]
    saida[i] = soma / Math.min(i + 1, janela)
  }
  return saida
}

/**
 * Variação total estimada ao longo da série, pela reta de mínimos quadrados:
 * inclinação por passo × (n − 1). Diz "o reward subiu 0,12 nesta janela" sem
 * depender só do primeiro e do último ponto, que são os mais ruidosos.
 */
export const tendencia = (valores) => {
  const n = valores.length
  if (n < 3) return null
  let sx = 0
  let sy = 0
  let sxy = 0
  let sxx = 0
  for (let i = 0; i < n; i++) {
    sx += i
    sy += valores[i]
    sxy += i * valores[i]
    sxx += i * i
  }
  const denominador = n * sxx - sx * sx
  if (denominador === 0) return null
  return ((n * sxy - sx * sy) / denominador) * (n - 1)
}

/** Reduz uma série a no máximo `max` pontos, pela média de cada fatia. */
export const reduzirPontos = (valores, max = 40) => {
  if (valores.length <= max) return valores
  const passo = valores.length / max
  const saida = []
  for (let i = 0; i < max; i++) {
    const fatia = valores.slice(Math.floor(i * passo), Math.floor((i + 1) * passo))
    saida.push(media(fatia))
  }
  return saida
}

/** Intervalo típico entre episódios consecutivos (mediana dos intervalos). */
export const cadenciaMediana = (timeline) => {
  const intervalos = []
  for (let i = 1; i < timeline.length; i++) {
    const d = instanteDe(timeline[i]) - instanteDe(timeline[i - 1])
    if (d > 0) intervalos.push(d)
  }
  return mediana(intervalos)
}

// A partir de que pausa dois episódios deixam de ser o mesmo trecho de treino.
// Piso de 30min: com média×3 qualquer episódio lento (>60s) virava um "ciclo"
// espúrio. Mediana e não média porque as próprias pausas entre ciclos puxam a
// média para cima.
export const limiarDeLacuna = (timeline) =>
  Math.max(30 * UM_MINUTO_MS, (cadenciaMediana(timeline) ?? 0) * 12)

// Recuo de numeração que ainda é ordem de gravação, e não reinício: até 3
// episódios, a até 5 s do anterior. O desempate da ordenação resolve os
// empates no mesmo segundo; isto cobre a gravação que atravessa a virada do
// segundo. Um reinício de verdade volta ao episódio 1 depois de centenas, e
// com pausa de minutos (nos dados reais, 300 → 1 com 5 a 8 min entre eles).
const RECUO_DE_ORDEM = 3
const JANELA_DE_ORDEM_MS = 5000

/**
 * Ciclos de treino numa timeline já ordenada por data. Novo ciclo quando a
 * numeração do episódio CAI (reset do treino) — o sinal forte — ou quando há
 * uma pausa maior que o limiar, que cobre retomadas sem reset.
 *
 * Cada ciclo guarda os índices [de, ate] na timeline, para quem quiser
 * resumir os episódios dele sem refazer a busca.
 */
export const detectarCiclos = (timeline) => {
  if (timeline.length === 0) return []
  const limiar = limiarDeLacuna(timeline)
  const ciclos = []
  const fechar = (de, ate) => {
    ciclos.push({
      inicio: instanteDe(timeline[de]),
      fim: instanteDe(timeline[ate]),
      epInicio: timeline[de].episodio,
      epFim: timeline[ate].episodio,
      total: ate - de + 1,
      de,
      ate,
    })
  }
  let de = 0
  for (let i = 1; i < timeline.length; i++) {
    const anterior = timeline[i - 1]
    const atual = timeline[i]
    const intervalo = instanteDe(atual) - instanteDe(anterior)
    const recuo = (anterior.episodio ?? 0) - (atual.episodio ?? 0)
    const foraDeOrdem = recuo <= RECUO_DE_ORDEM && intervalo <= JANELA_DE_ORDEM_MS
    const reset = recuo > 0 && !foraDeOrdem
    const pausa = intervalo > limiar
    if (reset || pausa) {
      fechar(de, i - 1)
      de = i
    }
  }
  fechar(de, timeline.length - 1)
  return ciclos
}

/**
 * O ciclo inteiro, entre os detectados em tudo o que está carregado, que
 * contém `instante` — ou null. A janela corta o ciclo que atravessa a borda
 * dela: dentro da janela ele "começa" na borda, e o ciclo, que se identifica
 * pelo início, ganharia um nome diferente em cada janela.
 */
export const cicloQueContem = (ciclos, instante) =>
  ciclos.find((c) => instante >= c.inicio && instante <= c.fim) ?? null

/** Os instantes em que começa cada ciclo depois do primeiro: onde as séries cortam. */
export const cortesEntreCiclos = (ciclos) => ciclos.slice(1).map((c) => c.inicio)

/**
 * Série suavizada de uma métrica no tempo, pronta para um eixo temporal:
 * [{ x: ms, y }]. A média móvel recomeça a cada ciclo — `cortes` são os
 * instantes em que um ciclo novo começa (cortesEntreCiclos) — e um ponto
 * `y: null` entre os trechos quebra a linha. Sem isso o gráfico ligava o fim
 * de um treino ao começo do seguinte, como se o modelo tivesse desaprendido em
 * linha reta na virada.
 *
 * Cortava só em pausa maior que o limiar de lacuna (30 min). Nos dados reais
 * um treino emenda no seguinte em 5 a 8 min, e a linha seguia inteira pela
 * virada: a média do começo de um treino carregava o fim do anterior. Os
 * cortes vêm de fora, e não de uma detecção aqui dentro, para a série de cada
 * moeda cortar exatamente onde as faixas de ciclo do gráfico mudam.
 *
 * Razão (acerto por trade) suaviza pela soma das contagens na janela, como
 * mediaDaMetrica: a linha do gráfico e o cartão dizem a mesma coisa.
 */
export const serieSuavizada = (timeline, chave, janela = 5, cortes = []) => {
  const pontos = []
  let fila = []
  let num = 0
  let den = 0
  let anterior = null
  let proximoCorte = 0
  for (const r of timeline) {
    const p = parcelaDe(r, chave)
    const x = instanteDe(r)
    if (p === null || Number.isNaN(x)) continue
    // Algum corte entre o ponto anterior e este? Os de antes do primeiro
    // ponto só são pulados.
    let virou = false
    while (proximoCorte < cortes.length && cortes[proximoCorte] <= x) {
      if (anterior !== null && cortes[proximoCorte] > anterior) virou = true
      proximoCorte += 1
    }
    if (virou) {
      pontos.push({ x: anterior + (x - anterior) / 2, y: null })
      fila = []
      num = 0
      den = 0
    }
    fila.push(p)
    num += p.num
    den += p.den
    if (fila.length > janela) {
      const saiu = fila.shift()
      num -= saiu.num
      den -= saiu.den
    }
    pontos.push({ x, y: num / den })
    anterior = x
  }
  return pontos
}

/**
 * Um ponto por episódio, sem suavização: [{ x: ms, y, id }]. O `id` viaja no
 * ponto para o clique no gráfico abrir o episódio: a série pula episódios sem a
 * métrica, e o índice do ponto não é o índice na timeline.
 */
export const pontosBrutos = (timeline, chave) => {
  const pontos = []
  for (const r of timeline) {
    const v = valorDe(r, chave)
    const x = instanteDe(r)
    if (v !== null && !Number.isNaN(x)) pontos.push({ x, y: v, id: r.idTreinamentoEpisodio })
  }
  return pontos
}

/**
 * Tamanho da média móvel quando todas as moedas estão misturadas numa série só.
 * O treino alterna moeda a cada episódio; com janela 5 e nove moedas, cada
 * ponto da média era uma amostra diferente de moedas, e o zigue-zague que se
 * via era a troca de moeda, não o aprendizado. Duas voltas completas pelas
 * moedas apagam esse efeito.
 */
export const janelaParaMistura = (qtdMoedas) =>
  Math.min(30, Math.max(5, 2 * qtdMoedas))

/** Médias das métricas principais num conjunto de episódios. */
export const estatisticas = (itens) => ({
  total: itens.length,
  rewardMedio: mediaDaMetrica(itens, 'rewardMedio'),
  // Trades vencedores somados sobre trades somados (ver RAZOES): o episódio com
  // mais trades pesa mais. Os sem contagem (antigos, ou sem trade fechado) ficam
  // de fora, em vez de entrar como zero.
  acertoTrades: mediaDaMetrica(itens, 'acertoTrades'),
  lossMedia: mediaDaMetrica(itens, 'lossMedia'),
  epsilon: mediaDaMetrica(itens, 'epsilon'),
  duracaoSegundos: mediaDaMetrica(itens, 'duracaoSegundos'),
})

/** Diferença atual − anterior, ou null se faltar um dos lados. */
export const variacao = (atual, anterior) =>
  atual === null || atual === undefined || anterior === null || anterior === undefined
    ? null
    : atual - anterior

/** Participação de Hold / Compra / Venda no total de ações (frações 0–1). */
export const proporcaoDeAcoes = (itens) => {
  let hold = 0
  let compra = 0
  let venda = 0
  for (const r of itens) {
    hold += valorDe(r, 'acoesHold') ?? 0
    compra += valorDe(r, 'acoesCompra') ?? 0
    venda += valorDe(r, 'acoesVenda') ?? 0
  }
  const total = hold + compra + venda
  if (total === 0) return null
  return { hold: hold / total, compra: compra / total, venda: venda / total, total }
}

const agruparPor = (itens, chave) => {
  const grupos = new Map()
  for (const r of itens) {
    const k = r?.[chave]
    if (!k) continue
    if (!grupos.has(k)) grupos.set(k, [])
    grupos.get(k).push(r)
  }
  return grupos
}

/**
 * Uma linha por moeda: médias, tendência do reward, curva resumida para o
 * minigráfico, proporção de ações e o melhor episódio. Recebe a timeline já
 * ordenada, para a curva e a tendência seguirem a ordem do treino.
 */
export const resumirPorMoeda = (timeline, janela = 5) =>
  [...agruparPor(timeline, 'moeda').entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([moeda, eps]) => {
      const rewards = eps.map((r) => valorDe(r, 'rewardMedio')).filter((v) => v !== null)
      const suavizado = mediaMovel(rewards, janela)
      let melhor = null
      for (const r of eps) {
        const v = valorDe(r, 'rewardMedio')
        if (v !== null && (melhor === null || v > melhor.rewardMedio)) melhor = r
      }
      return {
        moeda,
        ...estatisticas(eps),
        tendencia: tendencia(suavizado),
        curva: reduzirPontos(suavizado, 40),
        acoes: proporcaoDeAcoes(eps),
        melhor,
      }
    })

// ── Evolução entre treinos ──────────────────────────────────────────────────
//
// Dentro de um treino o reward sobe sobretudo porque o epsilon cai de 1 (ação
// sorteada) até o piso: o começo contra o fim mede a exploração acabando, e não
// o modelo aprendendo. O que diz se o modelo aprende é o PATAMAR de um treino —
// o reward com o epsilon já no piso, a política jogando sem explorar — contra o
// do treino anterior: o checkpoint passa de um para o outro, e os dois são
// medidos no mesmo epsilon.

// Folga sobre o piso para o episódio contar como "sem explorar".
const FOLGA_DO_PISO = 0.01
// Episódios no piso que um ciclo precisa para ter patamar. Com um ou dois — o
// ciclo que a borda da janela corta no fim do decaimento —, o patamar é ruído.
const MINIMO_NO_PISO = 3
// Acima disto, o menor epsilon carregado não é piso: nenhum treino carregado
// chegou ao fim do decaimento (0,05 no treinador).
const PISO_MAXIMO = 0.2

/** O menor epsilon da série: o piso do decaimento. Null sem epsilon nenhum. */
export const pisoDoEpsilon = (timeline) => {
  let piso = Infinity
  for (const r of timeline) {
    const v = valorDe(r, 'epsilon')
    if (v !== null && v < piso) piso = v
  }
  return Number.isFinite(piso) ? piso : null
}

/**
 * O patamar de cada ciclo: a média do reward dos episódios com o epsilon no
 * piso. `ciclos` vêm de detectarCiclos sobre a mesma `timeline`; `filtro`
 * restringe os episódios (uma moeda). Ciclo que não chegou ao piso — o que
 * ainda está explorando — não tem patamar.
 */
export const patamaresDosCiclos = (timeline, ciclos, piso, filtro = () => true) => {
  if (piso === null || piso === undefined || piso > PISO_MAXIMO) return []
  const patamares = []
  for (const c of ciclos) {
    const noPiso = timeline
      .slice(c.de, c.ate + 1)
      .filter((r) => filtro(r) && (valorDe(r, 'epsilon') ?? Infinity) <= piso + FOLGA_DO_PISO)
    const reward = mediaDaMetrica(noPiso, 'rewardMedio')
    if (noPiso.length >= MINIMO_NO_PISO && reward !== null) {
      patamares.push({ inicio: c.inicio, reward, total: noPiso.length })
    }
  }
  return patamares
}

/**
 * Por moeda, a evolução entre treinos: o patamar de cada ciclo, quanto eles
 * mudaram (pela reta de tendência com três ou mais; a diferença, com dois) e o
 * último. Map moeda → { patamares: number[], tendencia, ultimo }.
 */
export const evolucaoPorMoeda = (timeline, ciclos, piso) => {
  const moedas = [...new Set(timeline.map((r) => r.moeda).filter(Boolean))]
  return new Map(moedas.map((moeda) => {
    const valores = patamaresDosCiclos(timeline, ciclos, piso, (r) => r.moeda === moeda).map((p) => p.reward)
    const mudanca = valores.length >= 3
      ? tendencia(valores)
      : valores.length === 2 ? valores[1] - valores[0] : null
    return [moeda, { patamares: valores, tendencia: mudanca, ultimo: valores.length > 0 ? valores[valores.length - 1] : null }]
  }))
}

/**
 * O último episódio carregado fecha um treino? Compara a numeração dele com a
 * do fim dos treinos anteriores — a mediana, com 5% de folga: filtrada uma
 * moeda só, o último episódio dela num treino de 300 é o 291, o 296...
 */
export const treinoTerminou = (timeline) => {
  const ultimo = timeline[timeline.length - 1]
  const completos = detectarCiclos(timeline).slice(0, -1)
  if (!ultimo || completos.length === 0) return false
  const fimTipico = mediana(completos.map((c) => c.epFim).filter(Number.isFinite))
  return fimTipico !== null && (ultimo.episodio ?? 0) >= fimTipico * 0.95
}

/**
 * Resumo de cada ciclo: começo e fim medidos pela média dos primeiros e dos
 * últimos episódios (um quinto do ciclo, entre 1 e 20), não pelo primeiro e o
 * último isolados — um episódio sozinho é ruído demais para dizer se o ciclo
 * melhorou.
 *
 * Sem número de ordem: "C2" era o segundo ciclo DA JANELA, e mudava com ela —
 * enquadrado, o C2 virava C1. O ciclo se identifica pelo início, como no
 * "Ciclo atual … desde 22:53" do ao vivo e na posição do episódio no detalhe.
 */
export const resumirCiclos = (timeline, ciclos) =>
  ciclos.map((c) => {
    const eps = timeline.slice(c.de, c.ate + 1)
    const k = Math.max(1, Math.min(20, Math.ceil(eps.length / 5)))
    const inicio = eps.slice(0, k)
    const fim = eps.slice(-k)
    return {
      inicio: c.inicio,
      fim: c.fim,
      duracaoMs: c.fim - c.inicio,
      total: c.total,
      epInicio: c.epInicio,
      epFim: c.epFim,
      rewardInicio: mediaDaMetrica(inicio, 'rewardMedio'),
      rewardFim: mediaDaMetrica(fim, 'rewardMedio'),
      acertoInicio: mediaDaMetrica(inicio, 'acertoTrades'),
      acertoFim: mediaDaMetrica(fim, 'acertoTrades'),
      versoes: [...new Set(eps.map((r) => r.versaoModelo).filter(Boolean))].sort(),
    }
  })

/** Uma linha por versão do modelo, com o período em que ela aparece. */
export const resumirVersoes = (timeline) =>
  [...agruparPor(timeline, 'versaoModelo').entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([versao, eps]) => ({
      versao,
      ...estatisticas(eps),
      inicio: instanteDe(eps[0]),
      fim: instanteDe(eps[eps.length - 1]),
    }))

// Quanto tempo sem episódio, depois do fim de um treino, ainda é a troca para o
// seguinte: nos dados reais, 5 a 8 min. O dobro do maior.
const LIMITE_ENTRE_TREINOS_MS = 15 * UM_MINUTO_MS

/**
 * O treino está rodando? Parado quando o último episódio ficou para trás mais
 * que dez intervalos típicos — com piso de 5min, para um treino lento não
 * aparecer como parado entre um episódio e o seguinte.
 *
 * `entreTreinos`: o último treino terminou (`terminouTreino`, ver
 * treinoTerminou) e o seguinte ainda não começou. Sem isso, os 5 a 8 min de
 * troca entre um treino e outro passavam do piso de 5 min, e a tela marcava
 * "Parado" por até 3 min a cada hora e meia, sem nada parado.
 */
export const statusDoTreino = (ultimoMs, agoraMs, cadenciaMs, terminouTreino = false) => {
  if (ultimoMs === null || ultimoMs === undefined || Number.isNaN(ultimoMs)) return null
  const limite = Math.max(5 * UM_MINUTO_MS, (cadenciaMs ?? 0) * 10)
  const desdeMs = Math.max(0, agoraMs - ultimoMs)
  const ativo = desdeMs <= limite
  return { ativo, entreTreinos: !ativo && terminouTreino && desdeMs <= LIMITE_ENTRE_TREINOS_MS, desdeMs }
}

/**
 * Episódios por hora enquanto o treino rodava. Era o total dividido pela
 * duração da janela inteira, e a janela quase nunca está toda coberta: com o
 * ciclo começando no meio da janela de 1h, um treino de 180 episódios/h
 * aparecia como 135. Conta só o tempo dentro dos ciclos — de um episódio ao
 * último do mesmo trecho —, que é o tempo em que o treino estava de fato
 * produzindo episódios.
 */
export const ritmoPorHora = (timeline) => {
  let intervalos = 0
  let tempo = 0
  for (const c of detectarCiclos(timeline)) {
    intervalos += c.total - 1
    tempo += c.fim - c.inicio
  }
  return tempo > 0 ? (intervalos / tempo) * UMA_HORA_MS : null
}

/**
 * Período que enquadra um ciclo, com uma folga curta de cada lado. Folga
 * pequena de propósito: nos dados reais os ciclos ficam a 5–8 min um do outro,
 * e uma folga maior puxava a ponta do ciclo vizinho para dentro do quadro.
 *
 * O fim fica sempre fixo, mesmo no ciclo que ainda está rodando. Ancorado no
 * mais recente, o quadro andaria com o polling e iria cortando o começo do
 * ciclo minuto a minuto — o contrário do que se pediu ao enquadrá-lo.
 */
export const periodoDoCiclo = (ciclo) => {
  const folga = Math.max(UM_MINUTO_MS, (ciclo.fim - ciclo.inicio) * 0.02)
  return { duracaoMs: ciclo.fim - ciclo.inicio + 2 * folga, fimMs: ciclo.fim + folga }
}

/**
 * Enquadra um ciclo: o período passa a ser o dele, marcado com `foco` — o
 * início do ciclo, que o identifica, e o período de antes, para onde "voltar"
 * leva. Sem isso, sair do enquadramento era "Ir para o mais recente", que
 * mantinha a duração quebrada do ciclo (62 min) sem nenhum botão de período
 * aceso. Enquadrar outro ciclo a partir de um enquadramento guarda o período
 * original, e não o do ciclo anterior.
 */
export const enquadrarCiclo = (periodo, ciclo) => ({
  ...periodoDoCiclo(ciclo),
  foco: {
    inicio: ciclo.inicio,
    anterior: periodo.foco?.anterior ?? { duracaoMs: periodo.duracaoMs, fimMs: periodo.fimMs ?? null },
  },
})

/**
 * Janela de um período: termina em `fimMs` quando a pessoa navegou para trás,
 * ou no episódio mais recente — não no relógio. Ancorar no relógio deixava a
 * tela vazia sempre que o treino tinha parado havia mais que a duração da
 * janela. A janela anterior, de mesmo tamanho, é a base das comparações.
 */
export const janelaDoPeriodo = ({ duracaoMs, fimMs }, maisRecenteMs) => {
  const fim = fimMs ?? maisRecenteMs
  if (fim === null || fim === undefined || Number.isNaN(fim)) return null
  const inicio = fim - duracaoMs
  return {
    inicio,
    fim,
    anterior: { inicio: inicio - duracaoMs, fim: inicio - 1 },
    ancorada: fimMs === null || fimMs === undefined,
  }
}

// ── Período na URL ──────────────────────────────────────────────────────────
//
//   ?periodo=4h&ate=2026-09-30T22:27:00Z&ciclo=2026-09-30T21:26:12Z
//
//   periodo  duração da janela, em horas ("4h") ou minutos ("63m");
//   ate      fim da janela, quando a pessoa navegou para trás — sem ele, a
//            janela acompanha o episódio mais recente;
//   ciclo    início do ciclo enquadrado (só na análise).
//
// O período ficava só no estado da página: um refresh voltava a 1h/24h, e um
// link mandado para alguém abria outra janela — inclusive o ciclo enquadrado.
// O padrão da aba não escreve nada, para a URL de quem não mexeu seguir limpa.

/** "15m", "1h", "24h", "63m": horas quando fecha a hora, senão minutos, para cima. */
export const duracaoParaParam = (ms) =>
  (ms % UMA_HORA_MS === 0 ? `${ms / UMA_HORA_MS}h` : `${Math.ceil(ms / UM_MINUTO_MS)}m`)

/** O inverso de duracaoParaParam; null fora do formato ou de [1 min, maximoMs]. */
export const duracaoDoParam = (texto, maximoMs) => {
  const m = /^(\d{1,5})(m|h)$/.exec(texto ?? '')
  if (!m) return null
  const ms = Number(m[1]) * (m[2] === 'h' ? UMA_HORA_MS : UM_MINUTO_MS)
  return ms >= UM_MINUTO_MS && ms <= maximoMs ? ms : null
}

// Instante em ISO UTC, ao segundo, arredondado para cima: o fim de um
// enquadramento não pode encolher e deixar de fora o último episódio do ciclo.
const instanteParaParam = (ms) =>
  new Date(Math.ceil(ms / 1000) * 1000).toISOString().replace('.000Z', 'Z')

// Só ISO com o Z. Sem fuso, "2026-09-30T22:27" seria lido na hora local de
// quem abre o link — o deslize que já deslocou a janela de consulta em 3h.
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?Z$/
const instanteDoParam = (texto) => {
  if (!ISO_UTC.test(texto ?? '')) return null
  const ms = Date.parse(texto)
  return Number.isFinite(ms) ? ms : null
}

/**
 * Período de uma aba lido da URL. Duração fora do formato, ou acima de
 * `maximoMs` (a maior opção da aba: um link com periodo=9999h faria a tela
 * pedir milhares de blocos de 4h), fica no padrão. `ciclo` só vale onde
 * `aceitaCiclo` e com `ate`; o período de antes do enquadramento não viaja na
 * URL, então sair dele leva ao padrão da aba.
 */
export const periodoDaUrl = (params, { padrao, maximoMs, aceitaCiclo = false }) => {
  const periodo = {
    duracaoMs: duracaoDoParam(params.get('periodo'), maximoMs) ?? padrao.duracaoMs,
    fimMs: instanteDoParam(params.get('ate')),
  }
  const inicioDoCiclo = aceitaCiclo ? instanteDoParam(params.get('ciclo')) : null
  if (inicioDoCiclo === null || periodo.fimMs === null) return periodo
  return { ...periodo, foco: { inicio: inicioDoCiclo, anterior: { duracaoMs: padrao.duracaoMs, fimMs: padrao.fimMs } } }
}

/** Parâmetros de URL de um período; {} quando ele é o padrão da aba. */
export const paramsDoPeriodo = (periodo, padrao) => {
  const params = {}
  if (periodo.duracaoMs !== padrao.duracaoMs) params.periodo = duracaoParaParam(periodo.duracaoMs)
  if (periodo.fimMs !== null && periodo.fimMs !== undefined) params.ate = instanteParaParam(periodo.fimMs)
  if (periodo.foco) params.ciclo = instanteParaParam(periodo.foco.inicio)
  return params
}

// ── Exportação ──────────────────────────────────────────────────────────────

// Cabeçalho com o nome do campo da API, e não o rótulo traduzido da tela: quem
// abre o arquivo num notebook cruza com a API sem tabela de tradução, e o mesmo
// script lê o CSV exportado em qualquer idioma.
const COLUNAS_DO_CSV = Object.freeze([
  'idTreinamentoEpisodio', 'episodio', 'dataHora', 'moeda', 'versaoModelo',
  'rewardMedio', 'rewardTotal', 'lossMedia', 'epsilon', 'winRate',
  'duracaoSegundos', 'totalSteps', 'acoesHold', 'acoesCompra', 'acoesVenda',
  // Acerto por operação. Vazio em episódio de worker que ainda não contava trades.
  'trades', 'tradesVencedores', 'acertoTrades', 'retornoMedioTrade',
])

/**
 * Episódios em CSV (RFC 4180), em ordem cronológica. Números crus, com ponto:
 * formatados no idioma da tela, "0,612" partiria a célula na vírgula. A data
 * vai em ISO UTC, com o Z, pelo mesmo motivo que a consulta vai assim — sem
 * fuso, quem lê do outro lado não sabe de que hora se trata.
 */
export const episodiosParaCSV = (itens) => {
  const data = (r) => {
    const ms = instanteDe(r)
    return Number.isNaN(ms) ? r.dataHora : new Date(ms).toISOString()
  }
  const linhas = ordenarPorData(itens).map((r) =>
    COLUNAS_DO_CSV.map((c) => celulaCSV(c === 'dataHora' ? data(r) : r[c])).join(','))
  return [COLUNAS_DO_CSV.join(','), ...linhas].join('\r\n')
}

// ── Detalhe de um episódio ──────────────────────────────────────────────────

// Quantos episódios da mesma moeda, de cada lado, formam a base de comparação.
export const RAIO_DE_VIZINHOS = 10

/**
 * Os episódios em volta de `idx` numa série da mesma moeda, sem ele próprio.
 *
 * É a base justa para julgar um episódio: o modelo melhora ao longo do treino,
 * e comparar contra a média de tudo o que estava carregado fazia todo episódio
 * antigo parecer ruim e todo recente parecer bom — além de mudar conforme
 * quanto histórico a tela tinha buscado.
 */
export const vizinhosDe = (serie, idx, raio = RAIO_DE_VIZINHOS) =>
  idx < 0 ? [] : [...serie.slice(Math.max(0, idx - raio), idx), ...serie.slice(idx + 1, idx + 1 + raio)]

/** Mínimo, média e máximo de uma lista, ignorando o que não é número. */
export const faixaDe = (valores) => {
  const v = valores.filter((x) => x !== null && x !== undefined && Number.isFinite(Number(x))).map(Number)
  if (v.length === 0) return null
  let min = v[0]
  let max = v[0]
  for (const x of v) {
    if (x < min) min = x
    if (x > max) max = x
  }
  return { min, max, media: media(v), total: v.length }
}

/**
 * Onde `valor` cai entre `valores`: quantos ficam abaixo e o percentil (0–1),
 * com empates contando meio. Null sem base de comparação.
 */
export const posicaoEntre = (valor, valores) => {
  const v = valores.filter((x) => x !== null && x !== undefined && Number.isFinite(Number(x))).map(Number)
  if (v.length === 0 || valor === null || valor === undefined || !Number.isFinite(Number(valor))) return null
  let abaixo = 0
  let iguais = 0
  for (const x of v) {
    if (x < valor) abaixo += 1
    else if (x === valor) iguais += 1
  }
  return { abaixo, total: v.length, percentil: (abaixo + iguais / 2) / v.length }
}

// Com menos que isto a comparação vira sorteio: não há veredito.
export const MINIMO_PARA_VEREDITO = 3

/** 'acima' | 'dentro' | 'abaixo' do esperado, pelo percentil do reward. */
export const vereditoDoEpisodio = (posicao) => {
  if (!posicao || posicao.total < MINIMO_PARA_VEREDITO) return null
  if (posicao.percentil >= 0.8) return 'acima'
  if (posicao.percentil <= 0.2) return 'abaixo'
  return 'dentro'
}

/** O ciclo que contém o episódio, com a posição dele dentro do ciclo (1-based). */
export const cicloDoEpisodio = (timeline, id) => {
  const idx = timeline.findIndex((r) => r.idTreinamentoEpisodio === id)
  if (idx < 0) return null
  const ciclo = detectarCiclos(timeline).find((c) => idx >= c.de && idx <= c.ate)
  return ciclo ? { ...ciclo, posicao: idx - ciclo.de + 1 } : null
}

// ── Mesmo lote, outras moedas ───────────────────────────────────────────────
//
// O treinador treina várias moedas no mesmo lote de dados antes de andar o
// offset (a linha do banco traz todas as moedas): é a rodada. Os episódios
// dela têm a mesma janela (dataInicioDados/dataFimDados), rodam em sequência e
// com o mesmo modelo. Compará-los separa "a moeda era difícil naquele trecho"
// de "o modelo estava ruim naquele ponto do treino".

const msDaData = (valor) => (valor ? new Date(valor).getTime() : NaN)

// Do maior reward médio para o menor; sem reward vai para o fim.
const porRewardDecrescente = (a, b) => {
  const semA = !Number.isFinite(a.rewardMedio)
  const semB = !Number.isFinite(b.rewardMedio)
  if (semA || semB) return semA === semB ? 0 : semA ? 1 : -1
  return b.rewardMedio - a.rewardMedio
}

/**
 * A rodada de `item`: os episódios em sequência no tempo que negociaram o
 * mesmo lote que ele (ele incluído), do maior reward médio para o menor, com a
 * posição dele, a média da rodada e o instante do último. `episodios` é o
 * entorno de TODAS as moedas e lotes. null quando o episódio não tem janela:
 * foi gravado antes de o treinador mandá-la, e não há como achar a rodada.
 *
 * O trecho contínuo, e não todo episódio com a mesma janela: quando o
 * treinador dá a volta no dataset, o mesmo lote volta mais tarde, com o
 * modelo em outro ponto do treino (no mock, a cada 130 episódios). Misturar
 * as duas passagens poria no mesmo ranking um modelo explorando e um pronto.
 * A pausa entre treinos não tem episódio nenhum, então a rodada que atravessa
 * a troca de sessão continua contínua.
 */
export const rodadaDoEpisodio = (item, episodios) => {
  const inicio = msDaData(item?.dataInicioDados)
  const fim = msDaData(item?.dataFimDados)
  if (!Number.isFinite(inicio) || !Number.isFinite(fim)) return null
  const doLote = (r) => msDaData(r?.dataInicioDados) === inicio && msDaData(r?.dataFimDados) === fim
  const porId = new Map()
  for (const r of [...(episodios || []), item]) porId.set(r.idTreinamentoEpisodio, r)
  const timeline = [...porId.values()]
    .filter((r) => r === item || Number.isFinite(instanteDe(r)))
    .sort((a, b) => instanteDe(a) - instanteDe(b))
  const idx = timeline.indexOf(porId.get(item.idTreinamentoEpisodio))
  let de = idx
  let ate = idx
  while (de > 0 && doLote(timeline[de - 1])) de--
  while (ate < timeline.length - 1 && doLote(timeline[ate + 1])) ate++
  const ordenados = timeline.slice(de, ate + 1).sort(porRewardDecrescente)
  const recompensas = ordenados.map((r) => r.rewardMedio).filter(Number.isFinite)
  const instantes = ordenados.map(instanteDe).filter(Number.isFinite)
  return {
    episodios: ordenados,
    posicao: ordenados.findIndex((r) => r.idTreinamentoEpisodio === item.idTreinamentoEpisodio) + 1,
    total: ordenados.length,
    media: recompensas.length > 0 ? recompensas.reduce((s, v) => s + v, 0) / recompensas.length : null,
    ultimoMs: instantes.length > 0 ? Math.max(...instantes) : NaN,
  }
}

/**
 * Variação do preço do primeiro ao último fechamento de uma janela, a partir
 * das velas pedidas perto de cada ponta. Aceita qualquer ordem (o modo demo
 * devolve do mais recente para o mais antigo). null sem preço numa das pontas.
 */
export const variacaoEntreVelas = (doInicio, doFim) => {
  const comPreco = (lista) => (Array.isArray(lista) ? lista : [])
    .filter((r) => Number.isFinite(msDaData(r?.horaReferencia)) && r.precoFechamento > 0)
  const primeira = comPreco(doInicio).sort((a, b) => msDaData(a.horaReferencia) - msDaData(b.horaReferencia))[0]
  const ultima = comPreco(doFim).sort((a, b) => msDaData(b.horaReferencia) - msDaData(a.horaReferencia))[0]
  if (!primeira || !ultima) return null
  return (ultima.precoFechamento - primeira.precoFechamento) / primeira.precoFechamento
}

// ── Validação das sessões ───────────────────────────────────────────────────
//
// A avaliação out-of-sample de cada sessão (/api/TreinamentoEpisodio/avaliacoes):
// a política gulosa no holdout, contra ficar parado e contra o buy-and-hold. O
// `score` é a mediana, entre as moedas, do retorno acima do passivo na VALIDAÇÃO —
// o que decide se a sessão vira o modelo ao vivo. O teste é registrado e nunca
// entra na escolha.

/**
 * As avaliações em ordem cronológica, cada uma com `ms` e o `campeaoVigente`:
 * o score da última sessão promovida até ela (inclusive), ou null se nenhuma
 * das carregadas foi promovida até ali.
 */
export const serieDasAvaliacoes = (avaliacoes) => {
  let campeao = null
  return [...(avaliacoes || [])]
    .sort((a, b) => instanteDe(a) - instanteDe(b))
    .map((a) => {
      if (a.promovido) campeao = a.score
      return { ...a, ms: instanteDe(a), campeaoVigente: campeao }
    })
}

/**
 * Para os cartões: a última sessão, o modelo ao vivo (a última promovida entre
 * as carregadas; null se a promoção foi antes delas) e quantas batem o passivo.
 */
export const resumoDasAvaliacoes = (avaliacoes) => {
  const serie = serieDasAvaliacoes(avaliacoes)
  if (serie.length === 0) return null
  return {
    ultima: serie[serie.length - 1],
    aoVivo: [...serie].reverse().find((a) => a.promovido) ?? null,
    batendoPassivo: serie.filter((a) => a.score > 0).length,
    total: serie.length,
  }
}

// O motivo em código (`motivoCodigo`; MotivoAvaliacao no worker), que é o que a
// tela traduz. Até 03/10/2026 ela traduzia o texto em português que o treinador
// escreve, e qualquer mudança nele aparecia crua nos cinco idiomas.
const CHAVE_DO_MOTIVO = {
  'abaixo-do-passivo': 'treinamento.decisionBelowPassive',
  'promocao-desligada': 'treinamento.decisionPromotionOff',
  'abaixo-do-campeao': 'treinamento.decisionBelowChampion',
  'falha-ao-medir-campeao': 'treinamento.decisionChampionFailed',
  'falha-ao-guardar-copia': 'treinamento.decisionSaveFailed',
}

// Avaliação sem código: gravada por um worker anterior a ele depois da migration
// que preencheu as antigas. Os textos fixos que ele escrevia.
const MOTIVOS_CONHECIDOS = {
  'não bate o passivo na moeda mediana': 'treinamento.decisionBelowPassive',
  'TB_GUARDAR_MELHOR desligado': 'treinamento.decisionPromotionOff',
  'falha ao medir o campeão atual': 'treinamento.decisionChampionFailed',
  'falha ao guardar a cópia do melhor modelo': 'treinamento.decisionSaveFailed',
}

const comCampeao = (chave, scoreCampeao) =>
  chave === 'treinamento.decisionBelowChampion' ? { chave, campeao: scoreCampeao ?? null } : { chave }

/**
 * A decisão sobre a sessão, para a tela: `{ chave }` de tradução, com
 * `campeao` quando perdeu para o modelo ao vivo, ou `{ texto }` para um motivo
 * desconhecido; null sem motivo. Pelo código do motivo; sem ele, pelos números
 * (perder para o campeão) e pelo texto.
 */
export const decisaoDaAvaliacao = (avaliacao) => {
  if (!avaliacao) return null
  if (avaliacao.promovido) return { chave: 'treinamento.decisionPromoted' }
  const { score, scoreCampeao, motivo, motivoCodigo } = avaliacao
  const doCodigo = CHAVE_DO_MOTIVO[motivoCodigo]
  if (doCodigo) return comCampeao(doCodigo, scoreCampeao)
  if (scoreCampeao !== null && scoreCampeao !== undefined && score <= scoreCampeao) {
    return comCampeao('treinamento.decisionBelowChampion', scoreCampeao)
  }
  const chave = MOTIVOS_CONHECIDOS[(motivo || '').trim()]
  if (chave) return { chave }
  return motivo ? { texto: motivo } : null
}
