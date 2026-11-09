// @vitest-environment jsdom
import Settings from '../src/pages/Settings'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
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

vi.mock('../src/context/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    token: 'fake-token',
    user: { nome: 'Teste' },
    prefs: { frequenciaReview: 'daily', riscoMaximoPerda: 1 },
    login: vi.fn(),
    logout: vi.fn(),
    updatePreferences: vi.fn()
  }))
}))

vi.mock('../src/utils/browser', () => ({
  isNotificationSupported: () => true
}))

vi.mock('../src/utils/workflow', () => ({
  executeNotificationWorkflow: vi.fn()
}))

vi.mock('../src/hooks/useAlertasPreco', () => ({
  default: (() => { let valor; return () => (valor ??= {
    alertas: [],
    adicionarAlerta: vi.fn(),
    removerAlerta: vi.fn()
  }) })()
}))

describe('Settings Page', () => {
  it('displays the correct description for maxRiskPerTrade', () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    )

    expect(screen.getByText(t('maxRiskPerTradeDescription'))).toBeTruthy()
  })
})
