import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext'

let savedTheme = null
try {
  savedTheme = localStorage.getItem('theme')
} catch (e) {
  console.warn('[Main] localStorage não disponível para leitura de tema:', e)
}
if (savedTheme === 'light') {
  document.body.classList.add('light')
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
