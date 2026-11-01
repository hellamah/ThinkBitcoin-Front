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
  DEVOLVIDO: 'devolvido',
  NOVA_TENTATIVA: 'nova-tentativa',
  VALIDADO: 'validado',
  REABERTO: 'reaberto',
})

// Os que esperam a decisão de um administrador: só eles aceitam aprovar ou descartar.
// O devolvido é o que quem corrige não conseguiu corrigir (17/10/2026): volta com o
// motivo, e aprovar de novo é pedir outra tentativa.
export const AGUARDANDO_DECISAO = Object.freeze([STATUS.ABERTO, STATUS.REABERTO, STATUS.DEVOLVIDO])

// A nova tentativa (27/10/2026) é a falha de quem corrige, não uma decisão: ele
// tenta de novo sozinho, sem esperar aprovação. O administrador só a descarta,
// se o pedido não vale mais (StatusPedidoAlteracao.Descartaveis do backend).
export const DESCARTAVEIS = Object.freeze([...AGUARDANDO_DECISAO, STATUS.NOVA_TENTATIVA])

export const DECISOES = Object.freeze({ APROVADO: STATUS.APROVADO, DESCARTADO: STATUS.DESCARTADO })

// O tamanho da coluna do motivo (PedidoAlteracaoConfiguration.TamanhoMotivo).
export const TAMANHO_MOTIVO = 500

// Os filtros da tela, na ordem do ciclo. "Esperando decisão" junta aberto,
// reaberto e devolvido: é a fila de trabalho do administrador, e o padrão da tela.
export const FILTROS = Object.freeze([
  { id: 'esperando', status: AGUARDANDO_DECISAO },
  { id: STATUS.APROVADO, status: [STATUS.APROVADO] },
  { id: STATUS.NOVA_TENTATIVA, status: [STATUS.NOVA_TENTATIVA] },
  { id: STATUS.EM_CORRECAO, status: [STATUS.EM_CORRECAO] },
  { id: STATUS.CORRIGIDO, status: [STATUS.CORRIGIDO] },
  { id: STATUS.VALIDADO, status: [STATUS.VALIDADO] },
  { id: STATUS.DESCARTADO, status: [STATUS.DESCARTADO] },
  { id: 'todos', status: null },
])

export const FILTRO_PADRAO = 'esperando'

// O que a página aberta (/pregao) mostra: só o que um administrador aprovou, e
// o caminho até a correção. Esperando decisão (aberto, reaberto) e descartado
// nunca saem dali — a API pública nem os traz: nenhum pedido do Pregão chega ao
// público sem revisão. A nova tentativa continua aprovada: quem corrige tenta de novo.
export const STATUS_PUBLICOS = Object.freeze([
  STATUS.APROVADO, STATUS.NOVA_TENTATIVA, STATUS.EM_CORRECAO, STATUS.CORRIGIDO, STATUS.VALIDADO,
])

// Os filtros da página aberta, um por status público. O padrão é ver tudo —
// quem chega de fora quer o quadro inteiro, e não a fila de trabalho do
// administrador.
export const FILTROS_PUBLICOS = Object.freeze([
  { id: 'todos', status: null },
  ...FILTROS.filter((f) => f.status?.length === 1 && STATUS_PUBLICOS.includes(f.status[0])),
])

export const FILTRO_PADRAO_PUBLICO = 'todos'

/** O filtro pedido na URL (?status=); qualquer outra coisa é o padrão. */
export const filtroDaUrl = (valor, filtros = FILTROS, padrao = FILTRO_PADRAO) =>
  (filtros.some((f) => f.id === valor) ? valor : padrao)

/**
 * Os pedidos de um filtro, na ordem em que a API os entregou (do mais grave
 * para o menos grave e, no mesmo tipo, do visto em mais dias). A lista vem
 * inteira e o filtro é feito aqui: são dezenas de pedidos, e assim cada filtro
 * mostra quantos tem sem uma requisição por status.
 */
export const pedidosDoFiltro = (pedidos, filtro, filtros = FILTROS) => {
  const definicao = filtros.find((f) => f.id === filtro) ?? filtros[0]
  const lista = Array.isArray(pedidos) ? pedidos : []
  return definicao.status ? lista.filter((p) => definicao.status.includes(p.status)) : lista
}

/** Quantos pedidos cada filtro tem: { esperando: 2, aprovado: 1, ..., todos: 4 }. */
export const contagemPorFiltro = (pedidos, filtros = FILTROS) =>
  Object.fromEntries(filtros.map((f) => [f.id, pedidosDoFiltro(pedidos, f.id, filtros).length]))

/** Se o pedido ainda aceita aprovar ou descartar. */
export const podeDecidir = (pedido) => AGUARDANDO_DECISAO.includes(pedido?.status)

/**
 * Se o pedido aceita descartar: os que esperam decisão, a nova tentativa e o corrigido
 * das telas encerradas. Em 31/10/2026 eram 9: o Trader não visita mais essas telas, e
 * eles não virariam validados nem reabertos. O backend aceita descartar todo corrigido
 * (StatusPedidoAlteracao.Descartaveis): o limite é aqui, porque só ele sabe dos grupos.
 */
export const podeDescartar = (pedido) => DESCARTAVEIS.includes(pedido?.status)
  || (pedido?.status === STATUS.CORRIGIDO && grupoDoPedido(pedido) === 'telaEncerrada')

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

// ── Descarte por grupo ─────────────────────────────────────────────────────

// Os pedidos que uma decisão do dono já responde (30/10/2026): dos 178 esperando
// decisão naquele dia, 35 eram das telas do treino encerrado, e os "falta" de
// day trade passavam de 7 dias na fila sem ninguém decidir o cliente-alvo. A
// tela só reúne e sugere o motivo: quem descarta continua sendo o administrador.
const TELAS_ENCERRADAS = Object.freeze(['Treinamento IA', 'Detalhe do episódio'])
const NAO_SAO_TELA = Object.freeze(['?', 'Cruzamentos entre telas'])
const VITRINE = /94[,.]8|precis[aã]o da ia|marketing|vitrine|uptime do core|dados\s*\/\s*seg|domina o mercado/i
const DAY_TRADE = /order ?book|livro de (?:ofertas|ordens)|depth|profundidade|order flow|fluxo de ordens|volume profile|execu[cç][aã]o|executar|ordem|alavancagem|leverage|api keys?|chaves? de api|webhooks?|take profit|stop loss|scalp|timeframe|intraday|paper trading|linhas de tend[eê]ncia/i

const telasDoPedido = (pedido) => (pedido?.telas || '')
  .split('·')
  .map((t) => t.trim())
  .filter((t) => t && !NAO_SAO_TELA.includes(t))

// Na ordem: o pedido que cabe em dois grupos fica no primeiro.
export const GRUPOS_DE_DESCARTE = Object.freeze([
  {
    id: 'telaEncerrada',
    // Só as telas do treino: o pedido que cita também outra tela pode valer ali.
    pertence: (p) => {
      const telas = telasDoPedido(p)
      return telas.length > 0 && telas.every((t) => TELAS_ENCERRADAS.includes(t))
    },
  },
  { id: 'vitrine', pertence: (p) => VITRINE.test(`${p?.problema || ''} ${p?.trecho || ''}`) },
  { id: 'dayTrade', pertence: (p) => p?.tipo === 'falta' && DAY_TRADE.test(p?.problema || '') },
])

/**
 * Os grupos com pedido a descartar: [{ id, pedidos }], dos que esperam decisão e
 * da nova tentativa, que gasta uma rodada do modelo a cada dia até alguém
 * descartar (em 30/10/2026, 5 das 12 eram das telas encerradas).
 */
export const gruposDeDescarte = (pedidos) => {
  const restantes = (Array.isArray(pedidos) ? pedidos : []).filter(podeDescartar)
  const usados = new Set()
  return GRUPOS_DE_DESCARTE.map(({ id, pertence }) => {
    const doGrupo = restantes.filter((p) => !usados.has(p.idPedidoAlteracao) && pertence(p))
    doGrupo.forEach((p) => usados.add(p.idPedidoAlteracao))
    return { id, pedidos: doGrupo }
  }).filter((g) => g.pedidos.length > 0)
}

/**
 * O grupo de descarte do pedido, ou nulo: o cartão avisa antes de aprovar. Em
 * 30/10/2026, 46 pedidos foram aprovados em 2 minutos, 10 deles das telas
 * encerradas, e a regra só aparecia no painel de descarte, longe do botão.
 */
export const grupoDoPedido = (pedido) =>
  GRUPOS_DE_DESCARTE.find(({ pertence }) => pertence(pedido))?.id ?? null

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

// ── Linha do tempo (página aberta) ─────────────────────────────────────────

// Quem faz cada passo do ciclo. A API pública não traz o autor (o e-mail de
// quem decidiu é privado): a ação diz quem foi. A Equipe Pregão abre, reabre e
// valida; um administrador aprova; quem corrige começa, entrega ou devolve.
const AUTOR_DA_ACAO = Object.freeze({
  [STATUS.ABERTO]: 'pregao',
  [STATUS.REABERTO]: 'pregao',
  [STATUS.VALIDADO]: 'pregao',
  [STATUS.APROVADO]: 'administrador',
  [STATUS.EM_CORRECAO]: 'correcao',
  [STATUS.CORRIGIDO]: 'correcao',
  [STATUS.DEVOLVIDO]: 'correcao',
  [STATUS.NOVA_TENTATIVA]: 'correcao',
})

/** 'pregao', 'administrador' ou 'correcao'; nulo para ação que a tela não conhece. */
export const autorDaAcao = (acao) => AUTOR_DA_ACAO[acao] ?? null

/**
 * Os passos do pedido em ordem cronológica. A API já os entrega assim; ordenar
 * de novo custa nada e protege a história de ser contada de trás para frente.
 * A ordenação é estável: dois passos no mesmo instante ficam na ordem da API.
 */
export const eventosDoPedido = (pedido) =>
  [...(Array.isArray(pedido?.eventos) ? pedido.eventos : [])]
    .sort((a, b) => (Date.parse(a.dataHora) || 0) - (Date.parse(b.dataHora) || 0))

/**
 * O que o cartão mostra da referência da correção: o link do PR do Azure vira
 * "PR 41"; outro endereço http(s) vira link com o próprio endereço; o resto
 * (como o caminho do histórico, quando o merge não veio de um PR do agente)
 * fica como texto. Só http(s) vira link: a referência vem da API, e um
 * `javascript:` nunca chega ao href. Nulo sem referência.
 */
export const correcaoDoPedido = (referencia) => {
  const texto = typeof referencia === 'string' ? referencia.trim() : ''
  if (!texto) return null
  if (!/^https?:\/\//i.test(texto)) return { href: null, texto }
  const pr = texto.match(/\/pullrequest\/(\d+)\/?$/i)
  return { href: texto, texto: pr ? `PR ${pr[1]}` : texto }
}
