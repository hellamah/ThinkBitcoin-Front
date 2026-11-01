// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import IntelligencePanel from '../src/components/dashboard/IntelligencePanel'
import pt from '../src/lang/pt.json'

afterEach(cleanup)

const t = (chave) => chave.split('.').reduce((o, k) => o?.[k], pt) ?? chave

describe('IntelligencePanel', () => {
  // O rankNoMinuto continua vindo da API, mas não compara moedas: a tela só mostra o hotspot.
  it('mostra o hotspot sem o rank de interesse', () => {
    render(<IntelligencePanel trendAtual={{ geoTop1Code: 'BR', rankNoMinuto: 6, delta5: 1, delta15: 2 }} t={t} />)

    expect(screen.getByText('BR')).toBeTruthy()
    expect(screen.queryByText(/#6/)).toBeNull()
    expect(screen.queryByText(/Ranking de Interesse/i)).toBeNull()
  })
})
