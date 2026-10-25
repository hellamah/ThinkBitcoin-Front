// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { apiRequest, PedidoAlteracaoEndpoint } from '../src/utils/apiClient'
import MenuPregao from '../src/components/pregao/MenuPregao'
import usePedidosAlteracao, { usePedidosEsperando } from '../src/hooks/usePedidosAlteracao'

// O menu do Pregão no cabeçalho: abre as duas telas (fila de decisão e página
// aberta) e mostra quantos pedidos esperam decisão. O número vem de uma busca
// ao entrar e, depois, do que a fila avisa — decidir na fila baixa o número
// sem outra busca do cabeçalho.
// Sem provider de tradução, `t` devolve a chave.

vi.mock('../src/utils/apiClient', async (importOriginal) => ({
  ...(await importOriginal()),
  apiRequest: vi.fn(),
}))

afterEach(cleanup)

const pedido = (id, status) => ({ idPedidoAlteracao: id, problema: `Problema ${id}`, status })

let lista
beforeEach(() => {
  apiRequest.mockReset()
  lista = [pedido('a', 'aberto'), pedido('b', 'reaberto'), pedido('c', 'aprovado')]
  // Como o mock da API: a decisão muda o status, e a próxima lista já vem com ele.
  apiRequest.mockImplementation(async (endpoint, { method, body } = {}) => {
    if (method === 'POST') {
      const id = endpoint.split('/').at(-2)
      lista = lista.map((p) => (p.idPedidoAlteracao === id ? { ...p, status: body.decisao } : p))
      return { resultado: null }
    }
    return { resultado: lista }
  })
})

function Cabecalho({ administrador = true }) {
  return <MenuPregao esperando={usePedidosEsperando(administrador)} />
}

function Fila() {
  const { pedidos, decidir } = usePedidosAlteracao()
  return (pedidos ?? []).map((p) => (
    <button key={p.idPedidoAlteracao} onClick={() => decidir(p.idPedidoAlteracao, 'aprovado')}>
      {`aprovar ${p.idPedidoAlteracao}`}
    </button>
  ))
}

const renderizar = (conteudo, url = '/dashboard') => render(
  <MemoryRouter initialEntries={[url]}>{conteudo}</MemoryRouter>
)

const numero = (container) => container.querySelector('.MuiBadge-badge')

describe('Menu do Pregão no cabeçalho', () => {
  it('busca a lista em segundo plano e mostra quantos esperam decisão', async () => {
    const { container } = renderizar(<Cabecalho />)
    await waitFor(() => expect(numero(container).textContent).toBe('2'))
    expect(apiRequest).toHaveBeenCalledWith(PedidoAlteracaoEndpoint.LIST(), { emSegundoPlano: true })
    expect(screen.getByRole('button', { name: 'nav.pregaoMenu: nav.pregaoEsperando' })).toBeTruthy()
  })

  it('abre as três telas de administrador: a fila, a página aberta e o robô ao vivo', async () => {
    renderizar(<Cabecalho />)
    fireEvent.click(screen.getByRole('button', { name: /nav\.pregaoMenu/ }))
    const itens = await screen.findAllByRole('menuitem')
    expect(itens.map((i) => i.getAttribute('href'))).toEqual(['/pedidos-pregao', '/pregao', '/robo-ao-vivo'])
  })

  it('marca a tela em que se está, no botão e no item', async () => {
    renderizar(<Cabecalho />, '/pregao')
    const botao = screen.getByRole('button', { name: /nav\.pregaoMenu/ })
    expect(botao.classList.contains('active')).toBe(true)
    fireEvent.click(botao)
    const [fila, aberta] = await screen.findAllByRole('menuitem')
    expect(aberta.classList.contains('Mui-selected')).toBe(true)
    expect(fila.classList.contains('Mui-selected')).toBe(false)
  })

  it('sem o cargo, não busca nada', () => {
    const { container } = renderizar(<Cabecalho administrador={false} />)
    expect(apiRequest).not.toHaveBeenCalled()
    expect(numero(container).classList.contains('MuiBadge-invisible')).toBe(true)
  })

  it('decidir na fila baixa o número sem outra busca do cabeçalho', async () => {
    const { container } = renderizar(<><Cabecalho /><Fila /></>)
    await waitFor(() => expect(numero(container).textContent).toBe('2'))
    const buscasDoCabecalho = () => apiRequest.mock.calls.filter(([, opcoes]) => opcoes?.emSegundoPlano).length
    expect(buscasDoCabecalho()).toBe(1)

    await act(async () => { fireEvent.click(await screen.findByText('aprovar a')) })
    await waitFor(() => expect(numero(container).textContent).toBe('1'))
    expect(screen.getByRole('button', { name: 'nav.pregaoMenu: nav.pregaoUmEsperando' })).toBeTruthy()

    await act(async () => { fireEvent.click(screen.getByText('aprovar b')) })
    await waitFor(() => expect(numero(container).classList.contains('MuiBadge-invisible')).toBe(true))
    expect(screen.getByRole('button', { name: 'nav.pregaoMenu: nav.pregaoNenhumEsperando' })).toBeTruthy()
    expect(buscasDoCabecalho()).toBe(1)
  })
})
