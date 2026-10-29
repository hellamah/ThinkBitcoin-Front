// Web Worker das medições pesadas da simulação. Ver utils/tarefaRobustez.js.
//
// Protocolo:
//   → { tipo: 'serie', registros, aPartirDe }   uma vez por série carregada
//   → { tipo: 'calcular', id, pedido }          a cada ajuste de parâmetro
//   ← { tipo: 'parcial', id, chave, valor }     uma por fase pronta
//   ← { tipo: 'fim', id }
//
// Só o pedido mais recente vale. Um mais antigo ainda em curso para na
// próxima pausa entre fases, e o que ele emitiria é descartado aqui mesmo.

import { executarRobustez, prepararContextoRobustez } from '../utils/tarefaRobustez'

let contexto = null
let ultimoPedido = 0

self.onmessage = async (evento) => {
  const mensagem = evento.data || {}

  if (mensagem.tipo === 'serie') {
    contexto = prepararContextoRobustez(mensagem.registros, mensagem.aPartirDe)
    return
  }

  if (mensagem.tipo !== 'calcular') return

  const { id, pedido } = mensagem
  ultimoPedido = id
  const doPedido = contexto

  if (doPedido) {
    await executarRobustez(doPedido, pedido, {
      emitir: (chave, valor) => {
        if (id === ultimoPedido) self.postMessage({ tipo: 'parcial', id, chave, valor })
      },
      cancelado: () => id !== ultimoPedido,
    })
  }
  if (id === ultimoPedido) self.postMessage({ tipo: 'fim', id })
}
