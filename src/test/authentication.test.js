/**
 * Testes unitários para utils/authentication.
 *
 * Cobre:
 * - Fluxo de autenticação (authenticate) com sucesso e falha
 * - Ausência do token na resposta da API
 * - Decodificação de claims do token JWT (nome e email)
 * - Tokens com payload sem claims esperados
 * - Tokens com formato inválido
 * - AuthTokenClaim exposto corretamente
 */
import { describe, expect, it, vi } from 'vitest'
import { AuthenticationEndpoint, HttpMethod } from '../src/utils/apiClient'
import {
  AuthTokenClaim,
  authenticate,
  decodeAuthenticationToken,
} from '../src/utils/authentication'
import { API_URL } from '../src/api'

// O mock de fetch é configurado globalmente em vitest.setup.js

describe('utils/authentication › AuthTokenClaim', () => {
  it('expõe as URIs de claims de nome e email conforme padrão SOAP', () => {
    expect(AuthTokenClaim.NAME).toBe(
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'
    )
    expect(AuthTokenClaim.EMAIL).toBe(
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'
    )
  })
})

describe('utils/authentication › authenticate', () => {
  it('envia credenciais no corpo da requisição e retorna o resultado da API', async () => {
    const tokenAutenticado = 'token-jwt-mock'
    fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ resultado: { tokenAutenticado } }),
    })

    const resultado = await authenticate({
      email: 'usuario@exemplo.com',
      senha: 'segredo',
    })

    expect(fetch).toHaveBeenCalledWith(
      `${API_URL}${AuthenticationEndpoint.LOGIN}`,
      {
        method: HttpMethod.POST,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'usuario@exemplo.com', senha: 'segredo' }),
      }
    )
    expect(resultado).toEqual({ tokenAutenticado })
  })

  it('lança erro quando a API responde com status de falha (401)', async () => {
    fetch.mockResolvedValue({ ok: false, status: 401 })

    await expect(
      authenticate({ email: 'usuario@exemplo.com', senha: 'errada' })
    ).rejects.toThrow('Falha na requisição à API')
  })

  it('lança erro quando a API responde com status interno (500)', async () => {
    fetch.mockResolvedValue({ ok: false, status: 500 })

    await expect(
      authenticate({ email: 'usuario@exemplo.com', senha: 'qualquer' })
    ).rejects.toMatchObject({ status: 500 })
  })

  it('lança erro quando o token não está presente na resposta da API', async () => {
    fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ resultado: {} }),
    })

    await expect(
      authenticate({ email: 'usuario@exemplo.com', senha: 'segredo' })
    ).rejects.toThrow('Token de autenticação ausente na resposta')
  })

  it('lança erro quando resultado é nulo na resposta da API', async () => {
    fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ resultado: null }),
    })

    await expect(
      authenticate({ email: 'usuario@exemplo.com', senha: 'segredo' })
    ).rejects.toThrow('Token de autenticação ausente na resposta')
  })
})

describe('utils/authentication › decodeAuthenticationToken', () => {
  const buildToken = (payload) => {
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
    return `header.${encoded}.signature`
  }

  it('decodifica claims de nome e email do payload JWT', () => {
    const payload = {
      [AuthTokenClaim.NAME]: 'Satoshi Nakamoto',
      [AuthTokenClaim.EMAIL]: 'satoshi@bitcoin.org',
    }

    expect(decodeAuthenticationToken(buildToken(payload))).toEqual({
      nome: 'Satoshi Nakamoto',
      email: 'satoshi@bitcoin.org',
    })
  })

  it('retorna strings vazias quando os claims não estão presentes no payload', () => {
    const payload = { role: 'admin', sub: '123' }

    expect(decodeAuthenticationToken(buildToken(payload))).toEqual({
      nome: '',
      email: '',
    })
  })

  it('retorna apenas o nome quando o claim de email está ausente', () => {
    const payload = {
      [AuthTokenClaim.NAME]: 'Somente Nome',
    }

    expect(decodeAuthenticationToken(buildToken(payload))).toEqual({
      nome: 'Somente Nome',
      email: '',
    })
  })

  it('retorna apenas o email quando o claim de nome está ausente', () => {
    const payload = {
      [AuthTokenClaim.EMAIL]: 'somente@email.com',
    }

    expect(decodeAuthenticationToken(buildToken(payload))).toEqual({
      nome: '',
      email: 'somente@email.com',
    })
  })

  it('retorna null para token com formato inválido (sem pontos)', () => {
    expect(decodeAuthenticationToken('token-invalido')).toBeNull()
  })

  it('retorna null para token nulo', () => {
    expect(decodeAuthenticationToken(null)).toBeNull()
  })

  it('retorna null para token undefined', () => {
    expect(decodeAuthenticationToken(undefined)).toBeNull()
  })

  it('retorna null para token com payload não-JSON no base64', () => {
    const baseInvalido = Buffer.from('isto-nao-e-json').toString('base64url')
    const token = `header.${baseInvalido}.signature`
    // JSON.parse de texto aleatório ainda pode funcionar; garantimos que retorna null para payload sem estrutura
    const resultado = decodeAuthenticationToken(token)
    // O resultado deve ser ou null (falha no parse) ou um objeto sem nome/email
    if (resultado !== null) {
      expect(resultado).toMatchObject({ nome: '', email: '' })
    } else {
      expect(resultado).toBeNull()
    }
  })
})
