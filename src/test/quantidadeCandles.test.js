import { describe, expect, it } from 'vitest'
import { QUANTIDADE_MAXIMA_CANDLES } from '../src/utils/apiClient'
import { CANDLES_POR_REQUISICAO } from '../src/context/DashboardContext'

// O backend passou a recusar `quantidade` acima de um teto — antes aceitava
// qualquer número e materializava o resultado inteiro em memória.
//
// A relação entre os dois valores não aparece em lugar nenhum em tempo de
// execução: se alguém subir o pedido do dashboard além do teto da API para
// esticar a janela da simulação, TODA requisição do dashboard passa a responder
// 400 — e o sintoma (tela vazia) não aponta para a causa. Este teste é o que
// transforma esse acidente em job vermelho.

describe('contrato de quantidade de candles', () => {
  it('o dashboard não pode pedir mais candles do que a API aceita', () => {
    expect(CANDLES_POR_REQUISICAO).toBeLessThanOrEqual(QUANTIDADE_MAXIMA_CANDLES)
  })

  it('o teto da API deve acompanhar o FuncaoObterValorMoeda.QuantidadeMaxima do backend', () => {
    // Valor cravado de propósito: os dois repositórios sobem em deploys
    // separados, então a cópia precisa falhar aqui quando alguém mexer só de um
    // lado. Ao alterar o backend, altere este número junto.
    expect(QUANTIDADE_MAXIMA_CANDLES).toBe(5000)
  })

  it('o pedido do dashboard deve ser positivo', () => {
    expect(CANDLES_POR_REQUISICAO).toBeGreaterThan(0)
  })
})
