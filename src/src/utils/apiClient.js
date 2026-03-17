import { API_URL } from '../api'

export const HttpMethod = Object.freeze({
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  DELETE: 'DELETE',
})

export const ApiEndpoint = Object.freeze({
  AUTHENTICATION: Object.freeze({
    LOGIN: '/ThinkBitcoin/gerarTokenBearer/',
  }),
  USER: Object.freeze({
    ME: '/ThinkBitcoin/me',
    UPDATE_PREFERENCES: '/ThinkBitcoin/usuariosTB/atualizarPreferencias',
  }),
})

const JSON_HEADERS = Object.freeze({ 'Content-Type': 'application/json' })

const buildUrl = (endpoint) => `${API_URL}${endpoint}`

const createRequestInit = (method, headers, body) => {
  const hasBody = typeof body !== 'undefined'
  return {
    method,
    headers: hasBody ? { ...JSON_HEADERS, ...headers } : { ...headers },
    body: hasBody ? JSON.stringify(body) : undefined,
  }
}

export const apiRequest = async (
  endpoint,
  { method = HttpMethod.GET, headers = {}, body } = {}
) => {
  const response = await fetch(
    buildUrl(endpoint),
    createRequestInit(method, headers, body)
  )

  if (!response.ok) {
    const error = new Error('Falha na requisição à API')
    error.status = response.status
    throw error
  }

  if (response.status === 204) return null

  return response.json()
}

export const AuthenticationEndpoint = ApiEndpoint.AUTHENTICATION
export const UserEndpoint = ApiEndpoint.USER
