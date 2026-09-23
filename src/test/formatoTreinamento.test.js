import { describe, expect, it } from 'vitest'
import {
  MINIMO_TEXTO,
  MOEDAS_DA_PALETA,
  contraste,
  corDaMoeda,
  fundoDoChip,
  textoSobre,
  tintaDaMoeda,
} from '../src/components/treinamento/formato'

describe('formato do treinamento › contraste', () => {
  it('mede a razão WCAG: preto sobre branco é 21, cor sobre ela mesma é 1', () => {
    expect(contraste('#000000', '#ffffff')).toBeCloseTo(21)
    expect(contraste('#3065CC', '#3065CC')).toBeCloseTo(1)
  })

  // A paleta foi validada para 3:1, o mínimo de gráfico. Como texto do chip,
  // no tema escuro, nove das dez moedas ficavam abaixo de 4,5:1.
  it.each(MOEDAS_DA_PALETA)('%s: o texto do chip passa 4,5:1 nos dois temas', (moeda) => {
    for (const escuro of [true, false]) {
      expect(contraste(tintaDaMoeda(moeda, escuro), fundoDoChip(moeda, escuro))).toBeGreaterThanOrEqual(MINIMO_TEXTO)
    }
  })

  it('também garante o contraste para moeda fora da paleta, de cor gerada pelo nome', () => {
    for (const escuro of [true, false]) {
      expect(contraste(tintaDaMoeda('PEPE', escuro), fundoDoChip('PEPE', escuro))).toBeGreaterThanOrEqual(MINIMO_TEXTO)
    }
  })

  // O escurecimento fixo de 45% no claro chegava a 7,6:1 e apagava o matiz —
  // tudo virava marrom-escuro. A tinta anda só até passar do alvo.
  it.each(MOEDAS_DA_PALETA)('%s: a tinta não passa muito do necessário, para guardar o matiz', (moeda) => {
    for (const escuro of [true, false]) {
      expect(contraste(tintaDaMoeda(moeda, escuro), fundoDoChip(moeda, escuro))).toBeLessThan(6)
    }
  })

  it.each(MOEDAS_DA_PALETA)('%s: o texto do chip de filtro ativo passa 4,5:1', (moeda) => {
    const cor = corDaMoeda(moeda)
    expect(contraste(textoSobre(cor), cor)).toBeGreaterThanOrEqual(MINIMO_TEXTO)
  })

  it('escolhe branco onde o preto fixo reprovava (BTC, LINK)', () => {
    expect(textoSobre(corDaMoeda('BTC'))).toBe('#ffffff')
    expect(textoSobre(corDaMoeda('LINK'))).toBe('#ffffff')
    expect(textoSobre(corDaMoeda('SOL'))).toBe('#000000')
  })
})
