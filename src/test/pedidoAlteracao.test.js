import { beforeEach, describe, expect, it, vi } from 'vitest'
import pt from '../src/lang/pt.json'
import { PedidoAlteracaoEndpoint } from '../src/utils/apiClient'
import { AuthRole, decodeAuthenticationToken } from '../src/utils/authentication'
import {
  FILTROS_PUBLICOS,
  FILTRO_PADRAO,
  FILTRO_PADRAO_PUBLICO,
  STATUS,
  STATUS_PUBLICOS,
  TAMANHO_MOTIVO,
  autorDaAcao,
  conferirMotivo,
  contagemPorFiltro,
  eventosDoPedido,
  filtroDaUrl,
  frequenciaDoPedido,
  pedidosDoFiltro,
  podeDecidir,
  rotuloOuCru,
} from '../src/utils/pedidoAlteracao'

// Pedidos de alteração da Equipe Pregão: a regra da tela (filtros, quem ainda
// espera decisão, motivo do descarte) e o modo demo, que imita a API.

// O token guardado é o que o mock lê para renovar a sessão e para saber quem
// decidiu. Em Node não há localStorage: o teste o controla por aqui.
const { tokenGuardado } = vi.hoisted(() => ({ tokenGuardado: { valor: null } }))
vi.mock('../src/utils/preferences', async (importOriginal) => ({
  ...(await importOriginal()),
  getStoredToken: () => tokenGuardado.valor,
}))

// O `t` da tela com o dicionário em português: a frase sai como o admin a lê.
const t = (chave, vars = {}) => {
  const bruto = chave.split('.').reduce((nivel, parte) => nivel?.[parte], pt) ?? chave
  return Object.entries(vars).reduce((texto, [nome, valor]) => texto.replaceAll(`{{${nome}}}`, valor), String(bruto))
}

const pedido = (status, extra = {}) => ({ idPedidoAlteracao: `id-${status}`, status, tipo: 'errado', ...extra })
const LISTA = [
  pedido(STATUS.ABERTO),
  pedido(STATUS.DESCARTADO),
  pedido(STATUS.REABERTO),
  pedido(STATUS.APROVADO),
]

describe('pregão › filtros', () => {
  it('o padrão é esperando decisão; filtro desconhecido também cai nele', () => {
    expect(FILTRO_PADRAO).toBe('esperando')
    expect(filtroDaUrl(null)).toBe('esperando')
    expect(filtroDaUrl('qualquer')).toBe('esperando')
    expect(filtroDaUrl('descartado')).toBe('descartado')
    expect(filtroDaUrl('todos')).toBe('todos')
  })

  it('esperando decisão junta aberto e reaberto, na ordem da API', () => {
    expect(pedidosDoFiltro(LISTA, 'esperando').map((p) => p.status)).toEqual([STATUS.ABERTO, STATUS.REABERTO])
    expect(pedidosDoFiltro(LISTA, 'descartado').map((p) => p.status)).toEqual([STATUS.DESCARTADO])
    expect(pedidosDoFiltro(LISTA, 'todos')).toHaveLength(4)
    expect(pedidosDoFiltro(undefined, 'todos')).toEqual([])
  })

  it('conta os pedidos de cada filtro', () => {
    expect(contagemPorFiltro(LISTA)).toEqual({
      esperando: 2, aprovado: 1, 'em-correcao': 0, corrigido: 0, validado: 0, descartado: 1, todos: 4,
    })
  })

  it('só aberto e reaberto aceitam decisão', () => {
    expect(podeDecidir(pedido(STATUS.ABERTO))).toBe(true)
    expect(podeDecidir(pedido(STATUS.REABERTO))).toBe(true)
    expect(podeDecidir(pedido(STATUS.APROVADO))).toBe(false)
    expect(podeDecidir(pedido(STATUS.DESCARTADO))).toBe(false)
    expect(podeDecidir(undefined)).toBe(false)
  })
})

describe('pregão › página aberta', () => {
  it('os filtros abertos são só do que um administrador aprovou, e o padrão é ver tudo', () => {
    expect(STATUS_PUBLICOS).toEqual(['aprovado', 'em-correcao', 'corrigido', 'validado'])
    expect(FILTROS_PUBLICOS.map((f) => f.id)).toEqual(['todos', 'aprovado', 'em-correcao', 'corrigido', 'validado'])
    expect(FILTRO_PADRAO_PUBLICO).toBe('todos')
    expect(filtroDaUrl(null, FILTROS_PUBLICOS, FILTRO_PADRAO_PUBLICO)).toBe('todos')
    // Esperando decisão e descartado não são filtros da página aberta: caem no padrão.
    expect(filtroDaUrl('esperando', FILTROS_PUBLICOS, FILTRO_PADRAO_PUBLICO)).toBe('todos')
    expect(filtroDaUrl('descartado', FILTROS_PUBLICOS, FILTRO_PADRAO_PUBLICO)).toBe('todos')
    expect(filtroDaUrl('aprovado', FILTROS_PUBLICOS, FILTRO_PADRAO_PUBLICO)).toBe('aprovado')
    const publicos = [pedido(STATUS.APROVADO), pedido(STATUS.CORRIGIDO), pedido(STATUS.VALIDADO), pedido(STATUS.APROVADO)]
    expect(contagemPorFiltro(publicos, FILTROS_PUBLICOS)).toEqual({
      todos: 4, aprovado: 2, 'em-correcao': 0, corrigido: 1, validado: 1,
    })
  })

  it('a ação diz quem deu o passo', () => {
    expect(['aberto', 'reaberto', 'validado'].map(autorDaAcao)).toEqual(['pregao', 'pregao', 'pregao'])
    expect(autorDaAcao('aprovado')).toBe('administrador')
    expect(['em-correcao', 'corrigido'].map(autorDaAcao)).toEqual(['correcao', 'correcao'])
    expect(autorDaAcao('nova-acao')).toBeNull()
  })

  it('a linha do tempo sai em ordem cronológica, estável no empate', () => {
    const eventos = [
      { acao: 'corrigido', dataHora: '2026-10-05T12:00:00Z' },
      { acao: 'aberto', dataHora: '2026-10-01T09:00:00Z' },
      { acao: 'aprovado', dataHora: '2026-10-02T10:00:00Z' },
      { acao: 'em-correcao', dataHora: '2026-10-02T10:00:00Z' },
    ]
    expect(eventosDoPedido({ eventos }).map((e) => e.acao)).toEqual(['aberto', 'aprovado', 'em-correcao', 'corrigido'])
    expect(eventosDoPedido({})).toEqual([])
  })
})

describe('pregão › motivo da decisão', () => {
  it('descartar exige motivo, e espaço não conta', () => {
    expect(conferirMotivo('descartado', '')).toEqual({ erro: 'pregao.motivoObrigatorio' })
    expect(conferirMotivo('descartado', '   ')).toEqual({ erro: 'pregao.motivoObrigatorio' })
    expect(conferirMotivo('descartado', '  falso alarme  ')).toEqual({ motivo: 'falso alarme' })
  })

  it('aprovar vai sem motivo', () => {
    expect(conferirMotivo('aprovado', '')).toEqual({ motivo: null })
  })

  it('o motivo cabe na coluna da API', () => {
    expect(conferirMotivo('descartado', 'a'.repeat(TAMANHO_MOTIVO))).toEqual({ motivo: 'a'.repeat(TAMANHO_MOTIVO) })
    expect(conferirMotivo('descartado', 'a'.repeat(TAMANHO_MOTIVO + 1))).toEqual({ erro: 'pregao.motivoLongo' })
  })
})

describe('pregão › textos', () => {
  it('a frequência sai como no relatório do Pregão', () => {
    expect(frequenciaDoPedido(t, { dias: 3, rodadas: 5, visitas: 8 }))
      .toBe('3 dias, 5 de 8 rodadas que passaram pela tela')
    expect(frequenciaDoPedido(t, { dias: 1, rodadas: 1, visitas: 3 }))
      .toBe('1 dia, 1 de 3 rodadas que passaram pela tela')
  })

  it('tipo ou status que o dicionário não conhece aparece cru, nunca como chave', () => {
    expect(rotuloOuCru(t, 'pregao.tipos.errado', 'errado')).toBe('Errado ou não bate')
    expect(rotuloOuCru(t, 'pregao.status.em-correcao', 'em-correcao')).toBe('Em correção')
    expect(rotuloOuCru(t, 'pregao.tipos.novo', 'novo')).toBe('novo')
  })
})

describe('pregão › endpoints', () => {
  it('monta a lista e a decisão', () => {
    expect(PedidoAlteracaoEndpoint.LIST()).toBe('/api/PedidoAlteracao')
    expect(PedidoAlteracaoEndpoint.LIST({ status: 'aberto', agente: 'pregao.trader' }))
      .toBe('/api/PedidoAlteracao?status=aberto&agente=pregao.trader')
    expect(PedidoAlteracaoEndpoint.DECISAO('abc')).toBe('/api/PedidoAlteracao/abc/decisao')
    expect(PedidoAlteracaoEndpoint.PUBLICO).toBe('/api/PedidoAlteracao/publico')
  })
})

describe('pregão › modo demo', () => {
  // Cada teste com o mock recém-carregado: os pedidos vivem em memória, e uma
  // decisão de um teste não pode mudar a fila do seguinte.
  let getMockResponse
  beforeEach(async () => {
    tokenGuardado.valor = null
    vi.resetModules()
    ;({ getMockResponse } = await import('../src/utils/mockApi'))
  })

  const listar = (consulta = '') => getMockResponse({ endpoint: `/api/PedidoAlteracao${consulta}`, method: 'GET' }).resultado
  const decidir = (id, body) => getMockResponse({ endpoint: PedidoAlteracaoEndpoint.DECISAO(id), method: 'POST', body })
  const entrar = (email) => {
    const resp = getMockResponse({ endpoint: '/ThinkBitcoin/gerarTokenBearer', method: 'POST', body: { email, senha: 'x' } })
    return resp.resultado.tokenAutenticado
  }
  const erroDe = (acao) => {
    try {
      acao()
    } catch (e) {
      return { status: e.status, mensagem: e.message }
    }
    return null
  }

  it('traz três esperando decisão, um aprovado, o ciclo andando e um descartado, do mais grave ao menos grave', () => {
    const lista = listar()
    expect(lista).toHaveLength(7)
    expect(contagemPorFiltro(lista)).toMatchObject({ esperando: 3, aprovado: 1, corrigido: 1, validado: 1, descartado: 1 })
    expect(lista.map((p) => p.tipo)).toEqual(['errado', 'errado', 'errado', 'confuso', 'confuso', 'confuso', 'falta'])
    // A lista do administrador não traz a linha do tempo (é do GET /{id}).
    expect(lista.every((p) => !('eventos' in p))).toBe(true)
    expect(lista[0]).toMatchObject({
      tipo: 'errado',
      telas: 'Alertas de preço · Geopolítica',
      problema: 'Atraso de até 1 hora no e-mail é inviável para day trade',
      trecho: 'avisamos por e-mail em até 1 hora',
      dias: 3,
      rodadas: 5,
      visitas: 8,
      status: 'aberto',
    })
    // Sem marca de fuso, como a API serializa.
    expect(lista[0].ultimaVez).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/)
  })

  it('filtra por status e recusa status desconhecido com 400, como a API', () => {
    expect(listar('?status=descartado').map((p) => p.status)).toEqual(['descartado'])
    expect(getMockResponse({ endpoint: '/api/PedidoAlteracao?status=em-correcao', method: 'GET' }))
      .toEqual({ mensagem: 'Dados não encontrados', resultado: [] })
    expect(erroDe(() => listar('?status=xyz'))).toMatchObject({ status: 400, mensagem: expect.stringContaining('Status desconhecido') })
  })

  it('aprovar tira o pedido da fila e registra quem decidiu', () => {
    tokenGuardado.valor = entrar('admin@teste.local')
    const [primeiro] = listar('?status=aberto')
    expect(decidir(primeiro.idPedidoAlteracao, { decisao: 'aprovado' })).toEqual({ mensagem: 'Operação realizada com sucesso' })
    const aprovado = listar('?status=aprovado').find((p) => p.idPedidoAlteracao === primeiro.idPedidoAlteracao)
    expect(aprovado).toMatchObject({ decididoPor: 'admin@teste.local', motivoDecisao: null })
    expect(pedidosDoFiltro(listar(), 'esperando')).toHaveLength(2)
  })

  it('descartar exige motivo e guarda o motivo', () => {
    const [primeiro] = listar('?status=aberto')
    expect(erroDe(() => decidir(primeiro.idPedidoAlteracao, { decisao: 'descartado', motivo: '  ' })))
      .toEqual({ status: 400, mensagem: 'Informe o motivo do descarte.' })
    expect(erroDe(() => decidir(primeiro.idPedidoAlteracao, { decisao: 'descartado', motivo: 'a'.repeat(501) })))
      .toEqual({ status: 400, mensagem: 'O motivo passa de 500 caracteres.' })
    decidir(primeiro.idPedidoAlteracao, { decisao: 'descartado', motivo: ' Falso alarme do Trader ' })
    const descartado = listar('?status=descartado').find((p) => p.idPedidoAlteracao === primeiro.idPedidoAlteracao)
    expect(descartado.motivoDecisao).toBe('Falso alarme do Trader')
  })

  it('não decide de novo um pedido já decidido, nem decisão ou pedido desconhecidos', () => {
    const [descartado] = listar('?status=descartado')
    expect(erroDe(() => decidir(descartado.idPedidoAlteracao, { decisao: 'aprovado' })))
      .toEqual({ status: 400, mensagem: 'O pedido está descartado: só se decide um pedido aberto ou reaberto.' })
    const [aberto] = listar('?status=aberto')
    expect(erroDe(() => decidir(aberto.idPedidoAlteracao, { decisao: 'talvez' })))
      .toMatchObject({ status: 400, mensagem: expect.stringContaining('Decisão desconhecida') })
    expect(erroDe(() => decidir('nao-existe', { decisao: 'aprovado' })))
      .toEqual({ status: 400, mensagem: 'Pedido não encontrado.' })
  })

  it('e-mail que começa com "admin" entra como Administrador; o resto, como Minerador', () => {
    const admin = decodeAuthenticationToken(entrar(' Admin@Teste.local '))
    expect(admin).toMatchObject({ email: 'admin@teste.local', cargos: [AuthRole.ADMINISTRADOR] })
    // O Trader da Equipe Pregão continua cliente: não vê a tela dos pedidos.
    expect(decodeAuthenticationToken(entrar('trader@teste.local')).cargos).toEqual([AuthRole.MINERADOR])
    expect(decodeAuthenticationToken(entrar('')).cargos).toEqual([AuthRole.MINERADOR])
  })

  it('a renovação mantém o cargo da sessão', () => {
    const renovar = () => decodeAuthenticationToken(
      getMockResponse({ endpoint: '/ThinkBitcoin/gerarTokenBearer/renovar', method: 'POST' }).resultado.tokenAutenticado
    )
    tokenGuardado.valor = entrar('admin@teste.local')
    expect(renovar()).toMatchObject({ email: 'admin@teste.local', cargos: [AuthRole.ADMINISTRADOR] })
    tokenGuardado.valor = entrar('qualquer@teste.local')
    expect(renovar().cargos).toEqual([AuthRole.MINERADOR])
  })

  // ── A lista aberta (/api/PedidoAlteracao/publico, sem login) ──

  const publicos = () => getMockResponse({ endpoint: PedidoAlteracaoEndpoint.PUBLICO, method: 'GET' }).resultado
  const CAMPOS_PUBLICOS = [
    'dataStatus', 'dias', 'eventos', 'idPedidoAlteracao', 'primeiraVez', 'problema',
    'rodadas', 'status', 'telas', 'tipo', 'trecho', 'ultimaVez', 'visitas',
  ]

  it('a lista aberta responde sem sessão e só traz o que um administrador aprovou', () => {
    expect(tokenGuardado.valor).toBeNull()
    const lista = publicos()
    expect(lista).toHaveLength(3)
    // Nem esperando decisão nem descartado: nenhum pedido chega ao público sem revisão.
    expect(lista.some((p) => ['aberto', 'reaberto', 'descartado'].includes(p.status))).toBe(false)
    expect(new Set(lista.map((p) => p.status))).toEqual(new Set(['aprovado', 'corrigido', 'validado']))
    // Na mesma ordem da lista do administrador.
    expect(lista.map((p) => p.idPedidoAlteracao))
      .toEqual(listar().filter((p) => STATUS_PUBLICOS.includes(p.status)).map((p) => p.idPedidoAlteracao))
  })

  it('só os campos públicos: nada de quem decidiu, motivo, PR, ambiente, diários, chave ou agente', () => {
    const lista = publicos()
    for (const p of lista) {
      expect(Object.keys(p).sort()).toEqual(CAMPOS_PUBLICOS)
      for (const e of p.eventos) expect(Object.keys(e).sort()).toEqual(['acao', 'dataHora', 'detalhe', 'statusNovo'])
    }
    const texto = JSON.stringify(lista)
    expect(texto).not.toContain('admin@teste.local')
    expect(texto).not.toContain('pregao.trader')
    expect(texto).not.toContain('localhost')
  })

  it('a linha do tempo vem em ordem, e o detalhe só nos passos do Pregão', () => {
    const lista = publicos()
    const validado = lista.find((p) => p.status === STATUS.VALIDADO)
    expect(validado.eventos.map((e) => e.acao)).toEqual(['aberto', 'aprovado', 'em-correcao', 'corrigido', 'validado'])
    expect(validado.eventos.map((e) => Boolean(e.detalhe))).toEqual([true, false, false, false, true])
    expect(validado.eventos[0].detalhe).toBe('Visto em 2 dias diferentes (3 de 8 rodadas que passaram pela tela).')
    const corrigido = lista.find((p) => p.status === STATUS.CORRIGIDO)
    expect(corrigido.eventos.map((e) => e.acao)).toEqual(['aberto', 'aprovado', 'em-correcao', 'corrigido'])
    for (const p of lista) {
      const instantes = p.eventos.map((e) => Date.parse(`${e.dataHora}Z`))
      expect(instantes).toEqual([...instantes].sort((x, y) => x - y))
    }
  })

  it('o pedido só aparece na lista aberta depois de aprovado, e sem o motivo; o descartado nunca aparece', () => {
    tokenGuardado.valor = entrar('admin@teste.local')
    const [aprovar, descartar] = listar('?status=aberto')
    expect(publicos().some((p) => p.idPedidoAlteracao === aprovar.idPedidoAlteracao)).toBe(false)
    decidir(aprovar.idPedidoAlteracao, { decisao: 'aprovado', motivo: 'Vale para todo day trader.' })
    decidir(descartar.idPedidoAlteracao, { decisao: 'descartado', motivo: 'Falso alarme do Trader.' })
    tokenGuardado.valor = null

    const lista = publicos()
    const aprovado = lista.find((p) => p.idPedidoAlteracao === aprovar.idPedidoAlteracao)
    expect(aprovado.status).toBe('aprovado')
    expect(aprovado.eventos.map((e) => e.acao)).toEqual(['aberto', 'aprovado'])
    expect(aprovado.eventos.at(-1)).toMatchObject({ acao: 'aprovado', statusNovo: 'aprovado', detalhe: null })
    expect(lista.some((p) => p.idPedidoAlteracao === descartar.idPedidoAlteracao)).toBe(false)
    expect(JSON.stringify(lista)).not.toMatch(/Vale para todo|Falso alarme/)
  })
})
