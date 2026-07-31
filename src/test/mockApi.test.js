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
import { describe, expect, it } from 'vitest'
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

    it('retorna dados de valor para endpoint de ETH', () => {
      const resp = getMockResponse({
        endpoint: '/ThinkBitcoin/moeda/ETH/valor',
        method: 'GET',
      })

      expect(resp?.resultado?.registros?.[0]?.precoFechamento).toBeCloseTo(3500, -3)
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

      expect(resp?.resultado?.registros?.[0]?.precoFechamento).toBeCloseTo(100, -1)
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

    it('retorna confirmação simples para POST /usuariosTB/', () => {
      const resp = getMockResponse({
        endpoint: '/ThinkBitcoin/usuariosTB/',
        method: 'POST',
        body: { email: 'novo@usuario.com', senha: '123' },
      })

      expect(resp).toMatchObject({
        mensagem: expect.any(String),
      })
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
