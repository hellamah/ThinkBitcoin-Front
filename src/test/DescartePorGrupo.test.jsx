// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import DescartePorGrupo from '../src/components/pregao/DescartePorGrupo'
import { gruposDeDescarte, podeDescartar } from '../src/utils/pedidoAlteracao'

// O descarte por grupo: a lista vem marcada, o motivo vem sugerido e quem descarta
// é o administrador. Sem provider de tradução, `t` devolve a chave.

afterEach(cleanup)

const pedido = (id, problema, telas, extras = {}) => ({
  idPedidoAlteracao: id, problema, telas, tipo: 'errado', status: 'aberto', trecho: null, ...extras,
})

const TREINO = pedido('a', 'Reward sem unidade', 'Treinamento IA')
const EPISODIO = pedido('b', 'Falta drawdown', 'Detalhe do episódio · Treinamento IA', { tipo: 'falta' })
const MISTO = pedido('c', 'Reward diverge', 'Painel · Treinamento IA')
const CRUZAMENTO = pedido('d', 'Status de treinamento', 'Treinamento IA · Cruzamentos entre telas')
const VITRINE = pedido('e', 'Discrepância entre promessa e acerto', 'Cruzamentos entre telas', { trecho: '94,8% PRECISÃO DA IA' })
const MARKETING = pedido('f', 'Promessa de marketing vs Simulação real', 'Cruzamentos entre telas')
const BOOK = pedido('g', 'Order Book (Depth)', 'Painel · Início', { tipo: 'falta' })
const API_KEYS = pedido('h', 'Configuração de API Keys', 'Configurações', { tipo: 'falta' })
const ERRO_ORDEM = pedido('i', 'Ordem das colunas errada', 'Painel', { tipo: 'errado' })
const COMUM = pedido('j', 'Saldo não bate', 'Painel')
const JA_DECIDIDO = pedido('k', 'Reward antigo', 'Treinamento IA', { status: 'aprovado' })

describe('pregão › grupos de descarte', () => {
  const grupos = gruposDeDescarte([TREINO, EPISODIO, MISTO, CRUZAMENTO, VITRINE, MARKETING, BOOK, API_KEYS, ERRO_ORDEM, COMUM, JA_DECIDIDO])
  const ids = (id) => grupos.find((g) => g.id === id).pedidos.map((p) => p.idPedidoAlteracao)

  it('as telas do treino, sem o pedido que cita outra tela', () => {
    expect(ids('telaEncerrada')).toEqual(['a', 'b', 'd'])
  })

  it('a vitrine, pelo título ou pelo trecho', () => {
    expect(ids('vitrine')).toEqual(['e', 'f'])
  })

  it('o day trade só entre os que faltam: um "errado" sobre a ordem das colunas fica', () => {
    expect(ids('dayTrade')).toEqual(['g', 'h'])
  })

  it('não traz o que não espera decisão nem o que nenhum grupo pega', () => {
    const todos = grupos.flatMap((g) => g.pedidos.map((p) => p.idPedidoAlteracao))
    expect(todos).not.toContain('k')
    expect(todos).not.toContain('j')
    expect(todos).not.toContain('c')
  })

  it('o pedido em dois grupos fica no primeiro', () => {
    const dois = pedido('z', 'Falta Order Book', 'Treinamento IA', { tipo: 'falta' })
    const lista = gruposDeDescarte([dois])
    expect(lista.map((g) => g.id)).toEqual(['telaEncerrada'])
  })

  it('a nova tentativa entra: ela gasta o modelo até alguém descartar', () => {
    const tentando = pedido('n', 'Reward antigo', 'Treinamento IA', { status: 'nova-tentativa' })
    expect(gruposDeDescarte([tentando]).map((g) => g.id)).toEqual(['telaEncerrada'])
  })

  it('o corrigido das telas encerradas entra: o Trader não volta lá para validar', () => {
    const corrigido = pedido('p', 'Epsilon sem explicação', 'Treinamento IA', { status: 'corrigido' })
    expect(gruposDeDescarte([corrigido]).map((g) => g.id)).toEqual(['telaEncerrada'])
    expect(podeDescartar(corrigido)).toBe(true)
  })

  it('o corrigido das outras telas fica: o Trader ainda vai conferir', () => {
    const noPainel = pedido('q', 'Saldo não bate', 'Painel', { status: 'corrigido' })
    const naVitrine = pedido('r', 'Promessa de marketing', 'Início', { status: 'corrigido' })
    const misto = pedido('s', 'Reward diverge', 'Painel · Treinamento IA', { status: 'corrigido' })
    expect(gruposDeDescarte([noPainel, naVitrine, misto])).toEqual([])
    expect(podeDescartar(noPainel)).toBe(false)
  })

  it('sem nada a descartar, nenhum grupo', () => {
    expect(gruposDeDescarte([COMUM])).toEqual([])
    expect(gruposDeDescarte(undefined)).toEqual([])
  })
})

describe('Descarte por grupo', () => {
  const abrirTreino = (onDescartar = vi.fn().mockResolvedValue([])) => {
    render(<DescartePorGrupo pedidos={[TREINO, EPISODIO, COMUM]} onDescartar={onDescartar} />)
    fireEvent.click(screen.getByRole('button', { name: 'pregao.grupos.revisar' }))
    return onDescartar
  }

  it('não aparece sem grupo', () => {
    render(<DescartePorGrupo pedidos={[COMUM]} onDescartar={vi.fn()} />)
    expect(screen.queryByText('pregao.grupos.titulo')).toBeNull()
  })

  it('a lista vem marcada e o motivo vem sugerido', () => {
    abrirTreino()
    expect(screen.getAllByRole('checkbox').map((c) => c.checked)).toEqual([true, true])
    expect(screen.getByRole('textbox').value).toBe('pregao.grupos.telaEncerrada.motivo')
    expect(screen.getByText('Reward sem unidade')).toBeTruthy()
  })

  it('descarta só os marcados, com o motivo', async () => {
    const onDescartar = abrirTreino()
    fireEvent.click(screen.getAllByRole('checkbox')[1])
    fireEvent.click(screen.getByRole('button', { name: 'pregao.grupos.descartarN' }))
    await waitFor(() => expect(onDescartar).toHaveBeenCalledWith(['a'], 'pregao.grupos.telaEncerrada.motivo'))
  })

  it('sem motivo ou sem nenhum marcado, o botão não envia', () => {
    abrirTreino()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '  ' } })
    expect(screen.getByRole('button', { name: 'pregao.grupos.descartarN' }).disabled).toBe(true)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'motivo' } })
    screen.getAllByRole('checkbox').forEach((c) => fireEvent.click(c))
    expect(screen.getByRole('button', { name: 'pregao.grupos.descartarN' }).disabled).toBe(true)
  })

  it('a falha aparece, e a lista continua aberta', async () => {
    abrirTreino(vi.fn().mockResolvedValue([{ id: 'a', erro: new Error('rede') }]))
    fireEvent.click(screen.getByRole('button', { name: 'pregao.grupos.descartarN' }))
    await waitFor(() => expect(screen.getByText('pregao.grupos.falhas')).toBeTruthy())
    expect(screen.getAllByRole('checkbox')).toHaveLength(2)
  })

  it('tudo descartado fecha a lista', async () => {
    abrirTreino()
    fireEvent.click(screen.getByRole('button', { name: 'pregao.grupos.descartarN' }))
    await waitFor(() => expect(screen.queryAllByRole('checkbox')).toHaveLength(0))
  })
})
