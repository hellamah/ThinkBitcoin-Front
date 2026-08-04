import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import Home from './pages/Home.jsx'
import Login from './pages/Login.jsx'
import Layout from './components/Layout.jsx'
import { DashboardProvider } from './context/DashboardContext.jsx'

// Páginas pesadas (chart.js, react-google-charts) carregadas sob demanda
// para não inflar o bundle inicial de quem entra em / ou /login.
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'))
const Settings = lazy(() => import('./pages/Settings.jsx'))
const GeoHeatmapView = lazy(() => import('./pages/GeoHeatmapView.jsx'))
const TreinamentoEpisodios = lazy(() => import('./pages/TreinamentoEpisodios.jsx'))
const RedefinirSenha = lazy(() => import('./pages/RedefinirSenha.jsx'))
const DocumentoLegal = lazy(() => import('./pages/DocumentoLegal.jsx'))

const PageLoader = () => (
  <Box
    sx={{
      minHeight: '60vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    <CircularProgress sx={{ color: 'var(--accent-ink)' }} />
  </Box>
)

function App() {
  const location = useLocation()
  return (
    <DashboardProvider>
      <Layout>
        {/* key por rota: um erro numa página não impede navegar para as demais */}
        <ErrorBoundary key={location.pathname}>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/redefinir-senha" element={<RedefinirSenha />} />
              {/* Públicas de propósito: o banner de cookies aparece para
                  visitante, e o overlay de cadastro pede o aceite antes de
                  existir conta. Exigir login para ler o que se está aceitando
                  seria o avesso do consentimento informado. */}
              <Route path="/privacidade" element={<DocumentoLegal documento="privacidade" />} />
              <Route path="/termos" element={<DocumentoLegal documento="termos" />} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <ProtectedRoute>
                    <Settings />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/treinamento-episodios"
                element={
                  <ProtectedRoute>
                    <TreinamentoEpisodios />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/treinamento-episodios/:id"
                element={
                  <ProtectedRoute>
                    <TreinamentoEpisodios />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/heatmap"
                element={
                  <ProtectedRoute>
                    <GeoHeatmapView />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </Layout>
    </DashboardProvider>
  )
}

export default App
