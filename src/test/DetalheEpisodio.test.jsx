// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import pt from '../src/lang/pt.json'
import DetalheEpisodio from '../src/components/treinamento/DetalheEpisodio'

afterEach(cleanup)

const t = (chave) => chave.split('.').reduce((o, k) => o?.[k], pt) ?? chave

vi.mock('../src/hooks/useTranslation', () => ({
  default: (() => { let valor; return () => (valor ??= { t: (key) => t(key), idioma: 'pt' }) })()
}))

describe('DetalheEpisodio', () => {
  it('deve navegar para o episódio anterior na timeline global', () => {
    const mockOnNavigate = vi.fn()
    const allItems = [
      { idTreinamentoEpisodio: '1', moeda: 'BTC', dataHora: '2023-01-01', duracaoSegundos: 60 },
      { idTreinamentoEpisodio: '2', moeda: 'ETH', dataHora: '2023-01-02', duracaoSegundos: 60 },
      { idTreinamentoEpisodio: '3', moeda: 'SOL', dataHora: '2023-01-03', duracaoSegundos: 60 },
    ]
    const item = allItems[1] // ETH

    render(<DetalheEpisodio item={item} allItems={allItems} onNavigate={mockOnNavigate} carregando={false} />)

    const btnAnterior = screen.getByText(t('treinamento.previous'))
    fireEvent.click(btnAnterior)

    expect(mockOnNavigate).toHaveBeenCalledWith('1')
  })

  it('deve navegar para o próximo episódio na timeline global', () => {
    const mockOnNavigate = vi.fn()
    const allItems = [
      { idTreinamentoEpisodio: '1', moeda: 'BTC', dataHora: '2023-01-01', duracaoSegundos: 60 },
      { idTreinamentoEpisodio: '2', moeda: 'ETH', dataHora: '2023-01-02', duracaoSegundos: 60 },
      { idTreinamentoEpisodio: '3', moeda: 'SOL', dataHora: '2023-01-03', duracaoSegundos: 60 },
    ]
    const item = allItems[1] // ETH

    render(<DetalheEpisodio item={item} allItems={allItems} onNavigate={mockOnNavigate} carregando={false} />)

    const btnProximo = screen.getByText(t('treinamento.next'))
    fireEvent.click(btnProximo)

    expect(mockOnNavigate).toHaveBeenCalledWith('3')
  })
})
