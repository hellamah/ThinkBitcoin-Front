import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  aplicarCotacao,
  criarCotacoesCarrossel,
  INTERVALO_COTACOES_MS,
} from '../src/utils/cotacoesCarrossel'

// Dashboard e Heatmap exibem o mesmo carrossel. Cada um montava o próprio
// polling, e a navegação desmonta a página: ir e voltar refazia tudo. O que
// estes testes travam é o contrato do store compartilhado — uma rodada por vez,
// reaproveitada por quem chega dentro do intervalo, e polling só enquanto
// alguma tela estiver olhando.

const LISTA = {
  resultado: [
    { id: 1, sigla: 'BTC', nome: 'Bitcoin' },
    { id: 2, sigla: 'ETH', nome: 'Ethereum' },
    // Fora do carrossel: stablecoin não tem cotação a acompanhar.
    { id: 3, sigla: 'USDT', nome: 'Tether' },
  ],
}

// Duas moedas no carrossel, três requisições por moeda.
const POR_RODADA = 6
const LISTA_E_RODADA = 1 + POR_RODADA

const criarApi = () => {
  const chamadas = []
  let listaFora = false
  const requisitar = vi.fn(async (endpoint) => {
    chamadas.push(endpoint)
    if (endpoint === '/ThinkBitcoin/moedas') {
      if (listaFora) throw new Error('fora do ar')
      return LISTA
    }
    if (endpoint.includes('/valor')) {
      return { resultado: { registros: [{ precoFechamento: 100, precoPercentualVariacao: 1.5 }] } }
    }
    return { resultado: { registros: [{ valor: 50 }] } }
  })
  return {
    requisitar,
    chamadas,
    derrubarLista: (fora) => {
      listaFora = fora
    },
  }
}

const nada = () => {}
const avancar = (ms) => vi.advanceTimersByTimeAsync(ms)

describe('cotações do carrossel', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(console, 'error').mockImplementation(nada)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('a primeira tela busca lista e cotações; uma segunda, junto, não duplica', async () => {
    const api = criarApi()
    const loja = criarCotacoesCarrossel({ requisitar: api.requisitar, abaOculta: () => false })

    loja.subscribe(nada)
    loja.subscribe(nada)
    await avancar(0)

    expect(api.chamadas).toHaveLength(LISTA_E_RODADA)
    const { moedas } = loja.getSnapshot()
    expect(moedas.map((m) => m.simbolo)).toEqual(['BTC', 'ETH'])
    expect(moedas[0].valor).toBe(100)
    expect(moedas[0].variacao).toBe(1.5)
  })

  it('o duplo montar do StrictMode não dispara duas rodadas', async () => {
    const api = criarApi()
    const loja = criarCotacoesCarrossel({ requisitar: api.requisitar, abaOculta: () => false })

    const primeira = loja.subscribe(nada)
    primeira()
    loja.subscribe(nada)
    await avancar(0)

    expect(api.chamadas).toHaveLength(LISTA_E_RODADA)
  })

  it('sair e voltar dentro do intervalo reaproveita a rodada, e a próxima vem quando ela vence', async () => {
    const api = criarApi()
    const loja = criarCotacoesCarrossel({ requisitar: api.requisitar, abaOculta: () => false })

    const sair = loja.subscribe(nada)
    await avancar(0)
    sair()

    // Dez segundos depois, outra tela abre o carrossel.
    await avancar(10_000)
    loja.subscribe(nada)
    await avancar(0)
    expect(api.chamadas).toHaveLength(LISTA_E_RODADA)
    expect(loja.getSnapshot().moedas[0].valor).toBe(100)

    // A rodada seguinte sai quando a anterior completa o intervalo — não um
    // intervalo inteiro depois de a tela nova chegar.
    await avancar(INTERVALO_COTACOES_MS - 10_000 - 1)
    expect(api.chamadas).toHaveLength(LISTA_E_RODADA)
    await avancar(1)
    expect(api.chamadas).toHaveLength(LISTA_E_RODADA + POR_RODADA)
  })

  it('sem nenhuma tela inscrita, o polling para', async () => {
    const api = criarApi()
    const loja = criarCotacoesCarrossel({ requisitar: api.requisitar, abaOculta: () => false })

    const sair = loja.subscribe(nada)
    await avancar(0)
    sair()
    await avancar(INTERVALO_COTACOES_MS * 3)

    expect(api.chamadas).toHaveLength(LISTA_E_RODADA)
  })

  it('aba em segundo plano pula a rodada', async () => {
    const api = criarApi()
    let oculta = false
    const loja = criarCotacoesCarrossel({ requisitar: api.requisitar, abaOculta: () => oculta })

    loja.subscribe(nada)
    await avancar(0)
    oculta = true
    await avancar(INTERVALO_COTACOES_MS)
    expect(api.chamadas).toHaveLength(LISTA_E_RODADA)

    oculta = false
    await avancar(INTERVALO_COTACOES_MS)
    expect(api.chamadas).toHaveLength(LISTA_E_RODADA + POR_RODADA)
  })

  it('lista fora do ar: avisa uma vez, tenta de novo e se recupera sozinha', async () => {
    const api = criarApi()
    api.derrubarLista(true)
    const loja = criarCotacoesCarrossel({ requisitar: api.requisitar, abaOculta: () => false })

    loja.subscribe(nada)
    await avancar(0)
    expect(loja.getSnapshot().erro).toBe('coinListError')

    // A pessoa fecha o aviso; a falha seguinte não o reabre.
    loja.definirErro('')
    await avancar(INTERVALO_COTACOES_MS)
    expect(api.chamadas.filter((e) => e === '/ThinkBitcoin/moedas')).toHaveLength(2)
    expect(loja.getSnapshot().erro).toBe('')

    // A API volta: a rodada seguinte carrega a lista sem recarregar a página.
    api.derrubarLista(false)
    await avancar(INTERVALO_COTACOES_MS)
    expect(loja.getSnapshot().moedas.map((m) => m.simbolo)).toEqual(['BTC', 'ETH'])
    expect(loja.getSnapshot().erro).toBe('')
  })
})

describe('aplicarCotacao', () => {
  const base = { id: 1, simbolo: 'BTC', valor: 7, variacao: 0, dados: [1, 2, 3, 4, 5, 6, 7] }

  it('acrescenta o valor ao histórico e mantém só os últimos sete pontos', () => {
    const r = aplicarCotacao(base, { resultado: { registros: [{ precoFechamento: 8 }] } }, null, null)
    expect(r.valor).toBe(8)
    expect(r.dados).toEqual([2, 3, 4, 5, 6, 7, 8])
  })

  it('usa a variação da API quando ela vem, e calcula contra o ponto anterior quando não', () => {
    const daApi = aplicarCotacao(base, { resultado: { registros: [{ precoFechamento: 8, precoPercentualVariacao: -2 }] } }, null, null)
    expect(daApi.variacao).toBe(-2)

    const calculada = aplicarCotacao(base, { resultado: { registros: [{ precoFechamento: 8 }] } }, null, null)
    expect(calculada.variacao).toBeCloseTo(((8 - 7) / 7) * 100)
  })

  it('sentimento ausente fica nulo, em vez de inventado', () => {
    const r = aplicarCotacao(
      base,
      { resultado: { registros: [{ precoFechamento: 8 }] } },
      null,
      { resultado: { registros: [{ tendencia: 'alta' }] } }
    )
    expect(r.fear).toBeNull()
    expect(r.trend).toEqual({ tendencia: 'alta' })
  })
})
