import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext'
import { TranslationProvider } from './context/TranslationContext'
import { instalarCapturaGlobal } from './utils/relatarErro'
import { registrarServiceWorker } from './utils/registrarServiceWorker'

// Antes de qualquer render: um erro na subida do app é justamente o que
// ninguém vê, e é o que mais importa saber.
instalarCapturaGlobal()

// Instalável e utilizável sem rede. Só faz efeito em build de produção.
registrarServiceWorker()

let savedTheme = null
try {
  savedTheme = localStorage.getItem('theme')
} catch (e) {
  console.warn('[Main] localStorage não disponível para leitura de tema:', e)
}
// A classe vai no <html> também, como o AuthContext faz ao aplicar o tema: os
// tokens valem para o elemento raiz, e só no body o <html> ficava com os do
// tema escuro até o primeiro efeito do React rodar.
if (savedTheme === 'light') {
  document.body.classList.add('light')
  document.documentElement.classList.add('light')
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        {/* Dentro do AuthProvider: o idioma vem das preferências do usuário. */}
        <TranslationProvider>
          <App />
        </TranslationProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
