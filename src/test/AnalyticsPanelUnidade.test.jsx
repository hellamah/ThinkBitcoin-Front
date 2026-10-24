// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import AnalyticsPanel from '../src/components/dashboard/AnalyticsPanel'
import { derivarAnalytics } from '../src/utils/marketAnalytics'

afterEach(cleanup)

// A API entrega do mais recente ao mais antigo (ordemAsc=false).
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

it('o delta acumulado diz a unidade: o volume é na própria moeda', () => {
  // O PR 55 (23/10/2026, "Unidade do Delta Acumulado é incerta") pôs
  // `analytics.moeda` depois do número, mas o painel recebe a sigla em
  // `analytics.sigla`: a unidade saía vazia, e o teste do modelo, que falhava
  // com a correção, foi tirado do commit. O delta é o volume comprado menos o
  // vendido, na moeda do candle (o volume base da Binance), e não em dólar.
  const historico = Array.from({ length: 30 }, (_, i) =>
    registro(new Date(Date.UTC(2026, 0, 2, 0) - i * 3600e3).toISOString()))
  const analytics = derivarAnalytics({
    historicosPorMoeda: { ETH: historico },
    fearGreedPorMoeda: { ETH: [] },
    moedasFiltro: ['ETH'],
  })

  const { container } = render(<AnalyticsPanel analytics={analytics} t={(chave) => chave} />)

  const valores = [...container.querySelectorAll('.intel-value')].map((e) => e.textContent.trim())
  expect(valores).toContainEqual(expect.stringMatching(/^\+\S+ ETH$/))
})
