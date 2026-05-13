import { API_URL } from '../api'
import { getMockResponse, USE_MOCK_API } from './mockApi'

export const HttpMethod = Object.freeze({
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  DELETE: 'DELETE',
})

export const ApiEndpoint = Object.freeze({
  AUTHENTICATION: Object.freeze({
    LOGIN: '/ThinkBitcoin/gerarTokenBearer',
  }),
  USER: Object.freeze({
    ME: (id) => `/ThinkBitcoin/usuariosTB/${id}`,
    LIST: '/ThinkBitcoin/usuariosTB/',
    CREATE: '/ThinkBitcoin/usuariosTB/',
    DELETE: (id) => `/ThinkBitcoin/usuariosTB/${id}`,
    CHANGE_PASSWORD: '/ThinkBitcoin/usuariosTB/AlterarSenha',
  }),
  PREFERENCES: Object.freeze({
    ALL: '/ThinkBitcoin/preferencias',
    MINE: '/ThinkBitcoin/preferencias/minhas',
    BY_ID: (id) => `/ThinkBitcoin/preferencias/${id}`,
  }),
  MARKET: Object.freeze({
    COIN_LIST: '/ThinkBitcoin/moedas',
    COIN_VALUE: (symbol) => `/ThinkBitcoin/moeda/${symbol}/valor`,
    SCRIPT_COMMON: '/ThinkBitcoin/AtivadorScript/ScriptComum',
    RETURN_SEQUENCE: (id = '') => `/ThinkBitcoin/sequenciasRetorno/${id}`,
    EXCHANGES: '/ThinkBitcoin/exchanges',
  }),
  CARGO: Object.freeze({
    UPDATE: '/ThinkBitcoin/CargoUsuarioTB/AlterarCargoUsuarioTB/',
  }),
  VARIAVEL_EXTERNA: Object.freeze({
    FEAR_GREED: '/ThinkBitcoin/variavel-externa/fear-greed',
    TREND: '/ThinkBitcoin/variavel-externa/trend',
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
  { method = HttpMethod.GET, headers = {}, body, signal } = {}
) => {
  if (USE_MOCK_API) {
    const mockResponse = getMockResponse({ endpoint, method, body })
    if (mockResponse) return mockResponse
  }

  // Intercepta endpoints em desenvolvimento para evitar poluição de erros 404 no console
  if (endpoint.includes('fear-greed') || endpoint.includes('trend')) {
    return Promise.reject(new Error('Backend endpoint not implemented yet - Intercepted to prevent 404 log'))
  }

  const response = await fetch(
    buildUrl(endpoint),
    { ...createRequestInit(method, headers, body), signal }
  )

  if (!response.ok) {
    if (response.status === 401 && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('auth-expired'))
    }
    const error = new Error('Falha na requisição à API')
    error.status = response.status
    throw error
  }

  if (response.status === 204) return null

  return response.json()
}

export const AuthenticationEndpoint = ApiEndpoint.AUTHENTICATION
export const UserEndpoint = ApiEndpoint.USER
export const MarketEndpoint = ApiEndpoint.MARKET
export const PreferencesEndpoint = ApiEndpoint.PREFERENCES
export const CargoEndpoint = ApiEndpoint.CARGO
export const VariavelExternaEndpoint = ApiEndpoint.VARIAVEL_EXTERNA
