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
  !resolveIsTestMode() &&
  (parseUseMockFlag(resolvedUseMockEnv) ||
   (resolvedUseMockEnv === undefined && resolveIsDevMode()))

// Codifica em base64 usando bytes UTF-8 (simétrico ao decode em authentication.js).
// btoa() puro trata cada caractere como Latin-1 e corrompe acentos: "á" vira o byte 0xE1,
// que é UTF-8 inválido e aparece como "�" ao decodificar com TextDecoder.
const base64FromUtf8 = (str) => {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(str, 'utf-8').toString('base64')
  }

  if (typeof TextEncoder !== 'undefined' && typeof btoa === 'function') {
    const bytes = new TextEncoder().encode(str)
    let bin = ''
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
    return btoa(bin)
  }

  if (typeof btoa === 'function') return btoa(str)

  return str
}

const buildMockToken = () => {
  const header = { alg: 'HS256', typ: 'JWT' }
  const payload = {
    'idUsuarioTB': 'b282e124-4dd8-4ccd-a9c6-5b6b0c324a50',
    'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name': 'Helama Borges',
    'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress': 'helama@thinkbitcoin.com',
  }

  const encode = (value) =>
    base64FromUtf8(JSON.stringify(value))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')

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

const buildCoinValueResponse = (symbol, urlParams) => {
  const normalized = symbol.toUpperCase()
  const baseValue = MOCK_COIN_BASE_VALUE[normalized] ?? 100
  const variationFactor = ((hashSymbol(normalized) % 17) - 8) * 0.0025

  let registros = []
  const agora = new Date()

  // Gera 1 ano de mock com 3 itens por dia (para o gráfico não ficar vazio nos filtros de 7 dias)
  for (let d = 365; d >= 0; d--) {
    for (let i = 0; i < 3; i++) {
      const msOffset = d * 24 * 60 * 60 * 1000 - i * 8 * 60 * 60 * 1000
      const dataPonto = new Date(agora.getTime() - msOffset)
      
      const globalIndex = d * 3 + i
      const oscilacao = Math.sin(globalIndex + hashSymbol(normalized)) * 0.05 + variationFactor
      const precoPonto = Number((baseValue * (1 + oscilacao)).toFixed(2))
      const dVar = oscilacao * 100

      registros.push({
        precoFechamento: precoPonto,
        horaReferencia: dataPonto.toISOString(),
        precoMaior: precoPonto * 1.01,
        precoMedio: precoPonto * 0.995,
        precoMenor: precoPonto * 0.98,
        precoAbertura: precoPonto * 0.99,
        precoAmplitude: precoPonto * 0.03,
        precoPercentualVariacao: Number(dVar.toFixed(2)),
        precoRatioCompraVenda: 1.5,
        precoTotalNegociada: precoPonto * 1000,
        precoVolume: 150.5,
        precoDeltaUltimoAbertura: precoPonto * 0.01,
        precoVariacaoAbsoluta: precoPonto * 0.01,
        precoCorpoCandle: precoPonto * 0.01,
        precoSombraSuperior: precoPonto * 0.005,
        precoSombraInferior: precoPonto * 0.005,
        precoDirecao: dVar >= 0 ? 1 : -1,
        precoVolatilidadePercentual: 0.5,
        precoFinanceiroPorTrade: 450.0,
        quantidadeNegociada: 150.5,
        volumeComprado: 90.3,
        volumeVendido: 60.2,
        dominanciaCompradoraPercentual: 60.0,
        dominanciaVendedoraPercentual: 40.0,
        volumeDelta: 30.1,
        taxaFinanciamento: 0.0005 * (Math.random() > 0.5 ? 1 : -1),
        contratosAberto: 2000000 + Math.random() * 500000,
        longShortRatio: 1.0 + Math.random(),
        longAccount: 0.5 + Math.random() * 0.2,
        shortAccount: 0.5 - Math.random() * 0.2,
      })
    }
  }

  // Filtragem
  if (urlParams) {
    const dataInicio = urlParams.get('dataInicio')
    const dataFim = urlParams.get('dataFim')
    
    if (dataInicio) {
      const inicio = new Date(dataInicio).getTime()
      registros = registros.filter(r => new Date(r.horaReferencia).getTime() >= inicio)
    }
    if (dataFim) {
      const fim = new Date(dataFim).getTime()
      registros = registros.filter(r => new Date(r.horaReferencia).getTime() <= fim)
    }
  }

  // Inverte para retornar em ordem decrescente conforme o padrão da API real
  registros.reverse()

  let page = 1
  let size = 15
  let paginar = false

  if (urlParams) {
    if (urlParams.has('page') || urlParams.has('pagina')) {
      const p = parseInt(urlParams.get('page') || urlParams.get('pagina'))
      if (!isNaN(p) && p > 0) page = p
      paginar = true
    }
    if (urlParams.has('size') || urlParams.has('quantidade')) {
      const s = parseInt(urlParams.get('size') || urlParams.get('quantidade'))
      if (!isNaN(s) && s > 0) size = s
      paginar = true
    }
  }

  if (paginar) {
    const start = (page - 1) * size
    const end = start + size
    const totalRegistros = registros.length
    const paginados = registros.slice(start, end)
    return {
      mensagem: 'Operação realizada com sucesso',
      resultado: {
        totalRegistros,
        totalPaginas: Math.ceil(totalRegistros / size),
        paginaAtual: page,
        registros: paginados,
      },
    }
  }

  return {
    mensagem: 'Operação realizada com sucesso',
    resultado: {
      totalRegistros: registros.length,
      totalPaginas: 1,
      paginaAtual: 1,
      registros,
    },
  }
}

const buildSequenceResponse = () => {
  const points = []
  const agora = new Date()

  // Gera 1 ano de mock com 3 itens por dia
  for (let d = 365; d >= 0; d--) {
    for (let i = 0; i < 3; i++) {
      const msOffset = d * 24 * 60 * 60 * 1000 - i * 8 * 60 * 60 * 1000
      const dataPonto = new Date(agora.getTime() - msOffset)
      const isWin = Math.random() > 0.5
      
      points.push({
        idSequenciaRetorno: `00000000-0000-4000-a000-${Math.random().toString().substring(2,14)}`,
        dataHora: dataPonto.toISOString(),
        valorNegociado: 60000 + Math.random() * 10000,
        variacaoPercentual: (Math.random() * 0.02) * (isWin ? 1 : -1),
        tipo: isWin ? 1 : 2,
      })
    }
  }

  points.reverse()

  return {
    mensagem: 'Mock de sequência retornado com sucesso',
    resultado: {
      totalRegistros: points.length,
      totalPaginas: 1,
      paginaAtual: 1,
      listaSequenciaRetorno: points,
    },
  }
}

const generateMockPatrimonio = () => {
  const registros = []
  let saldoTotalBRL = 0
  let saldoTotalUSD = 0
  const agora = new Date()

  for (let mesOffset = 11; mesOffset >= 0; mesOffset--) {
    const numPontosMes = 2 + Math.floor(Math.random() * 2)
    const dataMes = new Date(agora.getFullYear(), agora.getMonth() - mesOffset, 1)
    
    for (let i = 0; i < numPontosMes; i++) {
      const dataPonto = new Date(dataMes.getFullYear(), dataMes.getMonth(), 5 + i * 10, 10 + i, 0, 0)
      const valorBRL = 2000 + Math.random() * 8000
      const cotacao = 5.0 + Math.random() * 0.5
      const valorUSD = valorBRL / cotacao
      
      saldoTotalBRL += valorBRL
      saldoTotalUSD += valorUSD
      
      registros.push({
        idPatrimonioTB: crypto.randomUUID?.() || Math.random().toString(36).substring(2, 15),
        idUsuarioTB: "b282e124-4dd8-4ccd-a9c6-5b6b0c324a50",
        valorBRL: Number(valorBRL.toFixed(2)),
        valorUSD: Number(valorUSD.toFixed(2)),
        cotacaoUtilizada: Number(cotacao.toFixed(2)),
        tipoMovimentacao: (mesOffset === 11 && i === 0) ? "Aporte Inicial" : "Aporte",
        dataHora: dataPonto.toISOString(),
        observacao: `Aporte automático mockado - Mês ${dataPonto.getMonth() + 1}/${dataPonto.getFullYear()}`
      })
    }
  }

  return {
    saldoTotalBRL: Number(saldoTotalBRL.toFixed(2)),
    saldoTotalUSD: Number(saldoTotalUSD.toFixed(2)),
    registros: registros.reverse()
  }
}

let mockPatrimonio = generateMockPatrimonio()

let mockPlanoAtivoId = 1 // Minerador (Acesso a IA) por padrão

// ---- Cobrança Pix simulada (fluxo de checkout de planos) ----
// No modo demo a cobrança "se paga sozinha" após alguns segundos, simulando
// o webhook do gateway confirmando o pagamento no backend.
const MOCK_COBRANCA_AUTO_PAGAR_MS = 10000
const MOCK_COBRANCA_EXPIRAR_MS = 30 * 60 * 1000

let mockCobranca = null

const mockPixQrCodeSvg = () => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220" viewBox="0 0 220 220"><rect width="220" height="220" fill="#fff"/><g fill="#000">${
    Array.from({ length: 120 }, (_, i) => {
      const x = 10 + (i * 37) % 200
      const y = 10 + Math.floor((i * 53) % 200 / 10) * 10
      return `<rect x="${x - x % 10}" y="${y}" width="10" height="10"/>`
    }).join('')
  }</g><rect x="70" y="95" width="80" height="30" fill="#fff"/><text x="110" y="115" font-family="monospace" font-size="12" text-anchor="middle" fill="#000">PIX DEMO</text></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

// Atualiza o status da cobrança em função do tempo decorrido e aplica o
// efeito colateral do "webhook" (ativar o plano) quando ela é paga.
const resolveMockCobranca = () => {
  if (!mockCobranca) return null
  if (mockCobranca.status === 'PENDENTE') {
    const idade = Date.now() - mockCobranca._criadaEmMs
    if (idade >= MOCK_COBRANCA_EXPIRAR_MS) {
      mockCobranca.status = 'EXPIRADO'
    } else if (idade >= MOCK_COBRANCA_AUTO_PAGAR_MS) {
      mockCobranca.status = 'PAGO'
      mockCobranca.pagaEm = new Date().toISOString()
      mockPlanoAtivoId = mockCobranca.tipoPlano
    }
  }
  return mockCobranca
}

const criarMockCobranca = (body) => {
  const criadaEmMs = Date.now()
  mockCobranca = {
    idCobranca: crypto.randomUUID?.() || Math.random().toString(36).substring(2, 15),
    idUsuarioTB: body?.idUsuarioTB || 'b282e124-4dd8-4ccd-a9c6-5b6b0c324a50',
    tipoPlano: parseInt(body?.tipoPlano ?? 0),
    nomePlano: body?.nomePlano || '',
    valor: parseFloat(body?.valor ?? 0),
    status: 'PENDENTE',
    pixCopiaECola:
      '00020126580014BR.GOV.BCB.PIX0136demo-thinkbitcoin-cobranca-simulada5204000053039865802BR5913ThinkBitcoin6009SAO PAULO62070503***6304DEMO',
    qrCodeBase64: mockPixQrCodeSvg(),
    criadaEm: new Date(criadaEmMs).toISOString(),
    expiraEm: new Date(criadaEmMs + MOCK_COBRANCA_EXPIRAR_MS).toISOString(),
    pagaEm: null,
    _criadaEmMs: criadaEmMs,
  }
  return mockCobranca
}

const mockHandlers = [
  {
    method: 'POST',
    match: (endpoint) =>
      endpoint === '/ThinkBitcoin/gerarTokenBearer' ||
      endpoint === '/ThinkBitcoin/gerarTokenBearer/renovar',
    response: () => {
      // Cria um payload mock no padrão JWT para o decode da aplicação
      const payload = {
        'idUsuarioTB': 'b282e124-4dd8-4ccd-a9c6-5b6b0c324a50',
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name': 'Usuário Teste',
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress': 'teste@thinkbitcoin.com'
      }
      const base64Payload = base64FromUtf8(JSON.stringify(payload))
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
        nome: 'Usuário Teste',
        email: 'teste@thinkbitcoin.com',
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
    response: (endpoint, body) => {
      const emailExistente = 'teste@thinkbitcoin.com'
      if (body?.email?.toLowerCase() === emailExistente.toLowerCase()) {
        const err = new Error('Este e-mail já está cadastrado na plataforma.')
        err.status = 409
        throw err
      }
      return { mensagem: 'Usuário mock cadastrado com sucesso' }
    },
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
      const urlQuery = endpoint.includes('?') ? new URLSearchParams(endpoint.split('?')[1]) : null
      return buildCoinValueResponse(symbol, urlQuery)
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
            timeUntilUpdateSeg: 1800,
            horaReferencia: new Date().toISOString(),
          }
        ]
      }
    }),
  },
  {
    method: 'GET',
    match: (endpoint) => !!endpoint.match(/^\/ThinkBitcoin\/variavel-externa\/trend(\?.*)?$/i),
    response: (endpoint) => {
      // País líder varia por moeda para exercitar o filtro real do carrossel
      // (clicar num país do mapa filtra por trend.geoTop1Code).
      const urlQuery = endpoint.includes('?') ? new URLSearchParams(endpoint.split('?')[1]) : null
      const idMoedaStr = urlQuery?.get('idMoeda') || ''
      const hash = idMoedaStr.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
      const paisesLideres = ['US', 'BR', 'CH', 'DE', 'JP']
      const geoTop1Code = paisesLideres[hash % paisesLideres.length]

      return {
      mensagem: 'Trend mock retornado com sucesso',
      resultado: {
        totalRegistros: 1,
        totalPaginas: 1,
        paginaAtual: 1,
        registros: [
          {
            valorAtual: 130,
            mediaPeriodo: 96.4,
            mA5: 120,
            mA15: 121,
            delta5: 19,
            delta15: 33,
            volatilidade15: 30.45,
            minutosDesdePico: 115,
            rankNoMinuto: 6,
            spreadTop2: 12.5,
            geoTop1Code,
            geoTop1Value: 100,
            geoTop5Std: 14.2,
            geoHHI: 0.31,
            isTimeseriesOk: true,
            isGeoOk: true,
            horaReferencia: new Date().toISOString(),
          }
        ]
      }
      }
    }
  },
  {
    method: 'GET',
    match: (endpoint) => !!endpoint.match(/^\/ThinkBitcoin\/variavel-externa\/trend\/heatmap(\?.*)?$/i),
    response: (endpoint) => {
      const urlQuery = endpoint.includes('?') ? new URLSearchParams(endpoint.split('?')[1]) : null
      const idMoedaStr = urlQuery?.get('idMoeda') || '1'
      const intervalo = urlQuery?.get('intervalo') || '24h'
      let idNum = parseInt(idMoedaStr)
      if (isNaN(idNum)) {
        idNum = idMoedaStr.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
      }
      
      const factor = (idNum * 17) % 30
      
      let registros = []

      if (intervalo === '1h') {
        // 1H: Concentração na Europa, Ásia, Oceania (Sem África, Sem Canadá/Brasil, apenas US para Américas)
        // Isso vai desabilitar a África, mas manter as outras regiões ativas no zoom geográfico
        registros = [
          { geoTop1Code: 'CH', frequenciaLideranca: Math.round(90 - (factor % 5)) },
          { geoTop1Code: 'DE', frequenciaLideranca: Math.round(85 - (factor % 3)) },
          { geoTop1Code: 'JP', frequenciaLideranca: Math.round(80 - (factor % 4)) },
          { geoTop1Code: 'US', frequenciaLideranca: Math.round(75 - (factor % 3)) },
          { geoTop1Code: 'GB', frequenciaLideranca: Math.round(70 - (factor % 2)) },
          { geoTop1Code: 'AU', frequenciaLideranca: Math.round(65 - (factor % 3)) },
          { geoTop1Code: 'CN', frequenciaLideranca: Math.round(60 - (factor % 2)) },
          { geoTop1Code: 'FR', frequenciaLideranca: Math.round(55 - (factor % 4)) },
          { geoTop1Code: 'IT', frequenciaLideranca: Math.round(50 - (factor % 3)) },
          { geoTop1Code: 'ES', frequenciaLideranca: Math.round(45 - (factor % 2)) },
          { geoTop1Code: 'NL', frequenciaLideranca: Math.round(40 - (factor % 3)) },
          { geoTop1Code: 'KR', frequenciaLideranca: Math.round(35 - (factor % 4)) },
          { geoTop1Code: 'CA', frequenciaLideranca: Math.round(30 - (factor % 3)) },
          { geoTop1Code: 'SG', frequenciaLideranca: Math.round(25 - (factor % 2)) },
          { geoTop1Code: 'IN', frequenciaLideranca: Math.round(20 - (factor % 5)) }
        ]
      } else if (intervalo === '1m') {
        // 1M: Longo prazo com amostragem ampla, ativando todas as regiões
        registros = [
          { geoTop1Code: 'US', frequenciaLideranca: Math.round(98 - (factor % 3)) },
          { geoTop1Code: 'BR', frequenciaLideranca: Math.round(94 - (factor % 4)) },
          { geoTop1Code: 'CA', frequenciaLideranca: Math.round(90 - (factor % 5)) },
          { geoTop1Code: 'CH', frequenciaLideranca: Math.round(86 - (factor % 5)) },
          { geoTop1Code: 'DE', frequenciaLideranca: Math.round(82 - (factor % 3)) },
          { geoTop1Code: 'GB', frequenciaLideranca: Math.round(78 - (factor % 4)) },
          { geoTop1Code: 'FR', frequenciaLideranca: Math.round(74 - (factor % 2)) },
          { geoTop1Code: 'JP', frequenciaLideranca: Math.round(70 - (factor % 4)) },
          { geoTop1Code: 'CN', frequenciaLideranca: Math.round(66 - (factor % 2)) },
          { geoTop1Code: 'AU', frequenciaLideranca: Math.round(62 - (factor % 3)) },
          { geoTop1Code: 'ZA', frequenciaLideranca: Math.round(58 - (factor % 2)) },
          { geoTop1Code: 'MX', frequenciaLideranca: Math.round(54 - (factor % 4)) },
          { geoTop1Code: 'AR', frequenciaLideranca: Math.round(50 - (factor % 3)) },
          { geoTop1Code: 'CO', frequenciaLideranca: Math.round(46 - (factor % 2)) },
          { geoTop1Code: 'IT', frequenciaLideranca: Math.round(42 - (factor % 5)) },
          { geoTop1Code: 'ES', frequenciaLideranca: Math.round(38 - (factor % 3)) },
          { geoTop1Code: 'RU', frequenciaLideranca: Math.round(34 - (factor % 4)) },
          { geoTop1Code: 'IN', frequenciaLideranca: Math.round(30 - (factor % 3)) },
          { geoTop1Code: 'KR', frequenciaLideranca: Math.round(26 - (factor % 2)) },
          { geoTop1Code: 'SG', frequenciaLideranca: Math.round(22 - (factor % 4)) },
          { geoTop1Code: 'NZ', frequenciaLideranca: Math.round(18 - (factor % 3)) },
          { geoTop1Code: 'NG', frequenciaLideranca: Math.round(14 - (factor % 2)) },
          { geoTop1Code: 'EG', frequenciaLideranca: Math.round(10 - (factor % 4)) },
          { geoTop1Code: 'MA', frequenciaLideranca: Math.round(8 - (factor % 3)) },
          { geoTop1Code: 'KE', frequenciaLideranca: Math.round(5 - (factor % 2)) }
        ]
      } else {
        // 24H (1D): Médio prazo com amostragem balanceada, cobrindo todas as regiões
        registros = [
          { geoTop1Code: 'US', frequenciaLideranca: Math.round(88 - (factor % 5)) },
          { geoTop1Code: 'BR', frequenciaLideranca: Math.round(82 - ((factor + 3) % 7)) },
          { geoTop1Code: 'CH', frequenciaLideranca: Math.round(76 - ((factor + 1) % 6)) },
          { geoTop1Code: 'DE', frequenciaLideranca: Math.round(70 - (factor % 4)) },
          { geoTop1Code: 'JP', frequenciaLideranca: Math.round(64 - ((factor + 4) % 5)) },
          { geoTop1Code: 'AU', frequenciaLideranca: Math.round(58 - (factor % 3)) },
          { geoTop1Code: 'ZA', frequenciaLideranca: Math.round(52 - (factor % 2)) },
          { geoTop1Code: 'CA', frequenciaLideranca: Math.round(46 - (factor % 4)) },
          { geoTop1Code: 'GB', frequenciaLideranca: Math.round(40 - (factor % 3)) },
          { geoTop1Code: 'AR', frequenciaLideranca: Math.round(35 - (factor % 2)) },
          { geoTop1Code: 'FR', frequenciaLideranca: Math.round(30 - (factor % 4)) },
          { geoTop1Code: 'IT', frequenciaLideranca: Math.round(25 - (factor % 3)) },
          { geoTop1Code: 'IN', frequenciaLideranca: Math.round(20 - (factor % 2)) },
          { geoTop1Code: 'NG', frequenciaLideranca: Math.round(16 - (factor % 3)) },
          { geoTop1Code: 'EG', frequenciaLideranca: Math.round(12 - (factor % 2)) },
          { geoTop1Code: 'NZ', frequenciaLideranca: Math.round(8 - (factor % 3)) },
          { geoTop1Code: 'KR', frequenciaLideranca: Math.round(5 - (factor % 2)) }
        ]
      }

      // Intensidade média derivada da frequência para exercitar o toggle
      // Liderança × Intensidade e o tooltip enriquecido.
      registros = registros.map((r, idx) => ({
        ...r,
        mediaIntensidade: Math.max(5, Math.min(100, Math.round(r.frequenciaLideranca * 0.75 + ((idx * 7) % 20)))),
      }))

      return {
        mensagem: 'Heatmap mock retornado com sucesso',
        resultado: {
          totalRegistros: registros.length,
          totalPaginas: 1,
          paginaAtual: 1,
          registros
        }
      }
    }
  },
  {
    method: 'GET',
    match: (endpoint) => !!endpoint.match(/^\/ThinkBitcoin\/patrimonio\/[^/]+(\?.*)?$/i),
    response: () => ({
      mensagem: 'Patrimônio mock retornado com sucesso',
      resultado: {
        totalRegistros: mockPatrimonio.registros.length,
        totalPaginas: 1,
        paginaAtual: 1,
        saldoTotalBRL: mockPatrimonio.saldoTotalBRL,
        saldoTotalUSD: mockPatrimonio.saldoTotalUSD,
        registros: [...mockPatrimonio.registros].reverse()
      }
    }),
  },
  {
    method: 'POST',
    match: (endpoint) => endpoint === '/ThinkBitcoin/patrimonio',
    response: (endpoint, body) => {
      console.log('Mock POST Patrimonio:', body)
      const valorBRL = parseFloat(body?.valorBRL || 0)
      const observacao = body?.observacao || 'Aporte manual'
      const cotacao = 5.20
      const valorUSD = parseFloat((valorBRL / cotacao).toFixed(2))

      const novo = {
        idPatrimonioTB: crypto.randomUUID?.() || Math.random().toString(36).substring(2, 15),
        idUsuarioTB: body?.idUsuarioTB || 'b282e124-4dd8-4ccd-a9c6-5b6b0c324a50',
        valorBRL,
        valorUSD,
        cotacaoUtilizada: cotacao,
        tipoMovimentacao: 'Aporte',
        dataHora: new Date().toISOString(),
        observacao
      }

      mockPatrimonio.registros.push(novo)
      mockPatrimonio.saldoTotalBRL = parseFloat((mockPatrimonio.saldoTotalBRL + valorBRL).toFixed(2))
      mockPatrimonio.saldoTotalUSD = parseFloat((mockPatrimonio.saldoTotalUSD + valorUSD).toFixed(2))

      return {
        mensagem: 'Patrimônio cadastrado com sucesso!',
        resultado: novo
      }
    }
  },
  {
    method: 'GET',
    match: (endpoint) => endpoint === '/ThinkBitcoin/planos-pagamento',
    response: () => {
      const planos = [
        {
          idPlanoPagamento: 0,
          nome: 'Consultor (Acesso Básico)',
          valor: 0,
          descricao: 'Acesso às moedas e gráficos básicos de mercado para análise elementar de portfólio.',
          duracaoDias: 30,
          carencia: 0,
          liquidacao: 1,
          tipoPrazoLiquidacao: 0,
          prazoCotizacao: 0,
          horarioLimiteSolicitacao: { ticks: 576000000000 },
          taxaSaqueAntecipado: 1.5,
          taxaResgate: 0.5,
          valorMinimoResgate: 100,
          saldoMinimoPermanencia: 50,
          limiteDiarioResgate: 5000,
          tipoPlano: 0,
          ativo: mockPlanoAtivoId === 0,
          statusPlano: 1,
          permiteResgateParcial: true,
          idUsuarioTB: 'b282e124-4dd8-4ccd-a9c6-5b6b0c324a50'
        },
        {
          idPlanoPagamento: 1,
          nome: 'Minerador (Acesso Completo + IA)',
          valor: 199.90,
          descricao: 'Acesso completo ao robô de trade de alta performance com recomendações guiadas por inteligência artificial.',
          duracaoDias: 30,
          carencia: 0,
          liquidacao: 0,
          tipoPrazoLiquidacao: 0,
          prazoCotizacao: 0,
          horarioLimiteSolicitacao: { ticks: 648000000000 },
          taxaSaqueAntecipado: 0.5,
          taxaResgate: 0.0,
          valorMinimoResgate: 50,
          saldoMinimoPermanencia: 10,
          limiteDiarioResgate: 50000,
          tipoPlano: 1,
          ativo: mockPlanoAtivoId === 1,
          statusPlano: 1,
          permiteResgateParcial: true,
          idUsuarioTB: 'b282e124-4dd8-4ccd-a9c6-5b6b0c324a50'
        },
        {
          idPlanoPagamento: 2,
          nome: 'ThinkElite (Profissional)',
          valor: 499.90,
          descricao: 'Acesso ilimitado e prioritário a todas as ferramentas com atendimento private broker e taxas zero de saque.',
          duracaoDias: 365,
          carencia: 0,
          liquidacao: 0,
          tipoPrazoLiquidacao: 0,
          prazoCotizacao: 0,
          horarioLimiteSolicitacao: { ticks: 720000000000 },
          taxaSaqueAntecipado: 0.0,
          taxaResgate: 0.0,
          valorMinimoResgate: 0,
          saldoMinimoPermanencia: 0,
          limiteDiarioResgate: 1000000,
          tipoPlano: 2,
          ativo: mockPlanoAtivoId === 2,
          statusPlano: 1,
          permiteResgateParcial: true,
          idUsuarioTB: 'b282e124-4dd8-4ccd-a9c6-5b6b0c324a50'
        }
      ]
      return {
        mensagem: 'Planos de pagamento retornados com sucesso',
        resultado: { planos }
      }
    }
  },
  {
    method: 'POST',
    match: (endpoint) => endpoint === '/ThinkBitcoin/planos-pagamento/checkout',
    response: (endpoint, body) => {
      console.log('Mock POST Checkout Plano:', body)
      const pendente = resolveMockCobranca()
      // Idempotência: reaproveita cobrança pendente do mesmo plano em vez de
      // gerar uma nova a cada clique.
      const cobranca =
        pendente && pendente.status === 'PENDENTE' && pendente.tipoPlano === parseInt(body?.tipoPlano ?? -1)
          ? pendente
          : criarMockCobranca(body)
      return {
        mensagem: 'Cobrança Pix gerada com sucesso',
        resultado: { cobranca }
      }
    }
  },
  {
    method: 'GET',
    match: (endpoint) => endpoint === '/ThinkBitcoin/planos-pagamento/cobranca/pendente',
    response: () => {
      const cobranca = resolveMockCobranca()
      return {
        mensagem: 'Consulta de cobrança pendente',
        resultado: { cobranca: cobranca && cobranca.status === 'PENDENTE' ? cobranca : null }
      }
    }
  },
  {
    method: 'GET',
    match: (endpoint) =>
      endpoint.startsWith('/ThinkBitcoin/planos-pagamento/cobranca/') &&
      !endpoint.endsWith('/pendente'),
    response: (endpoint) => {
      const id = endpoint.split('/').pop()
      const cobranca = resolveMockCobranca()
      if (!cobranca || cobranca.idCobranca !== id) {
        return { mensagem: 'Cobrança não encontrada', resultado: { cobranca: null } }
      }
      return { mensagem: 'Status da cobrança', resultado: { cobranca } }
    }
  },
  {
    method: 'POST',
    match: (endpoint) => endpoint === '/ThinkBitcoin/planos-pagamento/migrar',
    response: (endpoint, body) => {
      console.log('Mock POST Migrar Plano:', body)
      const novoId = parseInt(body?.tipoPlano ?? 0)
      mockPlanoAtivoId = novoId
      return {
        mensagem: 'Migração de plano concluída com sucesso!',
        resultado: true
      }
    }
  }
]

export const getMockResponse = ({ endpoint, method, body }) => {
  const normalizedMethod = String(method ?? 'GET').toUpperCase()
  const handler = mockHandlers.find(
    (item) => item.method === normalizedMethod && item.match(endpoint)
  )

  return handler ? handler.response(endpoint, body) : null
}
