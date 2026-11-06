// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import pt from '../src/lang/pt.json'
import { MemoryRouter } from 'react-router-dom'
import SignalLabPanel from '../src/components/dashboard/SignalLabPanel'

afterEach(cleanup)

const t = (chave) => chave.split('.').reduce((o, k) => o?.[k], pt) ?? chave

describe('SignalLabPanel', () => {
  const mockAnalise = {
    base: { taxaAlta: 50, ocorrencias: 100, retornoMedio: 10 },
    sinais: [
      {
        chave: 'martelo',
        ocorrencias: 10,
        taxaAlta: 55,
        intervalo: { inferior: 48, superior: 52 },
        deltaTaxa: 5,
        deltaRetorno: 5,
        significante: false,
        ajuste: null,
        validacao: null,
      },
    ],
    corte: null,
  }

  it('deve exibir a mensagem de ajuda correta com a métrica de intervalo de confiança', () => {
    render(
      <MemoryRouter>
        <SignalLabPanel 
          analise={mockAnalise} 
          horizonte={1} 
          setHorizonte={() => {}} 
          t={t} 
        />
      </MemoryRouter>
    )
    
    const hint = screen.getByText(/O que aconteceu DEPOIS de cada sinal, comparado com a taxa base. Linhas esmaecidas indicam sinais onde a taxa base está dentro do intervalo de confiança de 95%./)
    expect(hint).toBeTruthy()
  })
})
