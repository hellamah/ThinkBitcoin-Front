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
    LIST: '/ThinkBitcoin/usuariosTB', // PUT for multiple update
    REGISTER_CONSULTANT: '/ThinkBitcoin/usuariosTB/inserirConsultor',
    REGISTER_MINER: '/ThinkBitcoin/usuariosTB/inserirMinerador',
    DELETE: (id) => `/ThinkBitcoin/usuariosTB/${id}`,
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
    UPDATE: '/ThinkBitcoin/CargoUsuarioTB/AlterarCargoUsuarioTB',
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
    const mockResponse = getMockResponse({ endpoint, method })
    if (mockResponse) return mockResponse
  }

  const response = await fetch(
    buildUrl(endpoint),
    { ...createRequestInit(method, headers, body), signal }
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
export const MarketEndpoint = ApiEndpoint.MARKET
export const PreferencesEndpoint = ApiEndpoint.PREFERENCES
export const CargoEndpoint = ApiEndpoint.CARGO
