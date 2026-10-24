// @vitest-environment jsdom
import { afterAll, afterEach, beforeAll, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import CoinCarousel from '../src/components/dashboard/CoinCarousel'

// O carrossel observa o próprio tamanho para mostrar as setas e centraliza a
// moeda escolhida; o jsdom não tem ResizeObserver nem scrollIntoView.
const resizeObserverOriginal = globalThis.ResizeObserver
const scrollIntoViewOriginal = Element.prototype.scrollIntoView
beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    disconnect() {}
  }
  Element.prototype.scrollIntoView = () => {}
})
afterAll(() => {
  globalThis.ResizeObserver = resizeObserverOriginal
  Element.prototype.scrollIntoView = scrollIntoViewOriginal
})
afterEach(cleanup)

const SIMBOLOS = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'LINK', 'DOT', 'PAXG']
const moedas = SIMBOLOS.map((simbolo, i) => ({ simbolo, nome: `Moeda ${simbolo}`, valor: 100 + i, variacao: i - 4 }))

const montar = (props = {}) => render(
  <CoinCarousel
    moedasCarousel={moedas}
    moedasFiltro={['BTC']}
    selecionarMoeda={() => {}}
    t={(chave) => chave}
    isMobile={false}
    {...props}
  />,
)

it('o Top 5 mostra cinco moedas, e o carrossel com todas tem título próprio', () => {
  // O Pregão leu "Top 5" seguido das cinco do painel e das dez do carrossel, sem
  // nada entre elas, e apontou o Top 5 com 10 a 12 ativos e duplicatas (21 a 24/10/2026).
  const { container } = montar()

  expect(container.querySelectorAll('.top-item-card')).toHaveLength(5)
  expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent.trim()))
    .toEqual(['topCoins', 'carrosselTitulo'])

  const titulo = screen.getByRole('heading', { name: 'carrosselTitulo' })
  expect(titulo.nextElementSibling.classList.contains('crypto-carousel-wrapper')).toBe(true)
  expect(titulo.nextElementSibling.querySelectorAll('.carousel-item')).toHaveLength(SIMBOLOS.length)
})

it('na Geopolítica o carrossel fica só com o título dela', () => {
  montar({ isHeatmap: true })

  expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent.trim()))
    .toEqual(['selectAssetHeatmap'])
})
