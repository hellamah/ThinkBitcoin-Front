// O robô ao vivo: o motor de risco do Back-Python (docs/motor-de-risco.md),
// que decide no BTC, com dinheiro de mentira, desde que substituiu o DQN.
// Aqui ficam as contas puras da tela /robo-ao-vivo (só administrador). A tela
// usa só o que a API já serve: as operações (historicoDecisoes) e a curva de
// papel da mesma regra no zoo (ZooEstrategia/curva).

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
