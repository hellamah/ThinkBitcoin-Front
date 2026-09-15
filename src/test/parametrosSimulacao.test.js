import { describe, expect, it } from 'vitest'
import {
  PARAMETROS_PADRAO,
  sanearParametros,
  lerParametrosDaUrl,
  escreverParametrosNaUrl,
  impressaoDaConfiguracao,
} from '../src/utils/parametrosSimulacao'
import { StopMode, TradeDirection, TrendFilter } from '../src/utils/enums'

const COMPLETO = {
  sinalEntrada: 'martelo',
  direcao: TradeDirection.VENDA,
  saidaPorTempo: null,
  modoStop: StopMode.ATR_MOVEL,
  stopPercentual: 2.5,
  alvoPercentual: 4,
  custoPercentual: 0.05,
  sinalSaida: 'rsiSobrecompra',
  filtroTendencia: TrendFilter.BAIXA,
  sinalConfirmacao: 'vwapCruzamentoBaixa',
  riscoPorOperacao: 1,
}

describe('utils/parametrosSimulacao › saneamento', () => {
  it('deve completar com o padrão o que não veio', () => {
    expect(sanearParametros({})).toEqual(PARAMETROS_PADRAO)
    expect(sanearParametros(null)).toEqual(PARAMETROS_PADRAO)
  })

  it('deve recusar valores que nenhum controle oferece', () => {
    const p = sanearParametros({
      saidaPorTempo: 7,
      stopPercentual: -3,
      custoPercentual: -1,
      modoStop: 'magico',
      sinalEntrada: '<script>',
      filtroTendencia: 'lateral',
    })
    expect(p.saidaPorTempo).toBe(PARAMETROS_PADRAO.saidaPorTempo)
    expect(p.stopPercentual).toBeNull()
    expect(p.custoPercentual).toBe(PARAMETROS_PADRAO.custoPercentual)
    expect(p.modoStop).toBe(StopMode.PERCENTUAL)
    expect(p.sinalEntrada).toBeNull()
    expect(p.filtroTendencia).toBeNull()
  })

  it('deve manter o null explícito do tempo e o custo zero', () => {
    const p = sanearParametros({ saidaPorTempo: null, custoPercentual: 0 })
    expect(p.saidaPorTempo).toBeNull()
    expect(p.custoPercentual).toBe(0)
  })
})

describe('utils/parametrosSimulacao › URL', () => {
  it('deve fazer a ida e a volta sem perder nada', () => {
    const url = escreverParametrosNaUrl('', COMPLETO)
    expect(lerParametrosDaUrl(url)).toEqual(COMPLETO)
  })

  it('não deve escrever nada para a configuração padrão', () => {
    expect(escreverParametrosNaUrl('', PARAMETROS_PADRAO).toString()).toBe('')
  })

  it('deve preservar o resto da query string', () => {
    const url = escreverParametrosNaUrl('?moeda=BTC&sim.alvo=3', { ...PARAMETROS_PADRAO, stopPercentual: 2 })
    expect(url.get('moeda')).toBe('BTC')
    expect(url.get('sim.stop')).toBe('2')
    // O alvo voltou ao padrão, então some da URL.
    expect(url.has('sim.alvo')).toBe(false)
  })

  it('deve escrever direção e tempo por extenso', () => {
    const url = escreverParametrosNaUrl('', { direcao: TradeDirection.VENDA, saidaPorTempo: null })
    expect(url.get('sim.direcao')).toBe('venda')
    expect(url.get('sim.segurar')).toBe('sem')
  })
})

describe('utils/parametrosSimulacao › impressão da configuração', () => {
  it('não deve mudar com o custo', () => {
    expect(impressaoDaConfiguracao({ ...COMPLETO, custoPercentual: 0.3 }))
      .toBe(impressaoDaConfiguracao(COMPLETO))
  })

  it('deve ignorar o stop percentual que sobrou no modo ATR', () => {
    expect(impressaoDaConfiguracao({ ...COMPLETO, stopPercentual: 9 }))
      .toBe(impressaoDaConfiguracao(COMPLETO))
  })

  it('deve mudar com qualquer grau de liberdade da regra', () => {
    expect(impressaoDaConfiguracao({ ...COMPLETO, alvoPercentual: 5 }))
      .not.toBe(impressaoDaConfiguracao(COMPLETO))
  })
})
