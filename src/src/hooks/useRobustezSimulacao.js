import { useCallback, useEffect, useRef, useState } from 'react'
import { executarRobustez, prepararContextoRobustez } from '../utils/tarefaRobustez'

// Espera depois do último ajuste antes de pedir as medições. Digitar "2,5" no
// campo de stop passa por "2" e "2,": sem a espera, cada tecla dispararia uma
// rodada inteira de sorteios que a tecla seguinte jogaria fora.
const ATRASO_MS = 250

const VAZIO = Object.freeze({ acaso: null, mapa: null, sorte: null, calculando: false })

const criarWorker = () => {
  if (typeof Worker === 'undefined') return null
  try {
    return new Worker(new URL('../workers/robustez.worker.js', import.meta.url), { type: 'module' })
  } catch {
    return null
  }
}

/**
 * Régua aleatória, mapa de sensibilidade e sorte do ranking, fora da thread da
 * tela.
 *
 * Os resultados chegam em fases e em momentos diferentes. Enquanto um pedido
 * novo está em curso, os números do anterior continuam no estado com
 * `calculando: true` — a tela decide como mostrar que estão desatualizados, em
 * vez de piscar para vazio a cada clique.
 *
 * Sem Worker (testes, navegador antigo, ou um Worker que falhou ao carregar),
 * a mesma tarefa roda aqui, com pausas entre as fases.
 *
 * @param {object} params
 * @param {Array<object>|null} params.registros - Série da simulação.
 * @param {string|null} params.aPartirDe
 * @param {object|null} params.opcoes - Opções completas da simulação, sem a
 *   série de sinais (ela é montada do outro lado).
 * @returns {{acaso: object|null, mapa: object|null, sorte: object|null, calculando: boolean}}
 */
export default function useRobustezSimulacao({ registros, aPartirDe, opcoes }) {
  const [estado, setEstado] = useState(VAZIO)
  const workerRef = useRef(null)
  const contextoLocalRef = useRef(null)
  const pedidoRef = useRef(0)
  const ultimoRef = useRef(null)
  const serieRef = useRef({ registros: null, aPartirDe: null })

  const executarLocal = useCallback((id, pedido) => {
    if (!contextoLocalRef.current) {
      const { registros: r, aPartirDe: a } = serieRef.current
      contextoLocalRef.current = prepararContextoRobustez(r, a)
    }
    const contexto = contextoLocalRef.current
    if (!contexto) {
      setEstado((atual) => ({ ...atual, calculando: false }))
      return
    }
    executarRobustez(contexto, pedido, {
      emitir: (chave, valor) => {
        if (id === pedidoRef.current) setEstado((atual) => ({ ...atual, [chave]: valor }))
      },
      cancelado: () => id !== pedidoRef.current,
    }).finally(() => {
      if (id === pedidoRef.current) setEstado((atual) => ({ ...atual, calculando: false }))
    })
  }, [])

  // O Worker vive enquanto o painel vive.
  useEffect(
    () => () => {
      workerRef.current?.terminate()
      workerRef.current = null
    },
    []
  )

  // Série nova: zera o que havia (era de outra moeda) e manda os candles UMA
  // vez. Os pedidos seguintes só levam parâmetros.
  useEffect(() => {
    setEstado(VAZIO)
    serieRef.current = { registros, aPartirDe }
    contextoLocalRef.current = null
    if (!registros?.length) return

    if (!workerRef.current) {
      const worker = criarWorker()
      if (worker) {
        worker.onmessage = (evento) => {
          const { tipo, id, chave, valor } = evento.data || {}
          if (id !== pedidoRef.current) return
          if (tipo === 'parcial') setEstado((atual) => ({ ...atual, [chave]: valor }))
          else if (tipo === 'fim') setEstado((atual) => ({ ...atual, calculando: false }))
        }
        // Worker que não carregou (CSP, bundle quebrado) não pode deixar o
        // painel esperando para sempre: o pedido pendente é refeito aqui.
        worker.onerror = () => {
          worker.terminate()
          if (workerRef.current === worker) workerRef.current = null
          const pendente = ultimoRef.current
          if (pendente && pendente.id === pedidoRef.current) executarLocal(pendente.id, pendente.pedido)
        }
        workerRef.current = worker
      }
    }
    workerRef.current?.postMessage({ tipo: 'serie', registros, aPartirDe })
  }, [registros, aPartirDe, executarLocal])

  useEffect(() => {
    if (!registros?.length || !opcoes?.sinalEntrada) {
      setEstado(VAZIO)
      return undefined
    }

    const id = ++pedidoRef.current
    setEstado((atual) => (atual.calculando ? atual : { ...atual, calculando: true }))

    const timer = setTimeout(() => {
      const pedido = { opcoes }
      ultimoRef.current = { id, pedido }
      if (workerRef.current) workerRef.current.postMessage({ tipo: 'calcular', id, pedido })
      else executarLocal(id, pedido)
    }, ATRASO_MS)

    return () => clearTimeout(timer)
  }, [registros, aPartirDe, opcoes, executarLocal])

  return estado
}
