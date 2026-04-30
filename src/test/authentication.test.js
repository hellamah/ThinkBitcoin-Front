/**
 * Testes unitários para utils/authentication.
 * 
 * Este conjunto de testes valida o fluxo de segurança, login e decodificação 
 * de identidade (JWT) do ecossistema ThinkBitcoin.
 */
import { describe, expect, it, vi } from 'vitest'
import { AuthenticationEndpoint, HttpMethod } from '../src/utils/apiClient'
import {
  AuthTokenClaim,
  authenticate,
  decodeAuthenticationToken,
} from '../src/utils/authentication'
import { API_URL } from '../src/api'

// Mock de fetch global é configurado em vitest.setup.js

describe('utils/authentication › AuthTokenClaim (Mapeamento de Claims)', () => {
  it('deve expor as URIs de claims de nome e email seguindo o padrão SOAP/JWT', () => {
    expect(AuthTokenClaim.NAME).toBe(
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'
    )
    expect(AuthTokenClaim.EMAIL).toBe(
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'
    )
  })
})

describe('utils/authentication › authenticate (Fluxo de Login)', () => {
  const credenciaisMock = { email: 'investidor@think.com', senha: '123' }

  it('deve enviar credenciais via POST e retornar o token de sucesso da API', async () => {
    const tokenAutenticado = 'jwt-valid-token'
    fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ resultado: { tokenAutenticado } }),
    })

    const resultado = await authenticate(credenciaisMock)

    expect(fetch).toHaveBeenCalledWith(
      `${API_URL}${AuthenticationEndpoint.LOGIN}`,
      expect.objectContaining({
        method: HttpMethod.POST,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credenciaisMock),
      })
    )
    expect(resultado).toEqual({ tokenAutenticado })
  })

  it('deve lançar erro de autorização ao receber 401 da API', async () => {
    fetch.mockResolvedValue({ ok: false, status: 401 })
    await expect(authenticate(credenciaisMock)).rejects.toThrow('Falha na requisição à API')
  })

  it('deve lançar erro específico quando o token estiver ausente no corpo da resposta', async () => {
    fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ resultado: {} }), // Resposta vazia
    })

    await expect(authenticate(credenciaisMock)).rejects.toThrow('Token de autenticação ausente na resposta')
  })
})

describe('utils/authentication › decodeAuthenticationToken (Decodificação JWT)', () => {
  // Utilitário para construir tokens mockados simplificados
  const buildToken = (payload) => {
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
    return `header.${encoded}.signature`
  }

  it('deve extrair nome e email de um payload JWT válido', () => {
    const payload = {
      [AuthTokenClaim.NAME]: 'Satoshi Nakamoto',
      [AuthTokenClaim.EMAIL]: 'satoshi@bitcoin.org',
    }
    expect(decodeAuthenticationToken(buildToken(payload))).toEqual({
      idUsuarioTB: null,
      nome: 'Satoshi Nakamoto',
      email: 'satoshi@bitcoin.org',
    })
  })

  it('deve lidar corretamente com codificação UTF-8 (acentuação em nomes)', () => {
    const payload = {
      [AuthTokenClaim.NAME]: 'Helamã Borges',
      [AuthTokenClaim.EMAIL]: 'helama@think.com',
    }
    expect(decodeAuthenticationToken(buildToken(payload))).toEqual({
      idUsuarioTB: null,
      nome: 'Helamã Borges',
      email: 'helama@think.com',
    })
  })

  it('deve retornar strings vazias se as claims esperadas não existirem no token', () => {
    const payload = { sub: '12345', role: 'guest' }
    expect(decodeAuthenticationToken(buildToken(payload))).toEqual({
      idUsuarioTB: '12345',
      nome: '',
      email: '',
    })
  })

  it('deve retornar null para tokens com formato estrutural inválido', () => {
    expect(decodeAuthenticationToken('invalid_token_no_dots')).toBeNull()
    expect(decodeAuthenticationToken(null)).toBeNull()
  })

  it('deve ser resiliente a payloads que não são JSON válido codificado em base64', () => {
    const badBase64 = Buffer.from('raw-text-not-json').toString('base64url')
    const token = `h.${badBase64}.s`
    // Espera-se que retorne null (falha no decode/parse) ou objeto vazio padrão
    const res = decodeAuthenticationToken(token)
    if (res) {
      expect(res).toMatchObject({ nome: '', email: '' })
    } else {
      expect(res).toBeNull()
    }
  })
})
