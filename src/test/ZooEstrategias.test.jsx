// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import pt from '../src/lang/pt.json'

import ZooEstrategias from '../src/pages/ZooEstrategias'

afterEach(cleanup)

const t = (chave) => chave.split('.').reduce((o, k) => o?.[k], pt) ?? chave

vi.mock('../src/hooks/useTranslation', () => ({
  default: (() => { let valor; return () => (valor ??= {
    t,
    idioma: { intl: 'pt' },
  }) })(),
}))

vi.mock('../hooks/useZooEstrategia', () => ({
  default: (() => { let valor; return () => (valor ??= {
    rodada: {},
    carregando: false,
    erro: null,
    recarregar: vi.fn(),
  }) })(),
}))

describe('ZooEstrategias', () => {
  it('exibe a aba de histórico habilitada', () => {
    render(
      <MemoryRouter>
        <ZooEstrategias />
      </MemoryRouter>
    )

    const tabHistorico = screen.getByRole('tab', { name: t('zoo.tabHistory') })
    expect(tabHistorico).toBeTruthy()
    // O atributo 'disabled' ou 'aria-disabled' depende da implementação do MUI, 
    // mas o componente Tab com a prop disabled reflete isso no DOM.
    expect(tabHistorico.getAttribute('aria-disabled') !== 'true' && !tabHistorico.disabled).toBeTruthy()
  })
})
