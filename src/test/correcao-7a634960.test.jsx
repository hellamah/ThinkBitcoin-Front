// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import AnalyticsPanel from '../src/components/dashboard/AnalyticsPanel'
import { derivarAnalytics } from '../src/utils/marketAnalytics'
import pt from '../src/lang/pt.json'

afterEach(cleanup)

const t = (chave) => chave.split('.').reduce((o, k) => o?.[k], pt) ?? chave

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
})

describe('AnalyticsPanel', () => {
  it('deve exibir o texto de compra líquida com o escopo e período', () => {
    const historico = Array.from({ length: 30 }, (_, i) =>
      registro(new Date(Date.UTC(2026, 0, 2, 0) - i * 3600e3).toISOString()))
    
    const analytics = derivarAnalytics({
      historicosPorMoeda: { ETH: historico },
      fearGreedPorMoeda: { ETH: [] },
      moedasFiltro: ['ETH'],
    })
    
    render(<AnalyticsPanel analytics={analytics} t={t} />)
    
    // Busca pelo texto exato da tradução para evitar capturar outros elementos .intel-subvalue
    const label = screen.getByText(/Compra líquida no período selecionado \(Ativo\)/i)
    expect(label).toBeTruthy()
  })
})
