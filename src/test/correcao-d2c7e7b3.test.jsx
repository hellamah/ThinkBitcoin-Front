// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import pt from '../src/lang/pt.json'

afterEach(cleanup)

const t = (chave) => chave.split('.').reduce((o, k) => o?.[k], pt) ?? chave

vi.mock('../src/hooks/useTranslation', () => ({
  default: (() => { let valor; return () => (valor ??= {
    t,
    idioma: { intl: 'pt-BR' }
  }) })()
}))

vi.mock('../src/hooks/useZooEstrategia', () => ({
  default: (() => { let valor; return () => (valor ??= {
    rodada: {
      estrategias: [
        {
          estrategia: 'Estratégia 1',
          descricao: 'Descrição',
          aprovada: true,
          moedasAprovadas: 10,
          moedas: 10,
          moedasPeriodoOk: 8,
          medianaCagr: 0.1,
          medianaCagrBuyHold: 0.05,
          medianaQuedaMaxima: 0.2,
          medianaQuedaMaximaBuyHold: 0.1,
          medianaCalmar: 1.5,
          medianaCapturaAlta: 0.3,
          medianaCapturaQueda: 0.2,
          medianaExposicao: 0.5,
          medianaTaxaPaga: 0.115,
          medianaGiroPorAno: 10.5,
        },
      ],
    },
    carregando: false,
    erro: null,
    recarregar: () => {},
  }) })(),
  useCurvaZoo: (() => { let valor; return () => (valor ??= { curvas: [], carregando: false, erro: null }) })(),
}))

vi.mock('../src/context/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: { cargos: ['Administrador'] } }))
}))

import ZooEstrategias from '../src/pages/ZooEstrategias'

describe('ZooEstrategias', () => {
  it('mostra a nova coluna de Giro/ano (Mediana) com o valor e a dica', async () => {
    render(
      <MemoryRouter>
        <ZooEstrategias />
      </MemoryRouter>
    )

    // Verifica se o cabeçalho da nova coluna existe
    const header = screen.getByText(t('zoo.colGiro'))
    expect(header).toBeTruthy()

    // Verifica se o valor formatado (10,50) está na tabela
    // O valor é medianaGiroPorAno = 10.5 -> formatarNumero(10.5, 2) -> "10,50"
    expect(screen.getByText('10,50')).toBeTruthy()

    // Verifica a dica (title) ao passar o mouse no cabeçalho
    fireEvent.mouseOver(header)
    await screen.findByText(t('zoo.colGiroHint'))
  })
})
