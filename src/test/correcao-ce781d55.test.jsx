// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import pt from '../src/lang/pt.json'

afterEach(cleanup)

const t = (chave) => chave.split('.').reduce((o, k) => o?.[k], pt) ?? chave

import AnalyticsPanel from '../src/components/dashboard/AnalyticsPanel'
import { derivarAnalytics } from '../src/utils/marketAnalytics'

describe('AnalyticsPanel', () => {
  it('deve exibir o rótulo "Ticket Médio (do ativo)" e mostrar o tooltip ao passar o mouse', async () => {
    const registro = (hora) => ({
      horaReferencia: hora,
      precoFechamento: 100,
      precoVolume: 100,
      precoVolatilidadePercentual: 2,
      precoAmplitude: 5,
      volumeComprado: 60,
      volumeVendido: 40,
      volumeDelta: 20,
      dominanciaCompradoraPercentual: 60,
      dominanciaVendedoraPercentual: 40,
      precoFinanceiroPorTrade: 500,
    })

    const historico = Array.from({ length: 30 }, (_, i) =>
      registro(new Date(Date.UTC(2026, 0, 2, 0) - i * 3600e3).toISOString()))

    const analytics = derivarAnalytics({
      historicosPorMoeda: { ETH: historico },
      fearGreedPorMoeda: { ETH: [] },
      moedasFiltro: ['ETH'],
    })

    render(<AnalyticsPanel analytics={analytics} t={t} />)

    // O teste falha no código anterior porque o texto esperado 
    // era "Ticket Médio (Mercado)" e agora é "Ticket Médio (do ativo)".
    const label = screen.getByText('Ticket Médio (do ativo)')
    expect(label).toBeTruthy()

    // Verifica se o tooltip aparece ao passar o mouse sobre o rótulo
    fireEvent.mouseOver(label)
    
    // O findByText aguarda a renderização do tooltip (assumindo que o 
    // componente RotuloComAjuda o coloca no DOM após o mouseOver)
    const helpText = await screen.findByText(t('ajuda.ticketMedio'))
    expect(helpText).toBeTruthy()
  })
})
