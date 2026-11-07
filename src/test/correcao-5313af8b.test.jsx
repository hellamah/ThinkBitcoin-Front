// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import pt from '../src/lang/pt.json'

afterEach(cleanup)

// As chaves com ponto ('alertas.listaVazia') são aninhadas no JSON.
const t = (chave) => chave.split('.').reduce((o, k) => o?.[k], pt) ?? chave

describe('Traduções de Otimização e Ajuda', () => {
  it('deve exibir o texto de Otimização atualizado com contexto temporal', () => {
    render(<div data-testid="tuning">{t('simulationTuning')}</div>)
    expect(screen.getByText(/Otimização \(trecho de ajuste\)/)).toBeTruthy()
  })

  it('deve exibir a explicação sobre pesos e impacto na Avaliação', () => {
    render(<div data-testid="ajuda">{t('ajuda.colAjusteSinal')}</div>)
    expect(screen.getByText(/onde cada ocorrência conta igualmente e não influencia a Avaliação/)).toBeTruthy()
  })
})
