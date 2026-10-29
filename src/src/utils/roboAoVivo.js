// O robô ao vivo: o motor de risco do Back-Python (docs/motor-de-risco.md),
// que decide no BTC, com dinheiro de mentira, desde que substituiu o DQN.
// Aqui ficam as contas puras da tela /robo-ao-vivo (só administrador). A tela
// lê as operações (historicoDecisoes), o placar (RoboAoVivo/placar) e as
// decisões de cada vela (sequenciasRetorno).
//
// O placar (a curva do robô refeita pelas operações, a da regra no zoo, a do
// buy & hold e o critério) era calculado aqui até 28/10/2026; agora vem pronto
// do .NET (CalculoPlacarRobo), que também o confere todo dia e avisa por email.

// A regra é a do zoo, sem mudança, e só no BTC: o .NET guarda uma posição
// aberta por vez (TbPosicaoDecisao).
export const ESTRATEGIA_MOTOR = 'media_50d_vol_alvo_40'
export const MOEDA_MOTOR = 'BTC'

// A primeira decisão do motor no cluster: TB_DECISOR=motor-risco na réplica
// do activation-dqn criada em 23/10/2026 às 11:49 UTC. Antes disso, quem
// decidia era o DQN, que foi encerrado; as operações dele não são do robô de
// hoje e ficam fora da tela.
export const ATIVACAO_MOTOR = '2026-10-23T11:49:00Z'

// A banca de papel com que a simulação ao vivo parte (USDT).
export const BANCA_INICIAL = 1000

// Acao chega como o nome do ActionTypeEnum do .NET (FuncaoObterHistoricoDecisao).
export const ACOES = Object.freeze({
  MANTER: 'Manter',
  COMPRAR_TUDO: 'ComprarTudo',
  COMPRAR_PARCIAL: 'ComprarParcial',
  VENDER_TUDO: 'VenderTudo',
  VENDER_PARCIAL: 'VenderParcial',
})

const ACOES_QUE_FECHAM = [ACOES.VENDER_TUDO]

/** A chave de tradução da ação; a desconhecida volta crua. */
export const chaveDaAcao = (acao) => {
  const conhecida = Object.values(ACOES).includes(acao)
  return conhecida ? `robo.acoes.${acao}` : null
}

/**
 * A API devolve a data sem fuso ("2026-10-24T00:00:00"), e ela é UTC, como
 * tudo que os workers gravam. Sem o Z, o navegador a leria na hora local.
 */
export const instanteUtc = (valor) => {
  if (!valor) return NaN
  const texto = String(valor)
  const temFuso = /([zZ]|[+-]\d{2}:?\d{2})$/.test(texto)
  return Date.parse(temFuso ? texto : `${texto}Z`)
}

/** As operações da mais recente para a mais antiga, só as do motor (desde a ativação). */
export const operacoesDoMotor = (registros, ativacao = ATIVACAO_MOTOR) => {
  const corte = Date.parse(ativacao)
  return (registros ?? [])
    .filter((r) => instanteUtc(r.dataHora) >= corte)
    .sort((a, b) => instanteUtc(b.dataHora) - instanteUtc(a.dataHora))
}

/**
 * Dentro ou fora do mercado, pela última operação: depois de uma venda de
 * tudo, fora; depois de uma compra ou de um ajuste, dentro. Sem operação desde
 * a ativação, não se sabe pelo histórico, e quem responde é a curva (a dose).
 */
export const estadoPelasOperacoes = (operacoes) => {
  const ultima = operacoes?.[0]
  if (!ultima) return null
  return ACOES_QUE_FECHAM.includes(ultima.acao) ? 'fora' : 'dentro'
}

/**
 * O estado de hoje. A dose da regra vem do placar (a última exposição dela no
 * zoo); as operações dizem o que o robô fez. Quando as duas existem e discordam
 * (dose zero com posição aberta), vale a operação, que é o que está no banco, e
 * a tela mostra as duas.
 */
export const estadoDeHoje = (operacoes, dose = null) => {
  const pelasOperacoes = estadoPelasOperacoes(operacoes)
  const pelaDose = dose === null || dose === undefined ? null : dose > 0 ? 'dentro' : 'fora'
  return { estado: pelasOperacoes ?? pelaDose, dose: dose ?? null }
}

/**
 * As três curvas do placar para o gráfico ({x, y}, a partir de 1,0 no
 * fechamento antes da ativação), cada uma só nos dias em que existe.
 */
export const seriesDoPlacar = (placar) => {
  const serie = (campo) => (placar?.pontos ?? [])
    .filter((p) => p[campo] !== null && p[campo] !== undefined)
    .map((p) => ({ x: instanteUtc(p.data), y: Number(p[campo]) }))
  return { robo: serie('robo'), regra: serie('regra'), bh: serie('buyHold') }
}

const DIA_MS = 24 * 60 * 60 * 1000
const HORA_DA_DECISAO = 23
const diaUtc = (ms) => Math.floor(ms / DIA_MS) * DIA_MS

/**
 * O dia (meia-noite UTC) da vela das 23h cuja decisão a operação executou: a
 * última vela das 23h antes dela. A decisão executa na ativação seguinte, ao
 * preço da vela; com o PC do cluster desligado, o pod que sobe a executa mais
 * tarde, ao mesmo preço (o _vela_pendente do motor faz a mesma conta).
 */
export const diaDaDecisao = (dataHora) => {
  const ms = instanteUtc(dataHora)
  return Number.isNaN(ms) ? NaN : diaUtc(ms - DIA_MS)
}

/**
 * A carteira do robô ao longo das operações, da mais antiga para a mais nova:
 * o caixa logo depois de cada uma (o SaldoPosterior, que é o caixa da
 * simulação), a quantidade e o preço médio. No ajuste parcial, o .NET grava em
 * Quantidade a parte movida, e não o total (FuncaoAtualizarPosicaoDecisao).
 *
 * `inicial` é a carteira antes da primeira operação. A venda de tudo diz a
 * posição que havia (a que o DQN deixou, na troca de 23/10); a compra de tudo
 * parte de fora. Um ajuste parcial não diz o tamanho de antes: `inicial` fica
 * nulo. Sem operação, o robô está fora, com a banca inicial.
 */
export const carteirasDoRobo = (operacoes) => {
  const ops = [...(operacoes ?? [])].sort((a, b) => instanteUtc(a.dataHora) - instanteUtc(b.dataHora))
  const primeira = ops[0]
  let inicial = null
  if (!primeira) {
    inicial = { caixa: BANCA_INICIAL, quantidade: 0, precoMedio: 0 }
  } else if (primeira.acao === ACOES.VENDER_TUDO) {
    inicial = { caixa: Number(primeira.saldoAnterior), quantidade: Number(primeira.quantidade), precoMedio: Number(primeira.precoCompra) }
  } else if (primeira.acao === ACOES.COMPRAR_TUDO) {
    inicial = { caixa: Number(primeira.saldoAnterior), quantidade: 0, precoMedio: 0 }
  }
  const depois = []
  let quantidade = inicial?.quantidade ?? null
  for (const op of ops) {
    const movida = Number(op.quantidade)
    if (op.acao === ACOES.VENDER_TUDO) quantidade = 0
    else if (op.acao === ACOES.COMPRAR_TUDO) quantidade = movida
    else if (quantidade !== null && op.acao === ACOES.COMPRAR_PARCIAL) quantidade += movida
    else if (quantidade !== null && op.acao === ACOES.VENDER_PARCIAL) quantidade = Math.max(0, quantidade - movida)
    depois.push({
      dia: diaDaDecisao(op.dataHora),
      caixa: Number(op.saldoPosterior),
      quantidade,
      precoMedio: Number(op.precoCompra),
      precoMercado: Number(op.precoMercado),
    })
  }
  return { inicial, depois }
}

/** A carteira no fechamento do dia `dia`: a da última operação decidida até ele. */
const carteiraNoDia = ({ inicial, depois }, dia) => {
  let atual = inicial
  for (const c of depois) {
    if (c.dia <= dia) atual = c
  }
  return atual
}

// O Tipo de TbSequenciaRetorno na vela das 23h: o lado da decisão do dia
// (core/publisher.py e o _decidir do motor).
export const DECISOES = Object.freeze({ 0: 'manter', 1: 'comprar', 2: 'vender' })

/**
 * As noites do robô, da mais recente para a mais antiga, desde a primeira vela
 * das 23h depois da ativação: a decisão daquela vela (a linha das 23h de
 * sequenciasRetorno) e as operações que a executaram.
 *
 * - Noite sem a linha das 23h: o robô não rodou nessa vela (o PC do cluster
 *   desligado às 21:02 de Brasília, por exemplo). A decisão dela se perde, a
 *   menos que o pod que sobe a recupere, e então a operação aparece.
 * - As noites vão até a última que a sequência ou o zoo já têm (o zoo grava o
 *   dia às 00:30 UTC, mesmo quando o robô não rodou).
 * - `desde`: o dia da linha mais antiga que a busca trouxe, quando ela veio
 *   cortada; antes dele, a falta da linha não quer dizer nada, e a noite fica
 *   de fora.
 */
export const noitesDoRobo = (sequencias, operacoes, {
  ultimoDiaDoZoo = null, desde = null, ativacao = ATIVACAO_MOTOR, limite = 14, agora = Date.now(),
} = {}) => {
  const primeiro = Math.max(diaUtc(Date.parse(ativacao)), desde ?? -Infinity)
  const decisoes = new Map()
  for (const s of sequencias ?? []) {
    const ms = instanteUtc(s.dataHora)
    if (Number.isNaN(ms) || new Date(ms).getUTCHours() !== HORA_DA_DECISAO) continue
    if (diaUtc(ms) >= primeiro) decisoes.set(diaUtc(ms), s)
  }
  // Sem a lista de operações (falhou ou carrega), não se sabe o que executou.
  const conhecidas = Array.isArray(operacoes)
  const carteiras = conhecidas ? carteirasDoRobo(operacoes) : null
  const porDia = new Map()
  for (const op of conhecidas ? operacoes : []) {
    const dia = diaDaDecisao(op.dataHora)
    porDia.set(dia, [...(porDia.get(dia) ?? []), op])
  }
  const ultimo = Math.max(...decisoes.keys(), ultimoDiaDoZoo ?? -Infinity)
  const noites = []
  for (let dia = ultimo; Number.isFinite(dia) && dia >= primeiro && noites.length < limite; dia -= DIA_MS) {
    const linha = decisoes.get(dia)
    const decisao = linha ? (DECISOES[Number(linha.tipo)] ?? null) : null
    const ops = conhecidas ? (porDia.get(dia) ?? []).sort((a, b) => instanteUtc(a.dataHora) - instanteUtc(b.dataHora)) : null
    const carteira = carteiras ? carteiraNoDia(carteiras, dia) : null
    // Compra ou venda sem operação: a execução vem na ativação das 01:02 UTC.
    let execucao = null
    if (ops?.length) execucao = 'feita'
    else if (ops && (decisao === 'comprar' || decisao === 'vender')) {
      execucao = agora < dia + DIA_MS + 2 * 60 * 60 * 1000 ? 'pendente' : 'perdida'
    }
    noites.push({
      dia,
      decisao,
      rodou: Boolean(linha),
      operacoes: ops,
      execucao,
      depois: !carteira || carteira.quantidade === null ? null : carteira.quantidade > 0 ? 'dentro' : 'fora',
    })
  }
  return noites
}

/** O dia (meia-noite UTC) do último fechamento do placar, ou nulo. */
export const ultimoDiaDoPlacar = (placar) => {
  const ultimo = placar?.pontos?.at(-1)
  const ms = ultimo ? instanteUtc(ultimo.data) : NaN
  return Number.isNaN(ms) ? null : diaUtc(ms)
}

/** As linhas da busca de sequenciasRetorno e, quando ela veio cortada, o dia da mais antiga. */
export const sequenciasDaBusca = (resultado) => {
  const registros = Array.isArray(resultado?.registros) ? resultado.registros : []
  const cortada = Number(resultado?.totalRegistros) > registros.length
  const instantes = registros.map((r) => instanteUtc(r.dataHora)).filter((ms) => !Number.isNaN(ms))
  return { registros, desde: cortada && instantes.length ? diaUtc(Math.min(...instantes)) : null }
}

/**
 * Se a operação executou fora da ativação seguinte à vela das 23h (a das 00h
 * UTC): o PC estava desligado, e o pod que subiu a executou ao preço da vela.
 */
export const executouAoReligar = (op) => {
  const ms = instanteUtc(op?.dataHora)
  return !Number.isNaN(ms) && ms - (diaDaDecisao(op.dataHora) + DIA_MS) >= 60 * 60 * 1000
}
