import { describe, expect, it } from 'vitest'
import { ApiEndpoint, PatrimonioEndpoint } from '../src/utils/apiClient'

describe('utils/apiClient › Endpoints de Patrimônio', () => {
  it('deve construir endpoints estáticos e dinâmicos corretamente', () => {
    expect(ApiEndpoint.PATRIMONIO.CREATE).toBe('/ThinkBitcoin/patrimonio')
    expect(PatrimonioEndpoint.CREATE).toBe('/ThinkBitcoin/patrimonio')

    const userId = 'b282e124-4dd8-4ccd-a9c6-5b6b0c324a50'
    expect(ApiEndpoint.PATRIMONIO.BY_USER(userId)).toBe(`/ThinkBitcoin/patrimonio/${userId}`)
    expect(PatrimonioEndpoint.BY_USER(userId)).toBe(`/ThinkBitcoin/patrimonio/${userId}`)
  })
})
