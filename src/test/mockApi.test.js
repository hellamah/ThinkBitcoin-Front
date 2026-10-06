/**
 * Testes unitários para utils/mockApi.
 *
 * Cobre:
 * - getMockResponse: todos os handlers registrados na mockApi
 * - Endpoints estáticos e dinâmicos (por símbolo, por id, etc.)
 * - Variação de método HTTP (GET, POST, PUT)
 * - Endpoint não mapeado deve retornar null
 * - Normalização de método (case-insensitive)
 */
import { describe, expect, it, vi } from 'vitest'
import { getMockResponse } from '../src/utils/mockApi'

describe('utils/mockApi › getMockResponse', () => {
  describe('Autenticação', () => {
    it('retorna mock de token para POST /gerarTokenBearer', () => {
      const resp = getMockResponse({
        endpoint: '/ThinkBitcoin/gerarTokenBearer',
        method: 'POST',
      })

      expect(resp).toMatchObject({
        mensagem: expect.any(String),
        resultado: {
          tokenAutenticado: expect.stringContaining('.'),
        },
      })
    })
  })

  describe('Script Comum (Sinal de Trading)', () => {
    it('retorna mock de sinal BUY para POST /AtivadorScript/ScriptComum', () => {
      const resp = getMockResponse({
        endpoint: '/ThinkBitcoin/AtivadorScript/ScriptComum',
        method: 'POST',
      })

      expect(resp).toMatchObject({
        btc: 68000,
        decision: 'BUY',
        confidence: 0.73,
        acao: 1,
      })
    })
  })

  describe('Catálogo de Moedas', () => {
    const listar = () =>
      getMockResponse({ endpoint: '/ThinkBitcoin/moedas', method: 'GET' })?.resultado

    it('retorna a lista de moedas para GET /moedas', () => {
      const moedas = listar()

      expect(Array.isArray(moedas)).toBe(true)
      expect(moedas.length).toBeGreaterThan(0)
      moedas.forEach((m) => {
        expect(m).toMatchObject({
          id: expect.any(String),
          sigla: expect.any(String),
          nome: expect.any(String),
        })
      })
    })

    // O carrossel resolve idMoeda por esta lista e o painel de sentimento pede
    // fear-greed/trend por ele. Ids repetidos fariam duas moedas compartilharem
    // a mesma leitura sem nada acusar.
    it('não repete id entre moedas', () => {
      const ids = listar().map((m) => m.id)

      expect(new Set(ids).size).toBe(ids.length)
    })

    it('usa id no formato Guid, como a API real emite', () => {
      const guid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

      listar().forEach((m) => {
        expect(m.id).toMatch(guid)
      })
    })

    // O que importa não é o formato do id, é o mapa sair diferente por moeda.
    // Já saiu igual: o handler derivava o fator com `parseInt(idMoeda)`, que
    // para no primeiro caractere não numérico — todo Guid começado por dígito
    // colapsava naquele dígito e as moedas dividiam o mesmo mapa.
    it('gera heatmap distinto para cada moeda do catálogo', () => {
      const mapas = listar().map((m) => {
        const resp = getMockResponse({
          endpoint: `/ThinkBitcoin/variavel-externa/trend/heatmap?idMoeda=${m.id}&intervalo=24h`,
          method: 'GET',
        })
        return JSON.stringify(resp.resultado)
      })

      expect(new Set(mapas).size).toBe(mapas.length)
    })

    // useCoinPrices descarta USDT e qualquer moeda cujo nome contenha "dolar".
    // Uma entrada assim sumiria do carrossel sem erro nenhum.
    it('não traz moeda que o carrossel descartaria em silêncio', () => {
      listar().forEach((m) => {
        expect(m.sigla.toUpperCase()).not.toBe('USDT')
        expect(m.nome.toLowerCase()).not.toContain('dolar')
      })
    })

    // Trava a lista ao endpoint de valor: os dois já foram listas separadas, e
    // acrescentar moeda só numa delas a deixava sem série própria.
    it('entrega série de valor para toda moeda listada', () => {
      listar().forEach((m) => {
        const resp = getMockResponse({
          endpoint: `/ThinkBitcoin/moeda/${m.sigla}/valor?quantidade=5`,
          method: 'GET',
        })

        expect(resp?.resultado?.registros?.length).toBeGreaterThan(0)
      })
    })

    // O fallback de 100 do gerador é o sintoma de uma moeda sem valor-base.
    // Com dez moedas caindo nele, todas abririam no mesmo preço.
    it('não deixa moeda cair no valor-base genérico', () => {
      const aberturas = listar().map((m) => {
        const resp = getMockResponse({
          endpoint: `/ThinkBitcoin/moeda/${m.sigla}/valor?quantidade=1`,
          method: 'GET',
        })
        return resp.resultado.registros[0].precoFechamento
      })

      expect(new Set(aberturas).size).toBe(aberturas.length)
    })
  })

  describe('Valor de Moeda', () => {
    it('retorna dados de valor para endpoint de BTC', () => {
      const resp = getMockResponse({
        endpoint: '/ThinkBitcoin/moeda/BTC/valor',
        method: 'GET',
      })

      expect(resp).toMatchObject({
        mensagem: expect.any(String),
        resultado: {
          registros: expect.any(Array),
        },
      })
      expect(resp.resultado.registros.length).toBeGreaterThan(0)
    })

    // Campo constante no mock não quebra nada e não aparece em erro nenhum:
    // o painel simplesmente exibe sempre o mesmo número, e a régua "N× a
    // mediana" trava em 1,0. Já aconteceu quatro vezes neste arquivo.
    it('não deve entregar campo analítico congelado ao longo da série', () => {
      const resp = getMockResponse({
        endpoint: '/ThinkBitcoin/moeda/BTC/valor?quantidade=40',
        method: 'GET',
      })
      const registros = resp.resultado.registros
      expect(registros.length).toBeGreaterThan(20)

      // Campos que alimentam painel ou detector; cada um precisa de variação
      // para o modo demo conseguir demonstrar a leitura que oferece.
      const analiticos = [
        'precoFechamento', 'precoAbertura', 'precoMaior', 'precoMenor',
        'precoPercentualVariacao', 'precoAmplitude', 'precoVolume',
        'precoCorpoCandle', 'precoSombraSuperior', 'precoSombraInferior',
        'precoFinanceiroPorTrade', 'precoRatioCompraVenda',
        'precoVolatilidadePercentual', 'volumeComprado', 'volumeVendido',
        'dominanciaCompradoraPercentual', 'dominanciaVendedoraPercentual',
        'volumeDelta',
      ]

      const congelados = analiticos.filter(
        (campo) => new Set(registros.map((r) => r[campo])).size === 1
      )

      expect(congelados).toEqual([])
    })

    // Campo que varia no tempo mas é igual em todas as moedas passa no teste
    // acima e ainda assim inutiliza qualquer comparação — foi o caso de
    // precoVolatilidadePercentual, que dependia só do índice do candle.
    it('não deve entregar série idêntica entre moedas diferentes', () => {
      const serieDe = (sigla) =>
        getMockResponse({
          endpoint: `/ThinkBitcoin/moeda/${sigla}/valor?quantidade=30`,
          method: 'GET',
        }).resultado.registros

      const btc = serieDe('BTC')
      const eth = serieDe('ETH')

      // Percentuais e razões, que não dependem da escala de preço da moeda e
      // por isso poderiam coincidir sem ninguém notar.
      const comparaveis = [
        'precoPercentualVariacao',
        'precoVolatilidadePercentual',
        'dominanciaCompradoraPercentual',
        'precoRatioCompraVenda',
      ]

      const iguais = comparaveis.filter((campo) =>
        btc.every((r, i) => r[campo] === eth[i]?.[campo])
      )

      expect(iguais).toEqual([])
    })

    it('deve manter o fluxo comprador e vendedor coerente entre si', () => {
      // As duas dominâncias somam 100, o delta é a diferença dos volumes e o
      // ratio é a razão deles. Sem isso o painel mostra números que se
      // contradizem — pressão de 60% com delta negativo, por exemplo.
      const resp = getMockResponse({
        endpoint: '/ThinkBitcoin/moeda/BTC/valor?quantidade=20',
        method: 'GET',
      })

      resp.resultado.registros.forEach((r) => {
        expect(r.dominanciaCompradoraPercentual + r.dominanciaVendedoraPercentual).toBeCloseTo(100, 4)
        expect(r.volumeComprado + r.volumeVendido).toBeCloseTo(r.precoVolume, 4)
        expect(r.volumeDelta).toBeCloseTo(r.volumeComprado - r.volumeVendido, 4)
        expect(r.precoRatioCompraVenda).toBeCloseTo(r.volumeComprado / r.volumeVendido, 4)
      })
    })

    // O preço passeia a partir da base ao longo de um ano de candles, então
    // prendê-lo à base testaria a forma do gerador, não o contrato. O que
    // importa é a moeda usar a base certa — se ETH herdasse a de BTC, o preço
    // sairia vinte vezes fora desta banda.
    const dentroDaBanda = (valor, base) => {
      expect(valor).toBeGreaterThan(base * 0.5)
      expect(valor).toBeLessThan(base * 1.5)
    }

    it('retorna dados de valor para endpoint de ETH', () => {
      const resp = getMockResponse({
        endpoint: '/ThinkBitcoin/moeda/ETH/valor',
        method: 'GET',
      })

      dentroDaBanda(resp?.resultado?.registros?.[0]?.precoFechamento, 3500)
    })

    it('retorna dados de valor para endpoint de DOGE (valor fracionário)', () => {
      const resp = getMockResponse({
        endpoint: '/ThinkBitcoin/moeda/DOGE/valor',
        method: 'GET',
      })

      expect(resp?.resultado?.registros?.[0]?.precoFechamento).toBeLessThan(1)
    })

    it('retorna valor numérico para símbolo desconhecido (fallback de 100)', () => {
      const resp = getMockResponse({
        endpoint: '/ThinkBitcoin/moeda/UNKNOWN/valor',
        method: 'GET',
      })

      dentroDaBanda(resp?.resultado?.registros?.[0]?.precoFechamento, 100)
    })

    it('aceita query string na URL do endpoint de moeda', () => {
      const resp = getMockResponse({
        endpoint: '/ThinkBitcoin/moeda/BTC/valor?page=1',
        method: 'GET',
      })

      expect(resp?.resultado?.registros).toHaveLength(15)
    })
  })

  describe('Sequência de Retorno', () => {
    it('retorna mock de sequência para endpoint base', () => {
      const resp = getMockResponse({
        endpoint: '/ThinkBitcoin/sequenciasRetorno/',
        method: 'GET',
      })

      expect(resp).toMatchObject({
        mensagem: expect.any(String),
        resultado: {
          listaSequenciaRetorno: expect.any(Array),
        },
      })
      expect(resp.resultado.listaSequenciaRetorno.length).toBeGreaterThan(0)
    })

    it('cada item da sequência possui campos obrigatórios', () => {
      const resp = getMockResponse({
        endpoint: '/ThinkBitcoin/sequenciasRetorno/',
        method: 'GET',
      })

      resp.resultado.listaSequenciaRetorno.forEach(item => {
        expect(item).toMatchObject({
          idSequenciaRetorno: expect.any(String),
          dataHora: expect.any(String),
          valorNegociado: expect.any(Number),
          variacaoPercentual: expect.any(Number),
          tipo: expect.any(Number),
        })
      })
    })

    it('retorna mock de sequência para endpoint com id específico', () => {
      const resp = getMockResponse({
        endpoint: '/ThinkBitcoin/sequenciasRetorno/abc-123',
        method: 'GET',
      })

      expect(resp?.resultado?.listaSequenciaRetorno).toBeDefined()
    })
  })

  describe('Preferências', () => {
    it('retorna mock de preferências para GET /preferencias/minhas', () => {
      const resp = getMockResponse({
        endpoint: '/ThinkBitcoin/preferencias/minhas',
        method: 'GET',
      })

      expect(resp).toMatchObject({
        mensagem: expect.any(String),
        resultado: {
          tema: expect.any(String),
          idioma: expect.any(String),
          notificacoes: expect.any(Boolean),
          estiloAlgoritmo: expect.any(String),
        },
      })
    })

    it('retorna confirmação simples para PUT /preferencias', () => {
      const resp = getMockResponse({
        endpoint: '/ThinkBitcoin/preferencias',
        method: 'PUT',
        body: { tema: 'dark' },
      })

      expect(resp).toMatchObject({
        mensagem: expect.any(String),
      })
    })
  })

  describe('Usuários', () => {
    it('retorna mock de usuário para GET /usuariosTB/:id numérico', () => {
      const resp = getMockResponse({
        endpoint: '/ThinkBitcoin/usuariosTB/42',
        method: 'GET',
      })

      expect(resp?.resultado?.listaUsuarioTB).toHaveLength(1)
    })

    const aceitesValidos = [
      { tipo: 'PRIVACIDADE', idDocumentoLegal: 'doc-privacidade', concedido: true },
      { tipo: 'TERMOS', idDocumentoLegal: 'doc-termos', concedido: true },
    ]

    it('retorna confirmação simples para POST /usuariosTB/', () => {
      const resp = getMockResponse({
        endpoint: '/ThinkBitcoin/usuariosTB/',
        method: 'POST',
        body: { email: 'novo@usuario.com', senha: '123', aceites: aceitesValidos },
      })

      expect(resp).toMatchObject({
        mensagem: expect.any(String),
      })
    })

    // O servidor recusa cadastro sem o aceite dos dois documentos; um mock
    // permissivo esconderia essa regra justamente no modo demo.
    it('recusa POST /usuariosTB/ sem o aceite dos dois documentos', () => {
      const cadastrar = (aceites) => () =>
        getMockResponse({
          endpoint: '/ThinkBitcoin/usuariosTB/',
          method: 'POST',
          body: { email: 'novo@usuario.com', senha: '123', aceites },
        })

      expect(cadastrar(undefined)).toThrow(/aceitar/i)
      expect(cadastrar([aceitesValidos[0]])).toThrow(/aceitar/i)
    })

    // Aceite sem a versão do documento é o problema original: marca o checkbox
    // mas não registra o que foi aceito.
    it('recusa aceite sem a versão do documento', () => {
      expect(() =>
        getMockResponse({
          endpoint: '/ThinkBitcoin/usuariosTB/',
          method: 'POST',
          body: {
            email: 'novo@usuario.com',
            senha: '123',
            aceites: aceitesValidos.map((a) => ({ ...a, idDocumentoLegal: null })),
          },
        })
      ).toThrow(/aceitar/i)
    })
  })

  describe('Exchanges', () => {
    it('retorna lista de exchanges para GET /exchanges', () => {
      const resp = getMockResponse({
        endpoint: '/ThinkBitcoin/exchanges',
        method: 'GET',
      })

      expect(resp).toMatchObject({
        mensagem: expect.any(String),
        resultado: expect.any(Array),
      })
      expect(resp.resultado.length).toBeGreaterThan(0)
      expect(resp.resultado[0]).toMatchObject({
        id: expect.any(String),
        nome: expect.any(String),
        sigla: expect.any(String),
      })
    })
  })

  describe('Variáveis Externas (Fear & Greed, Trend e Heatmap)', () => {
    it('retorna série de Fear & Greed para GET /variavel-externa/fear-greed', () => {
      const resp = getMockResponse({
        endpoint: '/ThinkBitcoin/variavel-externa/fear-greed',
        method: 'GET',
      })

      expect(resp.mensagem).toEqual(expect.any(String))
      // Série, não ponto único: o dashboard desenha a evolução do sentimento.
      expect(resp.resultado.registros.length).toBeGreaterThan(1)
      expect(resp.resultado.registros[0]).toMatchObject({
        valor: expect.any(Number),
        classificacao: expect.any(String),
        horaReferencia: expect.any(String),
      })
    })

    it('respeita quantidade e ordena do mais recente para o mais antigo', () => {
      const resp = getMockResponse({
        endpoint: '/ThinkBitcoin/variavel-externa/fear-greed?quantidade=5',
        method: 'GET',
      })

      expect(resp.resultado.registros).toHaveLength(5)

      // A API real usa ordemAsc=false: o índice 0 é sempre a leitura atual.
      const datas = resp.resultado.registros.map((r) => new Date(r.horaReferencia).getTime())
      expect(datas).toEqual([...datas].sort((a, b) => b - a))
    })

    it('retorna mock de Trend para GET /variavel-externa/trend', () => {
      const resp = getMockResponse({
        endpoint: '/ThinkBitcoin/variavel-externa/trend',
        method: 'GET',
      })

      expect(resp).toMatchObject({
        mensagem: expect.any(String),
        resultado: {
          registros: [
            {
              valorAtual: expect.any(Number),
              geoTop1Code: expect.any(String),
            }
          ]
        }
      })
    })

    it('retorna mock de Heatmap para GET /variavel-externa/trend/heatmap', () => {
      const resp = getMockResponse({
        endpoint: '/ThinkBitcoin/variavel-externa/trend/heatmap',
        method: 'GET',
      })

      expect(resp).toMatchObject({
        mensagem: expect.any(String),
        resultado: {
          registros: expect.any(Array)
        }
      })
      expect(resp.resultado.registros.length).toBeGreaterThan(0)
      expect(resp.resultado.registros[0]).toMatchObject({
        geoTop1Code: expect.any(String),
        frequenciaLideranca: expect.any(Number)
      })
    })

    it('retorna mock de Heatmap para GET /variavel-externa/trend/heatmap com query string (idMoeda)', () => {
      const resp = getMockResponse({
        endpoint: '/ThinkBitcoin/variavel-externa/trend/heatmap?idMoeda=924a77fc-31d8-4246-b07c-59729ffac63b',
        method: 'GET',
      })

      expect(resp).toMatchObject({
        mensagem: expect.any(String),
        resultado: {
          registros: expect.any(Array)
        }
      })
      expect(resp.resultado.registros.length).toBeGreaterThan(0)
    })
  })

  // O mock do treino imita o FORMATO dos dados reais. Antes, três treinos
  // separados por pausas de 40 min e numeração corrida escondiam tudo o que a
  // tela já errou com dados reais; estes testes seguram o mock no formato real.
  describe('Treinamento de IA', () => {
    const HORA = 3600 * 1000
    const listar = (params, mock = getMockResponse) =>
      mock({ endpoint: `/api/TreinamentoEpisodio?${new URLSearchParams(params)}`, method: 'GET' }).resultado
    const ultimas24h = (mock) => {
      const agora = Date.now()
      return listar({
        dataInicio: new Date(agora - 24 * HORA).toISOString(),
        dataFim: new Date(agora).toISOString(),
        quantidade: 100000,
        ordenarAscendente: false,
      }, mock).lista
    }
    // O front carimba o Z que a API não manda (marcarUtcQuandoFaltarFuso).
    const ms = (r) => new Date(`${r.dataHora}Z`).getTime()

    // Com o relógio de verdade, este teste falhava 24h seguidas a cada ~6,8
    // dias: o treino de número múltiplo de 92 (a pausa de 8 min é a 4ª do bloco
    // e a rajada vem a cada 23 episódios) começava por uma rajada, o 1º episódio
    // saía com o carimbo do 3º e a pausa medida dava 8 min 40 s. O relógio fica
    // então parado num instante cuja janela de 24h pega esse treino (o 3772,
    // às 02:21 UTC de 06/10/2026).
    it('cada treino tem 300 episódios e a numeração recomeça em 1, com 5 a 8 min entre eles', async () => {
      vi.useFakeTimers({ toFake: ['Date'] })
      try {
        vi.setSystemTime(new Date('2026-10-06T12:00:00Z'))
        vi.resetModules()
        const { getMockResponse: mockNoInstante } = await import('../src/utils/mockApi')
        const eps = [...ultimas24h(mockNoInstante)].reverse()
        const reinicios = eps
          .map((r, i) => ({ r, anterior: eps[i - 1] }))
          .filter(({ r, anterior }) => anterior && r.episodio === 1)
        expect(reinicios.length).toBeGreaterThan(10)
        for (const { r, anterior } of reinicios) {
          expect(anterior.episodio).toBe(300)
          const pausaMin = (ms(r) - ms(anterior)) / 60000
          expect(pausaMin).toBeGreaterThanOrEqual(5)
          expect(pausaMin).toBeLessThanOrEqual(8)
          // Treino novo começa explorando: epsilon de volta a 1.
          expect(r.epsilon).toBe(1)
        }
      } finally {
        vi.useRealTimers()
      }
    })

    it('devolve os episódios do mesmo segundo em ordem decrescente, como a API', () => {
      const eps = ultimas24h()
      const empate = eps.findIndex((r, i) => eps[i + 1] && r.dataHora === eps[i + 1].dataHora)
      expect(empate).toBeGreaterThanOrEqual(0)
      expect(eps[empate].episodio).toBeGreaterThan(eps[empate + 1].episodio)
    })

    it('rodadas de dez moedas, totalSteps igual à soma das ações e rewardTotal = rewardMedio × steps', () => {
      const eps = ultimas24h()
      expect(new Set(eps.map((r) => r.moeda)).size).toBe(10)
      for (const r of eps.slice(0, 50)) {
        expect(r.acoesHold + r.acoesCompra + r.acoesVenda).toBe(r.totalSteps)
        expect(r.rewardTotal).toBeCloseTo(r.rewardMedio * r.totalSteps)
      }
    })

    it('a janela de 24h pega ao menos uma troca de versão do modelo', () => {
      expect(new Set(ultimas24h().map((r) => r.versaoModelo)).size).toBeGreaterThanOrEqual(2)
    })

    // Ancorado no load, o calendário andava a cada recarga, e o link de um
    // episódio ou de um ciclo enquadrado deixava de bater com os dados.
    it('o mesmo episódio sai igual numa recarga minutos depois', async () => {
      const [antes] = listar({ quantidade: 1, ordenarAscendente: false }).lista
      vi.useFakeTimers({ toFake: ['Date'] })
      try {
        vi.setSystemTime(Date.now() + 7 * 60 * 1000)
        vi.resetModules()
        const { getMockResponse: depoisDaRecarga } = await import('../src/utils/mockApi')
        const { lista } = depoisDaRecarga({
          endpoint: `/api/TreinamentoEpisodio?${new URLSearchParams({ quantidade: 100, ordenarAscendente: false })}`,
          method: 'GET',
        }).resultado
        expect(lista.find((r) => r.idTreinamentoEpisodio === antes.idTreinamentoEpisodio)).toEqual(antes)
      } finally {
        vi.useRealTimers()
      }
    })

    it('não devolve episódio do futuro, e dataFim é inclusivo', () => {
      const [maisRecente] = listar({ quantidade: 1, ordenarAscendente: false }).lista
      expect(ms(maisRecente)).toBeLessThanOrEqual(Date.now())
      const exato = new Date(ms(maisRecente)).toISOString()
      const noFim = listar({ dataInicio: exato, dataFim: exato, quantidade: 10 }).lista
      expect(noFim.map((r) => r.idTreinamentoEpisodio)).toContain(maisRecente.idTreinamentoEpisodio)
    })

    // Como o treinador conta: trades fechados no episódio e os que deram lucro.
    it('cada episódio traz o acerto por trade, maior e com menos giro no piso do epsilon', () => {
      const eps = ultimas24h()
      for (const r of eps) {
        expect(r.tradesVencedores).toBeLessThanOrEqual(r.trades)
        if (r.trades > 0) expect(r.acertoTrades).toBeCloseTo(r.tradesVencedores / r.trades)
        else expect(r.acertoTrades).toBeNull()
      }
      const media = (lista, campo) => lista.reduce((s, r) => s + r[campo], 0) / lista.length
      const explorando = eps.filter((r) => r.epsilon > 0.8 && r.trades > 0)
      const noPiso = eps.filter((r) => r.epsilon <= 0.06 && r.trades > 0)
      expect(media(noPiso, 'acertoTrades')).toBeGreaterThan(media(explorando, 'acertoTrades'))
      expect(media(noPiso, 'trades')).toBeLessThan(media(explorando, 'trades'))
    })

    // O treino percorre o histórico: as dez moedas de uma rodada negociam o
    // mesmo lote de 1000 velas, e o lote anda para trás de rodada em rodada.
    it('cada rodada traz a janela de dados que negociou, de 1000 velas', () => {
      const eps = [...ultimas24h()].reverse().slice(0, 30)
      const janela = (r) => `${r.dataInicioDados}|${r.dataFimDados}`
      const horas = (r) => (ms({ dataHora: r.dataFimDados }) - ms({ dataHora: r.dataInicioDados })) / HORA
      expect(eps.every((r) => horas(r) === 999)).toBe(true)
      expect(ms({ dataHora: eps[0].dataFimDados })).toBeLessThan(Date.now() - 30 * 24 * HORA)
      expect(new Set(eps.map(janela)).size).toBeGreaterThan(1)
      // Os episódios da mesma janela são de moedas diferentes: é uma rodada.
      const porJanela = new Map()
      for (const r of eps) porJanela.set(janela(r), [...(porJanela.get(janela(r)) ?? []), r.moeda])
      for (const moedas of porJanela.values()) expect(new Set(moedas).size).toBe(moedas.length)
    })

    it('as avaliações das sessões vêm da mais recente para a mais antiga, com a decisão', () => {
      const { resultado } = getMockResponse({ endpoint: '/api/TreinamentoEpisodio/avaliacoes', method: 'GET' })
      expect(resultado.length).toBeGreaterThan(30)
      expect(ms(resultado[0])).toBeLessThanOrEqual(Date.now())
      expect(ms(resultado[0])).toBeGreaterThan(ms(resultado[1]))
      for (const a of resultado) {
        expect(a.validacao.moedasAvaliadas).toBe(10)
        if (a.promovido) expect(a.motivo).toBeNull()
        else expect(a.motivo).toEqual(expect.any(String))
        // O código do motivo, como a API devolve (MotivoCodigo).
        if (a.promovido) expect(a.motivoCodigo).toBeNull()
        else expect(a.motivoCodigo).toBe(a.score <= 0 ? 'abaixo-do-passivo' : 'abaixo-do-campeao')
        // Quem nem bate o passivo não chega a medir o campeão.
        if (a.score <= 0) expect(a.scoreCampeao).toBeNull()
      }
      expect(resultado.some((a) => a.promovido)).toBe(true)
      expect(resultado.some((a) => a.score <= 0)).toBe(true)
    })

    it('os filtros trazem as versões do histórico, da mais recente para a mais antiga', () => {
      const { resultado } = getMockResponse({ endpoint: '/api/TreinamentoEpisodio/filtros', method: 'GET' })
      expect(resultado.moedas).toHaveLength(10)
      expect(resultado.versoes.length).toBeGreaterThanOrEqual(2)
      const [maisRecente] = listar({ quantidade: 1, ordenarAscendente: false }).lista
      expect(resultado.versoes[0]).toMatchObject({ versao: maisRecente.versaoModelo, atual: true })
      expect(resultado.versoes.filter((v) => v.atual)).toHaveLength(1)
      expect(resultado.versoes.filter((v) => v.aoVivo).length).toBeLessThanOrEqual(1)
      for (let i = 1; i < resultado.versoes.length; i++) {
        expect(ms({ dataHora: resultado.versoes[i - 1].ultimoEpisodio }))
          .toBeGreaterThan(ms({ dataHora: resultado.versoes[i].ultimoEpisodio }))
      }
      for (const v of resultado.versoes) {
        expect(ms({ dataHora: v.primeiroEpisodio })).toBeLessThanOrEqual(ms({ dataHora: v.ultimoEpisodio }))
        expect(v.episodios).toBeGreaterThan(0)
        expect(v.moedas.length).toBeGreaterThan(0)
      }
    })

    it('o resumo traz os campos de ResumoTreinamentoEpisodioModelo', () => {
      const [primeira] = getMockResponse({ endpoint: '/api/TreinamentoEpisodio/resumo', method: 'GET' }).resultado
      expect(Object.keys(primeira).sort()).toEqual([
        'dataHoraAtual', 'dataHoraInicial', 'episodios', 'epsilonAtual', 'lossMedio',
        'moeda', 'rewardAtual', 'rewardInicial', 'winRateAtual', 'winRateInicial',
      ])
    })
  })

  describe('Endpoint não mapeado', () => {
    it('retorna null para endpoint sem handler registrado', () => {
      const resp = getMockResponse({
        endpoint: '/ThinkBitcoin/nao-existe',
        method: 'GET',
      })

      expect(resp).toBeNull()
    })

    it('retorna null para método HTTP não corresponde ao handler', () => {
      // ScriptComum é POST — um GET deve retornar null
      const resp = getMockResponse({
        endpoint: '/ThinkBitcoin/AtivadorScript/ScriptComum',
        method: 'GET',
      })

      expect(resp).toBeNull()
    })

    it('normaliza o método HTTP para maiúsculas antes de comparar', () => {
      const resp = getMockResponse({
        endpoint: '/ThinkBitcoin/exchanges',
        method: 'get', // minúsculo propositalmente
      })

      expect(resp?.resultado).toBeDefined()
    })
  })
})
