import { vi, beforeEach } from 'vitest'

/**
 * Configuração global dos testes.
 * Executada antes de cada arquivo de teste pelo Vitest.
 *
 * - Registra um mock global para a função `fetch` nativa.
 * - Reseta todos os mocks entre os testes para garantir isolamento.
 */
beforeEach(() => {
  vi.resetAllMocks()

  if (typeof global.fetch === 'undefined' || !vi.isMockFunction(global.fetch)) {
    global.fetch = vi.fn()
  }
})
