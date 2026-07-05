/**
 * Testes unitários para utils/apiClient.
 * 
 * Este conjunto de testes garante a integridade da comunicação entre o 
 * frontend ThinkBitcoin e a API do Laboratório de Trade.
 */
import { describe, expect, it, vi } from 'vitest'
import { API_URL } from '../src/api'
import { ApiEndpoint, HttpMethod, apiRequest, normalizeApiKeys } from '../src/utils/apiClient'

// Mock de fetch global é configurado em vitest.setup.js

describe('utils/apiClient › Enums & Endpoints', () => {
  it('deve expor métodos HTTP imutáveis e corretos', () => {
    expect(HttpMethod.GET).toBe('GET')
    expect(HttpMethod.POST).toBe('POST')
    expect(HttpMethod.PUT).toBe('PUT')
    expect(HttpMethod.DELETE).toBe('DELETE')
    // Garantir imutabilidade
    expect(() => { HttpMethod.PATCH = 'PATCH' }).toThrow()
  })

  it('deve construir endpoints estáticos seguindo o padrão da API ThinkBitcoin', () => {
    expect(ApiEndpoint.AUTHENTICATION.LOGIN).toBe('/ThinkBitcoin/gerarTokenBearer')
    expect(ApiEndpoint.MARKET.COIN_LIST).toBe('/ThinkBitcoin/moedas')
  })

  it('deve gerar endpoints dinâmicos (ID/Símbolo) corretamente', () => {
    expect(ApiEndpoint.USER.ME('U001')).toBe('/ThinkBitcoin/usuariosTB/U001')
    expect(ApiEndpoint.MARKET.COIN_VALUE('BTC')).toBe('/ThinkBitcoin/moeda/BTC/valor')
  })
})

describe('utils/apiClient › normalizeApiKeys (Normalização PascalCase → camelCase)', () => {
  it('deve converter chaves PascalCase para camelCase recursivamente', () => {
    const bruto = {
      Resultado: {
        Registros: [{ PrecoFechamento: 10, HoraReferencia: '2026-01-01' }],
        TotalPaginas: 3,
      },
    }
    expect(normalizeApiKeys(bruto)).toEqual({
      resultado: {
        registros: [{ precoFechamento: 10, horaReferencia: '2026-01-01' }],
        totalPaginas: 3,
      },
    })
  })

  it('deve preservar chaves que já estão em camelCase e valores primitivos', () => {
    const bruto = { resultado: { valor: 1.5, ativo: true, nulo: null } }
    expect(normalizeApiKeys(bruto)).toEqual(bruto)
  })

  it('não deve alterar chaves-código como siglas de moeda ou país', () => {
    const bruto = { BTC: 1, US: 2, MA5: 3 }
    expect(normalizeApiKeys(bruto)).toEqual({ BTC: 1, US: 2, MA5: 3 })
  })

  it('deve manter a variante camelCase quando a resposta trouxer as duas', () => {
    const bruto = { Valor: 1, valor: 2 }
    expect(normalizeApiKeys(bruto)).toEqual({ valor: 2 })
  })

  it('deve normalizar arrays na raiz e passar adiante tipos não-objeto', () => {
    expect(normalizeApiKeys([{ Sigla: 'BTC' }])).toEqual([{ sigla: 'BTC' }])
    expect(normalizeApiKeys('texto')).toBe('texto')
    expect(normalizeApiKeys(null)).toBeNull()
  })
})

describe('utils/apiClient › apiRequest (Comunicação com API)', () => {
  it('deve executar requisição GET com parâmetros de URL e headers vazios por padrão', async () => {
    fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ status: 'online' }),
    })

    const resultado = await apiRequest('/health')

    expect(fetch).toHaveBeenCalledWith(`${API_URL}/health`, expect.objectContaining({
      method: HttpMethod.GET,
      headers: {},
      body: undefined
    }))
    expect(resultado).toEqual({ status: 'online' })
  })

  it('deve executar requisição POST serializando o body para JSON automaticamente', async () => {
    fetch.mockResolvedValue({
      ok: true,
      status: 201,
      json: () => Promise.resolve({ success: true }),
    })

    const payload = { test: 'data' }
    await apiRequest('/submit', {
      method: HttpMethod.POST,
      body: payload
    })

    expect(fetch).toHaveBeenCalledWith(`${API_URL}/submit`, expect.objectContaining({
      method: HttpMethod.POST,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }))
  })

  it('deve entregar respostas com chaves normalizadas para camelCase', async () => {
    fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ Resultado: { TokenAutenticado: 'abc' } }),
    })

    const res = await apiRequest('/pascal')
    expect(res).toEqual({ resultado: { tokenAutenticado: 'abc' } })
  })

  it('deve retornar null graciosamente para status 204 (No Content)', async () => {
    fetch.mockResolvedValue({ ok: true, status: 204 })
    const res = await apiRequest('/no-content')
    expect(res).toBeNull()
  })

  it('deve lançar erro customizado com status HTTP para falhas do servidor (500)', async () => {
    fetch.mockResolvedValue({ ok: false, status: 500 })

    await expect(apiRequest('/crash')).rejects.toMatchObject({
      message: 'Falha na requisição à API',
      status: 500,
      hasBackendMessage: false
    })
  })

  it('deve usar a mensagem de erro enviada pelo backend quando disponível', async () => {
    fetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ Mensagem: 'Senha inválida' }),
    })

    await expect(apiRequest('/login-falho')).rejects.toMatchObject({
      message: 'Senha inválida',
      status: 400,
      hasBackendMessage: true
    })
  })

  it('deve anexar o Bearer token armazenado automaticamente quando existir', async () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k) => (k === 'token' ? 'token-armazenado' : null),
      },
    })
    fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    })

    try {
      await apiRequest('/privado')
      expect(fetch).toHaveBeenCalledWith(`${API_URL}/privado`, expect.objectContaining({
        headers: { Authorization: 'Bearer token-armazenado' },
      }))
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('não deve sobrescrever um header Authorization definido pelo caller', async () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k) => (k === 'token' ? 'token-armazenado' : null),
      },
    })
    fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    })

    try {
      await apiRequest('/custom', { headers: { Authorization: 'Bearer explicito' } })
      expect(fetch).toHaveBeenCalledWith(`${API_URL}/custom`, expect.objectContaining({
        headers: { Authorization: 'Bearer explicito' },
      }))
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('deve propagar falhas de rede (rejeição do fetch) corretamente', async () => {
    fetch.mockRejectedValue(new Error('Network Failure'))
    await expect(apiRequest('/offline')).rejects.toThrow('Network Failure')
  })

  it('deve respeitar o AbortSignal para cancelamento de requisições pendentes', async () => {
    fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    })

    const controller = new AbortController()
    await apiRequest('/cancelable', { signal: controller.signal })

    const lastCallArgs = fetch.mock.calls[fetch.mock.calls.length - 1][1]
    expect(lastCallArgs.signal).toBe(controller.signal)
  })
})
