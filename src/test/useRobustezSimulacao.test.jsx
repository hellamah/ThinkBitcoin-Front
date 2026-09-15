// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, renderHook, waitFor } from '@testing-library/react'

import useRobustezSimulacao from '../src/hooks/useRobustezSimulacao'
import { CandlePattern } from '../src/utils/candlePatterns'
import { serie } from './fixtures/candlesSimulacao'

// O jsdom não tem Worker, que é exatamente o caso que este teste precisa
// cobrir: navegador sem Worker, ou Worker que não carregou. A mesma tarefa tem
// de rodar na thread da tela e entregar as três fases.

afterEach(cleanup)

const registros = serie(
  Array.from({ length: 120 }, (_, i) => {
    const p = 100 + Math.sin(i / 4) * 6
    return { abertura: p, maior: p + 2, menor: p - 2, fechamento: p + 1, martelo: i % 5 === 0 }
  })
)

describe('hooks/useRobustezSimulacao', () => {
  it('deve medir sem Worker e entregar a régua e o mapa', async () => {
    const opcoes = { sinalEntrada: CandlePattern.MARTELO, saidaPorTempo: 3, custoPercentual: 0, aPartirDe: null }
    const { result } = renderHook(() => useRobustezSimulacao({ registros, aPartirDe: null, opcoes }))

    expect(result.current.calculando).toBe(true)
    await waitFor(() => expect(result.current.calculando).toBe(false), { timeout: 5000 })

    expect(result.current.acaso?.percentil).toBeGreaterThanOrEqual(0)
    expect(result.current.mapa?.celulas.length).toBeGreaterThan(0)
  })

  it('deve ficar vazio sem sinal de entrada', () => {
    const { result } = renderHook(() =>
      useRobustezSimulacao({ registros, aPartirDe: null, opcoes: null })
    )
    expect(result.current).toEqual({ acaso: null, mapa: null, sorte: null, calculando: false })
  })
})
