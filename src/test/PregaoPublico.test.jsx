// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { apiRequest, PedidoAlteracaoEndpoint } from '../src/utils/apiClient'
import PregaoPublico from '../src/pages/PregaoPublico'

// A página aberta /pregao: chama o endpoint público sem sessão (`anonimo`),
// não oferece filtro de descartados e mostra os pedidos com a linha do tempo.
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

const LISTA = [
  pedido('a', 'aberto', 'Problema esperando decisão'),
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

  it('mostra todos por padrão, e os filtros não têm descartados', async () => {
    renderizar()
    expect(await screen.findByText('Problema esperando decisão')).toBeTruthy()
    expect(screen.getByText('Problema aprovado')).toBeTruthy()
    const filtros = screen.getByRole('group', { name: 'pregao.filtroRotulo' })
    expect(filtros.textContent).not.toContain('descartado')
    expect(filtros.querySelectorAll('[aria-pressed]')).toHaveLength(6)
  })

  it('filtra por status', async () => {
    renderizar('/pregao?status=aprovado')
    expect(await screen.findByText('Problema aprovado')).toBeTruthy()
    expect(screen.queryByText('Problema esperando decisão')).toBeNull()
    // `t` sem provider não interpola: o chip mostra a chave do rótulo com total.
    fireEvent.click(screen.getAllByText('pregao.filtroComTotal')[0])
    expect(await screen.findByText('Problema esperando decisão')).toBeTruthy()
  })

  it('lista vazia explica quando os pedidos aparecem', async () => {
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
