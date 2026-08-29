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

  // O carrossel lê `registros[0]` como cotação atual, o que só é verdade com
  // ordemAsc=false. Enquanto ele omitia os parâmetros e ficava no default do
  // servidor, uma mudança de default do lado da API teria virado preço antigo
  // exibido como atual — sem erro, sem log, sem ninguém perceber.
  it('deve serializar os parâmetros de COIN_VALUE na query', () => {
    expect(
      ApiEndpoint.MARKET.COIN_VALUE('btc', { pagina: 1, quantidade: 1, ordemAsc: false })
    ).toBe('/ThinkBitcoin/moeda/btc/valor?pagina=1&quantidade=1&ordemAsc=false')
  })

  // `ordemAsc: false` e `quantidade: 0` são falsy, e um `if (valor)` os
  // descartaria em silêncio — justamente os dois que precisam chegar.
  it('não descarta parâmetro de COIN_VALUE por ser falsy', () => {
    const url = ApiEndpoint.MARKET.COIN_VALUE('btc', { ordemAsc: false })

    expect(url).toContain('ordemAsc=false')
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

  // A API .NET serializa DateTime sem sufixo de fuso quando o Kind é
  // Unspecified — que é o que o EF Core devolve lendo datetime2. Os valores são
  // UTC, mas sem a marca o `new Date()` os lê como hora local, deslocando todo
  // instante do produto pelo fuso do usuário.
  it('deve marcar como UTC o carimbo que chega sem fuso', () => {
    expect(normalizeApiKeys({ horaReferencia: '2026-08-14T11:00:00' }))
      .toEqual({ horaReferencia: '2026-08-14T11:00:00Z' })
  })

  it('deve marcar também o carimbo com fração de segundo', () => {
    expect(normalizeApiKeys({ criadoEm: '2026-08-14T11:00:00.123' }))
      .toEqual({ criadoEm: '2026-08-14T11:00:00.123Z' })
  })

  it('não deve mexer no carimbo que já traz fuso', () => {
    const comFuso = {
      a: '2026-08-14T11:00:00Z',
      b: '2026-08-14T11:00:00-03:00',
      c: '2026-08-14T11:00:00+0000',
    }
    expect(normalizeApiKeys(comFuso)).toEqual(comFuso)
  })

  it('não deve confundir texto comum com carimbo', () => {
    // O `$` da expressão é o que impede isto: sem ele, qualquer string que
    // COMECE com uma data ganharia um Z no fim.
    const texto = {
      sigla: 'BTC',
      descricao: '2026-08-14 foi um bom dia',
      soData: '2026-08-14',
      quase: '2026-08-14T11:00:00 (aprox)',
    }
    expect(normalizeApiKeys(texto)).toEqual(texto)
  })

  it('deve marcar carimbos dentro de arrays e de objetos aninhados', () => {
    expect(normalizeApiKeys({ Registros: [{ HoraReferencia: '2026-08-14T11:00:00' }] }))
      .toEqual({ registros: [{ horaReferencia: '2026-08-14T11:00:00Z' }] })
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
