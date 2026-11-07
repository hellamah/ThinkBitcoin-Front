// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import pt from '../src/lang/pt.json'
import Settings from '../src/pages/Settings'

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
    prefs: { frequenciaReview: 'daily' },
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
  it('displays the correct description for review frequency', () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    )
    
    // Verify the new text is present
    expect(screen.getByText(t('reviewFrequencyDescription'))).toBeTruthy()
    
    // Verify the old text is NOT present
    // The old text was "Define a periodicidade de atualização de dados na interface."
    expect(screen.queryByText(/periodicidade de atualização/i)).toBeNull()
  })
})
