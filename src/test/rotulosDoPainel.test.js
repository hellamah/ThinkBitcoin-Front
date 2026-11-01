import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import pt from '../src/lang/pt.json'
import en from '../src/lang/en.json'
import es from '../src/lang/es.json'
import fr from '../src/lang/fr.json'
import it_ from '../src/lang/it.json'

const idiomas = [['pt', pt], ['en', en], ['es', es], ['fr', fr], ['it', it_]]

describe('o Painel e os textos que descrevem os números', () => {
  // O PR 136 passou null: os 3 dias de aquecimento entravam nas leituras "do período", e num filtro de
  // 24h 3 de cada 4 candles ficavam fora do que a tela diz. O recorte é o que a tela promete.
  it('recorta as leituras de período pela data escolhida', () => {
    const dashboard = readFileSync(new URL('../src/pages/Dashboard.jsx', import.meta.url), 'utf8')
    expect(dashboard).toContain('aPartirDe: dataInicio || null\n  })'.replace('\n', dashboard.includes('\r\n') ? '\r\n' : '\n'))
    expect(dashboard).toContain('compararMoedas(historicosPorMoeda, moedasFiltro, dataInicio || null)')
  })

  // O PR 92 trocou por "Watchlist": a lista é o top 5 por variação, e ninguém a escolhe.
  it.each(idiomas)('o título da lista diz o que ela é (%s)', (_, idioma) => {
    expect(idioma.topCoins).toMatch(/top 5/i)
  })

  // O PR 102 escreveu "variação percentual total": a captura é mês a mês (utils/regua_risco.py, no Back-Python).
  it.each(idiomas)('a captura de alta e de queda é mensal (%s)', (_, idioma) => {
    expect(idioma.zoo.colUpCaptureHint).toMatch(/mes|mois|month/i)
    expect(idioma.zoo.colDownCaptureHint).toMatch(/mes|mois|month/i)
  })
})
