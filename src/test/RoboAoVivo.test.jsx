// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { apiRequest, HistoricoDecisaoEndpoint, RoboAoVivoEndpoint, SequenciaRetornoEndpoint } from '../src/utils/apiClient'
import { PLACAR_ROBO, RADAR_ROBO, REGRA_ROBO, SEQUENCIAS_ROBO } from '../src/utils/mockRoboAoVivo'
import RoboAoVivo from '../src/pages/RoboAoVivo'

// A tela do robô ao vivo: pede as operações desde a ativação do motor, o placar
// pronto do .NET (as três curvas, os retornos, a dose, o critério e a última
// conferência), as decisões de cada vela e a regra nos fechamentos, e mostra o
// estado de hoje com a última decisão, o que falta para a regra mudar de lado,
// o que o histórico dela diz, os retornos, o critério, as noites e as operações.
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

const responder = ({ ops, placar, sequencias, regra, radar } = {}) => async (endpoint) => {
  if (endpoint.startsWith('/ThinkBitcoin/historicoDecisoes')) return ops ? ops() : { resultado: { totalRegistros: 1, registros: [operacao] } }
  if (endpoint.startsWith('/ThinkBitcoin/sequenciasRetorno')) return sequencias ? sequencias() : { resultado: velas }
  if (endpoint === RoboAoVivoEndpoint.REGRA) return regra ? regra() : { resultado: REGRA_ROBO }
  if (endpoint === RoboAoVivoEndpoint.RADAR) return radar ? radar() : { resultado: RADAR_ROBO }
  return placar ? placar() : { resultado: PLACAR_ROBO }
}
const falha = () => { throw new Error('fora do ar') }

beforeEach(() => {
  apiRequest.mockReset()
  apiRequest.mockImplementation(responder())
})

const renderizar = () => render(<MemoryRouter><RoboAoVivo /></MemoryRouter>)

describe('Robô ao vivo', () => {
  it('pede as operações desde a ativação, o placar, as velas, a regra e o radar', async () => {
    renderizar()
    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(5))
    expect(apiRequest).toHaveBeenCalledWith(RoboAoVivoEndpoint.REGRA)
    expect(apiRequest).toHaveBeenCalledWith(RoboAoVivoEndpoint.RADAR)
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
    expect(retornos).toMatch(/robo\.nomeRobo-0[.,]38%/)
    expect(retornos).toMatch(/-0[.,]10%/)
    expect(retornos).toMatch(/-0[.,]62%/)
  })

  it('mostra a última decisão, as noites, o critério do servidor e que ainda não houve conferência', async () => {
    renderizar()
    const noites = await screen.findByTestId('robo-noites')
    expect(noites.querySelectorAll('tbody tr')).toHaveLength(5)
    // A última decisão é a primeira noite: a vela das 23h de 27/10, manter.
    const primeira = noites.querySelector('tbody tr').textContent
    expect(primeira).toMatch(/27/)
    expect(primeira).toContain('robo.noites.manter · robo.fora')
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

  it('mostra o patrimônio em USDT e a última hora que o robô gravou', async () => {
    renderizar()
    await waitFor(() => expect(screen.getByTestId('robo-patrimonio').textContent).toMatch(/^997[.,]03$/))
    // A vela das 23h de 27/10, a mais recente do modo demo.
    await waitFor(() => expect(screen.getByTestId('robo-ultima-hora').textContent).toMatch(/27.*UTC$/))
  })

  // O robô fora: a tela diz o que falta para ele comprar, e não só que ele está parado.
  it('fora do mercado, diz o que falta para comprar, a próxima decisão e a dose', async () => {
    renderizar()
    expect((await screen.findByTestId('robo-gatilho')).textContent).toBe('robo.gatilho.paraComprar')
    expect(screen.getByText('robo.gatilho.titleFora')).toBeTruthy()
    expect(screen.getByTestId('robo-proxima-decisao').textContent).toBe('robo.gatilho.proximaDecisaoValor')
    expect(screen.getByTestId('robo-dose-gatilho').textContent).toMatch(/^100%$/)
    expect(screen.getByText('robo.gatilho.doseAoEntrar')).toBeTruthy()
  })

  it('o painel de cima mostra a distância em destaque, a régua até o gatilho e há quanto tempo a regra está fora', async () => {
    renderizar()
    // Dados reais até 27/10: fechar acima de 81.955,68, com o preço a 80.909,77.
    expect((await screen.findByTestId('robo-falta')).textContent).toMatch(/^1[.,]29%$/)
    expect(screen.getByText('robo.gatilho.distancia.paraComprar')).toBeTruthy()
    expect(screen.getByTestId('robo-regua').textContent).toMatch(/80[.,]909[.,]77.*81[.,]955[.,]68/)
    expect(screen.getByTestId('robo-dias-estado').textContent).toBe('robo.diasFora')
  })

  it('a legenda repete a forma de cada marca, e o gráfico tem a tabela de mudanças ao lado', async () => {
    renderizar()
    const legenda = await screen.findByTestId('robo-legenda')
    expect(legenda.textContent).toContain('robo.gatilho.preco')
    expect(legenda.textContent).toContain('robo.gatilho.rotuloGatilho')
    expect(legenda.textContent).toContain('robo.gatilho.regraVendeu')
    // A venda de 23/10 existe; compra do robô ainda não houve, e a chave dela não aparece.
    await waitFor(() => expect(legenda.textContent).toContain('robo.gatilho.roboVendeu'))
    expect(legenda.textContent).not.toContain('robo.gatilho.roboComprou')
    const tabelas = screen.getAllByTestId('robo-tabela-do-grafico')
    expect(tabelas[0].textContent).toContain('robo.gatilho.verMudancas')
    expect(tabelas[1].textContent).toContain('robo.verEmTabela')
  })

  // Até 04/11/2026 havia o painel "Registro" e a tabela "Operações" no fim da
  // tela, que repetiam as noites. A regra subiu para o topo, e as operações
  // abrem dentro das noites, com quantidade, preço, valor e taxa.
  it('a regra fica no topo, e as operações abrem dentro das noites, sem painel repetido', async () => {
    renderizar()
    expect(screen.getByTestId('robo-regra').textContent).toBe('robo.regra')
    expect(screen.queryByText('robo.registroTitle')).toBeNull()
    expect(screen.queryByText('robo.operacoesTitle')).toBeNull()
    const noites = await screen.findByTestId('robo-noites')
    const operacoes = (await screen.findByText('robo.noites.verOperacoes')).closest('details')
    // Logo depois da tabela das noites, no mesmo painel.
    expect(noites.compareDocumentPosition(operacoes) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(noites.parentElement.parentElement.contains(operacoes)).toBe(true)
    expect(operacoes.querySelectorAll('tbody tr')).toHaveLength(1)
    expect(operacoes.textContent).toContain('robo.acoes.VenderTudo')
    expect(operacoes.textContent).toMatch(/0[.,]99/)
  })

  it('com o preço já acima do gatilho, diz que ele compra se fechar assim', async () => {
    apiRequest.mockImplementation(responder({
      regra: () => ({ resultado: { ...REGRA_ROBO, faltaParaOGatilho: -0.01 } }),
    }))
    renderizar()
    expect((await screen.findByTestId('robo-gatilho')).textContent).toBe('robo.gatilho.comprariaHoje')
    expect(screen.getByText('robo.gatilho.distancia.comprariaHoje')).toBeTruthy()
  })

  it('o robô sem registro há horas aparece como parado, e não como ativo', async () => {
    renderizar()
    // A última vela do modo demo é de 27/10: bem mais de 3 horas atrás.
    expect((await screen.findByTestId('robo-saude')).textContent).toBe('robo.saude.parado')
  })

  it('o robô que acabou de registrar aparece como ativo', async () => {
    const agora = new Date(Math.floor(Date.now() / 3600000) * 3600000).toISOString().slice(0, 19)
    apiRequest.mockImplementation(responder({
      sequencias: () => ({ resultado: { totalRegistros: 1, registros: [{ idSequenciaRetorno: 'a', moeda: 'BTC', dataHora: agora, tipo: 0 }] } }),
    }))
    renderizar()
    expect((await screen.findByTestId('robo-saude')).textContent).toBe('robo.saude.ativo')
  })

  it('dentro do mercado, diz o que o faria vender e a dose de hoje', async () => {
    apiRequest.mockImplementation(responder({
      regra: () => ({ resultado: { ...REGRA_ROBO, dentro: true, dose: 0.8, doseNoGatilho: 1, faltaParaOGatilho: -0.03 } }),
    }))
    renderizar()
    expect((await screen.findByTestId('robo-gatilho')).textContent).toBe('robo.gatilho.paraVender')
    expect(screen.getByText('robo.gatilho.titleDentro')).toBeTruthy()
    expect(screen.getByTestId('robo-dose-gatilho').textContent).toMatch(/^80%$/)
    expect(screen.getByText('robo.gatilho.doseHoje')).toBeTruthy()
    expect(screen.getByText('robo.normal.periodoAtual')).toBeTruthy()
  })

  it('mostra o histórico da regra: a pausa de hoje, o tempo fora, as entradas e a conclusão', async () => {
    renderizar()
    expect((await screen.findByTestId('robo-normal-atual')).textContent).toBe('robo.normal.dias')
    expect(screen.getByText('robo.normal.pausaAtual')).toBeTruthy()
    const { fracaoFora } = REGRA_ROBO.historico
    expect(screen.getByTestId('robo-normal-fora').textContent).toBe(`${Math.round(fracaoFora * 100)}%`)
    expect(screen.getByTestId('robo-normal-duracao').textContent).toBe('robo.normal.ateDias')
    expect(screen.getByTestId('robo-normal-entradas').textContent).toBe('robo.normal.entradasValor')
    expect(screen.getByTestId('robo-normal-curtas').textContent).toBe('robo.normal.curtasValor')
    expect(screen.getByTestId('robo-normal-conclusao').textContent).toBe('robo.normal.conclusao')
  })

  it('sem histórico para medir, a regra avisa em vez de mostrar zeros', async () => {
    apiRequest.mockImplementation(responder({
      regra: () => ({ resultado: { moeda: 'BTC', pontos: [], mudancas: [], dentro: null, faltaParaOGatilho: null, historico: null } }),
    }))
    renderizar()
    expect(await screen.findByText('robo.gatilho.semDados')).toBeTruthy()
    expect(screen.getByText('robo.normal.semDados')).toBeTruthy()
    expect(screen.queryByTestId('robo-gatilho')).toBeNull()
  })

  // Os dados reais até 27/10: as 10 fora, a BNB a 0,67% do gatilho e o BTC a 1,29%.
  it('o radar mostra as 10 moedas da mais perto de mudar de lado para a mais longe, com o BTC marcado', async () => {
    renderizar()
    const radar = await screen.findByTestId('robo-radar')
    const ordem = [...radar.querySelectorAll('tbody tr')].map((tr) => tr.getAttribute('data-moeda'))
    expect(ordem).toEqual(['BNB', 'BTC', 'PAXG', 'XRP', 'LTC', 'ETH', 'SOL', 'LINK', 'DOGE', 'ADA'])
    expect(radar.querySelector('tr[data-moeda="BTC"]').textContent).toContain('robo.radar.oRobo')
    expect(radar.querySelector('tr[data-moeda="BNB"]').textContent).toContain('robo.radar.subir')
    expect(screen.getByTestId('robo-radar-resumo').textContent).toBe('robo.radar.resumo')
  })

  it('a falha do radar não esconde o resto', async () => {
    apiRequest.mockImplementation(responder({ radar: falha }))
    renderizar()
    expect(await screen.findByText('robo.radar.erro')).toBeTruthy()
    expect((await screen.findByTestId('robo-gatilho')).textContent).toBe('robo.gatilho.paraComprar')
    expect(await screen.findByTestId('robo-retornos')).toBeTruthy()
  })

  it('a falha da regra não esconde o resto', async () => {
    apiRequest.mockImplementation(responder({ regra: falha }))
    renderizar()
    expect(await screen.findByText('robo.gatilho.erro')).toBeTruthy()
    expect(screen.getByText('robo.normal.erro')).toBeTruthy()
    expect(screen.getAllByText('robo.acoes.VenderTudo').length).toBeGreaterThan(0)
    expect(await screen.findByTestId('robo-retornos')).toBeTruthy()
    expect(await screen.findByTestId('robo-noites')).toBeTruthy()
  })
})
