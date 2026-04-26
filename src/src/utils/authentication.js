import { apiRequest, AuthenticationEndpoint, HttpMethod } from './apiClient'

export const AuthTokenClaim = Object.freeze({
  ID: 'idUsuarioTB',
  NAME: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name',
  EMAIL: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
})

const normalizeBase64 = (valor) => {
  if (typeof valor !== 'string') return null
  const sanitized = valor.replace(/-/g, '+').replace(/_/g, '/')
  const padding = (4 - (sanitized.length % 4)) % 4
  return sanitized + '='.repeat(padding)
}

const decodeBase64 = (valor) => {
  try {
    // Ambiente Node.js (comum em testes vitest)
    /* istanbul ignore next */
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(valor, 'base64').toString('utf-8')
    }

    // Ambiente Browser
    if (typeof atob === 'function') {
      const binStr = atob(valor)
      // Técnica moderna com TextDecoder
      if (typeof TextDecoder !== 'undefined') {
        const bytes = new Uint8Array(binStr.length)
        for (let i = 0; i < binStr.length; i++) {
          bytes[i] = binStr.charCodeAt(i)
        }
        return new TextDecoder().decode(bytes)
      }
      // Fallback para navegadores muito antigos (se existirem)
      return decodeURIComponent(escape(binStr))
    }
  } catch (err) {
    /* istanbul ignore next */
  }

  throw new Error('Nenhum decodificador base64 disponível ou falha na decodificação')
}

const decodeJwtPayload = (token) => {
  if (typeof token !== 'string') return null
  const partes = token.split('.')
  if (partes.length < 2) return null
  const base64 = normalizeBase64(partes[1])
  if (!base64) return null
  try {
    const decoded = decodeBase64(base64)
    return JSON.parse(decoded)
  } catch {
    return null
  }
}

export const decodeAuthenticationToken = (token) => {
  const payload = decodeJwtPayload(token)
  if (!payload) return null
  return {
    idUsuarioTB: payload[AuthTokenClaim.ID] ?? payload['sub'] ?? null,
    nome: payload[AuthTokenClaim.NAME] ?? '',
    email: payload[AuthTokenClaim.EMAIL] ?? '',
  }
}

const obterToken = (dados) => dados?.resultado?.tokenAutenticado

export const authenticate = async ({ email, senha }) => {
  const data = await apiRequest(AuthenticationEndpoint.LOGIN, {
    method: HttpMethod.POST,
    body: { email, senha },
  })

  const token = obterToken(data)
  if (!token) {
    throw new Error('Token de autenticação ausente na resposta')
  }

  return data.resultado
}

export default authenticate
