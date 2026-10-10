import { beforeEach, describe, expect, it, vi } from 'vitest'
import pt from '../src/lang/pt.json'
import { PedidoAlteracaoEndpoint } from '../src/utils/apiClient'
import { AuthRole, decodeAuthenticationToken } from '../src/utils/authentication'
import {
  FILTRO_PADRAO,
  STATUS,
  TAMANHO_MOTIVO,
  conferirMotivo,
  contagemPorFiltro,
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

  it('traz três pedidos esperando decisão e um descartado, do mais grave ao menos grave', () => {
    const lista = listar()
    expect(lista).toHaveLength(4)
    expect(pedidosDoFiltro(lista, 'esperando')).toHaveLength(3)
    expect(lista.map((p) => p.tipo)).toEqual(['errado', 'confuso', 'confuso', 'falta'])
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
    expect(getMockResponse({ endpoint: '/api/PedidoAlteracao?status=aprovado', method: 'GET' }))
      .toEqual({ mensagem: 'Dados não encontrados', resultado: [] })
    expect(erroDe(() => listar('?status=xyz'))).toMatchObject({ status: 400, mensagem: expect.stringContaining('Status desconhecido') })
  })

  it('aprovar tira o pedido da fila e registra quem decidiu', () => {
    tokenGuardado.valor = entrar('admin@teste.local')
    const [primeiro] = listar('?status=aberto')
    expect(decidir(primeiro.idPedidoAlteracao, { decisao: 'aprovado' })).toEqual({ mensagem: 'Operação realizada com sucesso' })
    const aprovado = listar('?status=aprovado')
    expect(aprovado).toHaveLength(1)
    expect(aprovado[0]).toMatchObject({ idPedidoAlteracao: primeiro.idPedidoAlteracao, decididoPor: 'admin@teste.local', motivoDecisao: null })
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
})
