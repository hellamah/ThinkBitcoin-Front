// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'

import Filtros from '../src/components/treinamento/Filtros'

// Filtros da tela de treino. Sem provider de tradução, `t` devolve a chave.

afterEach(cleanup)

const DIA_MS = 24 * 3600 * 1000
const BASE = Date.UTC(2026, 8, 1, 12)

// Como versoesDoFiltro entrega: da que treinou por último para a mais antiga.
const versao = (nome, dias, extra = {}) => ({
  versao: nome,
  inicio: BASE + dias * DIA_MS,
  fim: BASE + (dias + 1) * DIA_MS,
  episodios: 1200,
  moedas: ['BTC'],
  atual: false,
  aoVivo: false,
  ...extra,
})
const VERSOES = [
  versao('v8', 7, { atual: true }),
  versao('v7', 6, { aoVivo: true }),
  versao('v6', 5),
  versao('v5', 4),
  versao('v4', 3),
]

const renderizar = (props = {}) => {
  const onVersao = vi.fn()
  const onAlternarMoeda = vi.fn()
  const onLimparMoedas = vi.fn()
  render(
    <Filtros
      moedas={['BTC', 'ETH']}
      moedasSelecionadas={[]}
      onAlternarMoeda={onAlternarMoeda}
      onLimparMoedas={onLimparMoedas}
      moedasInativas={null}
      versoes={VERSOES}
      versao={null}
      onVersao={onVersao}
      {...props}
    />
  )
  return { onVersao, onAlternarMoeda, onLimparMoedas }
}

const linha = (rotulo) => screen.getByRole('group', { name: rotulo })
const linhaDeVersoes = () => linha('treinamento.modelVersion')
const linhaDeMoedas = () => linha('treinamento.filterByCoin')
const chip = (dentro, texto) => within(dentro).getByText(texto).closest('[aria-pressed]')

describe('Filtros do treino', () => {
  it('sem filtro, o chip "Todas" fica aceso nas duas linhas', () => {
    renderizar()
    expect(chip(linhaDeMoedas(), 'treinamento.filterAll').getAttribute('aria-pressed')).toBe('true')
    expect(chip(linhaDeVersoes(), 'treinamento.filterAll').getAttribute('aria-pressed')).toBe('true')
  })

  it('"Todas" limpa as moedas', () => {
    const { onLimparMoedas } = renderizar({ moedasSelecionadas: ['BTC'] })
    const todas = chip(linhaDeMoedas(), 'treinamento.filterAll')
    expect(todas.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(todas)
    expect(onLimparMoedas).toHaveBeenCalled()
  })

  it('mostra as três versões mais recentes, com os selos, e as demais no menu', () => {
    const { onVersao } = renderizar()
    const versoes = linhaDeVersoes()
    expect(within(versoes).getByText('v8')).toBeTruthy()
    expect(within(versoes).getByText('v6')).toBeTruthy()
    expect(within(versoes).queryByText('v5')).toBeNull()
    expect(within(chip(versoes, 'v8')).getByText('treinamento.versionCurrent')).toBeTruthy()
    expect(within(chip(versoes, 'v7')).getByText('treinamento.versionLive')).toBeTruthy()

    fireEvent.click(within(versoes).getByRole('button', { name: 'treinamento.olderVersionsLabel' }))
    const menu = screen.getByRole('menu')
    expect(within(menu).getAllByRole('menuitem').map((i) => i.textContent)).toEqual([
      expect.stringContaining('v5'),
      expect.stringContaining('v4'),
    ])
    fireEvent.click(within(menu).getByText('v4'))
    expect(onVersao).toHaveBeenCalledWith('v4')
  })

  it('a versão filtrada fica à vista mesmo sendo antiga', () => {
    renderizar({ versao: 'v4' })
    const versoes = linhaDeVersoes()
    expect(chip(versoes, 'v4').getAttribute('aria-pressed')).toBe('true')
    // Só a v5 sobra para o menu.
    fireEvent.click(within(versoes).getByRole('button', { name: 'treinamento.olderVersionsLabel' }))
    expect(screen.getAllByRole('menuitem')).toHaveLength(1)
  })

  it('acende a versão da URL sem diferenciar maiúsculas, como o filtro da API', () => {
    renderizar({ versao: 'V7' })
    expect(chip(linhaDeVersoes(), 'v7').getAttribute('aria-pressed')).toBe('true')
  })

  it('clicar na versão filtrada desliga o filtro', () => {
    const { onVersao } = renderizar({ versao: 'v7' })
    fireEvent.click(chip(linhaDeVersoes(), 'v7'))
    expect(onVersao).toHaveBeenCalledWith(null)
  })

  it('uma versão só não vira linha de filtro', () => {
    renderizar({ versoes: [versao('v8', 7, { atual: true })] })
    expect(screen.queryByRole('group', { name: 'treinamento.modelVersion' })).toBeNull()
  })

  it('na validação, os chips de moeda ficam desligados, com o motivo ao lado', () => {
    const { onAlternarMoeda } = renderizar({ moedasSelecionadas: ['BTC'], moedasInativas: 'não se aplica' })
    const moedas = linhaDeMoedas()
    expect(within(moedas).getByRole('note').textContent).toBe('não se aplica')
    const btc = chip(moedas, 'BTC')
    expect(btc.getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(btc)
    expect(onAlternarMoeda).not.toHaveBeenCalled()
  })
})
