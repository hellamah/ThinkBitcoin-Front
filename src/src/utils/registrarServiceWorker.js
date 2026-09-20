// Registro do service worker (public/sw.js).
//
// Só em build de produção. Em desenvolvimento o Vite serve os módulos sem hash
// e recarrega por HMR; um service worker no meio disso devolve arquivo velho e
// faz perseguir bug que não existe no código.

export const registrarServiceWorker = () => {
  if (typeof window === 'undefined') return
  if (!('serviceWorker' in navigator)) return

  let ehProducao = false
  try {
    ehProducao = Boolean(import.meta.env?.PROD)
  } catch {
    return
  }
  if (!ehProducao) return

  // Depois do `load`, e não durante: registrar disputa banda e CPU justamente
  // com o primeiro carregamento, que é o que a pessoa está esperando na tela.
  // O ganho do SW é da segunda visita em diante; atrasá-lo alguns milissegundos
  // não custa nada.
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Registro pode falhar por motivo legítimo — navegação privada, política
      // do navegador, storage cheio. O app funciona sem ele; o que não pode é
      // essa falha virar erro visível para quem só queria ver o painel.
    })
  })
}
