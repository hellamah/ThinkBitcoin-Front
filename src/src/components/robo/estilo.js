import { keyframes } from '@emotion/react'

// O que os instrumentos e a tela do Robô ao vivo dividem: as fontes que o site já usa
// para títulos e números, e a entrada em ondas ao abrir a tela.
export const FONTE_DOS_NUMEROS = "'Share Tech Mono', monospace"
export const FONTE_DOS_TITULOS = 'Outfit, sans-serif'
export const SEM_MOVIMENTO = '@media (prefers-reduced-motion: reduce)'

const subir = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: none; }
`

/** A entrada da tela, em ondas: uma vez só, ao abrir, e nunca para quem pediu sem movimento. */
export const entradaEmOrdem = (ordem = 0) => ({
  animation: `${subir} 420ms ease-out both`,
  animationDelay: `${ordem * 70}ms`,
  [SEM_MOVIMENTO]: { animation: 'none' },
})
