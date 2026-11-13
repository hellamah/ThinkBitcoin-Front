// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import pt from '../src/lang/pt.json'
import HeatmapInsights from '../src/components/heatmap/HeatmapInsights'

afterEach(cleanup)

const t = (chave) => chave.split('.').reduce((o, k) => o?.[k], pt) ?? chave

describe('HeatmapInsights', () => {
  it('exibe o tooltip de concentração geográfica ao passar o mouse sobre o rótulo', async () => {
    const mockTrend = {
      volatilidade15: 10,
      minutosDesdePico: 30,
      geoHHI: 3100, // Resulta em 0.31 após normalização, disparando o bloco de "Narrativa concentrada"
      isTimeseriesOk: true,
      isGeoOk: true,
    }
    const mockFear = {
      valor: 50,
      timeUntilUpdateSeg: 60,
    }

    render(<HeatmapInsights trend={mockTrend} fear={mockFear} t={t} locale="pt-BR" />)

    // Localiza o elemento do rótulo que agora está envolto por um Tooltip e Typography
    const labelElement = screen.getByText(/Concentração geográfica/i)
    
    // Simula o hover para disparar o Tooltip
    fireEvent.mouseOver(labelElement)

    // Verifica se o texto do tooltip (definido na nova chave heatmap.concentracaoGeo_tooltip) aparece no DOM
    const tooltip = await screen.findByText(/Calculado sobre todas as regiões da coleta/i)
    expect(tooltip).toBeTruthy()
  })
})
