import { API_URL } from '../api'
import { getMockResponse, USE_MOCK_API } from './mockApi'
import { getCache, setCache } from './cache'
import { getStoredToken } from './preferences'

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
    COIN_VALUE: (symbol, { dataInicio, dataFim, pagina, quantidade, ordemAsc } = {}) => {
      const params = new URLSearchParams()
      if (dataInicio) params.set('dataInicio', dataInicio)
      if (dataFim) params.set('dataFim', dataFim)
      if (pagina != null) params.set('pagina', String(pagina))
      if (quantidade != null) params.set('quantidade', String(quantidade))
      if (ordemAsc != null) params.set('ordemAsc', String(ordemAsc))
      const qs = params.toString()
      return qs ? `/ThinkBitcoin/moeda/${symbol}/valor?${qs}` : `/ThinkBitcoin/moeda/${symbol}/valor`
    },
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
    // Fluxo de pagamento Pix: o checkout cria uma cobrança no gateway (via
    // backend), o front exibe o QR code e faz polling do status. A ativação
    // do plano acontece no backend, via webhook do gateway — nunca aqui.
    CHECKOUT: '/ThinkBitcoin/planos-pagamento/checkout',
    COBRANCA: (id) => `/ThinkBitcoin/planos-pagamento/cobranca/${id}`,
    COBRANCA_PENDENTE: '/ThinkBitcoin/planos-pagamento/cobranca/pendente',
  }),
  TREINAMENTO_EPISODIO: Object.freeze({
    LIST: ({ moeda, versaoModelo, dataInicio, dataFim, pagina, quantidade, ordenarAscendente } = {}) => {
      const params = new URLSearchParams()
      if (moeda) params.set('moeda', moeda)
      if (versaoModelo) params.set('versaoModelo', versaoModelo)
      if (dataInicio) params.set('dataInicio', dataInicio)
      if (dataFim) params.set('dataFim', dataFim)
      if (pagina != null) params.set('pagina', String(pagina))
      if (quantidade != null) params.set('quantidade', String(quantidade))
      if (ordenarAscendente != null) params.set('ordenarAscendente', String(ordenarAscendente))
      const qs = params.toString()
      return qs ? `/api/TreinamentoEpisodio?${qs}` : '/api/TreinamentoEpisodio'
    },
    RESUMO: ({ moeda, versaoModelo, dataInicio, dataFim } = {}) => {
      const params = new URLSearchParams()
      if (moeda) params.set('moeda', moeda)
      if (versaoModelo) params.set('versaoModelo', versaoModelo)
      if (dataInicio) params.set('dataInicio', dataInicio)
      if (dataFim) params.set('dataFim', dataFim)
      const qs = params.toString()
      return qs ? `/api/TreinamentoEpisodio/resumo?${qs}` : '/api/TreinamentoEpisodio/resumo'
    },
    SERIE: ({ moeda, versaoModelo, dataInicio, dataFim, janela, limite } = {}) => {
      const params = new URLSearchParams()
      if (moeda) params.set('moeda', moeda)
      if (versaoModelo) params.set('versaoModelo', versaoModelo)
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

// A API .NET ora serializa em PascalCase, ora em camelCase. Normalizar aqui,
// na fronteira, dispensa cadeias defensivas como `resultado ?? Resultado` no
// resto do código. Só converte chaves no padrão PascalCase clássico (maiúscula
// seguida de minúscula) para não corromper chaves-código como "BTC" ou "US".
const PASCAL_KEY = /^[A-Z][a-z]/

export const normalizeApiKeys = (value) => {
  if (Array.isArray(value)) return value.map(normalizeApiKeys)
  if (value === null || typeof value !== 'object') return value
  const out = {}
  for (const [key, val] of Object.entries(value)) {
    const camel = PASCAL_KEY.test(key)
      ? key.charAt(0).toLowerCase() + key.slice(1)
      : key
    // Se a resposta trouxer as duas variantes, a camelCase original prevalece.
    if (camel !== key && Object.prototype.hasOwnProperty.call(value, camel)) continue
    out[camel] = normalizeApiKeys(val)
  }
  return out
}

const buildUrl = (endpoint) => `${API_URL}${endpoint}`

const createRequestInit = (method, headers, body) => {
  const hasBody = typeof body !== 'undefined'
  return {
    method,
    headers: hasBody ? { ...JSON_HEADERS, ...headers } : { ...headers },
    body: hasBody ? JSON.stringify(body) : undefined,
  }
}

// Anexa o Bearer token armazenado quando o caller não define Authorization.
// Endpoints públicos (login, recuperação de senha) funcionam igual: sem token
// armazenado, nada é anexado.
const withAuthHeader = (headers) => {
  if (headers.Authorization || headers.authorization) return headers
  const token = getStoredToken()
  return token ? { ...headers, Authorization: `Bearer ${token}` } : headers
}

// Extrai a mensagem de erro do corpo da resposta, quando o backend enviar uma.
const extractErrorMessage = async (response) => {
  try {
    const body = normalizeApiKeys(await response.json())
    const msg = body?.mensagem ?? body?.message ?? body?.erro ?? null
    if (typeof msg === 'string' && msg.trim()) return msg.trim()
    if (Array.isArray(body?.erros) && body.erros.length > 0) return body.erros.join('; ')
  } catch {
    /* corpo vazio ou não-JSON */
  }
  return null
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
      const normalizedMock = normalizeApiKeys(mockResponse)
      if (useCache && isGet) {
        setCache(key, normalizedMock, ttl)
      }
      return normalizedMock
    }
  }

  const response = await fetch(
    buildUrl(endpoint),
    { ...createRequestInit(method, withAuthHeader(headers), body), signal }
  )

  if (!response.ok) {
    if (response.status === 401 && !suppressAuthRedirect && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('auth-expired'))
    }
    const backendMessage = await extractErrorMessage(response)
    const error = new Error(backendMessage || 'Falha na requisição à API')
    error.status = response.status
    error.hasBackendMessage = Boolean(backendMessage)
    throw error
  }

  if (response.status === 204) return null

  const data = normalizeApiKeys(await response.json())
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
