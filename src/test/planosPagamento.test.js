import { describe, expect, it } from 'vitest'
import { ApiEndpoint, PlanosPagamentoEndpoint } from '../src/utils/apiClient'

describe('utils/apiClient › Endpoints de Planos de Pagamento', () => {
  it('deve construir endpoints de planos e migração corretamente', () => {
    expect(ApiEndpoint.PLANOS_PAGAMENTO.LIST).toBe('/ThinkBitcoin/planos-pagamento')
    expect(PlanosPagamentoEndpoint.LIST).toBe('/ThinkBitcoin/planos-pagamento')

    expect(ApiEndpoint.PLANOS_PAGAMENTO.MIGRATE).toBe('/ThinkBitcoin/planos-pagamento/migrar')
    expect(PlanosPagamentoEndpoint.MIGRATE).toBe('/ThinkBitcoin/planos-pagamento/migrar')
  })
})
