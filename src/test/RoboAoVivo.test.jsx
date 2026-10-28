// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { apiRequest, HistoricoDecisaoEndpoint, RoboAoVivoEndpoint, SequenciaRetornoEndpoint } from '../src/utils/apiClient'
import { PLACAR_ROBO, SEQUENCIAS_ROBO } from '../src/utils/mockRoboAoVivo'
import RoboAoVivo from '../src/pages/RoboAoVivo'

// A tela do robô ao vivo: pede as operações desde a ativação do motor, o placar
// pronto do .NET (as três curvas, os retornos, a dose, o critério e a última
// conferência) e as decisões de cada vela, e mostra o estado de hoje com a
// última decisão, os retornos, o critério, as noites e as operações.
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
  precoCompra: 81351.37,
  taxa: 0.99213483,
  valorOperacao: 992.1348346,
  saldoAnterior: 1000,
  saldoPosterior: 997.02895837,
  dataHora: '2026-10-24T00:00:00',
  status: 'Fechado',
}
// As velas das 23h reais de 23 a 27/10, os mesmos dias do placar.
const velas = { totalRegistros: SEQUENCIAS_ROBO.length, registros: SEQUENCIAS_ROBO }

const responder = ({ ops, placar, sequencias } = {}) => async (endpoint) => {
  if (endpoint.startsWith('/ThinkBitcoin/historicoDecisoes')) return ops ? ops() : { resultado: { totalRegistros: 1, registros: [operacao] } }
  if (endpoint.startsWith('/ThinkBitcoin/sequenciasRetorno')) return sequencias ? sequencias() : { resultado: velas }
  return placar ? placar() : { resultado: PLACAR_ROBO }
}
const falha = () => { throw new Error('fora do ar') }

beforeEach(() => {
  apiRequest.mockReset()
  apiRequest.mockImplementation(responder())
})

const renderizar = () => render(<MemoryRouter><RoboAoVivo /></MemoryRouter>)

describe('Robô ao vivo', () => {
  it('pede as operações desde a ativação, o placar e as velas', async () => {
    renderizar()
    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(3))
    expect(apiRequest).toHaveBeenCalledWith(
      HistoricoDecisaoEndpoint.LIST({ siglaMoeda: 'BTC', dataInicio: '2026-10-23T11:49:00Z', quantidade: 200 })
    )
    expect(apiRequest).toHaveBeenCalledWith(RoboAoVivoEndpoint.PLACAR)
    expect(apiRequest).toHaveBeenCalledWith(
      SequenciaRetornoEndpoint.LIST({ siglaMoeda: 'BTC', dataInicio: '2026-10-23T11:49:00Z', quantidade: 400 })
    )
  })

  it('mostra fora do mercado, a operação com a taxa e os retornos do robô, da regra e do buy & hold', async () => {
    renderizar()
    expect((await screen.findByTestId('robo-estado')).textContent).toBe('robo.fora')
    expect(screen.getAllByText('robo.acoes.VenderTudo').length).toBeGreaterThan(0)
    // A taxa da operação (0,99 USDT), no separador do idioma do ambiente.
    expect(screen.getByText(/^0[.,]99$/)).toBeTruthy()
    // O robô (−0,38%: segurou a posição do DQN em 23/10), a regra (−0,10%) e o buy & hold (−0,62%).
    const retornos = (await screen.findByTestId('robo-retornos')).textContent
    expect(retornos).toMatch(/robo\.nomeRobo: -0[.,]38%/)
    expect(retornos).toMatch(/-0[.,]10%/)
  })

  it('mostra a última decisão, as noites, o critério do servidor e que ainda não houve conferência', async () => {
    renderizar()
    // A vela das 23h de 27/10, no formato de data do idioma do ambiente.
    expect((await screen.findByTestId('robo-ultima-decisao')).textContent).toMatch(/^robo\.noites\.manter · robo\.fora · .*27.*UTC$/)
    const noites = await screen.findByTestId('robo-noites')
    expect(noites.querySelectorAll('tbody tr')).toHaveLength(5)
    expect(noites.textContent).toContain('robo.noites.vender · robo.fora')
    expect(screen.getByTestId('robo-criterio-fidelidade').textContent).toBe('robo.criterio.dentro')
    expect(screen.getByTestId('robo-criterio-queda').textContent).toBe('robo.criterio.dentro')
    // O buy & hold não caiu 20%: a comparação das quedas não se aplica.
    expect(screen.getByTestId('robo-criterio-relativa').textContent).toBe('–')
    expect(screen.getByTestId('robo-conferencia').textContent).toBe('robo.criterio.semConferencia')
  })

  it('mostra a última conferência diária do servidor', async () => {
    apiRequest.mockImplementation(responder({
      placar: () => ({
        resultado: {
          ...PLACAR_ROBO,
          ultimaConferencia: { data: '2026-10-27T00:00:00', dataHora: '2026-10-28T01:30:00', situacao: 'dentro', avisado: false },
        },
      }),
    }))
    renderizar()
    expect((await screen.findByTestId('robo-conferencia')).textContent).toBe('robo.criterio.conferencia')
  })

  // Em 26/10/2026 a rota das operações falhava (500 da API), e o estado de hoje
  // dizia "nenhuma operação desde a ativação", com o fechamento de 24/10 no banco.
  it('a falha das operações não diz que não houve operação, nem o que cada noite executou', async () => {
    apiRequest.mockImplementation(responder({ ops: falha }))
    renderizar()
    expect(await screen.findByText('robo.operacoesErro')).toBeTruthy()
    expect(screen.queryByText('robo.semOperacao')).toBeNull()
    const noites = await screen.findByTestId('robo-noites')
    expect(noites.textContent).not.toContain('robo.noites.naoExecutada')
  })

  it('a falha do placar não esconde as operações nem as noites', async () => {
    apiRequest.mockImplementation(responder({ placar: falha }))
    renderizar()
    expect(await screen.findByText('robo.curvaErro')).toBeTruthy()
    expect(screen.getAllByText('robo.acoes.VenderTudo').length).toBeGreaterThan(0)
    expect(await screen.findByTestId('robo-noites')).toBeTruthy()
  })

  it('a falha das velas não esconde o resto', async () => {
    apiRequest.mockImplementation(responder({ sequencias: falha }))
    renderizar()
    expect(await screen.findByText('robo.noites.erro')).toBeTruthy()
    expect(screen.getAllByText('robo.acoes.VenderTudo').length).toBeGreaterThan(0)
    expect((await screen.findByTestId('robo-criterio-fidelidade')).textContent).toBe('robo.criterio.dentro')
  })
})
