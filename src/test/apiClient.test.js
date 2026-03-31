/**
 * Testes unitários para utils/apiClient.
 *
 * Cobre:
 * - Enums HttpMethod e ApiEndpoint
 * - Construção de URL via buildUrl
 * - Serialização de body e headers
 * - Tratamento de respostas 204 (sem conteúdo)
 * - Lançamento de erros com status HTTP
 * - Passagem de AbortSignal para o fetch
 */
import { describe, expect, it, vi } from 'vitest'
import { API_URL } from '../src/api'
import { ApiEndpoint, HttpMethod, apiRequest } from '../src/utils/apiClient'

// O mock de fetch é configurado globalmente em vitest.setup.js

describe('utils/apiClient › HttpMethod', () => {
  it('expõe todos os métodos HTTP esperados como constantes imutáveis', () => {
    expect(HttpMethod.GET).toBe('GET')
    expect(HttpMethod.POST).toBe('POST')
    expect(HttpMethod.PUT).toBe('PUT')
    expect(HttpMethod.DELETE).toBe('DELETE')
    expect(() => { HttpMethod.PATCH = 'PATCH' }).toThrow()
  })
})

describe('utils/apiClient › ApiEndpoint', () => {
  it('expõe endpoints estáticos de autenticação e usuário corretamente', () => {
    expect(ApiEndpoint.AUTHENTICATION.LOGIN).toBe('/ThinkBitcoin/gerarTokenBearer')
    expect(ApiEndpoint.USER.LIST).toBe('/ThinkBitcoin/usuariosTB/')
    expect(ApiEndpoint.USER.CREATE).toBe('/ThinkBitcoin/usuariosTB/')
    expect(ApiEndpoint.MARKET.COIN_LIST).toBe('/ThinkBitcoin/moedas')
    expect(ApiEndpoint.MARKET.SCRIPT_COMMON).toBe('/ThinkBitcoin/AtivadorScript/ScriptComum')
    expect(ApiEndpoint.MARKET.EXCHANGES).toBe('/ThinkBitcoin/exchanges')
    expect(ApiEndpoint.MARKET.DEBATE).toBe('/ThinkBitcoin/debate')
    expect(ApiEndpoint.PREFERENCES.ALL).toBe('/ThinkBitcoin/preferencias')
    expect(ApiEndpoint.PREFERENCES.MINE).toBe('/ThinkBitcoin/preferencias/minhas')
    expect(ApiEndpoint.CARGO.UPDATE).toBe('/ThinkBitcoin/CargoUsuarioTB/AlterarCargoUsuarioTB/')
  })

  it('gera endpoints dinâmicos de usuário corretamente a partir de id', () => {
    expect(ApiEndpoint.USER.ME('42')).toBe('/ThinkBitcoin/usuariosTB/42')
    expect(ApiEndpoint.USER.DELETE('99')).toBe('/ThinkBitcoin/usuariosTB/99')
  })

  it('gera endpoint de valor de moeda corretamente a partir do símbolo', () => {
    expect(ApiEndpoint.MARKET.COIN_VALUE('BTC')).toBe('/ThinkBitcoin/moeda/BTC/valor')
    expect(ApiEndpoint.MARKET.COIN_VALUE('ETH')).toBe('/ThinkBitcoin/moeda/ETH/valor')
  })

  it('gera endpoint de sequenciaRetorno com e sem id', () => {
    expect(ApiEndpoint.MARKET.RETURN_SEQUENCE()).toBe('/ThinkBitcoin/sequenciasRetorno/')
    expect(ApiEndpoint.MARKET.RETURN_SEQUENCE('abc-123')).toBe('/ThinkBitcoin/sequenciasRetorno/abc-123')
  })

  it('gera endpoint de preferências por id corretamente', () => {
    expect(ApiEndpoint.PREFERENCES.BY_ID('pref-001')).toBe('/ThinkBitcoin/preferencias/pref-001')
  })
})

describe('utils/apiClient › apiRequest', () => {
  it('executa requisição GET sem body e sem Content-Type', async () => {
    fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ status: 'ok' }),
    })

    const resultado = await apiRequest('/status')

    expect(fetch).toHaveBeenCalledWith(`${API_URL}/status`, {
      method: HttpMethod.GET,
      headers: {},
      body: undefined,
    })
    expect(resultado).toEqual({ status: 'ok' })
  })

  it('executa requisição POST com body serializado e Content-Type automático', async () => {
    fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ criado: true }),
    })

    const body = { email: 'usuario@exemplo.com' }
    const resultado = await apiRequest('/contas', {
      method: HttpMethod.POST,
      body,
      headers: { Authorization: 'Bearer abc' },
    })

    expect(fetch).toHaveBeenCalledWith(`${API_URL}/contas`, {
      method: HttpMethod.POST,
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer abc',
      },
      body: JSON.stringify(body),
    })
    expect(resultado).toEqual({ criado: true })
  })

  it('executa requisição PUT com body e headers adicionais', async () => {
    fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ atualizado: true }),
    })

    const body = { tema: 'dark' }
    await apiRequest('/preferencias', {
      method: HttpMethod.PUT,
      body,
      headers: { Authorization: 'Bearer xyz' },
    })

    expect(fetch).toHaveBeenCalledWith(`${API_URL}/preferencias`, {
      method: HttpMethod.PUT,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer xyz' },
      body: JSON.stringify(body),
    })
  })

  it('retorna null para status 204 (sem conteúdo)', async () => {
    fetch.mockResolvedValue({ ok: true, status: 204 })

    await expect(apiRequest('/vazio')).resolves.toBeNull()
  })

  it('lança erro padronizado com status HTTP para respostas não-OK', async () => {
    fetch.mockResolvedValue({ ok: false, status: 500 })

    await expect(apiRequest('/erro')).rejects.toMatchObject({
      message: 'Falha na requisição à API',
      status: 500,
    })
  })

  it('lança erro com status 401 para resposta de não autorizado', async () => {
    fetch.mockResolvedValue({ ok: false, status: 401 })

    await expect(apiRequest('/protegido')).rejects.toMatchObject({
      message: 'Falha na requisição à API',
      status: 401,
    })
  })

  it('lança erro com status 404 para recurso não encontrado', async () => {
    fetch.mockResolvedValue({ ok: false, status: 404 })

    await expect(apiRequest('/nao-existe')).rejects.toMatchObject({
      message: 'Falha na requisição à API',
      status: 404,
    })
  })

  it('passa o AbortSignal corretamente para o fetch', async () => {
    fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    })

    const controller = new AbortController()
    await apiRequest('/com-signal', { signal: controller.signal })

    const chamada = fetch.mock.calls[0][1]
    expect(chamada.signal).toBe(controller.signal)
  })

  it('propaga o erro de rede quando o fetch rejeita a promessa', async () => {
    fetch.mockRejectedValue(new Error('Falha de rede'))

    await expect(apiRequest('/inacessivel')).rejects.toThrow('Falha de rede')
  })
})
