// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

import { apiRequest } from '../src/utils/apiClient'
import PatrimonioCard from '../src/components/dashboard/PatrimonioCard'

vi.mock('../src/utils/apiClient', async (importOriginal) => ({
  ...(await importOriginal()),
  apiRequest: vi.fn(),
}))

afterEach(cleanup)

// Pedido cfc7447c (PR 210): o selo ACTIVE_GROWTH aparecia sempre que havia saldo e não media
// crescimento nenhum. Ele sai, e nada entra no lugar: a primeira versão do PR deixava na tela
// o texto "// Selo removido por não representar métrica real" (um comentário escrito como texto
// do JSX).
describe('PatrimonioCard sem o selo ACTIVE_GROWTH', () => {
  it('com saldo, não mostra o selo nem texto no lugar dele', async () => {
    apiRequest.mockResolvedValue({ resultado: { saldoTotalBRL: 10000, saldoTotalUSD: 1818.18 } })

    const { container } = render(<PatrimonioCard token="t" user={{ idUsuarioTB: 'u' }} />)

    // O valor em reais aparece quando o patrimônio chega.
    await screen.findByText(/10[.,]000/)
    expect(container.textContent).not.toMatch(/ACTIVE_GROWTH/)
    expect(container.textContent).not.toMatch(/Selo removido/)
  })
})
