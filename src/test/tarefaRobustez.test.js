import { describe, expect, it } from 'vitest'
import { executarRobustez, prepararContextoRobustez, TrechoRobustez } from '../src/utils/tarefaRobustez'
import { simular, dividirParaValidacao } from '../src/utils/backtest'
import { CandlePattern } from '../src/utils/candlePatterns'
import { serie } from './fixtures/candlesSimulacao'

// A régua aleatória é uma das leituras que se olha para escolher a regra.
// Enquanto a validação está reservada, ela não pode ser medida na janela
// cheia: a janela cheia contém o trecho reservado.

const registros = serie(
  Array.from({ length: 120 }, (_, i) => {
    const p = 100 + Math.sin(i / 4) * 6
    return { abertura: p, maior: p + 2, menor: p - 2, fechamento: p + 1, martelo: i % 5 === 0 }
  })
)
const OPCOES = { sinalEntrada: CandlePattern.MARTELO, saidaPorTempo: 3, custoPercentual: 0, aPartirDe: null }

const medir = async (trecho) => {
  const saida = {}
  await executarRobustez(prepararContextoRobustez(registros, null), { opcoes: OPCOES, trecho }, {
    emitir: (chave, valor) => {
      saida[chave] = valor
    },
  })
  return saida
}

describe('utils/tarefaRobustez › trecho da régua aleatória', () => {
  it('deve medir no ajuste o mesmo retorno que a tela mostra para o ajuste', async () => {
    const { acaso } = await medir(TrechoRobustez.AJUSTE)
    const ajuste = simular(dividirParaValidacao(registros).registrosAjuste, OPCOES)
    expect(acaso.retornoReal).toBeCloseTo(ajuste.metricas.retornoTotal, 10)
  })

  it('deve medir na janela cheia depois de a regra ser fixada', async () => {
    const { acaso } = await medir(TrechoRobustez.CHEIA)
    expect(acaso.retornoReal).toBeCloseTo(simular(registros, OPCOES).metricas.retornoTotal, 10)
  })

  it('não deve devolver a medição de um trecho no pedido do outro', async () => {
    // As duas ficam na mesma memória do contexto; a chave precisa separá-las.
    const contexto = prepararContextoRobustez(registros, null)
    const pegar = async (trecho) => {
      let acaso = null
      await executarRobustez(contexto, { opcoes: OPCOES, trecho }, {
        emitir: (chave, valor) => {
          if (chave === 'acaso') acaso = valor
        },
      })
      return acaso
    }
    const noAjuste = await pegar(TrechoRobustez.AJUSTE)
    const naCheia = await pegar(TrechoRobustez.CHEIA)
    expect(naCheia.candidatas).toBeGreaterThan(noAjuste.candidatas)
  })
})
