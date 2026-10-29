// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import pt from '../src/lang/pt.json'
import TreinamentoEpisodios from '../src/pages/TreinamentoEpisodios'

// O agente de IA foi encerrado em 22/10/2026, e desde 23/10 quem decide ao vivo
// é o motor de risco. A tela de treino continua, como histórico, e diz isso no
// topo; os rótulos dela deixam de chamar de "ao vivo" o que não decide mais.
// Sem provider de tradução, `t` devolve a chave. A API responde vazio: o que se
// confere é a faixa, que não depende dos dados.

vi.mock('../src/utils/apiClient', async (importOriginal) => ({
  ...(await importOriginal()),
  apiRequest: vi.fn(async () => ({ resultado: null })),
}))
vi.mock('react-chartjs-2', () => ({ Line: () => null, Scatter: () => null }))

afterEach(cleanup)

describe('Tela de treino depois do encerramento do agente', () => {
  it('avisa no topo que o agente foi encerrado e que a tela é histórico', async () => {
    render(
      <MemoryRouter initialEntries={['/treinamento-episodios']}>
        <Routes><Route path="/treinamento-episodios" element={<TreinamentoEpisodios />} /></Routes>
      </MemoryRouter>
    )
    expect((await screen.findByTestId('treino-encerrado')).textContent).toBe('treinamento.encerrado')
  })

  it('o texto diz a data, quem decide hoje e que a tela é histórico', () => {
    expect(pt.treinamento.encerrado).toMatch(/22\/10\/2026/)
    expect(pt.treinamento.encerrado).toMatch(/motor de risco/)
    expect(pt.treinamento.encerrado).toMatch(/histórico/)
  })

  it('subtítulo, aba, selo e cartão não chamam mais o modelo de "ao vivo"', () => {
    const { subtitle, tabLive, versionLive, versionLiveHint, cardLiveModel } = pt.treinamento
    for (const texto of [subtitle, tabLive, versionLive, cardLiveModel]) {
      expect(texto.toLowerCase()).not.toContain('ao vivo')
    }
    expect(versionLiveHint).toMatch(/não decide/)
  })
})
