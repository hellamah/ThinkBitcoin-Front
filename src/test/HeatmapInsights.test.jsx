// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import pt from '../src/lang/pt.json'
import HeatmapInsights from '../src/components/heatmap/HeatmapInsights'

afterEach(cleanup)

const t = (chave) => chave.split('.').reduce((o, k) => o?.[k], pt) ?? chave

describe('HeatmapInsights', () => {
  it('exibe o valor do HHI ao lado do rótulo quando concentrado', () => {
    const mockTrend = {
      valorAtual: 50,
      mediaPeriodo: 45,
      delta5: 2,
      delta15: 5,
      volatilidade15: 10,
      minutosDesdePico: 30,
      rankNoMinuto: 1,
      geoHHI: 3100, // 3100 / 10000 = 0.31 (>= 0.25)
      isTimeseriesOk: true,
      isGeoOk: true,
    }
    const mockFear = {
      valor: 50,
      timeUntilUpdateSeg: 60,
    }

    render(<HeatmapInsights trend={mockTrend} fear={mockFear} t={t} locale="pt-BR" />)

    // Verifica se o texto da chave está presente e o valor formatado
    expect(screen.getByText(/Narrativa concentrada/i)).toBeTruthy()
    expect(screen.getByText(/31.0%/i)).toBeTruthy()
  })

  // O rank vem pronto da API e é a soma das posições dos 3 termos de busca da própria moeda (só 3, 5 ou
  // 6 nas 87.811 linhas de 31/10/2026): não compara moedas, e o rótulo não pode dizer que é global.
  it('exibe o rank de buscas sem afirmar o alcance dele', () => {
    const mockTrend = {
      rankNoMinuto: 6,
      geoHHI: 2000,
      isTimeseriesOk: true,
      isGeoOk: true,
    }
    const mockFear = {
      valor: 50,
      timeUntilUpdateSeg: 60,
    }

    render(<HeatmapInsights trend={mockTrend} fear={mockFear} t={t} locale="pt-BR" />)

    expect(screen.getByText(/^Rank de buscas$/i)).toBeTruthy()
    expect(screen.getByText(/#6/i)).toBeTruthy()
  })

  it('exibe a narrativa distribuída quando o HHI é inferior a 25%', () => {
    const mockTrend = {
      valorAtual: 50,
      mediaPeriodo: 45,
      delta5: 2,
      delta15: 5,
      volatilidade15: 10,
      minutosDesdePico: 30,
      rankNoMinuto: 1,
      geoHHI: 2000, // 2000 / 10000 = 0.20 (< 0.25)
      isTimeseriesOk: true,
      isGeoOk: true,
    }
    const mockFear = {
      valor: 50,
      timeUntilUpdateSeg: 60,
    }

    render(<HeatmapInsights trend={mockTrend} fear={mockFear} t={t} locale="pt-BR" />)

    // Verifica se o texto da chave 'distribuida' está presente
    expect(screen.getByText(/Narrativa globalizada/i)).toBeTruthy()
  })
})
