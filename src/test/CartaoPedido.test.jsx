// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import CartaoPedido from '../src/components/pregao/CartaoPedido'
import { TAMANHO_MOTIVO } from '../src/utils/pedidoAlteracao'

// O cartão de um pedido do Pregão: aprovar aceita uma nota opcional, descartar só
// com motivo, e o erro da API aparece junto do pedido. Sem provider de tradução, `t`
// devolve a chave: as asserções leem as chaves.

afterEach(cleanup)

const PEDIDO = {
  idPedidoAlteracao: '5b0e7c1a-3f2d-4e8a-9b6c-0d1e2f3a4b01',
  tipo: 'errado',
  telas: 'Alertas de preço · Geopolítica',
  problema: 'Atraso de até 1 hora no e-mail é inviável para day trade',
  trecho: 'avisamos por e-mail em até 1 hora',
  detalhe: 'O e-mail chega até 1 hora depois de o preço bater no alvo.',
  ajuste: 'Avisar na hora, por notificação no navegador.',
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
    // O que acontece e o que ajustar, cada um com o seu rótulo.
    expect(screen.getByText(PEDIDO.detalhe).textContent).toBe(`pregao.detalhe ${PEDIDO.detalhe}`)
    expect(screen.getByText(PEDIDO.ajuste).textContent).toBe(`pregao.ajuste ${PEDIDO.ajuste}`)
    // O artigo leva o nome do problema, para o leitor de tela anunciar qual é.
    expect(screen.getByRole('article', { name: PEDIDO.problema })).toBeTruthy()
    expect(botao('pregao.aprovar')).toBeTruthy()
    expect(botao('pregao.descartar')).toBeTruthy()
  })

  it('avisa antes de aprovar o que uma decisão já responde', () => {
    renderizar({ ...PEDIDO, telas: 'Treinamento IA', status: 'devolvido' })
    expect(screen.getByText('pregao.grupos.aviso')).toBeTruthy()
    expect(botao('pregao.aprovar')).toBeTruthy()
  })

  it('não avisa no pedido fora dos grupos nem no que já foi decidido', () => {
    renderizar()
    expect(screen.queryByText('pregao.grupos.aviso')).toBeNull()
    cleanup()
    renderizar({ ...PEDIDO, telas: 'Treinamento IA', status: 'aprovado' })
    expect(screen.queryByText('pregao.grupos.aviso')).toBeNull()
  })

  it('o corrigido de uma tela encerrada só se descarta', () => {
    renderizar({ ...PEDIDO, telas: 'Treinamento IA', status: 'corrigido' })
    expect(botao('pregao.descartar')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'pregao.aprovar' })).toBeNull()
  })

  it('aprovar abre a nota e não decide antes de confirmar', () => {
    // 18/11/2026: o clique direto não deixava escrever a nota, e a Oficina só acerta com ela.
    const { onDecidir } = renderizar()
    fireEvent.click(botao('pregao.aprovar'))
    expect(screen.getByRole('textbox', { name: /pregao.notaRotulo/ })).toBeTruthy()
    expect(screen.queryByRole('textbox', { name: /pregao.motivoRotulo/ })).toBeNull()
    expect(screen.getByText(/pregao\.notaAjuda/)).toBeTruthy()
    expect(botao('pregao.confirmarAprovacao')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'pregao.aprovar' })).toBeNull()
    expect(onDecidir).not.toHaveBeenCalled()
  })

  it('a nota da aprovação é opcional: sem ela, a decisão vai sem motivo', async () => {
    const { onDecidir } = renderizar()
    fireEvent.click(botao('pregao.aprovar'))
    const confirmar = botao('pregao.confirmarAprovacao')
    expect(confirmar.disabled).toBe(false)
    fireEvent.change(screen.getByRole('textbox', { name: /pregao.notaRotulo/ }), { target: { value: '   ' } })
    expect(confirmar.disabled).toBe(false)
    fireEvent.click(confirmar)
    await waitFor(() => expect(onDecidir).toHaveBeenCalledWith('aprovado', null))
  })

  it('aprovar com nota manda a nota como motivo, sem os espaços das pontas', async () => {
    const { onDecidir } = renderizar()
    fireEvent.click(botao('pregao.aprovar'))
    fireEvent.change(screen.getByRole('textbox', { name: /pregao.notaRotulo/ }), { target: { value: ' O rótulo fica como está. ' } })
    fireEvent.click(botao('pregao.confirmarAprovacao'))
    await waitFor(() => expect(onDecidir).toHaveBeenCalledWith('aprovado', 'O rótulo fica como está.'))
    // Decidido o pedido, o formulário fecha e a nota não fica para o próximo.
    await waitFor(() => expect(screen.queryByRole('textbox')).toBeNull())
  })

  it('a nota que passa da coluna da API não deixa confirmar', () => {
    const { onDecidir } = renderizar()
    fireEvent.click(botao('pregao.aprovar'))
    fireEvent.change(screen.getByRole('textbox', { name: /pregao.notaRotulo/ }), { target: { value: 'a'.repeat(TAMANHO_MOTIVO + 1) } })
    expect(botao('pregao.confirmarAprovacao').disabled).toBe(true)
    expect(onDecidir).not.toHaveBeenCalled()
  })

  it('cancelar a aprovação fecha a nota sem decidir e sem guardar o texto', () => {
    const { onDecidir } = renderizar()
    fireEvent.click(botao('pregao.aprovar'))
    fireEvent.change(screen.getByRole('textbox', { name: /pregao.notaRotulo/ }), { target: { value: 'rascunho' } })
    fireEvent.click(botao('pregao.cancelar'))
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(onDecidir).not.toHaveBeenCalled()
    fireEvent.click(botao('pregao.descartar'))
    expect(screen.getByRole('textbox', { name: /pregao.motivoRotulo/ }).value).toBe('')
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
    fireEvent.change(screen.getByRole('textbox', { name: /pregao.notaRotulo/ }), { target: { value: 'Vale para todo day trader.' } })
    fireEvent.click(botao('pregao.confirmarAprovacao'))
    expect(await screen.findByText(erro.message)).toBeTruthy()
    // O botão volta, e a nota escrita fica: dá para tentar de novo sem digitar tudo outra vez.
    expect(botao('pregao.confirmarAprovacao').disabled).toBe(false)
    expect(screen.getByRole('textbox', { name: /pregao.notaRotulo/ }).value).toBe('Vale para todo day trader.')
  })

  it('falha sem mensagem da API vira a frase genérica', async () => {
    renderizar(PEDIDO, vi.fn().mockRejectedValue(new Error('Failed to fetch')))
    fireEvent.click(botao('pregao.aprovar'))
    fireEvent.click(botao('pregao.confirmarAprovacao'))
    expect(await screen.findByText('pregao.erroDecisao')).toBeTruthy()
  })

  it('pedido já decidido não tem botões', () => {
    renderizar({ ...PEDIDO, status: 'descartado', decididoPor: 'admin@teste.local', motivoDecisao: 'Agora não' })
    expect(screen.queryByRole('button', { name: 'pregao.aprovar' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'pregao.descartar' })).toBeNull()
  })

  it('pedido que o Pregão ainda não detalhou fica sem as duas linhas', () => {
    renderizar({ ...PEDIDO, detalhe: null, ajuste: null })
    expect(screen.queryByText('pregao.detalhe')).toBeNull()
    expect(screen.queryByText('pregao.ajuste')).toBeNull()
    expect(screen.getByText(PEDIDO.trecho)).toBeTruthy()
  })

  it('devolvido pela Oficina mostra o motivo e aceita decidir de novo', () => {
    renderizar({
      ...PEDIDO,
      status: 'devolvido',
      decididoPor: 'agents-oficina@thinkbitcoin.local',
      motivoDecisao: 'Sem correção no front: a taxa vem da API.',
    })
    expect(screen.getByText('pregao.devolvidoDica')).toBeTruthy()
    expect(screen.getByText(/pregao\.decididoPor/)).toBeTruthy()
    expect(botao('pregao.aprovar')).toBeTruthy()
    expect(botao('pregao.descartar')).toBeTruthy()
  })

  it('em nova tentativa, a Oficina tenta de novo sozinha: só descartar, sem aprovar', async () => {
    // 27/10/2026: a falha foi de quem corrige, e aprovar de novo era só um clique para repetir.
    const { onDecidir } = renderizar({
      ...PEDIDO,
      status: 'nova-tentativa',
      decididoPor: 'agents-oficina@thinkbitcoin.local',
      motivoDecisao: 'Tentativa 1 de 3: A troca do modelo não encaixou no código (src/src/lang/pt.json).',
    })
    expect(screen.getByText('pregao.novaTentativaDica')).toBeTruthy()
    expect(screen.getByText(/pregao\.motivoDecisao/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'pregao.aprovar' })).toBeNull()

    fireEvent.click(botao('pregao.descartar'))
    fireEvent.change(screen.getByRole('textbox', { name: /pregao.motivoRotulo/ }), { target: { value: 'agora não' } })
    fireEvent.click(botao('pregao.confirmarDescarte'))
    await waitFor(() => expect(onDecidir).toHaveBeenCalledWith('descartado', 'agora não'))
  })

  it('em correção, o link do PR abre em outra aba', () => {
    const pr = 'https://dev.azure.com/helamaborges/ThinkBitcoin/_git/ThinkBitcoin-Front/pullrequest/41'
    renderizar({ ...PEDIDO, status: 'em-correcao', decididoPor: 'admin@teste.local', referenciaCorrecao: pr })
    const link = screen.getByRole('link', { name: 'PR 41' })
    expect(link.getAttribute('href')).toBe(pr)
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.closest('p').textContent).toBe('pregao.correcao PR 41')
  })

  it('referência que não é endereço fica como texto, sem link', () => {
    renderizar({ ...PEDIDO, status: 'corrigido', referenciaCorrecao: 'javascript:alert(1)' })
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByText('pregao.correcao javascript:alert(1)')).toBeTruthy()
  })

  it('pedido sem correção não tem a linha', () => {
    renderizar()
    expect(screen.queryByText(/pregao\.correcao/)).toBeNull()
  })

  it('tipo que o dicionário não conhece aparece cru', () => {
    renderizar({ ...PEDIDO, tipo: 'novo-tipo', trecho: null })
    expect(screen.getByText('novo-tipo')).toBeTruthy()
    expect(screen.queryByText(PEDIDO.trecho)).toBeNull()
  })
})
