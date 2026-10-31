// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
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
  it('deve exibir os textos atualizados para pressão e média', () => {
    const historico = Array.from({ length: 30 }, (_, i) =>
      registro(new Date(Date.UTC(2026, 0, 2, 0) - i * 3600e3).toISOString()))
    
    const analytics = derivarAnalytics({
      historicosPorMoeda: { ETH: historico },
      fearGreedPorMoeda: { ETH: [] },
      moedasFiltro: ['ETH'],
    })

    const { container } = render(<AnalyticsPanel analytics={analytics} t={t} />)

    // Verifica se o rótulo da pressão contém a nova informação de volume
    const label = container.querySelector('.intel-label').textContent.trim()
    expect(label).toContain('(baseada em volume)')

    // A média segue o período escolhido na tela (recortarJanela): não é um valor fixo como 24h
    const subvalue = container.querySelector('.intel-subvalue').textContent.trim()
    expect(subvalue).toContain('Média do período selecionado')
    expect(subvalue).not.toContain('24h')
  })
})
