import { beforeEach, describe, expect, it, vi } from 'vitest'
import { API_URL } from '../src/api'
import { ApiEndpoint, HttpMethod, apiRequest } from '../src/utils/apiClient'

describe('utils/apiClient', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    global.fetch = vi.fn()
  })

  it('expõe endpoints esperados para autenticação e usuário', () => {
    expect(ApiEndpoint.AUTHENTICATION.LOGIN).toBe('/ThinkBitcoin/gerarTokenBearer/')
    expect(ApiEndpoint.USER.ME).toBe('/ThinkBitcoin/me')
    expect(ApiEndpoint.USER.UPDATE_PREFERENCES).toBe('/ThinkBitcoin/usuariosTB/atualizarPreferencias')
    expect(ApiEndpoint.USER.REGISTER_CONSULTANT).toBe('/ThinkBitcoin/usuariosTB/inserirConsultor')
    expect(ApiEndpoint.MARKET.COIN_VALUE('BTC')).toBe('/ThinkBitcoin/moeda/BTC/valor')
    expect(ApiEndpoint.MARKET.SCRIPT_COMMON).toBe('/ThinkBitcoin/scriptComum')
  })

  it('executa requisição GET sem body e sem content-type automático', async () => {
    fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ ok: true }),
    })

    const response = await apiRequest('/status')

    expect(fetch).toHaveBeenCalledWith(`${API_URL}/status`, {
      method: HttpMethod.GET,
      headers: {},
      body: undefined,
    })
    expect(response).toEqual({ ok: true })
  })

  it('executa requisição POST com serialização de body e content-type', async () => {
    fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ created: true }),
    })

    const body = { email: 'user@foo.com' }
    const response = await apiRequest('/accounts', {
      method: HttpMethod.POST,
      body,
      headers: { Authorization: 'Bearer abc' },
    })

    expect(fetch).toHaveBeenCalledWith(`${API_URL}/accounts`, {
      method: HttpMethod.POST,
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer abc',
      },
      body: JSON.stringify(body),
    })
    expect(response).toEqual({ created: true })
  })

  it('retorna null para status 204', async () => {
    fetch.mockResolvedValue({ ok: true, status: 204 })

    await expect(apiRequest('/void')).resolves.toBeNull()
  })

  it('lança erro padronizado para resposta não OK com status anexado', async () => {
    fetch.mockResolvedValue({ ok: false, status: 500 })

    await expect(apiRequest('/broken')).rejects.toMatchObject({
      message: 'Falha na requisição à API',
      status: 500,
    })
  })
})
