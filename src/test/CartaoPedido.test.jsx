// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import CartaoPedido from '../src/components/pregao/CartaoPedido'

// O cartão de um pedido do Pregão: aprovar vai direto, descartar só com motivo,
// e o erro da API aparece junto do pedido. Sem provider de tradução, `t`
// devolve a chave: as asserções leem as chaves.

afterEach(cleanup)

const PEDIDO = {
  idPedidoAlteracao: '5b0e7c1a-3f2d-4e8a-9b6c-0d1e2f3a4b01',
  tipo: 'errado',
  telas: 'Alertas de preço · Geopolítica',
  problema: 'Atraso de até 1 hora no e-mail é inviável para day trade',
  trecho: 'avisamos por e-mail em até 1 hora',
  dias: 3,
  rodadas: 5,
  visitas: 8,
  ultimaVez: '2026-10-09T21:00:00Z',
  status: 'aberto',
  decididoPor: null,
  motivoDecisao: null,
}

const renderizar = (pedido = PEDIDO, onDecidir = vi.fn().mockResolvedValue(undefined)) => {
  render(<CartaoPedido pedido={pedido} onDecidir={onDecidir} />)
  return { onDecidir }
}

const botao = (nome) => screen.getByRole('button', { name: nome })

describe('Cartão do pedido do Pregão', () => {
  it('mostra o essencial para decidir', () => {
    renderizar()
    expect(screen.getByRole('heading', { name: PEDIDO.problema })).toBeTruthy()
    expect(screen.getByText(PEDIDO.telas)).toBeTruthy()
    expect(screen.getByText(PEDIDO.trecho)).toBeTruthy()
    // O artigo leva o nome do problema, para o leitor de tela anunciar qual é.
    expect(screen.getByRole('article', { name: PEDIDO.problema })).toBeTruthy()
    expect(botao('pregao.aprovar')).toBeTruthy()
    expect(botao('pregao.descartar')).toBeTruthy()
  })

  it('aprovar manda a decisão sem motivo', async () => {
    const { onDecidir } = renderizar()
    fireEvent.click(botao('pregao.aprovar'))
    await waitFor(() => expect(onDecidir).toHaveBeenCalledWith('aprovado', null))
  })

  it('descartar abre o motivo, e só confirma com ele preenchido', async () => {
    const { onDecidir } = renderizar()
    fireEvent.click(botao('pregao.descartar'))
    const motivo = screen.getByRole('textbox', { name: /pregao.motivoRotulo/ })
    const confirmar = botao('pregao.confirmarDescarte')
    expect(confirmar.disabled).toBe(true)

    fireEvent.change(motivo, { target: { value: '   ' } })
    expect(confirmar.disabled).toBe(true)

    fireEvent.change(motivo, { target: { value: ' Falso alarme do Trader ' } })
    expect(confirmar.disabled).toBe(false)
    fireEvent.click(confirmar)
    await waitFor(() => expect(onDecidir).toHaveBeenCalledWith('descartado', 'Falso alarme do Trader'))
  })

  it('cancelar fecha o motivo sem decidir', () => {
    const { onDecidir } = renderizar()
    fireEvent.click(botao('pregao.descartar'))
    fireEvent.click(botao('pregao.cancelar'))
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(botao('pregao.aprovar')).toBeTruthy()
    expect(onDecidir).not.toHaveBeenCalled()
  })

  it('mostra a mensagem da API quando a regra recusa', async () => {
    const erro = Object.assign(new Error('O pedido está aprovado: só se decide um pedido aberto ou reaberto.'), { status: 400, hasBackendMessage: true })
    renderizar(PEDIDO, vi.fn().mockRejectedValue(erro))
    fireEvent.click(botao('pregao.aprovar'))
    expect(await screen.findByText(erro.message)).toBeTruthy()
    // O botão volta: dá para tentar de novo.
    expect(botao('pregao.aprovar').disabled).toBe(false)
  })

  it('falha sem mensagem da API vira a frase genérica', async () => {
    renderizar(PEDIDO, vi.fn().mockRejectedValue(new Error('Failed to fetch')))
    fireEvent.click(botao('pregao.aprovar'))
    expect(await screen.findByText('pregao.erroDecisao')).toBeTruthy()
  })

  it('pedido já decidido não tem botões', () => {
    renderizar({ ...PEDIDO, status: 'descartado', decididoPor: 'admin@teste.local', motivoDecisao: 'Agora não' })
    expect(screen.queryByRole('button', { name: 'pregao.aprovar' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'pregao.descartar' })).toBeNull()
  })

  it('tipo que o dicionário não conhece aparece cru', () => {
    renderizar({ ...PEDIDO, tipo: 'novo-tipo', trecho: null })
    expect(screen.getByText('novo-tipo')).toBeTruthy()
    expect(screen.queryByText(PEDIDO.trecho)).toBeNull()
  })
})
