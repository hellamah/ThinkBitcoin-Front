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
          registros: [
            {
              valor: expect.any(Number),
              dataHora: expect.any(String),
            },
          ],
        },
      })
    })

    it('retorna dados de valor para endpoint de ETH', () => {
      const resp = getMockResponse({
        endpoint: '/ThinkBitcoin/moeda/ETH/valor',
        method: 'GET',
      })

      expect(resp?.resultado?.registros?.[0]?.valor).toBeCloseTo(3500, -2)
    })

    it('retorna dados de valor para endpoint de DOGE (valor fracionário)', () => {
      const resp = getMockResponse({
        endpoint: '/ThinkBitcoin/moeda/DOGE/valor',
        method: 'GET',
      })

      expect(resp?.resultado?.registros?.[0]?.valor).toBeLessThan(1)
    })

    it('retorna valor numérico para símbolo desconhecido (fallback de 100)', () => {
      const resp = getMockResponse({
        endpoint: '/ThinkBitcoin/moeda/UNKNOWN/valor',
        method: 'GET',
      })

      expect(resp?.resultado?.registros?.[0]?.valor).toBeCloseTo(100, -1)
    })

    it('aceita query string na URL do endpoint de moeda', () => {
      const resp = getMockResponse({
        endpoint: '/ThinkBitcoin/moeda/BTC/valor?page=1',
        method: 'GET',
      })

      expect(resp?.resultado?.registros).toHaveLength(1)
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

  describe('Debate', () => {
    it('retorna confirmação de debate iniciado para POST /debate', () => {
      const resp = getMockResponse({
        endpoint: '/ThinkBitcoin/debate',
        method: 'POST',
        body: { moeda: 'BTC' },
      })

      expect(resp).toMatchObject({
        mensagem: expect.any(String),
        resultado: true,
      })
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
