// Pedidos de alteração da Equipe Pregão. O Trader (usuário sintético, um day
// trader) usa a plataforma três vezes por dia; o que ele viu se repetir em dias
// diferentes vira um pedido, gravado pelo Back-DotNet. Esta é a primeira porta
// humana do ciclo: um administrador aprova (vai para quem corrige) ou descarta
// (com o motivo, que ensina a ajustar o Trader). Aqui só o que a tela precisa:
// os status, os filtros e a regra de quem ainda espera decisão.

// Espelham o StatusPedidoAlteracao do backend.
export const STATUS = Object.freeze({
  ABERTO: 'aberto',
  APROVADO: 'aprovado',
  DESCARTADO: 'descartado',
  EM_CORRECAO: 'em-correcao',
  CORRIGIDO: 'corrigido',
  VALIDADO: 'validado',
  REABERTO: 'reaberto',
})

// Os que esperam a decisão de um administrador: só eles aceitam aprovar ou descartar.
export const AGUARDANDO_DECISAO = Object.freeze([STATUS.ABERTO, STATUS.REABERTO])

export const DECISOES = Object.freeze({ APROVADO: STATUS.APROVADO, DESCARTADO: STATUS.DESCARTADO })

// O tamanho da coluna do motivo (PedidoAlteracaoConfiguration.TamanhoMotivo).
export const TAMANHO_MOTIVO = 500

// Os filtros da tela, na ordem do ciclo. "Esperando decisão" junta aberto e
// reaberto: é a fila de trabalho do administrador, e o padrão da tela.
export const FILTROS = Object.freeze([
  { id: 'esperando', status: AGUARDANDO_DECISAO },
  { id: STATUS.APROVADO, status: [STATUS.APROVADO] },
  { id: STATUS.EM_CORRECAO, status: [STATUS.EM_CORRECAO] },
  { id: STATUS.CORRIGIDO, status: [STATUS.CORRIGIDO] },
  { id: STATUS.VALIDADO, status: [STATUS.VALIDADO] },
  { id: STATUS.DESCARTADO, status: [STATUS.DESCARTADO] },
  { id: 'todos', status: null },
])

export const FILTRO_PADRAO = 'esperando'

/** O filtro pedido na URL (?status=); qualquer outra coisa é o padrão. */
export const filtroDaUrl = (valor) => (FILTROS.some((f) => f.id === valor) ? valor : FILTRO_PADRAO)

/**
 * Os pedidos de um filtro, na ordem em que a API os entregou (do mais grave
 * para o menos grave e, no mesmo tipo, do visto em mais dias). A lista vem
 * inteira e o filtro é feito aqui: são dezenas de pedidos, e assim cada filtro
 * mostra quantos tem sem uma requisição por status.
 */
export const pedidosDoFiltro = (pedidos, filtro) => {
  const definicao = FILTROS.find((f) => f.id === filtro) ?? FILTROS[0]
  const lista = Array.isArray(pedidos) ? pedidos : []
  return definicao.status ? lista.filter((p) => definicao.status.includes(p.status)) : lista
}

/** Quantos pedidos cada filtro tem: { esperando: 2, aprovado: 1, ..., todos: 4 }. */
export const contagemPorFiltro = (pedidos) =>
  Object.fromEntries(FILTROS.map((f) => [f.id, pedidosDoFiltro(pedidos, f.id).length]))

/** Se o pedido ainda aceita aprovar ou descartar. */
export const podeDecidir = (pedido) => AGUARDANDO_DECISAO.includes(pedido?.status)

/**
 * O motivo que vai para a API, ou a chave do texto que explica por que ele não
 * serve. A API recusa do mesmo jeito; conferir aqui poupa a ida e volta e deixa
 * o botão de confirmar dizer, antes do clique, que falta o motivo.
 */
export const conferirMotivo = (decisao, motivo) => {
  const texto = typeof motivo === 'string' ? motivo.trim() : ''
  if (decisao === DECISOES.DESCARTADO && !texto) return { erro: 'pregao.motivoObrigatorio' }
  if (texto.length > TAMANHO_MOTIVO) return { erro: 'pregao.motivoLongo' }
  return { motivo: texto || null }
}

/**
 * O texto do dicionário, ou o valor cru quando o dicionário ainda não o conhece
 * (status ou tipo novo no backend): nunca a chave crua na tela.
 */
export const rotuloOuCru = (t, chave, cru) => {
  const texto = t(chave)
  return texto && texto !== chave ? texto : cru
}

/**
 * Em quantos dias e rodadas o Trader viu o problema, como o relatório do
 * Pregão escreve: "3 dias, 5 de 8 rodadas que passaram pela tela". As visitas
 * são as rodadas que passaram pela tela, tenham visto o problema ou não.
 */
export const frequenciaDoPedido = (t, pedido) => {
  const dias = Number(pedido?.dias) || 0
  return t('pregao.vistoEm', {
    dias: dias === 1 ? t('pregao.diaUm') : t('pregao.dias', { n: dias }),
    rodadas: Number(pedido?.rodadas) || 0,
    visitas: Number(pedido?.visitas) || 0,
  })
}
