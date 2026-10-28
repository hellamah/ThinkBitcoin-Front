// O robô ao vivo: o motor de risco do Back-Python (docs/motor-de-risco.md),
// que decide no BTC, com dinheiro de mentira, desde que substituiu o DQN.
// Aqui ficam as contas puras da tela /robo-ao-vivo (só administrador). A tela
// usa só o que a API já serve: as operações (historicoDecisoes), a curva de
// papel da mesma regra no zoo (ZooEstrategia/curva) e as decisões de cada
// vela (sequenciasRetorno).

import { BUY_HOLD } from './zooEstrategia'

// A regra é a do zoo, sem mudança, e só no BTC: o .NET guarda uma posição
// aberta por vez (TbPosicaoDecisao).
export const ESTRATEGIA_MOTOR = 'media_50d_vol_alvo_40'
export const MOEDA_MOTOR = 'BTC'
export const ESTRATEGIAS_DA_CURVA = Object.freeze([ESTRATEGIA_MOTOR, BUY_HOLD])

// A primeira decisão do motor no cluster: TB_DECISOR=motor-risco na réplica
// do activation-dqn criada em 23/10/2026 às 11:49 UTC. Antes disso, quem
// decidia era o DQN, que foi encerrado; as operações dele não são do robô de
// hoje e ficam fora da tela.
export const ATIVACAO_MOTOR = '2026-10-23T11:49:00Z'

// A banca de papel com que a simulação ao vivo parte (USDT).
export const BANCA_INICIAL = 1000

// A curva começa no último fechamento antes da ativação (o do dia 22), para
// que o primeiro dia do motor já apareça como variação. O zoo grava um ponto
// por dia, com a data do dia do fechamento.
export const INICIO_DA_CURVA = '2026-10-22'

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

/** A dose da regra no último ponto da curva de papel (0 a 1), ou nulo. */
export const doseDaRegra = (curva) => {
  const pontos = curva?.pontos ?? []
  for (let i = pontos.length - 1; i >= 0; i -= 1) {
    const exposicao = pontos[i]?.exposicao
    if (exposicao !== null && exposicao !== undefined) return Number(exposicao)
  }
  return null
}

/**
 * O estado de hoje. A curva diz a dose da regra; as operações dizem o que o
 * robô fez. Quando as duas existem e discordam (dose zero com posição aberta),
 * vale a operação, que é o que está no banco, e a tela mostra as duas.
 */
export const estadoDeHoje = (operacoes, curvaDaRegra) => {
  const dose = doseDaRegra(curvaDaRegra)
  const pelasOperacoes = estadoPelasOperacoes(operacoes)
  const pelaDose = dose === null ? null : dose > 0 ? 'dentro' : 'fora'
  return { estado: pelasOperacoes ?? pelaDose, dose }
}

/**
 * Os pontos da curva para o gráfico, a partir de 1,0 no primeiro ponto: as
 * curvas do zoo começam em 1,0 no início do histórico, e aqui o que interessa
 * é o período do robô.
 */
export const curvaNoPeriodo = (curva) => {
  const pontos = (curva?.pontos ?? []).filter((p) => p.patrimonio !== null && p.patrimonio !== undefined)
  if (pontos.length === 0) return []
  const base = Number(pontos[0].patrimonio)
  if (!(base > 0)) return []
  return pontos.map((p) => ({ x: instanteUtc(p.data), y: Number(p.patrimonio) / base }))
}

/** O retorno do período (último ponto / primeiro − 1), ou nulo sem dois pontos. */
export const retornoDoPeriodo = (pontos) => (pontos.length < 2 ? null : pontos.at(-1).y - 1)

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

/**
 * A curva do robô, refeita pelas operações, nas datas da curva buy & hold do
 * zoo e a partir de 1,0 no primeiro ponto, como as outras duas.
 *
 * O patrimônio é o caixa mais a posição ao preço de fechamento do dia. O
 * preço vem da própria curva buy & hold, que é o fechamento das 23h UTC
 * dividido pelo do primeiro dia do histórico: medido em 28/10/2026, a razão
 * ficou igual de 18 a 27/10. A escala sai de uma operação, que executa ao
 * preço da vela das 23h do dia da decisão.
 */
export const curvaDoRobo = (operacoes, curvaBh) => {
  const pontosBh = (curvaBh?.pontos ?? []).filter((p) => p.patrimonio !== null && p.patrimonio !== undefined)
  if (pontosBh.length === 0) return []
  const carteiras = carteirasDoRobo(operacoes)
  const bhNoDia = new Map(pontosBh.map((p) => [diaUtc(instanteUtc(p.data)), Number(p.patrimonio)]))
  const ancora = carteiras.depois.find((c) => bhNoDia.get(c.dia) > 0 && c.precoMercado > 0)
  const escala = ancora ? ancora.precoMercado / bhNoDia.get(ancora.dia) : null

  const patrimonios = pontosBh.map((p) => {
    const x = instanteUtc(p.data)
    const carteira = carteiraNoDia(carteiras, diaUtc(x))
    if (!carteira || carteira.quantidade === null) return { x, valor: null }
    if (carteira.quantidade === 0) return { x, valor: carteira.caixa }
    if (escala === null) return { x, valor: null }
    const preco = Number(p.patrimonio) * escala
    return { x, valor: carteira.caixa + carteira.quantidade * (preco - carteira.precoMedio) }
  }).filter((p) => p.valor !== null && Number.isFinite(p.valor))
  if (patrimonios.length === 0 || !(patrimonios[0].valor > 0)) return []
  const base = patrimonios[0].valor
  return patrimonios.map((p) => ({ x: p.x, y: p.valor / base }))
}

/** A maior queda de um topo, na curva (0,25 = 25%), ou nulo sem pontos. */
export const quedaMaxima = (pontos) => {
  if (!pontos?.length) return null
  let topo = -Infinity
  let pior = 0
  for (const { y } of pontos) {
    topo = Math.max(topo, y)
    if (topo > 0) pior = Math.max(pior, 1 - y / topo)
  }
  return pior
}

// O critério registrado em 22/10/2026, antes de ligar o motor
// (docs/motor-de-risco.md, "Critério"). A tela mede; desligar é decisão do dono.
export const CRITERIO = Object.freeze({
  // Fidelidade: o retorno ao vivo a no máximo 3 pontos do da regra no zoo.
  FIDELIDADE: 0.03,
  // Risco: a queda ao vivo não passa de 50%...
  QUEDA_MAXIMA: 0.5,
  // ...e, com o buy & hold 20% ou mais abaixo do topo, não passa de 80% da dele.
  QUEDA_DO_BH: 0.2,
  FRACAO_DA_QUEDA_DO_BH: 0.8,
})

/**
 * O critério nas três curvas do período (todas a partir de 1,0 no mesmo dia).
 *
 * - `distancia`: o retorno do robô menos o da regra, no último dia que as duas
 *   têm, a partir do primeiro dia em comum (0,004 = 0,4 ponto).
 * - `quedaRobo` e `quedaBh`: as maiores quedas desde o início do período. A
 *   regra 2b lida aqui: com o buy & hold 20% ou mais abaixo do topo no
 *   período, a maior queda do robô não passa de 80% da maior dele.
 *
 * Cada `...Ok` é verdadeiro, falso ou nulo (sem dados, ou a regra não se aplica).
 */
export const criterioDoMotor = (robo, regra, bh) => {
  const naRegra = new Map((regra ?? []).map((p) => [p.x, p.y]))
  const comuns = (robo ?? []).filter((p) => naRegra.has(p.x))
  let distancia = null
  if (comuns.length >= 2) {
    const [primeiro, ultimo] = [comuns[0], comuns.at(-1)]
    distancia = (ultimo.y / primeiro.y) - (naRegra.get(ultimo.x) / naRegra.get(primeiro.x))
  }
  const quedaRobo = quedaMaxima(robo)
  const quedaBh = quedaMaxima(bh)
  const relativaAplica = quedaBh !== null && quedaBh >= CRITERIO.QUEDA_DO_BH
  return {
    distancia,
    fidelidadeOk: distancia === null ? null : Math.abs(distancia) <= CRITERIO.FIDELIDADE,
    quedaRobo,
    quedaOk: quedaRobo === null ? null : quedaRobo <= CRITERIO.QUEDA_MAXIMA,
    quedaBh,
    limiteRelativo: quedaBh === null ? null : quedaBh * CRITERIO.FRACAO_DA_QUEDA_DO_BH,
    relativaOk: !relativaAplica || quedaRobo === null ? null : quedaRobo <= quedaBh * CRITERIO.FRACAO_DA_QUEDA_DO_BH,
  }
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

/** O dia (meia-noite UTC) do último ponto da curva, ou nulo. */
export const ultimoDiaDaCurva = (curva) => {
  const ultimo = curva?.pontos?.at(-1)
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
