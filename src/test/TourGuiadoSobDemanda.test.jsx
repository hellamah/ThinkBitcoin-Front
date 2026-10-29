// @vitest-environment jsdom
import { Component } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import TourGuiadoSobDemanda from '../src/components/TourGuiadoSobDemanda'

// O tour é baixado sob demanda, e chunk sob demanda pode não chegar: rede
// oscilando, ou um deploy que trocou os hashes com a aba aberta. Um `lazy` que
// rejeita lança no render — sem o tratamento, o erro subiria ao ErrorBoundary
// da rota e derrubaria o Dashboard por causa de um balão de boas-vindas.
//
// O mock que lança é exatamente essa falha: o import dinâmico rejeita.
vi.mock('../src/components/TourGuiado', () => {
  throw new Error('Failed to fetch dynamically imported module')
})

// Faz o papel do ErrorBoundary da rota: se ele disparar, a página caiu.
class LimiteDaRota extends Component {
  state = { erro: null }

  static getDerivedStateFromError(erro) {
    return { erro }
  }

  render() {
    return this.state.erro ? <p>a página caiu</p> : this.props.children
  }
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

it('se o chunk do tour não chega, o tour só não aparece — a página continua de pé', async () => {
  const erroNoConsole = vi.spyOn(console, 'error').mockImplementation(() => {})

  render(
    <LimiteDaRota>
      <p>conteúdo da página</p>
      <TourGuiadoSobDemanda passos={[]} onEncerrar={() => {}} />
    </LimiteDaRota>
  )

  // A espera fica DENTRO do act, com tempo real, para o import rejeitar e o
  // React refazer o render do `lazy` antes das asserções. A primeira versão
  // esperava o log com vi.waitFor e passava também com o `.catch` quebrado —
  // não distinguia a página de pé da página caída. Conferido quebrando o catch
  // de propósito: nesta forma, o teste falha.
  await act(() => new Promise((resolve) => setTimeout(resolve, 50)))

  expect(erroNoConsole).toHaveBeenCalledWith('Erro ao carregar o tour guiado:', expect.anything())
  expect(screen.getByText('conteúdo da página')).toBeTruthy()
  expect(screen.queryByText('a página caiu')).toBeNull()
})
