// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import pt from '../src/lang/pt.json'
import AnalyticsPanel from '../src/components/dashboard/AnalyticsPanel'

afterEach(cleanup)

const t = (chave) => chave.split('.').reduce((o, k) => o?.[k], pt) ?? chave

describe('AnalyticsPanel - Tooltip de Ticket Médio', () => {
  it('deve exibir a nova explicação no tooltip do ticket médio ao passar o mouse', async () => {
    const mockAnalytics = {
      ticket: {
        atual: 523.62,
        razao: 0.5,
        trades: 100,
      },
      fluxo: {
        divergencia: null,
        dominanciaCompradora: 0,
        dominanciaVendedora: 0,
        deltaAcumulado: 0,
        dominanciaCompradoraPeriodo: null,
      },
      volatilidade: {
        atual: 1.5,
        razao: 0.5,
      },
      atr: null,
      osciladores: {
        rsiAtual: 50,
      },
      vwap: {
        vwapAtual: 500,
        acima: true,
        desvioAtual: 10,
      },
      fearGreed: {
        valor: 50,
        serie: [],
        classificacao: 'neutral',
      },
      sigla: 'BTC',
    }

    render(<AnalyticsPanel analytics={mockAnalytics} t={t} />)

    // Usamos um seletor parcial para evitar o erro de "text broken up by multiple elements" 
    // causado pelo ícone de ajuda ao lado do texto do rótulo.
    const label = screen.getByText(/Ticket Médio/i)
    
    fireEvent.mouseOver(label)

    // O tooltip deve aparecer com as novas informações de período e comparação.
    // Este teste falha no código anterior pois a string "candle mais recente" não existia.
    const tooltip = await screen.findByText(/candle mais recente/i)
    expect(tooltip).toBeTruthy()
  })
})
