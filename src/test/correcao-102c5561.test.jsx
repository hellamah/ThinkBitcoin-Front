// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import pt from '../src/lang/pt.json'
import AnalyticsPanel from '../src/components/dashboard/AnalyticsPanel'
import { derivarAnalytics } from '../src/utils/marketAnalytics'

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
  it('deve exibir a mediana do ativo no subvalor da volatilidade', () => {
    const historico = Array.from({ length: 30 }, (_, i) =>
      registro(new Date(Date.UTC(2026, 0, 2, 0) - i * 3600e3).toISOString()))

    const analytics = derivarAnalytics({
      historicosPorMoeda: { ETH: historico },
      fearGreedPorMoeda: { ETH: [] },
      moedasFiltro: ['ETH'],
    })

    render(<AnalyticsPanel analytics={analytics} t={t} />)

    // A busca por "mediana do ativo" confirma que a chave 'vsMedian' 
    // foi atualizada de "a mediana" para "a mediana do ativo".
    const subvalue = screen.getByText(/mediana do ativo/i)
    expect(subvalue).toBeTruthy()
  })
})
