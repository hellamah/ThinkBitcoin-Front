// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ProtectedRoute from '../src/components/ProtectedRoute'
import { AuthRole } from '../src/utils/authentication'

// A rota protegida: sem sessão vai ao login; com `cargos`, quem não tem o
// cargo volta ao painel (a tela dos pedidos do Pregão é só de administrador).

const { sessao } = vi.hoisted(() => ({ sessao: { token: null, user: null } }))
vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => sessao,
}))

afterEach(cleanup)

const entrarComo = (cargos) => {
  sessao.token = cargos ? 'header.payload.assinatura' : null
  sessao.user = cargos ? { cargos } : null
}

const renderizar = (cargos) => render(
  <MemoryRouter initialEntries={['/restrita']}>
    <Routes>
      <Route path="/restrita" element={<ProtectedRoute cargos={cargos}><p>conteúdo restrito</p></ProtectedRoute>} />
      <Route path="/dashboard" element={<p>painel</p>} />
      <Route path="/login" element={<p>login</p>} />
    </Routes>
  </MemoryRouter>
)

describe('ProtectedRoute', () => {
  it('sem sessão, vai ao login', () => {
    entrarComo(null)
    renderizar([AuthRole.ADMINISTRADOR])
    expect(screen.getByText('login')).toBeTruthy()
  })

  it('sem cargos exigidos, basta a sessão', () => {
    entrarComo([AuthRole.CONSULTOR])
    renderizar()
    expect(screen.getByText('conteúdo restrito')).toBeTruthy()
  })

  it('administrador vê a página de administrador', () => {
    entrarComo([AuthRole.MINERADOR, AuthRole.ADMINISTRADOR])
    renderizar([AuthRole.ADMINISTRADOR])
    expect(screen.getByText('conteúdo restrito')).toBeTruthy()
  })

  it('quem não tem o cargo volta ao painel', () => {
    entrarComo([AuthRole.MINERADOR])
    renderizar([AuthRole.ADMINISTRADOR])
    expect(screen.getByText('painel')).toBeTruthy()
    expect(screen.queryByText('conteúdo restrito')).toBeNull()
  })
})
