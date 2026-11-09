// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

import VereditoSimulacao from '../src/components/dashboard/simulacao/VereditoSimulacao'

// O custo total da simulação também em percentual do capital inicial (pedido
// d6e53fe9 da Equipe Pregão). O capital vem dos parâmetros da simulação: as
// métricas não o trazem, e a conta com metricas.capitalInicial dava NaN, que a
// tela mostrava como "(-)". Sem provider de tradução, `t` devolve a chave.

afterEach(cleanup)

const t = (chave) => chave
const METRICAS = { retornoTotal: 3.1, buyAndHold: 2, custoTotal: 52.3, amostraInsuficiente: false }
const VEREDITO = { tom: 'bom', titulo: { chave: 'simulationVerdictGood' }, frases: [] }

const custo = () => screen.getByText((_, el) => el?.tagName === 'STRONG' && el.textContent.startsWith('$'))

const renderizar = (props) =>
  render(<VereditoSimulacao metricas={METRICAS} veredito={VEREDITO} ressalvas={[]} t={t} {...props} />)

describe('VereditoSimulacao › custo total', () => {
  it('mostra o custo também em percentual do capital inicial, sem sinal', () => {
    renderizar({ capitalInicial: 10000 })
    expect(custo().textContent).toMatch(/\(0\.52%\)$/)
  })

  it('sem o capital inicial, só o valor: nem "(-)" nem NaN', () => {
    renderizar({})
    expect(custo().textContent).not.toMatch(/\(|NaN/)
  })
})

describe('VereditoSimulacao › dica do Alfa', () => {
  // Pedido ef656090: se o Alfa já desconta os custos. A chave fica dentro do bloco "ajuda": o t() divide a chave
  // nos pontos, e a "ajuda.simAlpha" solta no topo do arquivo nunca era achada.
  it('a dica abre ao passar o mouse e diz que o custo já saiu', async () => {
    const pt = (await import('../src/lang/pt.json')).default
    const tPt = (chave) => chave.split('.').reduce((o, k) => o?.[k], pt) ?? chave
    render(<VereditoSimulacao metricas={METRICAS} veredito={VEREDITO} ressalvas={[]} t={tPt} capitalInicial={10000} />)
    expect(pt['ajuda.simAlpha']).toBeUndefined()
    const { fireEvent } = await import('@testing-library/react')
    fireEvent.mouseOver(screen.getByText(pt.simulationAlpha))
    expect(await screen.findByText(pt.ajuda.simAlpha)).toBeTruthy()
  })
})
