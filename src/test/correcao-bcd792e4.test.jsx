// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import pt from '../src/lang/pt.json'

afterEach(cleanup)

const t = (chave) => chave.split('.').reduce((o, k) => o?.[k], pt) ?? chave

import HeatmapInsights from '../src/components/heatmap/HeatmapInsights'

describe('HeatmapInsights', () => {
  it('exibe os novos rótulos de momentum com escala e unidade', () => {
    const mockTrend = {
      delta5: 10,
      delta15: 20,
      valorAtual: 50,
      mediaPeriodo: 10,
      isTimeseriesOk: true,
      isGeoOk: true,
    }
    const mockFear = {
      valor: 50,
      timeUntilUpdateSeg: 60,
    }

    render(<HeatmapInsights trend={mockTrend} fear={mockFear} t={t} locale="pt-BR" />)

    expect(screen.getByText(/Variação 5min \(pontos, de -100 a \+100\)/i)).toBeTruthy()
    expect(screen.getByText(/Variação 15min \(pontos, de -100 a \+100\)/i)).toBeTruthy()
  })
})
