import { describe, expect, it } from 'vitest'
import pt from '../src/lang/pt.json'
import {
  montarVeredito,
  montarRessalvas,
  TomVeredito,
} from '../src/components/dashboard/simulacao/veredito'

// O veredito devolve chaves, e a tela as traduz com `t(item.chave)` — uma
// chamada que o teste de idiomas não consegue conferir, porque o nome não é
// literal. A última suíte daqui faz essa conferência no lugar dele.

const achatar = (objeto, prefixo = '') =>
  Object.entries(objeto).reduce((acc, [chave, valor]) => {
    const caminho = prefixo ? `${prefixo}.${chave}` : chave
    return valor && typeof valor === 'object'
      ? { ...acc, ...achatar(valor, caminho) }
      : { ...acc, [caminho]: valor }
  }, {})

const DICIONARIO = achatar(pt)

const metricas = (extra = {}) => ({
  alfa: 5,
  retornoTotal: 6,
  buyAndHold: 1,
  amostraInsuficiente: false,
  tradesConcluidos: 40,
  diasAnalisados: 180,
  ...extra,
})
const validacao = (alfa, ops = 30) => ({
  trades: Array.from({ length: ops }, () => ({})),
  metricas: { alfa, tradesConcluidos: ops },
})
const TUDO_BEM = {
  metricas: metricas(),
  acaso: { percentil: 99 },
  limiar: 95,
  bootstrap: { inferior: 1, superior: 9 },
  validacao: validacao(2),
}

const chaves = (v) => v.frases.map((f) => f.chave)

describe('simulacao/veredito › título', () => {
  it('deve dizer que não supera o buy & hold quando o alfa não é positivo', () => {
    const v = montarVeredito({ ...TUDO_BEM, metricas: metricas({ alfa: -3 }) })
    expect(v.tom).toBe(TomVeredito.RUIM)
    expect(v.titulo.chave).toBe('simulationVerdictBad')
    expect(v.frases[0]).toEqual({ chave: 'simulationVerdictBehind', valores: { diferenca: '3.00' } })
  })

  it('deve aprovar só quando todas as leituras passam', () => {
    const v = montarVeredito(TUDO_BEM)
    expect(v.tom).toBe(TomVeredito.BOM)
    expect(v.titulo.chave).toBe('simulationVerdictGood')
  })

  it.each([
    ['o acaso', { acaso: { percentil: 60 } }],
    ['o intervalo', { bootstrap: { inferior: -2, superior: 9 } }],
    ['a validação', { validacao: validacao(-1) }],
    ['a régua ainda não medida', { acaso: null, calculando: true }],
  ])('deve rebaixar para frágil quando falha %s', (_, sobrescrever) => {
    const v = montarVeredito({ ...TUDO_BEM, ...sobrescrever })
    expect(v.tom).toBe(TomVeredito.ALERTA)
    expect(v.titulo.chave).toBe('simulationVerdictFragile')
  })

  it('deve subir a régua com as tentativas', () => {
    const v = montarVeredito({ ...TUDO_BEM, acaso: { percentil: 97 }, limiar: 99.5 })
    expect(v.tom).toBe(TomVeredito.ALERTA)
    expect(v.frases.find((f) => f.chave === 'simulationVerdictChanceWeak').valores.limiar).toBe('99.5')
  })

  it('deve pôr a amostra curta no título, acima de qualquer outra leitura', () => {
    const v = montarVeredito({ ...TUDO_BEM, metricas: metricas({ amostraInsuficiente: true, tradesConcluidos: 7 }) })
    expect(v.tom).toBe(TomVeredito.ALERTA)
    expect(v.titulo).toEqual({ chave: 'simulationVerdictSampleShort', valores: { count: 7 } })
  })
})

describe('simulacao/veredito › frases', () => {
  it('deve avisar que ainda está medindo contra o acaso', () => {
    const v = montarVeredito({ ...TUDO_BEM, acaso: null, calculando: true })
    expect(chaves(v)).toContain('simulationVerdictCalculating')
  })

  it('não deve repetir o intervalo quando o alfa já é negativo', () => {
    const v = montarVeredito({ ...TUDO_BEM, metricas: metricas({ alfa: -3 }) })
    expect(chaves(v).some((c) => c.startsWith('simulationVerdictCi'))).toBe(false)
  })

  it('deve omitir a validação quando ela não operou', () => {
    const v = montarVeredito({ ...TUDO_BEM, validacao: validacao(0, 0) })
    expect(chaves(v)).not.toContain('simulationVerdictValidation')
    expect(v.tom).toBe(TomVeredito.BOM)
  })
})

describe('simulacao/veredito › ressalvas', () => {
  it('deve reunir janela curta, buracos e validação com poucas operações', () => {
    const r = montarRessalvas({
      metricas: metricas({ diasAnalisados: 119.6 }),
      descontinuidades: 2,
      validacao: validacao(1, 5),
    })
    expect(r).toEqual([
      { chave: 'simulationWindowShort', valores: { pedidos: 180, dias: 120 } },
      { chave: 'simulationGaps', valores: { count: 2 } },
      { chave: 'simulationCaveatValidation', valores: { count: 5, minimo: 20 } },
    ])
  })

  it('não deve ter ressalva quando nada merece uma', () => {
    expect(montarRessalvas({ metricas: metricas(), descontinuidades: 0, validacao: validacao(1) })).toEqual([])
  })
})

describe('simulacao/veredito › chaves', () => {
  it('deve pedir só chaves que existem no dicionário', () => {
    const cenarios = [
      TUDO_BEM,
      { ...TUDO_BEM, metricas: metricas({ alfa: -3 }) },
      { ...TUDO_BEM, acaso: { percentil: 50 }, bootstrap: { inferior: -1, superior: 3 } },
      { ...TUDO_BEM, bootstrap: { inferior: -5, superior: -1 } },
      { ...TUDO_BEM, acaso: null, calculando: true },
      { ...TUDO_BEM, metricas: metricas({ amostraInsuficiente: true }) },
    ]
    const pedidas = cenarios.flatMap((c) => {
      const v = montarVeredito(c)
      return [v.titulo.chave, ...chaves(v)]
    })
    pedidas.push(
      ...montarRessalvas({
        metricas: metricas({ diasAnalisados: 10 }),
        descontinuidades: 1,
        validacao: validacao(1, 2),
      }).map((r) => r.chave)
    )

    expect([...new Set(pedidas)].filter((c) => !(c in DICIONARIO))).toEqual([])
  })
})
