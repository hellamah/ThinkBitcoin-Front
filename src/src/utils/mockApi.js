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
  {
    method: 'GET',
    match: (endpoint) => !!endpoint.match(/^\/ThinkBitcoin\/variavel-externa\/trend\/heatmap(\?.*)?$/i),
    response: () => ({
      mensagem: 'Heatmap mock retornado com sucesso',
      resultado: {
        totalRegistros: 5,
        totalPaginas: 1,
        paginaAtual: 1,
        registros: [
          { geoTop1Code: 'US', frequenciaLideranca: 85 },
          { geoTop1Code: 'BR', frequenciaLideranca: 70 },
          { geoTop1Code: 'CH', frequenciaLideranca: 95 },
          { geoTop1Code: 'DE', frequenciaLideranca: 60 },
          { geoTop1Code: 'JP', frequenciaLideranca: 75 }
        ]
      }
    }),
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
