import { describe, expect, it } from 'vitest'
import pt from '../src/lang/pt.json'
import en from '../src/lang/en.json'
import es from '../src/lang/es.json'
import fr from '../src/lang/fr.json'
import it_ from '../src/lang/it.json'

describe('o cartão Contra o acaso', () => {
  // Os PRs 62, 86 e 139 copiaram a sugestão de quem testou: nada ali é escolhido por frequência, o número
  // do cartão não é um limiar, e o Stop Móvel aparecia na tela qualquer que fosse a saída (utils/acaso.js).
  it.each([['pt', pt], ['en', en], ['es', es], ['fr', fr], ['it', it_]])('não afirma o que a conta não faz (%s)', (_, idioma) => {
    expect(idioma.simulationChance).not.toMatch(/\(/)
    expect(idioma.simulationChanceSub).not.toMatch(/ATR|Frequ|Frecu|Fréq/)
    expect(idioma.simulationChanceSub).toContain('{{mediana}}')
    expect(idioma.simulationChanceSub).toContain('{{iteracoes}}')
  })
})
