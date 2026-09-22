// Lógica pura da tela de treinamento de IA (/treinamento-episodios).
//
// Tudo aqui é função de dados, sem React e sem rede: janela de tempo, médias,
// ciclos, resumo por moeda. Morava dentro da página, espalhado por uma dúzia de
// useMemo, e por isso nada disso tinha teste — os erros de leitura que a tela
// acumulou (curva em serrote, eixo com três unidades) nasciam exatamente em
// contas que ninguém conseguia exercitar isoladamente.

export const UM_MINUTO_MS = 60 * 1000
export const UMA_HORA_MS = 60 * UM_MINUTO_MS
export const QUATRO_HORAS_MS = 4 * UMA_HORA_MS

// Durações oferecidas em cada aba. Ao vivo olha o agora e compara com o trecho
// imediatamente anterior; a análise precisa de horizonte para ver tendência.
export const PERIODOS_AO_VIVO = Object.freeze([15 * UM_MINUTO_MS, UMA_HORA_MS, QUATRO_HORAS_MS])
export const PERIODOS_ANALISE = Object.freeze([QUATRO_HORAS_MS, 24 * UMA_HORA_MS, 72 * UMA_HORA_MS])

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
export const mesclarEpisodios = (atuais, novos) => {
  if (!novos || novos.length === 0) return atuais
  const ids = new Set(atuais.map((i) => i.idTreinamentoEpisodio))
  const extras = novos.filter((i) => !ids.has(i.idTreinamentoEpisodio))
  return extras.length > 0 ? [...atuais, ...extras] : atuais
}

export const instanteDe = (r) => new Date(r?.dataHora).getTime()

export const ordenarPorData = (itens) =>
  [...itens].sort((a, b) => instanteDe(a) - instanteDe(b))

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

export const mediaDaMetrica = (itens, chave) => media(itens.map((r) => valorDe(r, chave)))

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
    const reset = (atual.episodio ?? 0) < (anterior.episodio ?? 0)
    const pausa = instanteDe(atual) - instanteDe(anterior) > limiar
    if (reset || pausa) {
      fechar(de, i - 1)
      de = i
    }
  }
  fechar(de, timeline.length - 1)
  return ciclos
}

/**
 * Série suavizada de uma métrica no tempo, pronta para um eixo temporal:
 * [{ x: ms, y }]. A média móvel recomeça a cada pausa maior que `limiar`, e um
 * ponto `y: null` entre os trechos quebra a linha — sem isso o gráfico ligava o
 * fim de um ciclo ao começo do seguinte, como se o modelo tivesse desaprendido
 * em linha reta durante a pausa.
 */
export const serieSuavizada = (timeline, chave, janela = 5, limiar = Infinity) => {
  const pontos = []
  let fila = []
  let soma = 0
  let anterior = null
  for (const r of timeline) {
    const v = valorDe(r, chave)
    const x = instanteDe(r)
    if (v === null || Number.isNaN(x)) continue
    if (anterior !== null && x - anterior > limiar) {
      pontos.push({ x: anterior + (x - anterior) / 2, y: null })
      fila = []
      soma = 0
    }
    fila.push(v)
    soma += v
    if (fila.length > janela) soma -= fila.shift()
    pontos.push({ x, y: soma / fila.length })
    anterior = x
  }
  return pontos
}

/** Um ponto por episódio, sem suavização: [{ x: ms, y }]. */
export const pontosBrutos = (timeline, chave) => {
  const pontos = []
  for (const r of timeline) {
    const v = valorDe(r, chave)
    const x = instanteDe(r)
    if (v !== null && !Number.isNaN(x)) pontos.push({ x, y: v })
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
  winRate: mediaDaMetrica(itens, 'winRate'),
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

/**
 * Resumo de cada ciclo: começo e fim medidos pela média dos primeiros e dos
 * últimos episódios (um quinto do ciclo, entre 1 e 20), não pelo primeiro e o
 * último isolados — um episódio sozinho é ruído demais para dizer se o ciclo
 * melhorou.
 */
export const resumirCiclos = (timeline, ciclos) =>
  ciclos.map((c, idx) => {
    const eps = timeline.slice(c.de, c.ate + 1)
    const k = Math.max(1, Math.min(20, Math.ceil(eps.length / 5)))
    const inicio = eps.slice(0, k)
    const fim = eps.slice(-k)
    return {
      numero: idx + 1,
      inicio: c.inicio,
      fim: c.fim,
      duracaoMs: c.fim - c.inicio,
      total: c.total,
      epInicio: c.epInicio,
      epFim: c.epFim,
      rewardInicio: mediaDaMetrica(inicio, 'rewardMedio'),
      rewardFim: mediaDaMetrica(fim, 'rewardMedio'),
      winRateInicio: mediaDaMetrica(inicio, 'winRate'),
      winRateFim: mediaDaMetrica(fim, 'winRate'),
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

/**
 * O treino está rodando? Parado quando o último episódio ficou para trás mais
 * que dez intervalos típicos — com piso de 5min, para um treino lento não
 * aparecer como parado entre um episódio e o seguinte.
 */
export const statusDoTreino = (ultimoMs, agoraMs, cadenciaMs) => {
  if (ultimoMs === null || ultimoMs === undefined || Number.isNaN(ultimoMs)) return null
  const limite = Math.max(5 * UM_MINUTO_MS, (cadenciaMs ?? 0) * 10)
  const desdeMs = Math.max(0, agoraMs - ultimoMs)
  return { ativo: desdeMs <= limite, desdeMs }
}

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
