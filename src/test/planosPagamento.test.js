import { describe, expect, it, vi, afterEach } from 'vitest'
import { ApiEndpoint, PlanosPagamentoEndpoint, AuthenticationEndpoint } from '../src/utils/apiClient'
import { getMockResponse } from '../src/utils/mockApi'

describe('utils/apiClient › Endpoints de Planos de Pagamento', () => {
  it('deve construir endpoints de planos e migração corretamente', () => {
    expect(ApiEndpoint.PLANOS_PAGAMENTO.LIST).toBe('/ThinkBitcoin/planos-pagamento')
    expect(PlanosPagamentoEndpoint.LIST).toBe('/ThinkBitcoin/planos-pagamento')

    expect(ApiEndpoint.PLANOS_PAGAMENTO.MIGRATE).toBe('/ThinkBitcoin/planos-pagamento/migrar')
    expect(PlanosPagamentoEndpoint.MIGRATE).toBe('/ThinkBitcoin/planos-pagamento/migrar')
  })

  it('deve construir os endpoints do fluxo de checkout Pix', () => {
    expect(PlanosPagamentoEndpoint.CHECKOUT).toBe('/ThinkBitcoin/planos-pagamento/checkout')
    expect(PlanosPagamentoEndpoint.COBRANCA('abc-123')).toBe(
      '/ThinkBitcoin/planos-pagamento/cobranca/abc-123'
    )
    expect(PlanosPagamentoEndpoint.COBRANCA_PENDENTE).toBe(
      '/ThinkBitcoin/planos-pagamento/cobranca/pendente'
    )
  })

  it('deve expor o endpoint de renovação de token', () => {
    expect(AuthenticationEndpoint.RENOVAR).toBe('/ThinkBitcoin/gerarTokenBearer/renovar')
  })
})

describe('utils/mockApi › Fluxo de cobrança Pix', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  const checkout = (tipoPlano = 2) =>
    getMockResponse({
      endpoint: PlanosPagamentoEndpoint.CHECKOUT,
      method: 'POST',
      body: { idUsuarioTB: 'user-1', tipoPlano, nomePlano: 'ThinkElite', valor: 499.9 },
    })

  it('checkout cria cobrança PENDENTE com dados de Pix', () => {
    const res = checkout()
    const cobranca = res?.resultado?.cobranca

    expect(cobranca).toBeTruthy()
    expect(cobranca.status).toBe('PENDENTE')
    expect(cobranca.tipoPlano).toBe(2)
    expect(cobranca.idCobranca).toBeTruthy()
    expect(cobranca.pixCopiaECola).toContain('BR.GOV.BCB.PIX')
    expect(cobranca.qrCodeBase64).toMatch(/^data:image\/svg\+xml/)
    expect(new Date(cobranca.expiraEm).getTime()).toBeGreaterThan(
      new Date(cobranca.criadaEm).getTime()
    )
  })

  it('checkout é idempotente: reaproveita a cobrança pendente do mesmo plano', () => {
    const primeira = checkout()?.resultado?.cobranca
    const segunda = checkout()?.resultado?.cobranca

    expect(segunda.idCobranca).toBe(primeira.idCobranca)
  })

  it('cobranca/pendente retorna a cobrança em aberto', () => {
    const pendente = getMockResponse({
      endpoint: PlanosPagamentoEndpoint.COBRANCA_PENDENTE,
      method: 'GET',
    })?.resultado?.cobranca

    expect(pendente).toBeTruthy()
    expect(pendente.status).toBe('PENDENTE')
  })

  it('cobrança se paga sozinha após o intervalo do demo e pendente zera', () => {
    const cobranca = checkout()?.resultado?.cobranca

    // Avança o relógio além dos 10s do auto-pagamento do modo demo.
    vi.useFakeTimers()
    vi.setSystemTime(Date.now() + 15000)

    const consultada = getMockResponse({
      endpoint: PlanosPagamentoEndpoint.COBRANCA(cobranca.idCobranca),
      method: 'GET',
    })?.resultado?.cobranca

    expect(consultada.status).toBe('PAGO')
    expect(consultada.pagaEm).toBeTruthy()

    const pendente = getMockResponse({
      endpoint: PlanosPagamentoEndpoint.COBRANCA_PENDENTE,
      method: 'GET',
    })?.resultado?.cobranca

    expect(pendente).toBeNull()
  })

  it('cobrança paga ativa o plano correspondente na listagem', () => {
    const planos = getMockResponse({
      endpoint: PlanosPagamentoEndpoint.LIST,
      method: 'GET',
    })?.resultado?.planos

    const ativo = planos.find((p) => p.ativo)
    expect(ativo?.idPlanoPagamento).toBe(2)
  })

  it('renovar token responde com tokenAutenticado no formato JWT', () => {
    const res = getMockResponse({
      endpoint: AuthenticationEndpoint.RENOVAR,
      method: 'POST',
      body: {},
    })

    const token = res?.resultado?.tokenAutenticado
    expect(token).toBeTruthy()
    expect(token.split('.')).toHaveLength(3)
  })
})
