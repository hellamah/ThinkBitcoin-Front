// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import pt from '../src/lang/pt.json'
import HeatmapInsights from '../src/components/heatmap/HeatmapInsights'

afterEach(cleanup)

const t = (chave) => chave.split('.').reduce((o, k) => o?.[k], pt) ?? chave

describe('HeatmapInsights', () => {
  it('exibe os novos rótulos de volatilidade e pico de buscas com as descrições corrigidas', () => {
    const mockTrend = {
      volatilidade15: 10,
      minutosDesdePico: 30,
      geoHHI: 2000,
      isTimeseriesOk: true,
      isGeoOk: true,
    }
    const mockFear = {
      valor: 50,
      timeUntilUpdateSeg: 60,
    }

    render(<HeatmapInsights trend={mockTrend} fear={mockFear} t={t} locale="pt-BR" />)

    // Verifica se o novo texto de volatilidade (focado em busca) está presente
    expect(screen.getByText(/Volatilidade de busca 15min/i)).toBeTruthy()
    
    // Verifica se o novo texto de pico (focado em tempo decorrido) está presente
    expect(screen.getByText(/Tempo desde o último pico/i)).toBeTruthy()
  })
})
