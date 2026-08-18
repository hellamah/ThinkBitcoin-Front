/**
 * Testes do caminho de MOCK do apiRequest.
 *
 * Ficam num arquivo próprio porque `USE_MOCK_API` é resolvida na importação do
 * módulo: para exercitar o modo demo é preciso mockar a flag, e isso vale para
 * o arquivo inteiro. O apiClient.test.js exercita o caminho oposto.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/utils/mockFlag', () => ({ USE_MOCK_API: true }))
vi.mock('../src/utils/mockApi', () => ({ getMockResponse: vi.fn() }))

import { HttpMethod, apiRequest } from '../src/utils/apiClient'
import { getMockResponse } from '../src/utils/mockApi'

// O ambiente é node: window e CustomEvent não existem sozinhos.
const stubWindow = () => {
  const dispatchEvent = vi.fn()
  vi.stubGlobal('window', { dispatchEvent })
  vi.stubGlobal(
    'CustomEvent',
    class {
      constructor(type, init) {
        this.type = type
        this.detail = init?.detail
      }
    }
  )
  return dispatchEvent
}

const eventosDisparados = (dispatchEvent) => dispatchEvent.mock.calls.map(([e]) => e.type)

describe('utils/apiClient › apiRequest em modo mock (erros)', () => {
  beforeEach(() => {
    // O setup global roda resetAllMocks, que limpa a implementação.
    getMockResponse.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // O motivo de existir desta correção: sem ela a mensagem específica do mock
  // chegava sem `hasBackendMessage`, e a tela a trocava por "tente novamente".
  it('deve preservar a mensagem do handler e marcá-la como vinda do backend', async () => {
    getMockResponse.mockImplementation(() => {
      const err = new Error('Você já tem um alerta ativo para esta moeda neste valor.')
      err.status = 400
      throw err
    })

    await expect(apiRequest('/ThinkBitcoin/alertas-preco', { method: HttpMethod.POST, body: {} }))
      .rejects.toMatchObject({
        message: 'Você já tem um alerta ativo para esta moeda neste valor.',
        status: 400,
        hasBackendMessage: true,
      })
  })

  it('deve assumir 400 quando o handler não informa status', async () => {
    getMockResponse.mockImplementation(() => {
      throw new Error('Entrada inválida.')
    })

    await expect(apiRequest('/qualquer', { method: HttpMethod.POST })).rejects.toMatchObject({
      status: 400,
      hasBackendMessage: true,
    })
  })

  it('deve cair na frase genérica quando o handler lança sem mensagem', async () => {
    getMockResponse.mockImplementation(() => {
      const err = new Error('   ')
      err.status = 500
      throw err
    })

    await expect(apiRequest('/vazio')).rejects.toMatchObject({
      message: 'Falha na requisição à API',
      status: 500,
      hasBackendMessage: false,
    })
  })

  it('não deve chamar a API real quando o mock lança', async () => {
    getMockResponse.mockImplementation(() => {
      throw new Error('recusado')
    })

    await expect(apiRequest('/recusado')).rejects.toThrow()
    expect(fetch).not.toHaveBeenCalled()
  })

  // Antes desta correção o modo demo não conseguia expirar sessão nem abrir o
  // convite de assinatura: os eventos só existiam dentro do bloco do fetch.
  it('deve disparar subscription-required num 403 do mock', async () => {
    const dispatchEvent = stubWindow()
    getMockResponse.mockImplementation(() => {
      const err = new Error('Recurso de assinatura.')
      err.status = 403
      throw err
    })

    await expect(apiRequest('/ThinkBitcoin/alertas-preco')).rejects.toThrow()

    expect(eventosDisparados(dispatchEvent)).toEqual(['subscription-required'])
    expect(dispatchEvent.mock.calls[0][0].detail).toEqual({ endpoint: '/ThinkBitcoin/alertas-preco' })
  })

  it('deve disparar auth-expired num 401 do mock', async () => {
    const dispatchEvent = stubWindow()
    getMockResponse.mockImplementation(() => {
      const err = new Error('Sessão expirada.')
      err.status = 401
      throw err
    })

    await expect(apiRequest('/privado')).rejects.toThrow()

    expect(eventosDisparados(dispatchEvent)).toEqual(['auth-expired'])
  })

  it('deve respeitar suppressAuthRedirect num 401 do mock', async () => {
    const dispatchEvent = stubWindow()
    getMockResponse.mockImplementation(() => {
      const err = new Error('Sessão expirada.')
      err.status = 401
      throw err
    })

    await expect(apiRequest('/privado', { suppressAuthRedirect: true })).rejects.toThrow()

    expect(dispatchEvent).not.toHaveBeenCalled()
  })
})

describe('utils/apiClient › apiRequest em modo mock (sucesso e fallback)', () => {
  beforeEach(() => {
    getMockResponse.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('deve devolver a resposta do mock normalizada, sem tocar na rede', async () => {
    getMockResponse.mockReturnValue({ Resultado: { TokenAutenticado: 'abc' } })

    const res = await apiRequest('/mockado')

    expect(res).toEqual({ resultado: { tokenAutenticado: 'abc' } })
    expect(fetch).not.toHaveBeenCalled()
  })

  // Endpoint sem handler devolve null e o fluxo segue para a API real — é o que
  // permite o modo demo cobrir só parte das rotas.
  it('deve cair para a API real quando não há handler para o endpoint', async () => {
    getMockResponse.mockReturnValue(null)
    fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ vindo: 'da rede' }),
    })

    await expect(apiRequest('/sem-handler')).resolves.toEqual({ vindo: 'da rede' })
    expect(fetch).toHaveBeenCalled()
  })

  it('deve manter os eventos de erro no caminho da API real', async () => {
    const dispatchEvent = stubWindow()
    getMockResponse.mockReturnValue(null)
    fetch.mockResolvedValue({ ok: false, status: 403, json: () => Promise.reject(new Error('sem corpo')) })

    await expect(apiRequest('/pago')).rejects.toMatchObject({ status: 403 })

    expect(eventosDisparados(dispatchEvent)).toEqual(['subscription-required'])
  })
})
