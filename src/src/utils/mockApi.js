// A flag vive em mockFlag.js, para que este arquivo possa ficar atrás de um
// import dinâmico e não viajar no bundle de produção.

import { CURVAS_ZOO, RODADA_ZOO } from './mockZooEstrategia'
import { DECISOES_ROBO, PLACAR_ROBO, RADAR_ROBO, REGRA_ROBO, SEQUENCIAS_ROBO } from './mockRoboAoVivo'
import { AuthRole, decodeAuthenticationToken, temCargo } from './authentication'
import { getStoredToken } from './preferences'
import { AGUARDANDO_DECISAO, DECISOES, STATUS, STATUS_PUBLICOS, TAMANHO_MOTIVO, podeDescartar } from './pedidoAlteracao'

// As preferências do modo demo vivem no localStorage: sem isso o GET devolve
// sempre o mesmo objeto fixo e qualquer alteração do usuário (tema, idioma…)
// é descartada no primeiro reload.
const MOCK_PREFS_KEY = 'tb_mock_preferencias'

const readMockPrefs = () => {
  try {
    const raw = globalThis.localStorage?.getItem(MOCK_PREFS_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

const writeMockPrefs = (prefs) => {
  try {
    globalThis.localStorage?.setItem(MOCK_PREFS_KEY, JSON.stringify(prefs))
  } catch {
    /* storage indisponível (SSR/teste): segue só em memória */
  }
}

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

/**
 * Catálogo de moedas do modo demo — a mesma lista que `GET /moedas` devolve.
 *
 * É a fonte única: o mapa de valores-base abaixo é DERIVADO daqui. Enquanto as
 * duas coisas fossem listas separadas, acrescentar uma moeda ao catálogo sem
 * lembrar do valor-base a faria cair no fallback de 100 — um DOGE cotado a cem
 * dólares no meio do carrossel.
 *
 * O `id` é Guid, como a API real emite. Não é detalhe cosmético: o handler do
 * heatmap tenta `parseInt(idMoeda)` e só cai no hash de caracteres quando o
 * valor não é numérico. Com ids '1', '2', '3' o modo demo exercitaria um ramo
 * que produção nunca usa, e o ramo que produção usa ficaria sem cobertura.
 */
const MOCK_MOEDAS = Object.freeze([
  { id: '6f1c0b7e-2d3a-4c58-9e10-7a5b3c8d1e01', sigla: 'BTC', nome: 'Bitcoin', valorBase: 68000 },
  { id: '6f1c0b7e-2d3a-4c58-9e10-7a5b3c8d1e02', sigla: 'ETH', nome: 'Ethereum', valorBase: 3500 },
  { id: '6f1c0b7e-2d3a-4c58-9e10-7a5b3c8d1e03', sigla: 'ADA', nome: 'Cardano', valorBase: 0.73 },
  { id: '6f1c0b7e-2d3a-4c58-9e10-7a5b3c8d1e04', sigla: 'XRP', nome: 'XRP', valorBase: 0.61 },
  { id: '6f1c0b7e-2d3a-4c58-9e10-7a5b3c8d1e05', sigla: 'SOL', nome: 'Solana', valorBase: 148 },
  { id: '6f1c0b7e-2d3a-4c58-9e10-7a5b3c8d1e06', sigla: 'LINK', nome: 'Chainlink', valorBase: 18 },
  { id: '6f1c0b7e-2d3a-4c58-9e10-7a5b3c8d1e07', sigla: 'BNB', nome: 'BNB', valorBase: 585 },
  { id: '6f1c0b7e-2d3a-4c58-9e10-7a5b3c8d1e08', sigla: 'LTC', nome: 'Litecoin', valorBase: 88 },
  { id: '6f1c0b7e-2d3a-4c58-9e10-7a5b3c8d1e09', sigla: 'DOGE', nome: 'Dogecoin', valorBase: 0.16 },
  { id: '6f1c0b7e-2d3a-4c58-9e10-7a5b3c8d1e0a', sigla: 'PAXG', nome: 'PAX Gold', valorBase: 2330 },
])

const MOCK_COIN_BASE_VALUE = Object.freeze(
  Object.fromEntries(MOCK_MOEDAS.map((m) => [m.sigla, m.valorBase]))
)

const hashSymbol = (symbol) =>
  symbol
    .split('')
    .reduce((acc, char) => acc + char.charCodeAt(0), 0)

// Gerador pseudoaleatório semeado (mulberry32). Determinístico de propósito:
// a mesma sigla produz sempre a mesma série, então o demo é reprodutível e
// dois desenvolvedores veem os mesmos números. Não é Math.random.
const geradorSemeado = (semente) => () => {
  semente |= 0
  semente = (semente + 0x6d2b79f5) | 0
  let t = Math.imul(semente ^ (semente >>> 15), 1 | semente)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

// Quanto do movimento de ontem persiste hoje. É o que cria trechos de
// tendência sustentada — sem isso o preço vira ruído sem direção e nenhum
// oscilador chega perto de extremo.
const PERSISTENCIA = 0.72

// Escala do choque por candle.
const CHOQUE = 0.028

// Puxão de volta em direção ao preço-base. Um passeio livre acumula deriva ao
// longo dos 1096 candles do mock e afasta o ativo do valor que o identifica —
// ETH terminava em $1.013 com base $3.500. Com a reversão o preço passeia
// numa banda plausível sem deixar de ter tendência.
const REVERSAO = 0.012

// Quantas horas de histórico o mock gera: dois anos e uma semana. A simulação
// busca 180 dias, e a leitura "escolher pelo passado", dois anos; com os 120
// dias de antes, a primeira anunciava "janela curta" em todo teste no modo demo
// e a segunda não tinha período nenhum para mostrar.
const HORAS_DE_HISTORICO = (2 * 365 + 7) * 24

// A série gerada, por moeda e por hora cheia. Gerar ~17.700 candles a cada
// requisição custava o que custavam os 120 dias antes, vezes seis; guardada, a
// geração acontece uma vez por hora por moeda. Quem recebe a resposta recebe
// cópias — o `normalizeApiKeys` do apiClient refaz cada registro —, então
// nada do que a tela fizer com elas volta para cá.
const historicosMock = new Map()

const historicoMockDe = (normalized) => {
  const agora = new Date()
  agora.setMinutes(0, 0, 0)
  const guardado = historicosMock.get(normalized)
  if (guardado?.hora === agora.getTime()) return guardado.registros
  const registros = gerarHistoricoMock(normalized, agora)
  historicosMock.set(normalized, { hora: agora.getTime(), registros })
  return registros
}

const gerarHistoricoMock = (normalized, agora) => {
  const baseValue = MOCK_COIN_BASE_VALUE[normalized] ?? 100
  const variationFactor = ((hashSymbol(normalized) % 17) - 8) * 0.0025
  // Moeda barata anda em casas menores, como na corretora. Com 2 casas, o
  // Cardano a 0,73 só andava de 1 em 1 centavo (1,4%) e ficava com variação
  // 0,00% em 37% das horas, contra 4% nos dados reais; o Dogecoin, em 85%,
  // contra 2%. O Trader via isso como erro, e o PR 89 tirava do site real
  // toda moeda que não estivesse em alta.
  const casasDoPreco = baseValue < 10 ? 4 : 2
  const arredondarPreco = (valor) => Number(valor.toFixed(casasDoPreco))

  let registros = []
  // Fechamento do candle anterior, que vira a abertura do próximo.
  let fechamentoAnterior = null

  // Estado do passeio. O laço abaixo percorre do mais antigo para o mais
  // recente, então basta avançar o passeio a cada candle.
  const sortear = geradorSemeado(hashSymbol(normalized))
  let precoRelativo = 1
  let momentum = 0
  // `agora` chega truncado na hora para todas as moedas caírem na mesma grade
  // de horários. Com `new Date()` puro cada moeda era gerada num milissegundo
  // diferente, então nenhuma série se alinhava com outra: o gráfico multi-moeda
  // ficava com um ponto por moeda por instante e a correlação não achava um
  // par sequer. O backend real amostra em cadência fixa, que é o que isto imita.

  // Um candle por hora, como o backend real amostra.
  //
  // Eram 3 por dia. A diferença de cadência escondia uma classe inteira de
  // problema: com 3/dia um filtro de 1 mês dá 90 candles e cabe em qualquer
  // requisição, enquanto de hora em hora dá ~720 e estoura o teto. Foi por
  // isso que o corte silencioso do período só apareceu em produção.
  //
  // Menos histórico que antes em dias, mas 4× mais candles: o que os
  // indicadores consomem é quantidade de candles, não calendário.
  for (let passo = HORAS_DE_HISTORICO; passo >= 0; passo--) {
    {
      const dataPonto = new Date(agora.getTime() - passo * 60 * 60 * 1000)

      // Cresce com o tempo, do mais antigo para o mais recente.
      const globalIndex = HORAS_DE_HISTORICO - passo
      // Passeio aleatório com momentum, semeado pela sigla.
      //
      // Antes era soma de senos, e antes disso um seno puro. Ambos falhavam
      // pelo mesmo motivo: oscilação periódica não tem tendência sustentada,
      // então o RSI orbitava 50 (medido: 38 a 61 em 93 candles) e nunca
      // cruzava 70/30 — o sinal existia no código e era impossível de ver.
      //
      // A correção não foi ajustar a frequência até o indicador acender, e sim
      // trocar a forma da série: preço real se parece com passeio aleatório
      // com persistência, não com senoide. Com isso o extremo de oscilador
      // aparece por consequência, não por encomenda.
      momentum =
        momentum * PERSISTENCIA +
        (sortear() - 0.5) * CHOQUE -
        (precoRelativo - 1) * REVERSAO
      precoRelativo *= 1 + momentum

      const oscilacao = precoRelativo - 1 + variationFactor
      const precoPonto = arredondarPreco(baseValue * precoRelativo)

      // O volume acompanha a oscilação e leva um pico a cada 11 candles. Com o
      // valor fixo que havia aqui a mediana era igual a todo registro, então o
      // detector de anomalia nunca tinha o que marcar no modo demo. O ciclo é
      // determinístico de propósito: dado sorteado não se distingue de medido.
      const picoDeVolume = globalIndex % 11 === 3
      const precoVolume = Number(
        (150.5 * (1 + Math.abs(oscilacao) * 6) * (picoDeVolume ? 5 : 1)).toFixed(2)
      )

      // Ticket médio em ciclo próprio, deslocado do ciclo do volume de
      // propósito: assim o demo produz hora de volume alto com ticket baixo
      // (varejo) e hora de volume normal com ticket alto (baleia), que é
      // justamente a distinção que o card e o sinal existem para mostrar.
      // Era 450 fixo, e com mediana igual a todo registro nada era atípico.
      const picoDeTicket = globalIndex % 13 === 6
      const precoFinanceiroPorTrade = Number(
        (450 * (1 + Math.abs(Math.sin(globalIndex * 0.4)) * 0.5) * (picoDeTicket ? 3 : 1)).toFixed(2)
      )

      // Fluxo comprador/vendedor. Tudo deriva de uma única dominância: assim os
      // cinco campos continuam coerentes entre si (as duas dominâncias somam
      // 100, o delta é a diferença dos volumes e o ratio é a razão deles), que
      // é como o backend real entrega. Eram cinco constantes, então o painel
      // Fluxo de Ordens ficava congelado no demo — pressão sempre 60,0% e
      // "média do período" idêntica à leitura atual.
      // A faixa imita a do backend real, que oscila entre ~44% e ~56%.
      const dominanciaCompradora = 50 + Math.sin(globalIndex * 0.55 + hashSymbol(normalized)) * 6
      const volumeComprado = precoVolume * (dominanciaCompradora / 100)
      const volumeVendido = precoVolume - volumeComprado

      // OHLC de verdade: a abertura é o fechamento do candle anterior, e as
      // extremidades envolvem esse intervalo. Antes a abertura era fixada em
      // 0,99 × fechamento, então fechamento > abertura sempre — toda vela saía
      // verde e com o mesmo corpo, mesmo nos candles em que o preço caiu.
      const abertura = fechamentoAnterior ?? arredondarPreco(precoPonto * 0.995)

      // Segunda oscilação, de frequência diferente da do preço, para as sombras
      // não saírem proporcionais ao corpo. É o que faz o demo exibir doji,
      // martelo e marubozu em vez de 21 velas do mesmo formato.
      const formato = Math.sin(globalIndex * 0.7 + hashSymbol(normalized))
      const alcanceSuperior = 0.002 + Math.max(0, formato) * 0.01
      const alcanceInferior = 0.002 + Math.max(0, -formato) * 0.01

      const maior = arredondarPreco(Math.max(abertura, precoPonto) * (1 + alcanceSuperior))
      const menor = arredondarPreco(Math.min(abertura, precoPonto) * (1 - alcanceInferior))
      fechamentoAnterior = precoPonto

      // Volatilidade derivada da amplitude real do candle, e não de um ciclo
      // próprio. Antes dependia só do índice, então TODAS as moedas tinham a
      // mesma série e a coluna de volatilidade do comparativo mostrava o mesmo
      // número para todas — campo que varia no tempo mas não distingue os
      // ativos passa despercebido em teste de campo congelado.
      const precoVolatilidadePercentual = Number(
        (((maior - menor) / precoPonto) * 100).toFixed(5)
      )

      // Contrato do backend: variação é o retorno DENTRO do candle, não o
      // desvio em relação a um preço-base. O teste PreencherTbMoedaBinanceTests
      // crava abertura=10, fechamento=12 e variação=20. Com a fórmula antiga
      // (oscilacao * 100) o sinal da variação não tinha relação com a cor da
      // vela, e a coluna da tabela contradizia o candle ao lado.
      const dVar = ((precoPonto - abertura) / abertura) * 100

      registros.push({
        precoFechamento: precoPonto,
        horaReferencia: dataPonto.toISOString(),
        precoMaior: maior,
        precoMedio: arredondarPreco((maior + menor) / 2),
        precoMenor: menor,
        precoAbertura: abertura,
        // Amplitude é, por definição, máxima menos mínima; era 3% fixo do preço
        // e não conversava com o OHLC ao lado.
        precoAmplitude: arredondarPreco(maior - menor),
        precoPercentualVariacao: Number(dVar.toFixed(4)),
        precoRatioCompraVenda: Number(
          (volumeVendido > 0 ? volumeComprado / volumeVendido : 0).toFixed(5)
        ),
        // Nocional em dólar coerente com o volume da hora, para a contagem de
        // trades derivada (nocional ÷ ticket) não sair absurda.
        precoTotalNegociada: Number((precoVolume * precoPonto).toFixed(2)),
        precoVolume,
        precoDeltaUltimoAbertura: precoPonto * 0.01,
        precoVariacaoAbsoluta: precoPonto * 0.01,
        // Anatomia derivada do próprio OHLC, como o backend faz. Eram frações
        // fixas do preço e não descreviam a vela ao lado.
        precoCorpoCandle: arredondarPreco(Math.abs(precoPonto - abertura)),
        precoSombraSuperior: arredondarPreco(maior - Math.max(abertura, precoPonto)),
        precoSombraInferior: arredondarPreco(Math.min(abertura, precoPonto) - menor),
        precoDirecao: dVar >= 0 ? 1 : -1,
        precoVolatilidadePercentual,
        precoFinanceiroPorTrade,
        // No backend real quantidadeNegociada e precoVolume vêm com o mesmo
        // valor; o mock reproduz isso em vez de inventar duas séries.
        quantidadeNegociada: precoVolume,
        volumeComprado: Number(volumeComprado.toFixed(5)),
        volumeVendido: Number(volumeVendido.toFixed(5)),
        dominanciaCompradoraPercentual: Number(dominanciaCompradora.toFixed(5)),
        dominanciaVendedoraPercentual: Number((100 - dominanciaCompradora).toFixed(5)),
        volumeDelta: Number((volumeComprado - volumeVendido).toFixed(5)),
      })
    }
  }

  return registros
}

const buildCoinValueResponse = (symbol, urlParams) => {
  // Cópia: o `reverse()` abaixo inverteria no lugar a série guardada.
  let registros = [...historicoMockDe(symbol.toUpperCase())]

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

// Faixas do índice Fear & Greed, iguais às da fonte externa (alternative.me).
const classificarFearGreed = (valor) => {
  if (valor <= 24) return 'Extreme Fear'
  if (valor <= 44) return 'Fear'
  if (valor <= 54) return 'Neutral'
  if (valor <= 74) return 'Greed'
  return 'Extreme Greed'
}

// O índice real é uma série diária. Devolver um ponto só deixava o modo demo
// sem como exercitar a evolução do sentimento no dashboard.
const buildFearGreedResponse = (urlParams) => {
  const quantidadeParam = parseInt(urlParams?.get('quantidade'), 10)
  const quantidade = Math.min(Math.max(quantidadeParam || 30, 1), 90)
  const agora = Date.now()

  // Do mais recente para o mais antigo, como a API real (ordemAsc=false).
  const registros = Array.from({ length: quantidade }, (_, i) => {
    const valor = Math.round(58 + Math.sin(i / 3.5) * 17)
    return {
      valor,
      classificacao: classificarFearGreed(valor),
      timeUntilUpdateSeg: 1800,
      horaReferencia: new Date(agora - i * 24 * 60 * 60 * 1000).toISOString(),
    }
  })

  return {
    mensagem: 'Fear & Greed Index mock retornado com sucesso',
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

// A cotação do modo demonstração, uma só: o histórico do patrimônio foi a 6,00 com
// o PR 94, e o aporte ficou em 5,20, então o patrimônio mudava de cotação a cada aporte.
export const COTACAO_DEMONSTRACAO = 6.00

// Semeado como as séries: a página carrega de novo a cada tela, e um sorteio a cada
// carga mostrava um patrimônio diferente em cada uma.
const generateMockPatrimonio = () => {
  const sortear = geradorSemeado(hashSymbol('patrimonio'))
  const registros = []
  let saldoTotalBRL = 0
  let saldoTotalUSD = 0
  const agora = new Date()

  for (let mesOffset = 11; mesOffset >= 0; mesOffset--) {
    const numPontosMes = 2 + Math.floor(sortear() * 2)
    const dataMes = new Date(agora.getFullYear(), agora.getMonth() - mesOffset, 1)
    
    for (let i = 0; i < numPontosMes; i++) {
      const dataPonto = new Date(dataMes.getFullYear(), dataMes.getMonth(), 5 + i * 10, 10 + i, 0, 0)
      const valorBRL = 2000 + sortear() * 8000
      const cotacao = COTACAO_DEMONSTRACAO
      const valorUSD = valorBRL / cotacao
      
      saldoTotalBRL += valorBRL
      saldoTotalUSD += valorUSD
      
      registros.push({
        idPatrimonioTB: globalThis.crypto?.randomUUID?.() || Math.random().toString(36).substring(2, 15),
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
    idCobranca: globalThis.crypto?.randomUUID?.() || Math.random().toString(36).substring(2, 15),
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

// Auxiliares que os mocks do zoo, do robô e do Pregão usam. Até 04/11/2026
// moravam na seção do treino do agente DQN, que saiu com a tela de treino.
const lerQuery = (endpoint) =>
  endpoint.includes('?') ? new URLSearchParams(endpoint.split('?')[1]) : new URLSearchParams()
// Como a API devolve DateTime sem fuso: ISO até os segundos, sem o Z.
const utcSemFuso = (ms) => new Date(ms).toISOString().slice(0, 19)

// Alertas de preço do modo demo. Em memória de propósito: o valor do exercício
// é ver a lista mudar ao criar e excluir, não sobreviver ao reload.
let mockAlertas = []

// Documentos legais do modo demo. O texto é o mesmo que a migração semeia no
// banco: as páginas /termos e /privacidade passaram a ler da API, e um mock com
// texto resumido faria a demo mostrar um documento que não existe.
const MOCK_DOCUMENTOS = [
  {
    idDocumentoLegal: 'd0c1e9a0-0000-4000-8000-000000000001',
    tipo: 'PRIVACIDADE',
    versao: '1.0',
    titulo: 'Política de Privacidade',
    conteudo: '## 1. Controlador dos Dados\n\nA **ThinkBitcoin** é a controladora dos dados pessoais coletados por meio desta plataforma, nos termos da Lei nº 13.709/2018 (LGPD).\n\n## 2. Dados Coletados\n\nColetamos e tratamos as seguintes categorias de dados:\n\n- Dados de identificação (nome, e-mail)\n- Dados de acesso e autenticação (token JWT — armazenado localmente)\n- Preferências de uso (tema, idioma, perfil de risco)\n- Dados de navegação e interação com a plataforma (logs de sessão)\n- Endereços de carteiras Bitcoin informados voluntariamente\n\n## 3. Finalidade do Tratamento\n\nOs dados são tratados exclusivamente para: prestação dos serviços de análise de mercado Bitcoin, personalização da experiência, segurança da conta, cumprimento de obrigações legais e melhoria contínua da plataforma.\n\n## 4. Base Legal\n\nO tratamento é realizado com base no seu **consentimento** (art. 7º, I da LGPD), na execução do contrato de uso da plataforma (art. 7º, V) e no cumprimento de obrigações legais (art. 7º, II).\n\n## 5. Compartilhamento de Dados\n\nSeus dados **não são vendidos** a terceiros. Podemos compartilhá-los apenas com parceiros de infraestrutura (hospedagem, autenticação) vinculados por contratos de confidencialidade, ou quando exigido por lei.\n\n## 6. Retenção e Exclusão\n\nOs dados são retidos pelo período necessário à prestação do serviço ou conforme exigido pela legislação. Você pode solicitar a exclusão a qualquer momento pelo e-mail de suporte.\n\n## 7. Seus Direitos (art. 18 LGPD)\n\n- Confirmação da existência de tratamento\n- Acesso aos seus dados\n- Correção de dados incompletos ou desatualizados\n- Anonimização, bloqueio ou eliminação de dados desnecessários\n- Portabilidade dos dados\n- Revogação do consentimento a qualquer tempo\n\n## 8. Contato com o DPO\n\nPara exercer seus direitos ou esclarecer dúvidas sobre privacidade, entre em contato com nosso Encarregado (DPO) pelo e-mail: **privacidade@thinkbitcoin.com.br**',
    resumoAlteracoes: null,
    hashConteudo: 'mock-privacidade-v1',
    exigeNovoAceite: false,
    vigente: true,
    dataPublicacao: '2026-08-22T00:00:00Z',
    dataVigenciaInicio: '2026-08-22T00:00:00Z',
    dataVigenciaFim: null,
  },
  {
    idDocumentoLegal: 'd0c1e9a0-0000-4000-8000-000000000002',
    tipo: 'TERMOS',
    versao: '1.0',
    titulo: 'Termos de Uso',
    conteudo: '## 1. Aceitação dos Termos\n\nAo utilizar a plataforma ThinkBitcoin você concorda integralmente com estes Termos de Uso. O uso continuado após alterações implica aceitação das versões atualizadas.\n\n## 2. Descrição do Serviço\n\nA ThinkBitcoin oferece uma plataforma de análise de dados e informações sobre o mercado de Bitcoin, incluindo dashboards, heatmaps geopolíticos, análises de on-chain e ferramentas educacionais. As informações disponibilizadas têm caráter exclusivamente informativo.\n\n## 3. Não Constitui Consultoria Financeira\n\n> ⚠ **Aviso Importante**\n>\n> O conteúdo desta plataforma é meramente informativo e educacional. Nenhuma informação aqui disponibilizada constitui conselho de investimento, recomendação de compra ou venda de ativos, ou assessoria financeira de qualquer natureza. Investimentos em criptoativos envolvem riscos significativos. Consulte um profissional habilitado antes de tomar decisões financeiras.\n\n## 4. Uso Permitido\n\nVocê se compromete a utilizar a plataforma somente para fins lícitos e pessoais, respeitando a legislação brasileira vigente. É vedado: reproduzir, redistribuir ou comercializar o conteúdo sem autorização expressa; realizar engenharia reversa; utilizar bots ou automações não autorizadas; praticar qualquer ato que prejudique a integridade da plataforma ou de outros usuários.\n\n## 5. Propriedade Intelectual\n\nTodo o conteúdo, marca, código-fonte, layout e demais elementos da plataforma são de propriedade exclusiva da ThinkBitcoin e protegidos pela Lei nº 9.610/1998 (Lei de Direitos Autorais) e pela Lei nº 9.279/1996 (Propriedade Industrial).\n\n## 6. Limitação de Responsabilidade\n\nA ThinkBitcoin não se responsabiliza por perdas financeiras decorrentes do uso das informações disponibilizadas, por interrupções no serviço, por falhas de terceiros ou por eventos de força maior.\n\n## 7. Modificações\n\nReservamo-nos o direito de alterar estes Termos a qualquer momento. Mudanças relevantes serão comunicadas por e-mail ou por aviso na plataforma.\n\n## 8. Foro\n\nFica eleito o foro da comarca de São Paulo / SP para dirimir quaisquer controvérsias decorrentes destes Termos, com renúncia expressa a qualquer outro, por mais privilegiado que seja.',
    resumoAlteracoes: null,
    hashConteudo: 'mock-termos-v1',
    exigeNovoAceite: false,
    vigente: true,
    dataPublicacao: '2026-08-22T00:00:00Z',
    dataVigenciaInicio: '2026-08-22T00:00:00Z',
    dataVigenciaFim: null,
  },
]

const documentoVigentePorTipo = (tipo) =>
  MOCK_DOCUMENTOS.find((d) => d.tipo === tipo && d.vigente) || null

// A demo entra com os dois documentos já aceitos: quem abre o modo demo quer
// ver o produto, não um modal de consentimento na primeira tela.
let mockConsentimentos = MOCK_DOCUMENTOS.map((documento, indice) => ({
  idConsentimentoUsuarioTB: `c0n5en70-0000-4000-8000-00000000000${indice + 1}`,
  tipo: documento.tipo,
  concedido: true,
  origem: 'CADASTRO',
  dataRegistro: '2026-08-22T12:00:00Z',
  idDocumentoLegal: documento.idDocumentoLegal,
  versaoDocumento: documento.versao,
  tituloDocumento: documento.titulo,
  enderecoIp: '203.0.113.10',
  atual: true,
  conteudoIntegro: true,
}))

const registrarMockConsentimento = (itens, origem) => {
  const agora = new Date().toISOString()

  for (const item of itens ?? []) {
    const documento = MOCK_DOCUMENTOS.find((d) => d.idDocumentoLegal === item.idDocumentoLegal)

    // Append-only, igual ao servidor: o registro anterior perde a marca de
    // atual, mas continua no histórico.
    mockConsentimentos = mockConsentimentos.map((c) =>
      c.tipo === item.tipo ? { ...c, atual: false } : c
    )

    mockConsentimentos = [
      {
        idConsentimentoUsuarioTB: crypto.randomUUID(),
        tipo: item.tipo,
        concedido: !!item.concedido,
        origem,
        dataRegistro: agora,
        idDocumentoLegal: documento?.idDocumentoLegal ?? null,
        versaoDocumento: documento?.versao ?? null,
        tituloDocumento: documento?.titulo ?? null,
        enderecoIp: '203.0.113.10',
        atual: true,
        conteudoIntegro: true,
      },
      ...mockConsentimentos,
    ]
  }
}

/**
 * Preço vigente da moeda no modo demo.
 *
 * Deriva da mesma série que alimenta o carrossel, e não de
 * MOCK_COIN_BASE_VALUE. O valor-base é só o ponto de partida do passeio
 * aleatório: para o ETH ele é 3500 enquanto a tela exibe ~4036. Comparar o
 * alvo contra a base fazia o mock recusar um alerta perfeitamente válido
 * dizendo que ele era "igual ao preço atual" — um preço que o usuário não vê
 * em lugar nenhum.
 */
const mockPrecoAtual = (sigla) => {
  const registros = buildCoinValueResponse(String(sigla).toUpperCase())?.resultado?.registros
  // A série vem em ordem decrescente: o primeiro é o candle mais recente.
  return registros?.[0]?.precoFechamento ?? MOCK_COIN_BASE_VALUE[String(sigla).toUpperCase()] ?? 100
}

const mockCriarAlerta = (body) => {
  const sigla = String(body?.siglaMoeda || '').toUpperCase()
  const valorAlvo = Number(body?.valorAlvo)
  const precoAtual = mockPrecoAtual(sigla)

  if (!Number.isFinite(valorAlvo) || valorAlvo <= 0) {
    const err = new Error('Valor alvo deve ser maior que zero.')
    err.status = 400
    throw err
  }

  if (valorAlvo === precoAtual) {
    const err = new Error('Valor alvo é igual ao preço atual. Escolha um valor acima ou abaixo.')
    err.status = 400
    throw err
  }

  mockAlertas = [
    {
      idAlertaPrecoTB: `mock-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      idMoeda: `mock-moeda-${sigla}`,
      siglaMoeda: sigla,
      nomeMoeda: sigla,
      valorAlvo,
      // Inferida aqui pelo mesmo critério do servidor: alvo acima do preço
      // vigente sobe, abaixo desce.
      direcao: valorAlvo > precoAtual ? 'ACIMA' : 'ABAIXO',
      status: 'ATIVO',
      valorReferencia: precoAtual,
      dataCriacao: new Date().toISOString(),
      dataDisparo: null,
      valorDisparo: null,
    },
    ...mockAlertas,
  ]

  return { mensagem: 'Alerta mock criado com sucesso' }
}

// Zoo de estratégias (/api/ZooEstrategia/*): a rodada real guardada em
// mockZooEstrategia.js. A janela do agente (?janela=teste-agente) saiu da tela
// em 04/11/2026, com o agente encerrado; o modo demo responde só o histórico. A curva vem como a API a devolve — uma por estratégia,
// em ordem de nome —, só que com menos pontos.
const DIA_MS = 24 * 60 * 60 * 1000

const mockZooRodada = () => ({ mensagem: 'Rodada do zoo (mock)', resultado: RODADA_ZOO })

const mockZooCurva = (endpoint) => {
  const q = lerQuery(endpoint)
  const moeda = (q.get('moeda') || '').trim().toUpperCase()
  if (!moeda) {
    const erro = new Error('Informe a moeda da curva.')
    erro.status = 400
    throw erro
  }
  const rodada = RODADA_ZOO
  const curvas = CURVAS_ZOO
  const pedidas = (q.get('estrategias') || '').split(',').map((e) => e.trim()).filter(Boolean)
  const nomes = pedidas.length > 0 ? pedidas : rodada.estrategias.map((e) => e.estrategia)
  // dataInicio/dataFim filtram como na API. A tela do robô ao vivo pedia datas
  // até 28/10/2026, quando passou a ler o placar pronto (PLACAR_ROBO).
  const dataInicio = q.get('dataInicio') ? Date.parse(`${q.get('dataInicio').slice(0, 10)}T00:00:00Z`) : null
  const dataFim = q.get('dataFim') ? Date.parse(`${q.get('dataFim').slice(0, 10)}T00:00:00Z`) : null
  const comData = dataInicio !== null || dataFim !== null
  const noPeriodo = (p) => {
    const ms = Date.parse(p.data)
    return (dataInicio === null || ms >= dataInicio) && (dataFim === null || ms <= dataFim)
  }
  const resultado = [...new Set(nomes)]
    .sort()
    .map((estrategia) => ({ estrategia, curva: curvas[`${estrategia}|${moeda}`] }))
    .filter(({ curva }) => curva)
    .map(({ estrategia, curva }) => {
      const inicio = Date.parse(`${curva.inicio}T00:00:00Z`)
      const pontos = curva.pontos.map(([dias, patrimonio, exposicao]) => ({
        data: new Date(inicio + dias * DIA_MS).toISOString(),
        patrimonio,
        exposicao,
      }))
      return {
        versaoZoo: rodada.versaoZoo,
        estrategia,
        moeda,
        pontos: comData ? pontos.filter(noPeriodo) : pontos,
      }
    })
    .filter((c) => c.pontos.length > 0)
  return { mensagem: resultado.length ? 'Curva do zoo (mock)' : 'Dados não encontrados', resultado }
}

// As decisões do robô por vela (/ThinkBitcoin/sequenciasRetorno, sem a barra
// final): os filtros e a paginação da FuncaoObterSequenciaRetorno, sobre as
// velas das 23h reais de mockRoboAoVivo.js. Com a barra final, a rota segue no
// mock antigo (buildSequenceResponse), que nenhuma tela usa.
const mockSequenciasDoRobo = (endpoint) => {
  const q = lerQuery(endpoint)
  const sigla = (q.get('siglaMoeda') || '').trim().toUpperCase()
  const utc = (v) => Date.parse(/([zZ]|[+-]\d{2}:?\d{2})$/.test(v) ? v : `${v}Z`)
  const dataInicio = q.get('dataInicio') ? utc(q.get('dataInicio')) : null
  const dataFim = q.get('dataFim') ? utc(q.get('dataFim')) : null
  const pagina = Math.max(1, Number(q.get('pagina')) || 1)
  const quantidade = Math.max(1, Number(q.get('quantidade')) || 10)
  const asc = q.get('ordemAsc') === 'true'
  const filtrados = SEQUENCIAS_ROBO
    .filter((s) => !sigla || s.moeda.toUpperCase() === sigla)
    .filter((s) => dataInicio === null || utc(s.dataHora) >= dataInicio)
    .filter((s) => dataFim === null || utc(s.dataHora) <= dataFim)
    .sort((a, b) => (asc ? 1 : -1) * (utc(a.dataHora) - utc(b.dataHora)))
  return {
    mensagem: 'Operação realizada com sucesso',
    resultado: {
      totalRegistros: filtrados.length,
      totalPaginas: Math.ceil(filtrados.length / quantidade),
      paginaAtual: pagina,
      registros: filtrados.slice((pagina - 1) * quantidade, pagina * quantidade),
    },
  }
}

// Operações do robô ao vivo (/ThinkBitcoin/historicoDecisoes): os filtros e a
// paginação da FuncaoObterHistoricoDecisao, sobre as decisões reais guardadas
// em mockRoboAoVivo.js. A data sem fuso é UTC, como no banco.
const mockHistoricoDecisoes = (endpoint) => {
  const q = lerQuery(endpoint)
  const sigla = (q.get('siglaMoeda') || '').trim().toUpperCase()
  const status = (q.get('status') || '').trim().toUpperCase()
  const utc = (v) => Date.parse(/([zZ]|[+-]\d{2}:?\d{2})$/.test(v) ? v : `${v}Z`)
  const dataInicio = q.get('dataInicio') ? utc(q.get('dataInicio')) : null
  const dataFim = q.get('dataFim') ? utc(q.get('dataFim')) : null
  const pagina = Math.max(1, Number(q.get('pagina')) || 1)
  const quantidade = Math.max(1, Number(q.get('quantidade')) || 10)
  const asc = q.get('ordemAsc') === 'true'
  const filtrados = DECISOES_ROBO
    .filter((d) => !sigla || d.moedaSigla.toUpperCase() === sigla)
    .filter((d) => !status || d.status.toUpperCase() === status)
    .filter((d) => dataInicio === null || utc(d.dataHora) >= dataInicio)
    .filter((d) => dataFim === null || utc(d.dataHora) <= dataFim)
    .sort((a, b) => (asc ? 1 : -1) * (utc(a.dataHora) - utc(b.dataHora)))
  return {
    mensagem: 'Operação realizada com sucesso',
    resultado: {
      totalRegistros: filtrados.length,
      totalPaginas: Math.ceil(filtrados.length / quantidade),
      paginaAtual: pagina,
      registros: filtrados.slice((pagina - 1) * quantidade, pagina * quantidade),
    },
  }
}

// Quem entra no modo demo. Qualquer credencial entra como Minerador, para que
// os recursos de assinatura (alertas de preço) apareçam em vez de virarem
// cadeado. Um e-mail que começa com "admin" entra como Administrador, para
// exercitar as telas internas (Pedidos do Pregão); o Trader da Equipe Pregão
// entra com trader@teste.local e continua vendo a plataforma como cliente.
//
// A renovação não manda e-mail: mantém quem está na sessão, como a API, que
// reemite o token para o usuário do token atual.
const EMAIL_DEMO = 'teste@thinkbitcoin.com'
const sessaoMock = (endpoint, body) => {
  if (endpoint.endsWith('/renovar')) {
    const atual = decodeAuthenticationToken(getStoredToken())
    return temCargo(atual, AuthRole.ADMINISTRADOR)
      ? { email: atual.email || EMAIL_DEMO, cargo: AuthRole.ADMINISTRADOR }
      : { email: EMAIL_DEMO, cargo: AuthRole.MINERADOR }
  }
  const email = String(body?.email ?? '').trim().toLowerCase()
  return email.startsWith('admin')
    ? { email, cargo: AuthRole.ADMINISTRADOR }
    : { email: EMAIL_DEMO, cargo: AuthRole.MINERADOR }
}

// Pedidos de alteração da Equipe Pregão (/api/PedidoAlteracao). Sete pedidos,
// com os achados que o Trader de fato repetiu entre os dias:
//   · três esperando decisão (os dois primeiros são os do contrato da fila no
//     Back-DotNet);
//   · um aprovado, esperando a correção;
//   · dois que fizeram o ciclo: o rótulo de preço no índice de busca, corrigido
//     (7fe6ede), e o "Acessar terminal" que devolvia o logado ao login,
//     corrigido (a538d17) e validado pelo Pregão;
//   · um descartado, para o filtro de descartados ter o que mostrar.
// A página aberta mostra só os três que um administrador aprovou: os abertos e
// o descartado ficam só na tela do administrador.
// Cada um guarda a linha do tempo (`eventos`), como TbPedidoAlteracaoEvento: o
// detalhe dos passos do Pregão é o texto do consumidor; o da decisão, o motivo.
// Em memória de propósito, como os alertas: o que vale é ver a fila mudar ao
// decidir, não sobreviver ao reload.
//
// As datas andam com o relógio (horas antes do load), para "última vez" não
// envelhecer na demo, e saem sem marca de fuso, como a API as serializa
// (utcSemFuso).
const PEDIDO_AGORA = Date.now()
const pedidoHaHoras = (horas) => utcSemFuso(PEDIDO_AGORA - horas * 3600 * 1000)
// O nome da rodada no Pregão (a pasta do diário): AAAA-MM-DD_HHMM.
const rodadaHaHoras = (horas) => pedidoHaHoras(horas).slice(0, 16).replace('T', '_').replace(':', '')
const ORDEM_DOS_TIPOS = ['errado', 'automatico', 'confuso', 'falta']

// Os textos do FuncaoPedidoAlteracaoPregaoConsumidor para os passos do Pregão.
const detalheAberto = (dias, rodadas, visitas) =>
  `Visto em ${dias} dias diferentes (${rodadas} de ${visitas} rodadas que passaram pela tela).`
const DETALHE_VALIDADO = 'Não se repetiu nos 3 dias depois da correção (8 rodadas na janela; o critério é aparecer em 2 dias diferentes).'

// Um passo da linha do tempo. `autor` e `statusAnterior` existem no banco e
// nunca saem na API pública.
const eventoMock = (acao, horas, { anterior = null, detalhe = null, autor = 'pregao.trader' } = {}) => ({
  acao,
  dataHora: pedidoHaHoras(horas),
  autor,
  statusAnterior: anterior,
  statusNovo: acao,
  detalhe,
})

const pedidoMock = (dados) => ({
  agente: 'pregao.trader',
  ambiente: 'http://localhost:5174',
  trecho: null,
  detalhe: null,
  ajuste: null,
  janelaDias: 3,
  minimoDias: 2,
  rodadasNaJanela: 8,
  dataHora: pedidoHaHoras(3.5),
  status: STATUS.ABERTO,
  decididoPor: null,
  motivoDecisao: null,
  referenciaCorrecao: null,
  ...dados,
})

let mockPedidos = [
  pedidoMock({
    idPedidoAlteracao: '5b0e7c1a-3f2d-4e8a-9b6c-0d1e2f3a4b01',
    chave: '7733adfd8f8ce6a88ee0b5a1891a48bf9570094b',
    tipo: 'errado',
    telas: 'Alertas de preço · Geopolítica',
    problema: 'Atraso de até 1 hora no e-mail é inviável para day trade',
    trecho: 'avisamos por e-mail em até 1 hora',
    detalhe: 'A janela de alertas diz "avisamos por e-mail em até 1 hora". No day trade o preço passa pelo alvo e volta em minutos: o aviso chega quando a entrada já passou.',
    ajuste: 'Avisar no momento em que o preço atinge o valor, por notificação no navegador, com o e-mail como cópia, e dizer na janela quanto o aviso pode demorar.',
    dias: 3,
    rodadas: 5,
    visitas: 8,
    primeiraVez: pedidoHaHoras(52),
    ultimaVez: pedidoHaHoras(4),
    diarios: [52, 44, 33, 9, 4].map(rodadaHaHoras),
    dataStatus: pedidoHaHoras(28),
    dataCriacao: pedidoHaHoras(28),
    // Aberto com o que se via então; os contadores andam depois, sem passo novo.
    eventos: [eventoMock('aberto', 28, { detalhe: detalheAberto(2, 3, 6) })],
  }),
  pedidoMock({
    idPedidoAlteracao: '5b0e7c1a-3f2d-4e8a-9b6c-0d1e2f3a4b02',
    chave: '6edbc4dd08c02755f350bea18772769702d983b4',
    tipo: 'confuso',
    telas: 'Alertas de preço',
    problema: 'Lista com 10 ativos sob rótulo de TOP 5',
    detalhe: 'O título "TOP 5 ATIVOS DO MOMENTO" fica sobre uma lista de 10 ativos, com Solana, Chainlink e Litecoin abaixo do quinto. Quem lê não sabe se o ranking é dos 5 primeiros ou da lista inteira.',
    ajuste: 'Mostrar só os 5 primeiros sob esse título, ou trocar o título para dizer quantos ativos a lista tem.',
    dias: 2,
    rodadas: 2,
    visitas: 7,
    primeiraVez: pedidoHaHoras(33),
    ultimaVez: pedidoHaHoras(9),
    diarios: [33, 9].map(rodadaHaHoras),
    dataStatus: pedidoHaHoras(9),
    dataCriacao: pedidoHaHoras(9),
    eventos: [eventoMock('aberto', 9, { detalhe: detalheAberto(2, 2, 7) })],
  }),
  pedidoMock({
    idPedidoAlteracao: '5b0e7c1a-3f2d-4e8a-9b6c-0d1e2f3a4b03',
    chave: '0c9f3be1a7d24e6f8b5a2c1d0e9f8a7b6c5d4e3f',
    tipo: 'falta',
    telas: 'Painel',
    problema: 'Sem gráfico de candles interativo com ferramentas de desenho',
    dias: 2,
    rodadas: 3,
    visitas: 8,
    primeiraVez: pedidoHaHoras(47),
    ultimaVez: pedidoHaHoras(4),
    diarios: [47, 28, 4].map(rodadaHaHoras),
    dataStatus: pedidoHaHoras(28),
    dataCriacao: pedidoHaHoras(28),
    eventos: [eventoMock('aberto', 28, { detalhe: detalheAberto(2, 2, 6) })],
  }),
  pedidoMock({
    idPedidoAlteracao: '5b0e7c1a-3f2d-4e8a-9b6c-0d1e2f3a4b04',
    chave: '9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d',
    tipo: 'confuso',
    telas: 'Simulação',
    problema: 'Significado do intervalo de confiança IC 95% não está claro',
    trecho: 'IC 95%',
    dias: 2,
    rodadas: 2,
    visitas: 6,
    primeiraVez: pedidoHaHoras(50),
    ultimaVez: pedidoHaHoras(28),
    diarios: [50, 28].map(rodadaHaHoras),
    dataHora: pedidoHaHoras(27.5),
    status: STATUS.DESCARTADO,
    dataStatus: pedidoHaHoras(20),
    decididoPor: 'admin@teste.local',
    motivoDecisao: 'Agora não: a simulação é para quem estuda regras, não para o day trade.',
    dataCriacao: pedidoHaHoras(27),
    eventos: [
      eventoMock('aberto', 27, { detalhe: detalheAberto(2, 2, 6) }),
      eventoMock('descartado', 20, {
        anterior: 'aberto',
        autor: 'admin@teste.local',
        detalhe: 'Agora não: a simulação é para quem estuda regras, não para o day trade.',
      }),
    ],
  }),
  pedidoMock({
    idPedidoAlteracao: '5b0e7c1a-3f2d-4e8a-9b6c-0d1e2f3a4b05',
    chave: '3a7f9c2e4b6d8a0c1e3f5a7b9c1d3e5f7a9b1c3d',
    tipo: 'errado',
    telas: 'Painel',
    problema: 'Variação do BTC no carrossel não bate com a do gráfico',
    trecho: 'BTC -0,9%',
    detalhe: 'O carrossel do Painel mostra "BTC -0,9%" e o gráfico logo abaixo, no mesmo período, "-0.91%". Com duas casas num lugar e uma no outro, parece que são dois números diferentes.',
    ajuste: 'Usar a mesma variação, com as mesmas casas decimais e o mesmo separador, no carrossel e no gráfico.',
    dias: 2,
    rodadas: 2,
    visitas: 8,
    primeiraVez: pedidoHaHoras(70),
    ultimaVez: pedidoHaHoras(46),
    diarios: [70, 46].map(rodadaHaHoras),
    dataHora: pedidoHaHoras(45.5),
    status: STATUS.APROVADO,
    dataStatus: pedidoHaHoras(20),
    decididoPor: 'admin@teste.local',
    dataCriacao: pedidoHaHoras(45),
    eventos: [
      eventoMock('aberto', 45, { detalhe: detalheAberto(2, 2, 8) }),
      eventoMock('aprovado', 20, { anterior: 'aberto', autor: 'admin@teste.local' }),
    ],
  }),
  pedidoMock({
    idPedidoAlteracao: '5b0e7c1a-3f2d-4e8a-9b6c-0d1e2f3a4b06',
    chave: '8c1e5a9d3f7b2c6e0a4d8f2b6c0e4a8d2f6b0c4e',
    tipo: 'confuso',
    telas: 'Painel',
    problema: 'Índice de interesse de busca aparece com rótulos de preço',
    trecho: 'Médias Móveis - Tendência de Baixa',
    dias: 3,
    rodadas: 4,
    visitas: 9,
    primeiraVez: pedidoHaHoras(150),
    ultimaVez: pedidoHaHoras(101),
    diarios: [150, 126, 105, 101].map(rodadaHaHoras),
    dataHora: pedidoHaHoras(100.5),
    status: STATUS.CORRIGIDO,
    referenciaCorrecao: 'https://dev.azure.com/helamaborges/ThinkBitcoin/_git/ThinkBitcoin-Front/pullrequest/38',
    dataStatus: pedidoHaHoras(80),
    decididoPor: 'admin@teste.local',
    dataCriacao: pedidoHaHoras(120),
    eventos: [
      eventoMock('aberto', 120, { detalhe: detalheAberto(2, 3, 7) }),
      eventoMock('aprovado', 100, { anterior: 'aberto', autor: 'admin@teste.local' }),
      eventoMock('em-correcao', 98, { anterior: 'aprovado', autor: 'agents-oficina' }),
      eventoMock('corrigido', 80, { anterior: 'em-correcao', autor: 'agents-oficina' }),
    ],
  }),
  pedidoMock({
    idPedidoAlteracao: '5b0e7c1a-3f2d-4e8a-9b6c-0d1e2f3a4b07',
    chave: 'e2b4d6f8a0c2e4b6d8f0a2c4e6b8d0f2a4c6e8b0',
    tipo: 'errado',
    telas: 'Início',
    problema: 'Já logado, "Acessar terminal" volta ao formulário de login',
    trecho: 'Acessar terminal',
    dias: 2,
    rodadas: 3,
    visitas: 8,
    primeiraVez: pedidoHaHoras(230),
    ultimaVez: pedidoHaHoras(205),
    diarios: [230, 210, 205].map(rodadaHaHoras),
    dataHora: pedidoHaHoras(100.5),
    status: STATUS.VALIDADO,
    referenciaCorrecao: 'https://dev.azure.com/helamaborges/ThinkBitcoin/_git/ThinkBitcoin-Front/pullrequest/36',
    dataStatus: pedidoHaHoras(100),
    decididoPor: 'admin@teste.local',
    dataCriacao: pedidoHaHoras(204),
    eventos: [
      eventoMock('aberto', 204, { detalhe: detalheAberto(2, 3, 8) }),
      eventoMock('aprovado', 190, { anterior: 'aberto', autor: 'admin@teste.local' }),
      eventoMock('em-correcao', 189, { anterior: 'aprovado', autor: 'agents-oficina' }),
      eventoMock('corrigido', 180, { anterior: 'em-correcao', autor: 'agents-oficina' }),
      eventoMock('validado', 100, { anterior: 'corrigido', detalhe: DETALHE_VALIDADO }),
    ],
  }),
]

const erroDoPedido = (mensagem) => {
  const err = new Error(mensagem)
  err.status = 400
  throw err
}

// A ordem da API: do mais grave ao menos grave e, no mesmo tipo, do visto em
// mais dias, em mais rodadas e mais recentemente. Tipo novo vai para o fim.
const posicaoDoTipo = (tipo) => {
  const posicao = ORDEM_DOS_TIPOS.indexOf(tipo)
  return posicao >= 0 ? posicao : ORDEM_DOS_TIPOS.length
}

const ordenarPedidos = (lista) => [...lista].sort((a, b) => posicaoDoTipo(a.tipo) - posicaoDoTipo(b.tipo)
  || b.dias - a.dias
  || b.rodadas - a.rodadas
  || Date.parse(b.ultimaVez) - Date.parse(a.ultimaVez))

const respostaDaLista = (resultado) =>
  ({ mensagem: resultado.length ? 'Operação realizada com sucesso' : 'Dados não encontrados', resultado })

const mockListarPedidos = (endpoint) => {
  const q = lerQuery(endpoint)
  const status = (q.get('status') || '').trim().toLowerCase()
  const tipo = (q.get('tipo') || '').trim().toLowerCase()
  const agente = (q.get('agente') || '').trim().toLowerCase()
  if (status && !Object.values(STATUS).includes(status)) {
    erroDoPedido(`Status desconhecido: '${q.get('status')}'. Use ${Object.values(STATUS).join(', ')}.`)
  }
  const filtrados = mockPedidos
    .filter((p) => (!status || p.status === status) && (!tipo || p.tipo === tipo) && (!agente || p.agente.toLowerCase() === agente))
  // A lista do administrador não traz a linha do tempo (é do GET /{id}).
  return respostaDaLista(ordenarPedidos(filtrados).map(({ eventos: _eventos, ...pedido }) => pedido))
}

// A lista aberta (/api/PedidoAlteracao/publico, sem login): só o que um
// administrador aprovou (aprovado, em-correcao, corrigido, validado), até 200,
// na ordem do administrador. Esperando decisão e descartado nunca vêm. Só os
// campos que a API pública expõe: nada de quem decidiu, motivo, link do PR,
// ambiente, diários, chave ou agente. Nos passos, o detalhe só nos do Pregão —
// o da decisão é o motivo, e o motivo é privado.
const LIMITE_PUBLICO = 200
const ACOES_DO_PREGAO = [STATUS.ABERTO, STATUS.REABERTO, STATUS.VALIDADO]

const mockPedidosPublicos = () => respostaDaLista(
  ordenarPedidos(mockPedidos.filter((p) => STATUS_PUBLICOS.includes(p.status)))
    .slice(0, LIMITE_PUBLICO)
    .map((p) => ({
      idPedidoAlteracao: p.idPedidoAlteracao,
      tipo: p.tipo,
      telas: p.telas,
      problema: p.problema,
      trecho: p.trecho,
      detalhe: p.detalhe,
      ajuste: p.ajuste,
      dias: p.dias,
      rodadas: p.rodadas,
      visitas: p.visitas,
      primeiraVez: p.primeiraVez,
      ultimaVez: p.ultimaVez,
      status: p.status,
      dataStatus: p.dataStatus,
      eventos: p.eventos.map((e) => ({
        acao: e.acao,
        dataHora: e.dataHora,
        statusNovo: e.statusNovo,
        detalhe: ACOES_DO_PREGAO.includes(e.acao) ? e.detalhe : null,
      })),
    }))
)

const ROTA_DECISAO = /^\/api\/PedidoAlteracao\/([^/?]+)\/decisao$/

// As mesmas regras e mensagens da FuncaoDecidirPedidoAlteracao, com o passo na
// linha do tempo.
const mockDecidirPedido = (endpoint, body) => {
  const id = endpoint.match(ROTA_DECISAO)?.[1]
  const decisao = String(body?.decisao ?? '').trim().toLowerCase()
  if (decisao !== DECISOES.APROVADO && decisao !== DECISOES.DESCARTADO) {
    erroDoPedido(`Decisão desconhecida: '${body?.decisao ?? ''}'. Use ${DECISOES.APROVADO} ou ${DECISOES.DESCARTADO}.`)
  }
  const motivo = typeof body?.motivo === 'string' && body.motivo.trim() ? body.motivo.trim() : null
  if (decisao === DECISOES.DESCARTADO && !motivo) erroDoPedido('Informe o motivo do descarte.')
  if (motivo && motivo.length > TAMANHO_MOTIVO) erroDoPedido(`O motivo passa de ${TAMANHO_MOTIVO} caracteres.`)

  const pedido = mockPedidos.find((p) => p.idPedidoAlteracao === id)
  if (!pedido) erroDoPedido('Pedido não encontrado.')
  // A nova tentativa só se descarta, como no backend (StatusPedidoAlteracao.Descartaveis).
  const decidivel = AGUARDANDO_DECISAO.includes(pedido.status)
    || (decisao === DECISOES.DESCARTADO && podeDescartar(pedido))
  if (!decidivel) {
    erroDoPedido(`O pedido está ${pedido.status}: só se decide um pedido ${AGUARDANDO_DECISAO.join(' ou ')}.`)
  }

  const agora = utcSemFuso(Date.now())
  const quem = decodeAuthenticationToken(getStoredToken())?.email || 'admin@teste.local'
  mockPedidos = mockPedidos.map((p) => (p === pedido
    ? {
      ...p,
      status: decisao,
      dataStatus: agora,
      decididoPor: quem,
      motivoDecisao: motivo,
      eventos: [
        ...p.eventos,
        { acao: decisao, dataHora: agora, autor: quem, statusAnterior: p.status, statusNovo: decisao, detalhe: motivo },
      ],
    }
    : p))
  return { mensagem: 'Operação realizada com sucesso' }
}

const mockHandlers = [
  {
    method: 'GET',
    match: (endpoint) => endpoint.split('?')[0] === '/api/PedidoAlteracao',
    response: (endpoint) => mockListarPedidos(endpoint),
  },
  {
    method: 'GET',
    match: (endpoint) => endpoint.split('?')[0] === '/api/PedidoAlteracao/publico',
    response: () => mockPedidosPublicos(),
  },
  {
    method: 'POST',
    match: (endpoint) => ROTA_DECISAO.test(endpoint),
    response: (endpoint, body) => mockDecidirPedido(endpoint, body),
  },
  {
    method: 'GET',
    match: (endpoint) => endpoint.split('?')[0] === '/api/ZooEstrategia/rodada',
    response: (endpoint) => mockZooRodada(endpoint),
  },
  {
    method: 'GET',
    match: (endpoint) => endpoint.split('?')[0] === '/api/ZooEstrategia/curva',
    response: (endpoint) => mockZooCurva(endpoint),
  },
  {
    method: 'GET',
    match: (endpoint) => endpoint.split('?')[0] === '/ThinkBitcoin/historicoDecisoes',
    response: (endpoint) => mockHistoricoDecisoes(endpoint),
  },
  {
    method: 'GET',
    match: (endpoint) => endpoint.split('?')[0] === '/ThinkBitcoin/sequenciasRetorno',
    response: (endpoint) => mockSequenciasDoRobo(endpoint),
  },
  // O placar do robô ao vivo, pronto como o .NET o devolve (mockRoboAoVivo.js).
  {
    method: 'GET',
    match: (endpoint) => endpoint.split('?')[0] === '/api/RoboAoVivo/placar',
    response: () => ({ mensagem: 'Operação realizada com sucesso', resultado: PLACAR_ROBO }),
  },
  // A regra do robô nos fechamentos, pronta como o .NET a devolve (mockRoboAoVivo.js).
  {
    method: 'GET',
    match: (endpoint) => endpoint.split('?')[0] === '/api/RoboAoVivo/regra',
    response: () => ({ mensagem: 'Operação realizada com sucesso', resultado: REGRA_ROBO }),
  },
  // A regra nas 10 moedas do zoo, pronta como o .NET a devolve (mockRoboAoVivo.js).
  {
    method: 'GET',
    match: (endpoint) => endpoint.split('?')[0] === '/api/RoboAoVivo/radar',
    response: () => ({ mensagem: 'Operação realizada com sucesso', resultado: RADAR_ROBO }),
  },
  {
    method: 'POST',
    match: (endpoint) =>
      endpoint === '/ThinkBitcoin/gerarTokenBearer' ||
      endpoint === '/ThinkBitcoin/gerarTokenBearer/renovar',
    response: (endpoint, body) => {
      // Minerador, ou Administrador com e-mail "admin…" (sessaoMock).
      const sessao = sessaoMock(endpoint, body)
      // Cria um payload mock no padrão JWT para o decode da aplicação
      const payload = {
        'idUsuarioTB': 'b282e124-4dd8-4ccd-a9c6-5b6b0c324a50',
        // Igual à API: o nome sai do banco na reemissão, então o que o usuário
        // salvou em /settings precisa aparecer aqui depois de renovar.
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name': readMockPrefs()?.nome || 'Usuário Teste',
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress': sessao.email,
        'http://schemas.microsoft.com/ws/2008/06/identity/claims/role': sessao.cargo,
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
    match: (endpoint) => endpoint === '/ThinkBitcoin/alertas-preco',
    response: () => ({
      mensagem: 'Alertas mock retornados com sucesso',
      resultado: mockAlertas,
    }),
  },
  {
    method: 'POST',
    match: (endpoint) => endpoint === '/ThinkBitcoin/alertas-preco',
    response: (endpoint, body) => mockCriarAlerta(body),
  },
  {
    method: 'DELETE',
    match: (endpoint) => endpoint.startsWith('/ThinkBitcoin/alertas-preco/'),
    response: (endpoint) => {
      const id = endpoint.split('/').pop()
      const antes = mockAlertas.length
      mockAlertas = mockAlertas.filter((a) => a.idAlertaPrecoTB !== id)
      if (mockAlertas.length === antes) {
        const err = new Error('Alerta não encontrado.')
        err.status = 400
        throw err
      }
      return { mensagem: 'Alerta mock excluído com sucesso' }
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
        saldoSeguranca: 500.0,
        siglaMoedaSaldoSeguranca: 'USDT',
        perfilRisco: 'moderado',
        siglaMoedaUltimaInteracaoIA: 'ETH',
        dataUltimaInteracaoIA: new Date().toISOString(),
        // O que o usuário já alterou nesta sessão vence os valores fixos acima.
        ...(readMockPrefs() || {}),
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
      writeMockPrefs({ ...(readMockPrefs() || {}), ...(body || {}) })
      return { mensagem: 'Preferências mock atualizadas com sucesso' };
    },
  },
  {
    method: 'PUT',
    match: (endpoint) => endpoint === '/ThinkBitcoin/usuariosTB/meu-perfil',
    response: (endpoint, body) => {
      const nome = body?.nome?.trim()
      if (!nome) {
        const err = new Error('Nome não pode ser vazio.')
        err.status = 400
        throw err
      }
      writeMockPrefs({ ...(readMockPrefs() || {}), nome })
      return { mensagem: 'Perfil mock atualizado com sucesso' }
    },
  },
  {
    method: 'POST',
    match: (endpoint) => endpoint === '/ThinkBitcoin/usuariosTB/excluir-conta',
    response: (endpoint, body) => {
      // O mock não guarda a senha do usuário demo: aceita qualquer uma, menos
      // este valor sentinela, que existe para exercitar o caminho de erro.
      if (!body?.senha || body.senha === 'senha-errada') {
        const err = new Error('A senha informada está incorreta.')
        err.status = 400
        throw err
      }
      return { mensagem: 'Conta mock excluída com sucesso' }
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

      // Mesma recusa do servidor: sem o aceite dos dois documentos, com a
      // versão de cada um, não há cadastro. Um mock permissivo aqui esconderia
      // no modo demo exatamente a regra que o produto passou a ter.
      const aceitou = (tipo) =>
        (body?.aceites ?? []).some((a) => a?.tipo === tipo && a?.concedido && !!a?.idDocumentoLegal)

      if (!aceitou('PRIVACIDADE') || !aceitou('TERMOS')) {
        const err = new Error('É necessário aceitar a Política de Privacidade e os Termos de Uso.')
        err.status = 400
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
  // Catálogo de moedas. Faltava um handler para esta rota, e a falta não dava
  // erro visível: `apiRequest` só usa o mock quando algum handler casa, e sem
  // casar a chamada seguia para a rede de verdade. No modo demo — que existe
  // justamente para rodar sem backend — isso significava carrossel vazio,
  // "Carregando moedas..." eterno e, por tabela, dashboard e heatmap sem série
  // nenhuma, já que ambos partem desta lista para descobrir sigla e idMoeda.
  {
    method: 'GET',
    match: (endpoint) => endpoint.split('?')[0] === '/ThinkBitcoin/moedas',
    response: () => ({
      mensagem: 'Moedas mock retornadas com sucesso',
      // `valorBase` fica de fora: é combustível do gerador de séries, não
      // contrato da API. Quem quer preço chama /moeda/{sigla}/valor.
      resultado: MOCK_MOEDAS.map(({ id, sigla, nome }) => ({ id, sigla, nome })),
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
    response: (endpoint) => {
      const urlQuery = endpoint.includes('?') ? new URLSearchParams(endpoint.split('?')[1]) : null
      return buildFearGreedResponse(urlQuery)
    },
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

      // Hash da string INTEIRA, sempre. Antes tentava `parseInt` primeiro e só
      // caía no hash quando o resultado era NaN — e `parseInt` para no primeiro
      // caractere não numérico: todo Guid que começa com dígito virava aquele
      // dígito. Como Guid é hexadecimal, dez moedas quaisquer têm boa chance de
      // colidir no mesmo número e receber o MESMO mapa, sem nada acusar. O
      // ramo do parseInt não servia para nada que o hash não sirva.
      const idNum = idMoedaStr
        .split('')
        .reduce((acc, char) => acc + char.charCodeAt(0), 0)

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
      const cotacao = COTACAO_DEMONSTRACAO
      const valorUSD = parseFloat((valorBRL / cotacao).toFixed(2))

      const novo = {
        idPatrimonioTB: globalThis.crypto?.randomUUID?.() || Math.random().toString(36).substring(2, 15),
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
          taxaSaqueAntecipado: 0.0,
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
  },
  {
    method: 'GET',
    match: (endpoint) => /^\/ThinkBitcoin\/documentos-legais\/[A-Z_]+$/.test(endpoint),
    response: (endpoint) => {
      const tipo = endpoint.split('/').pop()
      const documento = documentoVigentePorTipo(tipo)
      if (!documento) {
        const err = new Error('Nenhuma vers\u00e3o vigente encontrada para este documento.')
        err.status = 400
        throw err
      }
      return { mensagem: 'Documento mock retornado com sucesso', resultado: documento }
    },
  },
  {
    method: 'GET',
    match: (endpoint) => /^\/ThinkBitcoin\/documentos-legais\/[A-Z_]+\/versoes$/.test(endpoint),
    response: (endpoint) => {
      const tipo = endpoint.split('/')[3]
      return {
        mensagem: 'Vers\u00f5es mock retornadas com sucesso',
        resultado: MOCK_DOCUMENTOS.filter((d) => d.tipo === tipo).map(({ conteudo: _conteudo, ...meta }) => meta),
      }
    },
  },
  {
    method: 'GET',
    match: (endpoint) => endpoint.startsWith('/ThinkBitcoin/documentos-legais/versao/'),
    response: (endpoint) => {
      const id = endpoint.split('/').pop()
      const documento = MOCK_DOCUMENTOS.find((d) => d.idDocumentoLegal === id)
      if (!documento) {
        const err = new Error('Vers\u00e3o do documento n\u00e3o encontrada.')
        err.status = 400
        throw err
      }
      return { mensagem: 'Vers\u00e3o mock retornada com sucesso', resultado: documento }
    },
  },
  {
    method: 'GET',
    match: (endpoint) => endpoint === '/ThinkBitcoin/consentimentos/pendentes',
    response: () => ({
      mensagem: 'Pend\u00eancias mock retornadas com sucesso',
      // Espelha a regra do servidor: pendente \u00e9 documento obrigat\u00f3rio cujo
      // \u00faltimo registro n\u00e3o \u00e9 um aceite da vers\u00e3o vigente.
      resultado: MOCK_DOCUMENTOS.filter((documento) => {
        const atual = mockConsentimentos.find((c) => c.tipo === documento.tipo && c.atual)
        return !atual || !atual.concedido
      }).map((documento) => {
        const atual = mockConsentimentos.find((c) => c.tipo === documento.tipo && c.atual)
        return {
          tipo: documento.tipo,
          motivo: atual ? 'REVOGADO' : 'NUNCA_ACEITO',
          idDocumentoLegal: documento.idDocumentoLegal,
          versao: documento.versao,
          titulo: documento.titulo,
          resumoAlteracoes: documento.resumoAlteracoes,
          dataVigenciaInicio: documento.dataVigenciaInicio,
          versaoAceitaAnteriormente: atual?.versaoDocumento ?? null,
        }
      }),
    }),
  },
  {
    method: 'GET',
    match: (endpoint) => endpoint === '/ThinkBitcoin/consentimentos/meus',
    response: () => ({
      mensagem: 'Consentimentos mock retornados com sucesso',
      resultado: mockConsentimentos,
    }),
  },
  {
    method: 'POST',
    match: (endpoint) => endpoint === '/ThinkBitcoin/consentimentos',
    response: (endpoint, body) => {
      registrarMockConsentimento(body?.itens, body?.origem ?? 'CONFIGURACOES')
      return {
        mensagem: 'Consentimento mock registrado com sucesso',
        resultado: (body?.itens ?? []).map((i) => i.tipo),
      }
    },
  },
]

export const getMockResponse = ({ endpoint, method, body }) => {
  const normalizedMethod = String(method ?? 'GET').toUpperCase()
  const handler = mockHandlers.find(
    (item) => item.method === normalizedMethod && item.match(endpoint)
  )

  return handler ? handler.response(endpoint, body) : null
}
