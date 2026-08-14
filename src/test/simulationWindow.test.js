import { describe, expect, it } from 'vitest'
import {
  montarJanelaSimulacao,
  DIAS_JANELA_SIMULACAO,
  DIAS_DE_AQUECIMENTO,
} from '../src/utils/simulationWindow'
import { QUANTIDADE_MAXIMA_CANDLES } from '../src/utils/apiClient'

const AGORA = new Date('2026-08-14T12:00:00Z')
const DIA_MS = 86400000

describe('utils/simulationWindow', () => {
  it('deve analisar a janela pedida e buscar o aquecimento antes dela', () => {
    const j = montarJanelaSimulacao(AGORA, 180)

    // O que vira operação começa 180 dias atrás.
    expect(new Date(j.aPartirDe).getTime()).toBe(AGORA.getTime() - 180 * DIA_MS)

    // A BUSCA começa antes disso, para o indicador de janela móvel chegar
    // aquecido ao primeiro candle analisado.
    expect(new Date(j.dataInicio).getTime()).toBe(
      AGORA.getTime() - (180 + DIAS_DE_AQUECIMENTO) * DIA_MS
    )
    expect(new Date(j.dataInicio).getTime()).toBeLessThan(new Date(j.aPartirDe).getTime())
    expect(j.dataFim).toBe(AGORA.toISOString())
  })

  it('deve pedir uma linha por hora da janela inteira, aquecimento incluído', () => {
    const j = montarJanelaSimulacao(AGORA, 180)
    expect(j.quantidade).toBe((180 + DIAS_DE_AQUECIMENTO) * 24)
  })

  it('a janela padrão deve caber no teto da API', () => {
    // Esta é a invariante que sustenta "uma requisição só". Se alguém aumentar
    // DIAS_JANELA_SIMULACAO além do que o teto comporta, a janela seria cortada
    // em silêncio — e a simulação analisaria menos período do que anuncia.
    const j = montarJanelaSimulacao(AGORA)
    expect(j.quantidade).toBeLessThan(QUANTIDADE_MAXIMA_CANDLES)
    expect((DIAS_JANELA_SIMULACAO + DIAS_DE_AQUECIMENTO) * 24).toBeLessThanOrEqual(
      QUANTIDADE_MAXIMA_CANDLES
    )
  })

  it('deve respeitar o teto da API mesmo com janela grande demais', () => {
    // 866 dias é o histórico que existe hoje no banco. Pedir tudo de uma vez
    // não cabe: o resultado é cortado no teto, e é o teto que tem de aparecer
    // no parâmetro — não um número que a API recusaria com 400.
    const j = montarJanelaSimulacao(AGORA, 866)
    expect(j.quantidade).toBe(QUANTIDADE_MAXIMA_CANDLES)
  })

  it('deve devolver datas em ISO UTC', () => {
    const j = montarJanelaSimulacao(AGORA)
    ;[j.dataInicio, j.dataFim, j.aPartirDe].forEach((d) => {
      expect(d).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    })
  })

  it('a janela padrão deve ser bem maior que a do dashboard', () => {
    // O ponto inteiro do D-03: 180 dias contra os 7 do preset padrão. Sem essa
    // diferença o corte de validação não valida nada e o intervalo de confiança
    // nunca fecha.
    expect(DIAS_JANELA_SIMULACAO).toBeGreaterThanOrEqual(90)
  })
})
