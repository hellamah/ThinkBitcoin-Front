import { apiRequest, AuthenticationEndpoint, HttpMethod } from './apiClient'

export const AuthTokenClaim = Object.freeze({
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
    if (typeof atob === 'function') {
      return atob(valor)
    }
  } catch {
    /* istanbul ignore next */
  }

  /* istanbul ignore next */
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(valor, 'base64').toString('binary')
  }

  throw new Error('Nenhum decodificador base64 disponível')
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
