// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { apiRequest, PedidoAlteracaoEndpoint } from '../src/utils/apiClient'
import PregaoPublico from '../src/pages/PregaoPublico'

// A página aberta /pregao: chama o endpoint público sem sessão (`anonimo`),
// só tem filtros do que um administrador aprovou (nem esperando decisão nem
// descartado) e mostra os pedidos com a linha do tempo.
// Sem provider de tradução, `t` devolve a chave.

vi.mock('../src/utils/apiClient', async (importOriginal) => ({
  ...(await importOriginal()),
  apiRequest: vi.fn(),
}))

afterEach(cleanup)

const pedido = (id, status, problema) => ({
  idPedidoAlteracao: id,
  tipo: 'errado',
  telas: 'Painel',
  problema,
  trecho: null,
  dias: 2,
  rodadas: 3,
  visitas: 8,
  primeiraVez: '2026-10-03T12:00:00Z',
  ultimaVez: '2026-10-05T21:00:00Z',
  status,
  dataStatus: '2026-10-05T21:30:00Z',
  eventos: [{ acao: 'aberto', dataHora: '2026-10-05T21:30:00Z', statusNovo: 'aberto', detalhe: null }],
})

// Como a API pública entrega: só aprovado, em-correcao, corrigido e validado.
const LISTA = [
  pedido('a', 'corrigido', 'Problema corrigido'),
  pedido('b', 'aprovado', 'Problema aprovado'),
]

const renderizar = (url = '/pregao') => render(
  <MemoryRouter initialEntries={[url]}>
    <PregaoPublico />
  </MemoryRouter>
)

describe('Página aberta dos pedidos do Pregão', () => {
  beforeEach(() => {
    apiRequest.mockResolvedValue({ mensagem: 'Operação realizada com sucesso', resultado: LISTA })
  })

  it('busca o endpoint público como chamada anônima', async () => {
    renderizar()
    await screen.findByText('Problema aprovado')
    expect(apiRequest).toHaveBeenCalledWith(PedidoAlteracaoEndpoint.PUBLICO, { anonimo: true })
  })

  it('mostra todos por padrão, e os filtros são só do que foi aprovado', async () => {
    renderizar()
    expect(await screen.findByText('Problema corrigido')).toBeTruthy()
    expect(screen.getByText('Problema aprovado')).toBeTruthy()
    // Todos, aprovado, em correção, corrigido e validado: sem esperando decisão nem descartado.
    const filtros = screen.getByRole('group', { name: 'pregao.filtroRotulo' })
    expect(filtros.querySelectorAll('[aria-pressed]')).toHaveLength(5)
  })

  it('não mostra pedido sem revisão, mesmo que a API o devolva', async () => {
    apiRequest.mockResolvedValue({
      mensagem: 'Operação realizada com sucesso',
      resultado: [...LISTA, pedido('c', 'aberto', 'Problema aberto'), pedido('d', 'reaberto', 'Problema reaberto'),
        pedido('e', 'descartado', 'Problema descartado')],
    })
    renderizar()
    expect(await screen.findByText('Problema aprovado')).toBeTruthy()
    expect(screen.queryByText('Problema aberto')).toBeNull()
    expect(screen.queryByText('Problema reaberto')).toBeNull()
    expect(screen.queryByText('Problema descartado')).toBeNull()
  })

  it('filtra por status', async () => {
    renderizar('/pregao?status=aprovado')
    expect(await screen.findByText('Problema aprovado')).toBeTruthy()
    expect(screen.queryByText('Problema corrigido')).toBeNull()
    // `t` sem provider não interpola: o chip mostra a chave do rótulo com total.
    fireEvent.click(screen.getAllByText('pregao.filtroComTotal')[0])
    expect(await screen.findByText('Problema corrigido')).toBeTruthy()
  })

  it('link antigo com ?status=esperando cai em todos', async () => {
    renderizar('/pregao?status=esperando')
    expect(await screen.findByText('Problema corrigido')).toBeTruthy()
    expect(screen.getByText('Problema aprovado')).toBeTruthy()
  })

  // Em produção, até o administrador aprovar o primeiro pedido.
  it('lista vazia explica que nenhum pedido foi aprovado ainda', async () => {
    apiRequest.mockResolvedValue({ mensagem: 'Dados não encontrados', resultado: [] })
    renderizar()
    expect(await screen.findByText('pregaoPublico.vazio')).toBeTruthy()
  })

  it('falha sem mensagem da API vira a frase da página, com tentar de novo', async () => {
    apiRequest.mockRejectedValue(new Error('Failed to fetch'))
    renderizar()
    expect(await screen.findByText('pregaoPublico.loadError')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'pregao.retry' })).toBeTruthy()
  })
})
