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

export const USE_MOCK_API = false

const buildMockToken = () => {
  const header = { alg: 'HS256', typ: 'JWT' }
  const payload = {
    'idUsuarioTB': 'b282e124-4dd8-4ccd-a9c6-5b6b0c324a50',
    'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name': 'Helama Borges',
    'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress': 'helama@thinkbitcoin.com',
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
  const variationFactor = ((hashSymbol(normalized) % 17) - 8) * 0.0025
  const value = Number((baseValue * (1 + variationFactor)).toFixed(2))

  return {
    mensagem: 'Operação realizada com sucesso',
    resultado: {
      totalRegistros: 1,
      totalPaginas: 1,
      paginaAtual: 1,
      registros: [
        {
          precoFechamento: value,
          horaReferencia: new Date().toISOString(),
          precoMaior: value * 1.01,
          precoMedio: value * 0.995,
          precoMenor: value * 0.98,
          precoAbertura: value * 0.99,
          precoAmplitude: value * 0.03,
          precoPercentualVariacao: variationFactor * 100,
          precoRatioCompraVenda: 1.5,
          precoTotalNegociada: value * 1000,
          precoVolume: 150.5,
          precoDeltaUltimoAbertura: value * 0.01,
          precoVariacaoAbsoluta: value * 0.01,
          precoCorpoCandle: value * 0.01,
          precoSombraSuperior: value * 0.005,
          precoSombraInferior: value * 0.005,
          precoDirecao: variationFactor >= 0 ? 1 : -1,
          precoVolatilidadePercentual: 0.5,
          precoFinanceiroPorTrade: 450.0,
          quantidadeNegociada: 150.5,
          volumeComprado: 90.3,
          volumeVendido: 60.2,
          dominanciaCompradoraPercentual: 60.0,
          dominanciaVendedoraPercentual: 40.0,
          volumeDelta: 30.1,
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
        idSequenciaRetorno: `00000000-0000-4000-a000-00000000000${index + 1}`,
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
    match: (endpoint) => endpoint === '/ThinkBitcoin/gerarTokenBearer',
    response: () => {
      // Cria um payload mock no padrão JWT para o decode da aplicação
      const payload = {
        'idUsuarioTB': 'b282e124-4dd8-4ccd-a9c6-5b6b0c324a50',
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name': 'Helama Teste',
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress': 'ssssssshelamaborges@gmail.com'
      }
      const base64Payload = btoa(JSON.stringify(payload))
      return {
        mensagem: 'Token mock gerado com sucesso',
        resultado: { tokenAutenticado: `header.${base64Payload}.signature` },
      }
    },
  },
  {
    method: 'GET',
    match: (endpoint) => endpoint === '/ThinkBitcoin/preferencias/minhas',
    response: () => ({
      mensagem: 'Preferências mock retornadas com sucesso',
      resultado: {
        idPreferenciasUsuarioTB: 'b282e124-4dd8-4ccd-a9c6-5b6b0c324a50',
        nome: 'Helama Teste',
        email: 'ssssssshelamaborges@gmail.com',
        tema: 'dark',
        idioma: 'pt',
        notificacoes: true,
        estiloAlgoritmo: 'equilibrado',
        frequenciaReview: 'diaria',
        siglaMoedaPreferida: 'BTC',
        siglaEmpresaExterna: 'MB',
        investimentoInicial: 1000.0,
        riscoMaximoPerda: 2.5,
        perfilRisco: 'moderado',
        siglaMoedaUltimaInteracaoIA: 'ETH',
        dataUltimaInteracaoIA: new Date().toISOString()
      },
    }),
  },
  {
    method: 'GET',
    match: (endpoint) => !!endpoint.match(/^\/ThinkBitcoin\/usuariosTB\/\d+(\?.*)?$/),
    response: () => ({
      mensagem: 'Usuário mock retornado com sucesso',
      resultado: {
        listaUsuarioTB: [
          { nome: 'Helama Borges', email: 'helama@thinkbitcoin.com' }
        ]
      }
    }),
  },
  {
    method: 'PUT',
    match: (endpoint) => endpoint === '/ThinkBitcoin/preferencias',
    response: (endpoint, body) => {
      console.log('Mock PUT Preferences:', body);
      return { mensagem: 'Preferências mock atualizadas com sucesso' };
    },
  },
  {
    method: 'POST',
    match: (endpoint) => endpoint === '/ThinkBitcoin/usuariosTB/',
    response: () => ({ mensagem: 'Usuário mock cadastrado com sucesso' }),
  },
  {
    method: 'GET',
    match: (endpoint) => !!endpoint.match(/^\/ThinkBitcoin\/sequenciasRetorno\/(\?.*)?$/i) || !!endpoint.match(/^\/ThinkBitcoin\/sequenciasRetorno\/[^/?]+(\?.*)?$/i),
    response: () => buildSequenceResponse(),
  },
  {
    method: 'POST',
    match: (endpoint) => endpoint === '/ThinkBitcoin/AtivadorScript/ScriptComum',
    response: () => ({
      btc: 68000,
      decision: 'BUY',
      confidence: 0.73,
      acao: 1,
    }),
  },
  {
    method: 'GET',
    match: (endpoint) => !!endpoint.match(/^\/ThinkBitcoin\/moeda\/[^/]+\/valor(\?.*)?$/i),
    response: (endpoint) => {
      const match = endpoint.match(/\/moeda\/([^/]+)\/valor/i)
      const symbol = match ? match[1] : 'BTC'
      return buildCoinValueResponse(symbol)
    },
  },
  {
    method: 'GET',
    match: (endpoint) => endpoint === '/ThinkBitcoin/exchanges',
    response: () => ({
      mensagem: 'Exchanges mock retornadas com sucesso',
      resultado: [
        { id: '1', nome: 'Mercado Bitcoin', sigla: 'MB' },
        { id: '2', nome: 'Binance', sigla: 'BNB' },
        { id: '3', nome: 'Coinbase', sigla: 'CB' },
      ],
    }),
  },
  {
    method: 'POST',
    match: (endpoint) => endpoint === '/ThinkBitcoin/debate',
    response: (endpoint, body) => {
      console.log('Mock POST Debate Triggered:', body);
      return { 
        mensagem: 'Debate iniciado com sucesso via fila RabbitMQ',
        resultado: true 
      };
    },
  },
  {
    method: 'GET',
    match: (endpoint) => !!endpoint.match(/^\/ThinkBitcoin\/variavel-externa\/fear-greed(\?.*)?$/i),
    response: () => ({
      mensagem: 'Fear & Greed Index mock retornado com sucesso',
      resultado: {
        totalRegistros: 1,
        totalPaginas: 1,
        paginaAtual: 1,
        registros: [
          {
            valor: 75,
            classificacao: 'Greed',
            horaReferencia: new Date().toISOString(),
          }
        ]
      }
    }),
  },
  {
    method: 'GET',
    match: (endpoint) => !!endpoint.match(/^\/ThinkBitcoin\/variavel-externa\/trend(\?.*)?$/i),
    response: () => ({
      mensagem: 'Trend mock retornado com sucesso',
      resultado: {
        totalRegistros: 1,
        totalPaginas: 1,
        paginaAtual: 1,
        registros: [
          {
            valorAtual: 130,
            mA5: 120,
            mA15: 121,
            delta5: 19,
            delta15: 33,
            volatilidade15: 30.45,
            minutosDesdePico: 115,
            rankNoMinuto: 6,
            geoTop1Code: 'CH',
            geoTop1Value: 100,
            horaReferencia: new Date().toISOString(),
          }
        ]
      }
    }),
  },
]

export const getMockResponse = ({ endpoint, method, body }) => {
  const normalizedMethod = String(method ?? 'GET').toUpperCase()
  const handler = mockHandlers.find(
    (item) => item.method === normalizedMethod && item.match(endpoint)
  )

  return handler ? handler.response(endpoint, body) : null
}
