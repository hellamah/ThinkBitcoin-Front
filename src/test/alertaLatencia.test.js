import { describe, expect, it } from 'vitest'
import pt from '../src/lang/pt.json'
import en from '../src/lang/en.json'
import es from '../src/lang/es.json'
import fr from '../src/lang/fr.json'
// `italiano`, e não `it`: o nome curto sombrearia o `it()` do vitest.
import italiano from '../src/lang/it.json'

// O aviso do alerta de preço diz quando o e-mail sai, e isso é do produto: o
// avaliador (Back-DotNet, FuncaoAvaliarAlertasPreco) roda às :10 e às :40 e
// compara o alvo com o fechamento do último candle de 1 hora. O e-mail sai em
// até 1 hora, e um toque no alvo que volta antes de a hora fechar não dispara.
//
// Em 20/10/2026 o PR 45 da Oficina trocou esse aviso por "notificações
// instantâneas", a pedido do Trader, que comparou com o "1,5M+ dados/seg" da
// vitrine da Home. Este teste segura o aviso do lado da verdade: se o modelo
// voltar a prometer tempo real, a suíte reprova o PR.

const IDIOMAS = { pt, en, es, fr, it: italiano }

describe.each(Object.entries(IDIOMAS))('alertas.explicacaoLatencia em %s', (_nome, dicionario) => {
  const texto = dicionario.alertas.explicacaoLatencia

  it('não promete aviso instantâneo nem em tempo real', () => {
    expect(texto).not.toMatch(/instant|istantane|tempo real|real[- ]time|tiempo real|temps réel/i)
  })

  it('diz o prazo de 1 hora', () => {
    expect(texto).toMatch(/1|heure/)
  })
})

describe('alertas.explicacaoLatencia em pt', () => {
  it('diz que a comparação é com o fechamento de cada hora e que um toque que volta não dispara', () => {
    const texto = pt.alertas.explicacaoLatencia
    expect(texto).toMatch(/fechamento de cada hora/)
    expect(texto).toMatch(/em até 1 hora/)
    expect(texto).toMatch(/não dispara/)
  })
})
