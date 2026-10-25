// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { apiRequest, HistoricoDecisaoEndpoint, ZooEstrategiaEndpoint } from '../src/utils/apiClient'
import RoboAoVivo from '../src/pages/RoboAoVivo'

// A tela do robô ao vivo: pede as operações desde a ativação do motor e a
// curva da regra com o buy & hold desde o fechamento anterior, e mostra o
// estado de hoje, a lista de operações com a taxa e o retorno do período.
// Sem provider de tradução, `t` devolve a chave. O gráfico (canvas) não é
// desenhado no jsdom; o que se confere é o que está fora dele.

vi.mock('../src/utils/apiClient', async (importOriginal) => ({
  ...(await importOriginal()),
  apiRequest: vi.fn(),
}))
vi.mock('react-chartjs-2', () => ({ Line: () => null }))

afterEach(cleanup)

const operacao = {
  idHistoricoDecisao: '60d7c573',
  moedaSigla: 'BTC',
  acao: 'VenderTudo',
  quantidade: 0.01222,
  precoMercado: 81189.43,
  taxa: 0.99213483,
  valorOperacao: 992.1348346,
  dataHora: '2026-10-24T00:00:00',
  status: 'Fechado',
}
const curva = (estrategia, valores, exposicao) => ({
  estrategia,
  moeda: 'BTC',
  pontos: valores.map((patrimonio, i) => ({ data: `2026-10-2${2 + i}T00:00:00Z`, patrimonio, exposicao: exposicao[i] })),
})

beforeEach(() => {
  apiRequest.mockReset()
  apiRequest.mockImplementation(async (endpoint) => {
    if (endpoint.startsWith('/ThinkBitcoin/historicoDecisoes')) {
      return { resultado: { totalRegistros: 1, registros: [operacao] } }
    }
    return {
      resultado: [
        curva('buy_hold', [7.0633672522796322, 7.0437030455927019, 7.0175659435518867], [1, 1, 1]),
        curva('media_50d_vol_alvo_40', [16.222079124306237, 16.205857045181929, 16.205857045181929], [1, 0, 0]),
      ],
    }
  })
})

const renderizar = () => render(<MemoryRouter><RoboAoVivo /></MemoryRouter>)

describe('Robô ao vivo', () => {
  it('pede as operações desde a ativação e a curva desde o fechamento anterior', async () => {
    renderizar()
    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(2))
    expect(apiRequest).toHaveBeenCalledWith(
      HistoricoDecisaoEndpoint.LIST({ siglaMoeda: 'BTC', dataInicio: '2026-10-23T11:49:00Z', quantidade: 200 })
    )
    expect(apiRequest).toHaveBeenCalledWith(
      ZooEstrategiaEndpoint.CURVA({ moeda: 'BTC', estrategias: ['media_50d_vol_alvo_40', 'buy_hold'], dataInicio: '2026-10-22' })
    )
  })

  it('mostra fora do mercado, a operação com a taxa e o retorno do período', async () => {
    renderizar()
    expect((await screen.findByTestId('robo-estado')).textContent).toBe('robo.fora')
    expect(screen.getAllByText('robo.acoes.VenderTudo').length).toBeGreaterThan(0)
    // A taxa da operação (0,99 USDT), no separador do idioma do ambiente.
    expect(screen.getByText(/^0[.,]99$/)).toBeTruthy()
    expect(screen.getByTestId('robo-retornos').textContent).toMatch(/-0[.,]1\d%/)
  })

  it('a falha da curva não esconde as operações', async () => {
    apiRequest.mockImplementation(async (endpoint) => {
      if (endpoint.startsWith('/ThinkBitcoin/historicoDecisoes')) {
        return { resultado: { totalRegistros: 1, registros: [operacao] } }
      }
      throw new Error('fora do ar')
    })
    renderizar()
    expect(await screen.findByText('robo.curvaErro')).toBeTruthy()
    expect(screen.getAllByText('robo.acoes.VenderTudo').length).toBeGreaterThan(0)
  })
})
