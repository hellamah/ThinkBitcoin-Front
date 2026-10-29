// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import en from '../src/lang/en.json'
import { TranslationProvider } from '../src/context/TranslationContext'
import CartaoPedidoPublico from '../src/components/pregao/CartaoPedidoPublico'

// O cartão da página aberta: o resumo do pedido, o status em linguagem simples
// e a linha do tempo, só leitura. Com o provider de tradução de verdade (sem
// sessão, o idioma é o padrão, inglês): o cartão cai no valor cru quando o
// dicionário não conhece a chave, e só o dicionário real exercita isso.

afterEach(cleanup)

// Como a API pública entrega (depois do apiClient, com o Z carimbado).
const PEDIDO = {
  idPedidoAlteracao: '5b0e7c1a-3f2d-4e8a-9b6c-0d1e2f3a4b06',
  tipo: 'confuso',
  telas: 'Painel',
  problema: 'Índice de interesse de busca aparece com rótulos de preço',
  trecho: 'Médias Móveis - Tendência de Baixa',
  dias: 3,
  rodadas: 4,
  visitas: 9,
  primeiraVez: '2026-10-03T12:00:00Z',
  ultimaVez: '2026-10-05T21:00:00Z',
  status: 'corrigido',
  dataStatus: '2026-10-06T12:00:00Z',
  eventos: [
    // Fora de ordem de propósito: a tela conta a história do começo.
    { acao: 'aprovado', dataHora: '2026-10-05T22:00:00Z', statusNovo: 'aprovado', detalhe: null },
    { acao: 'aberto', dataHora: '2026-10-05T21:30:00Z', statusNovo: 'aberto', detalhe: 'Visto em 2 dias diferentes (3 de 7 rodadas que passaram pela tela).' },
    { acao: 'em-correcao', dataHora: '2026-10-06T00:00:00Z', statusNovo: 'em-correcao', detalhe: null },
    { acao: 'corrigido', dataHora: '2026-10-06T12:00:00Z', statusNovo: 'corrigido', detalhe: null },
  ],
}

const renderizar = (pedido = PEDIDO) => render(
  <TranslationProvider>
    <CartaoPedidoPublico pedido={pedido} />
  </TranslationProvider>
)

const passos = () => within(screen.getByRole('list')).getAllByRole('listitem')
const { acoes, statusExplicado } = en.pregaoPublico

describe('Cartão público do pedido do Pregão', () => {
  it('mostra o resumo e o status em linguagem simples, sem botões', () => {
    renderizar()
    expect(screen.getByRole('article', { name: PEDIDO.problema })).toBeTruthy()
    expect(screen.getByText(PEDIDO.trecho)).toBeTruthy()
    expect(screen.getByText(en.pregao.status.corrigido)).toBeTruthy()
    expect(screen.getByText(statusExplicado.corrigido)).toBeTruthy()
    expect(screen.getByText('3 days, 4 of 9 rounds that went through the screen', { exact: false })).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('conta a linha do tempo em ordem, com quem deu cada passo', () => {
    renderizar()
    expect(screen.getByRole('heading', { name: en.pregaoPublico.linhaDoTempo })).toBeTruthy()
    expect(passos().map((li) => li.querySelector('p').textContent)).toEqual([
      acoes.aberto,
      acoes.aprovado,
      acoes['em-correcao'],
      acoes.corrigido,
    ])
    // O detalhe do passo do Pregão aparece; o carimbo vai num <time> legível por máquina.
    expect(passos()[0].textContent).toContain('Visto em 2 dias diferentes')
    expect(passos()[0].querySelector('time').getAttribute('dateTime')).toBe('2026-10-05T21:30:00Z')
    expect(passos()[1].textContent).not.toContain('·')
  })

  it('ação ou status que o dicionário não conhece aparece cru, sem explicação inventada', () => {
    renderizar({
      ...PEDIDO,
      status: 'novo-status',
      eventos: [{ acao: 'nova-acao', dataHora: '2026-10-05T21:30:00Z', statusNovo: 'novo-status', detalhe: null }],
    })
    expect(passos()[0].querySelector('p').textContent).toBe('nova-acao')
    expect(screen.getByText('novo-status')).toBeTruthy()
    for (const frase of Object.values(statusExplicado)) expect(screen.queryByText(frase)).toBeNull()
  })

  it('sem passos, sem linha do tempo', () => {
    renderizar({ ...PEDIDO, eventos: undefined })
    expect(screen.queryByRole('list')).toBeNull()
  })
})
