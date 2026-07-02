import { API_URL } from '../api'
import { getMockResponse, USE_MOCK_API } from './mockApi'
import { getCache, setCache } from './cache'

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
    RECUPERAR_SENHA: '/ThinkBitcoin/usuariosTB/recuperar-senha',
    REDEFINIR_SENHA: '/ThinkBitcoin/usuariosTB/redefinir-senha',
    ENVIAR_BOAS_VINDAS: '/ThinkBitcoin/usuariosTB/enviar-boas-vindas',
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
    TREND_HEATMAP: '/ThinkBitcoin/variavel-externa/trend/heatmap',
  }),
  PATRIMONIO: Object.freeze({
    BY_USER: (id) => `/ThinkBitcoin/patrimonio/${id}`,
    CREATE: '/ThinkBitcoin/patrimonio',
  }),
  PLANOS_PAGAMENTO: Object.freeze({
    LIST: '/ThinkBitcoin/planos-pagamento',
    MIGRATE: '/ThinkBitcoin/planos-pagamento/migrar',
  }),
  TREINAMENTO_EPISODIO: Object.freeze({
    LIST: ({ moeda, dataInicio, dataFim, pagina, quantidade, ordenarAscendente } = {}) => {
      const params = new URLSearchParams()
      if (moeda) params.set('moeda', moeda)
      if (dataInicio) params.set('dataInicio', dataInicio)
      if (dataFim) params.set('dataFim', dataFim)
      if (pagina != null) params.set('pagina', String(pagina))
      if (quantidade != null) params.set('quantidade', String(quantidade))
      if (ordenarAscendente != null) params.set('ordenarAscendente', String(ordenarAscendente))
      const qs = params.toString()
      return qs ? `/api/TreinamentoEpisodio?${qs}` : '/api/TreinamentoEpisodio'
    },
    RESUMO: ({ moeda, dataInicio, dataFim } = {}) => {
      const params = new URLSearchParams()
      if (moeda) params.set('moeda', moeda)
      if (dataInicio) params.set('dataInicio', dataInicio)
      if (dataFim) params.set('dataFim', dataFim)
      const qs = params.toString()
      return qs ? `/api/TreinamentoEpisodio/resumo?${qs}` : '/api/TreinamentoEpisodio/resumo'
    },
    SERIE: ({ moeda, dataInicio, dataFim, janela, limite } = {}) => {
      const params = new URLSearchParams()
      if (moeda) params.set('moeda', moeda)
      if (dataInicio) params.set('dataInicio', dataInicio)
      if (dataFim) params.set('dataFim', dataFim)
      if (janela != null) params.set('janela', String(janela))
      if (limite != null) params.set('limite', String(limite))
      const qs = params.toString()
      return qs ? `/api/TreinamentoEpisodio/serie?${qs}` : '/api/TreinamentoEpisodio/serie'
    },
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
  {
    method = HttpMethod.GET,
    headers = {},
    body,
    signal,
    useCache = false,
    ttl,
    cacheKey,
    forceRefresh = false,
    suppressAuthRedirect = false,
  } = {}
) => {
  const isGet = method === HttpMethod.GET
  const key = cacheKey || `api_cache_${endpoint}`

  if (useCache && isGet && !forceRefresh) {
    const cachedData = getCache(key)
    if (cachedData !== null) {
      return cachedData
    }
  }

  if (USE_MOCK_API) {
    const mockResponse = getMockResponse({ endpoint, method, body })
    if (mockResponse) {
      if (useCache && isGet) {
        setCache(key, mockResponse, ttl)
      }
      return mockResponse
    }
  }

  const response = await fetch(
    buildUrl(endpoint),
    { ...createRequestInit(method, headers, body), signal }
  )

  if (!response.ok) {
    if (response.status === 401 && !suppressAuthRedirect && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('auth-expired'))
    }
    const error = new Error('Falha na requisição à API')
    error.status = response.status
    throw error
  }

  if (response.status === 204) return null

  const data = await response.json()
  if (useCache && isGet) {
    setCache(key, data, ttl)
  }

  return data
}

export const AuthenticationEndpoint = ApiEndpoint.AUTHENTICATION
export const UserEndpoint = ApiEndpoint.USER
export const MarketEndpoint = ApiEndpoint.MARKET
export const PreferencesEndpoint = ApiEndpoint.PREFERENCES
export const CargoEndpoint = ApiEndpoint.CARGO
export const VariavelExternaEndpoint = ApiEndpoint.VARIAVEL_EXTERNA
export const PatrimonioEndpoint = ApiEndpoint.PATRIMONIO
export const PlanosPagamentoEndpoint = ApiEndpoint.PLANOS_PAGAMENTO
export const TreinamentoEpisodioEndpoint = ApiEndpoint.TREINAMENTO_EPISODIO
