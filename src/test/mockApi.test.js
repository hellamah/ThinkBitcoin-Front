import { describe, expect, it } from 'vitest'
import { getMockResponse } from '../src/utils/mockApi'

describe('utils/mockApi', () => {
  it('retorna mock de sinal com dados fake para ScriptComum', () => {
    const response = getMockResponse({
      endpoint: '/ThinkBitcoin/scriptComum',
      method: 'POST',
    })

    expect(response).toMatchObject({
      btc: 68000,
      decision: 'BUY',
      confidence: 0.73,
      acao: 1,
    })
  })

  it('retorna mock de valor de moeda para endpoint dinâmico', () => {
    const response = getMockResponse({
      endpoint: '/ThinkBitcoin/moeda/BTC/valor',
      method: 'GET',
    })

    expect(response).toMatchObject({
      mensagem: expect.any(String),
      resultado: {
        valor: expect.any(Number),
        dataHora: expect.any(String),
      },
    })
  })

  it('retorna nulo para endpoint não mapeado', () => {
    const response = getMockResponse({
      endpoint: '/nao-existe',
      method: 'GET',
    })

    expect(response).toBeNull()
  })
})
