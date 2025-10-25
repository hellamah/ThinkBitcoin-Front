import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiEndpoint, HttpMethod } from '../src/utils/apiClient'
import { authenticate } from '../src/utils/authentication'
import { API_URL } from '../src/api'

describe('utils/authentication', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    global.fetch = vi.fn()
  })

  it('envia as credenciais corretas para a API de autenticação', async () => {
    const tokenAutenticado = 'token-jwt'
    fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({ resultado: { tokenAutenticado } }),
    })

    const resultado = await authenticate({
      email: 'usuario@exemplo.com',
      senha: 'segredo',
    })

    expect(fetch).toHaveBeenCalledWith(
      `${API_URL}${ApiEndpoint.AUTHENTICATION.LOGIN}`,
      {
        method: HttpMethod.POST,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'usuario@exemplo.com', senha: 'segredo' }),
      }
    )
    expect(resultado).toEqual({ tokenAutenticado })
  })

  it('lança erro quando a API responde com falha', async () => {
    fetch.mockResolvedValue({ ok: false, status: 401 })

    await expect(
      authenticate({ email: 'usuario@exemplo.com', senha: 'errada' })
    ).rejects.toThrow('Falha na requisição à API')
  })

  it('lança erro quando o token não está presente na resposta', async () => {
    fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ resultado: {} }),
    })

    await expect(
      authenticate({ email: 'usuario@exemplo.com', senha: 'segredo' })
    ).rejects.toThrow('Token de autenticação ausente na resposta')
  })
})
