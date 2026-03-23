const parseUseMockFlag = (value) => {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') return value.toLowerCase() === 'true'
  return false
}

const resolveUseMockEnv = () => {
  try {
    return import.meta.env?.VITE_USE_MOCK
  } catch {
    return undefined
  }
}

const resolveIsDevMode = () => {
  try {
    return Boolean(import.meta.env?.DEV)
  } catch {
    return false
  }
}

const resolveIsTestMode = () => {
  try {
    return import.meta.env?.MODE === 'test'
  } catch {
    return false
  }
}

const resolvedUseMockEnv = resolveUseMockEnv()

export const USE_MOCK_API =
  typeof resolvedUseMockEnv === 'undefined'
    ? resolveIsDevMode() && !resolveIsTestMode()
    : parseUseMockFlag(resolvedUseMockEnv)

const buildMockToken = () => {
  const header = { alg: 'HS256', typ: 'JWT' }
  const payload = {
    'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name': 'Usuário Mock',
    'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress': 'mock@thinkbitcoin.com',
  }

  const encode = (value) => {
    const json = JSON.stringify(value)

    if (typeof btoa === 'function') {
      return btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    }

    if (typeof Buffer !== 'undefined') {
      return Buffer.from(json).toString('base64url')
    }

    return json
  }

  return `${encode(header)}.${encode(payload)}.mock-signature`
}

const MOCK_COIN_BASE_VALUE = Object.freeze({
  BTC: 68000,
  ETH: 3500,
  ADA: 0.73,
  XRP: 0.61,
  SOL: 148,
  LINK: 18,
  BNB: 585,
  LTC: 88,
  DOGE: 0.16,
  PAXG: 2330,
})

const hashSymbol = (symbol) =>
  symbol
    .split('')
    .reduce((acc, char) => acc + char.charCodeAt(0), 0)

const buildCoinValueResponse = (symbol) => {
  const normalized = symbol.toUpperCase()
  const baseValue = MOCK_COIN_BASE_VALUE[normalized] ?? 100
  const variationFactor = ((hashSymbol(normalized) % 13) - 6) * 0.0015
  const value = Number((baseValue * (1 + variationFactor)).toFixed(2))

  return {
    mensagem: 'Mock de valor de moeda retornado com sucesso',
    resultado: {
      totalRegistros: 1,
      totalPaginas: 1,
      paginaAtual: 1,
      registros: [
        {
          valor: value,
          dataHora: new Date().toISOString(),
        }
      ],
    },
  }
}

const buildSequenceResponse = () => {
  const now = Date.now()
  const points = [
    { hour: 0, price: 68000, change: 0.008, type: 1 },
    { hour: 1, price: 67650, change: -0.005, type: 2 },
    { hour: 2, price: 68220, change: 0.0084, type: 1 },
    { hour: 3, price: 68080, change: -0.0021, type: 0 },
  ]

  return {
    mensagem: 'Mock de sequência retornado com sucesso',
    resultado: {
      totalRegistros: points.length,
      totalPaginas: 1,
      paginaAtual: 1,
      listaSequenciaRetorno: points.map((point, index) => ({
        idSequenciaRetorno: `mock-sequencia-${index + 1}`,
        dataHora: new Date(now - point.hour * 60 * 60 * 1000).toISOString(),
        valorNegociado: point.price,
        variacaoPercentual: point.change,
        tipo: point.type,
      })),
    },
  }
}

const mockHandlers = [
  {
    method: 'POST',
    match: (endpoint) => endpoint === '/ThinkBitcoin/gerarTokenBearer/',
    response: () => ({
      mensagem: 'Token mock gerado com sucesso',
      resultado: { tokenAutenticado: buildMockToken() },
    }),
  },
  {
    method: 'GET',
    match: (endpoint) => endpoint === '/ThinkBitcoin/me',
    response: () => ({
      mensagem: 'Preferências mock retornadas com sucesso',
      resultado: {
        nome: 'Usuário Mock',
        email: 'mock@thinkbitcoin.com',
        tema: 'dark',
        idioma: 'pt-BR',
        notificacoes: true,
        estiloAlgoritmo: 'balanceado',
        frequenciaAlerta: 'media',
      },
    }),
  },
  {
    method: 'POST',
    match: (endpoint) => endpoint === '/ThinkBitcoin/usuariosTB/atualizarPreferencias',
    response: () => ({ mensagem: 'Preferências mock atualizadas com sucesso' }),
  },
  {
    method: 'POST',
    match: (endpoint) => endpoint === '/ThinkBitcoin/usuariosTB/inserirConsultor',
    response: () => ({ mensagem: 'Usuário mock cadastrado com sucesso' }),
  },
  {
    method: 'GET',
    match: (endpoint) => !!endpoint.match(/^\/ThinkBitcoin\/sequenciasRetorno\/(\?.*)?$/i) || !!endpoint.match(/^\/ThinkBitcoin\/sequenciasRetorno\/[^/?]+(\?.*)?$/i),
    response: () => buildSequenceResponse(),
  },
  {
    method: 'POST',
    match: (endpoint) => endpoint === '/ThinkBitcoin/scriptComum' || endpoint === '/ThinkBitcoin/AtivadorScript/ScriptComum',
    response: () => ({
      btc: 68000,
      decision: 'BUY',
      confidence: 0.73,
      acao: 1,
    }),
  },
]

export const getMockResponse = ({ endpoint, method }) => {
  const normalizedMethod = String(method ?? 'GET').toUpperCase()
  const handler = mockHandlers.find(
    (item) => item.method === normalizedMethod && item.match(endpoint)
  )

  return handler ? handler.response(endpoint) : null
}
