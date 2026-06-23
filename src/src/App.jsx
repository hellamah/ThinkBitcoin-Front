import { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import Home from './pages/Home.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Settings from './pages/Settings.jsx'
import GeoHeatmapView from './pages/GeoHeatmapView.jsx'
import Layout from './components/Layout.jsx'
import { DashboardProvider } from './context/DashboardContext.jsx'
import ConsentimentoLGPD, { hasConsented } from './components/ConsentimentoLGPD.jsx'

function App() {
  const [consentido, setConsentido] = useState(hasConsented)

  return (
    <DashboardProvider>
      {!consentido && <ConsentimentoLGPD onAccept={() => setConsentido(true)} />}
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
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
            path="/heatmap"
            element={
              <ProtectedRoute>
                <GeoHeatmapView />
              </ProtectedRoute>
            }
          />
        </Routes>
      </Layout>
    </DashboardProvider>
  )
}

export default App
