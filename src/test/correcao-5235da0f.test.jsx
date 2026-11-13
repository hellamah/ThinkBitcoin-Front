// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import pt from '../src/lang/pt.json'

afterEach(cleanup)

// As chaves com ponto ('alertas.listaVazia') são aninhadas no JSON.
const t = (chave) => chave.split('.').reduce((o, k) => o?.[k], pt) ?? chave

describe('Localization Updates', () => {
  it('should display the correct disclaimer for ajuda.taxaAlta', () => {
    render(<div data-testid="test-taxaAlta">{t('ajuda.taxaAlta')}</div>)
    expect(screen.getByText(/Não é a taxa do Laboratório de Sinais/i)).toBeTruthy()
  })

  it('should display the correct label for signalBaseline', () => {
    render(<div data-testid="test-signalBaseline">{t('signalBaseline')}</div>)
    expect(screen.getByText(/Base: todos os candles, alta no horizonte/i)).toBeTruthy()
  })
})
