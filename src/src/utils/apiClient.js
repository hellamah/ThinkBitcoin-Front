import { API_URL } from '../api'
import { USE_MOCK_API } from './mockFlag'
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
    // Reemite o token com os claims atuais (o cargo muda ao trocar de plano).
    RENOVAR: '/ThinkBitcoin/gerarTokenBearer/renovar',
  }),
  USER: Object.freeze({
    ME: (id) => `/ThinkBitcoin/usuariosTB/${id}`,
    LIST: '/ThinkBitcoin/usuariosTB/',
    CREATE: '/ThinkBitcoin/usuariosTB/',
    DELETE: (id) => `/ThinkBitcoin/usuariosTB/${id}`,
    // Autoatendimento: o backend resolve o usuário pelo token, sem id na rota.
    UPDATE_PROFILE: '/ThinkBitcoin/usuariosTB/meu-perfil',
    DELETE_ACCOUNT: '/ThinkBitcoin/usuariosTB/excluir-conta',
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
  ALERTA_PRECO: Object.freeze({
    LIST: '/ThinkBitcoin/alertas-preco',
    CREATE: '/ThinkBitcoin/alertas-preco',
    DELETE: (id) => `/ThinkBitcoin/alertas-preco/${id}`,
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

/**
 * Teto de candles que `/moeda/{sigla}/valor` aceita por requisição.
 *
 * Espelha o `FuncaoObterValorMoeda.QuantidadeMaxima` do backend. Acima disto a
 * API responde 400 — antes ela aceitava qualquer número e materializava o
 * resultado inteiro em memória, que era o problema que o teto resolveu.
 *
 * Está aqui, e não no DashboardContext, porque é contrato da API e não escolha
 * de tela: qualquer consumidor futuro precisa respeitá-lo. Na cadência horária
 * da coleta são cerca de 208 dias.
 */
export const QUANTIDADE_MAXIMA_CANDLES = 5000

const JSON_HEADERS = Object.freeze({ 'Content-Type': 'application/json' })

// A API .NET ora serializa em PascalCase, ora em camelCase. Normalizar aqui,
// na fronteira, dispensa cadeias defensivas como `resultado ?? Resultado` no
// resto do código. Só converte chaves no padrão PascalCase clássico (maiúscula
// seguida de minúscula) para não corromper chaves-código como "BTC" ou "US".
const PASCAL_KEY = /^[A-Z][a-z]/

// Carimbo ISO 8601 sem nenhuma marca de fuso: "2026-08-14T11:00:00", com ou sem
// fração de segundo. O `$` é essencial — um valor que já termine em Z ou em
// ±hh:mm não casa e passa intacto.
const ISO_SEM_FUSO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/

/**
 * Marca como UTC o carimbo que a API entrega sem fuso.
 *
 * A API .NET serializa `DateTime` sem sufixo quando o Kind é `Unspecified` —
 * que é o que o EF Core devolve ao ler `datetime2`. Os valores SÃO UTC
 * (`HoraReferencia` vem de `dataHoraAberturaUtc` da Binance), mas sem a marca
 * `new Date()` os interpreta como hora LOCAL. Numa máquina em UTC-3, todo
 * instante do produto nascia três horas deslocado.
 *
 * O desvio passava despercebido porque era uniforme: rótulo e filtro erravam
 * juntos, então a tela parecia coerente consigo mesma. Aparecia só na borda —
 * escolher "1 de abril" trazia candles a partir das 21h de 31 de março, e o
 * mock (que emite `toISOString()`, com Z) se comportava diferente da produção.
 *
 * Corrigir aqui, na fronteira, em vez de em cada `new Date(...)` espalhado:
 * são mais de trinta pontos de leitura, e o próximo a ser escrito voltaria a
 * errar. Depois disto, todo consumidor recebe um carimbo que `new Date()` lê
 * corretamente, sem precisar saber de nada disso.
 */
const marcarUtcQuandoFaltarFuso = (value) =>
  typeof value === 'string' && ISO_SEM_FUSO.test(value) ? `${value}Z` : value

export const normalizeApiKeys = (value) => {
  if (Array.isArray(value)) return value.map(normalizeApiKeys)
  if (value === null || typeof value !== 'object') return marcarUtcQuandoFaltarFuso(value)
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

/**
 * Efeitos colaterais que um status de erro dispara, independentemente de a
 * resposta ter vindo da API ou do mock.
 *
 * Extraído para que os dois caminhos não divirjam: enquanto isto vivia só
 * dentro do bloco de `fetch`, o modo demo não tinha como expirar sessão nem
 * abrir o convite de assinatura, e um 403 mockado passava batido.
 */
const notificarStatusDeErro = (status, endpoint, suppressAuthRedirect) => {
  if (typeof window === 'undefined') return

  if (status === 401 && !suppressAuthRedirect) {
    window.dispatchEvent(new CustomEvent('auth-expired'))
  }

  // 403 = autenticado mas sem o cargo exigido: recurso de assinatura paga.
  // O Layout escuta este evento e exibe o convite para migrar de plano.
  if (status === 403) {
    window.dispatchEvent(new CustomEvent('subscription-required', { detail: { endpoint } }))
  }
}

/**
 * Padroniza o erro para o formato que os consumidores esperam: `status`,
 * `hasBackendMessage` e uma mensagem sempre preenchida.
 *
 * `hasBackendMessage` é o que autoriza a tela a exibir o texto como veio, em
 * vez de trocá-lo pela frase genérica dela. Sem esta marca, uma mensagem
 * precisa ("Você já tem um alerta ativo neste valor") chega à interface
 * indistinguível de uma falha de rede.
 */
const montarErroDeApi = (mensagem, status) => {
  const texto = typeof mensagem === 'string' ? mensagem.trim() : ''
  const error = new Error(texto || 'Falha na requisição à API')
  error.status = status
  error.hasBackendMessage = Boolean(texto)
  return error
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
    // Import dinâmico: em produção a flag é estaticamente falsa e o Rollup joga
    // o mockApi num chunk separado, que o navegador nunca chega a buscar.
    const { getMockResponse } = await import('./mockApi')

    let mockResponse
    try {
      mockResponse = getMockResponse({ endpoint, method, body })
    } catch (mockError) {
      // Os handlers do mock recusam entrada inválida lançando um Error com
      // `status`, imitando o 400 da API. Sem este catch a exceção escapava crua:
      // o erro chegava sem `hasBackendMessage`, e a tela — que só confia no
      // texto quando essa marca existe — descartava a mensagem específica e
      // exibia "tente novamente" no lugar dela.
      const status = Number.isInteger(mockError?.status) ? mockError.status : 400
      notificarStatusDeErro(status, endpoint, suppressAuthRedirect)
      throw montarErroDeApi(mockError?.message, status)
    }

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
    notificarStatusDeErro(response.status, endpoint, suppressAuthRedirect)
    throw montarErroDeApi(await extractErrorMessage(response), response.status)
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
export const AlertaPrecoEndpoint = ApiEndpoint.ALERTA_PRECO
export const PlanosPagamentoEndpoint = ApiEndpoint.PLANOS_PAGAMENTO
export const TreinamentoEpisodioEndpoint = ApiEndpoint.TREINAMENTO_EPISODIO
