import { useCallback, useEffect, useState } from 'react'
import { apiRequest, ZooEstrategiaEndpoint } from '../utils/apiClient'

// A rodada mais recente do zoo de estratégias. O zoo roda uma vez por dia,
// depois do fechamento: sem polling — quem quer a rodada nova recarrega.
//
// Até 04/11/2026 o hook também pedia a janela de teste do agente DQN, a
// segunda aba da tela. O agente foi encerrado em 22/10, e a aba saiu.

export default function useZooEstrategia() {
  // rodada: undefined = ainda não carregou; null = carregou e o zoo ainda não rodou.
  const [rodada, setRodada] = useState(undefined)
  const [erro, setErro] = useState(null)
  const [carregando, setCarregando] = useState(false)
  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    let cancelado = false
    const buscar = async () => {
      setCarregando(true)
      try {
        const resp = await apiRequest(ZooEstrategiaEndpoint.RODADA())
        if (cancelado) return
        setRodada(resp?.resultado ?? null)
        setErro(null)
      } catch (e) {
        if (!cancelado) setErro(e instanceof Error ? e : new Error(String(e ?? '')))
      } finally {
        if (!cancelado) setCarregando(false)
      }
    }
    buscar()
    return () => { cancelado = true }
  }, [recarga])

  const recarregar = useCallback(() => setRecarga((n) => n + 1), [])

  return { rodada, carregando, erro, recarregar }
}

/**
 * Curvas de patrimônio de uma moeda, para as estratégias pedidas (a escolhida e
 * o buy & hold, que é a referência do gráfico). Trocar a moeda ou a estratégia
 * busca de novo; a resposta de uma escolha antiga que chega atrasada é
 * descartada.
 */
export function useCurvaZoo({ moeda, estrategias, versaoZoo }) {
  const [curvas, setCurvas] = useState(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState(null)
  const chave = (estrategias ?? []).join(',')

  useEffect(() => {
    if (!moeda || !chave) return undefined
    let cancelado = false
    const buscar = async () => {
      setCarregando(true)
      try {
        const resp = await apiRequest(ZooEstrategiaEndpoint.CURVA({
          moeda, estrategias: chave.split(','), versaoZoo,
        }))
        if (cancelado) return
        setCurvas(Array.isArray(resp?.resultado) ? resp.resultado : [])
        setErro(null)
      } catch (e) {
        if (!cancelado) setErro(e instanceof Error ? e : new Error(String(e ?? '')))
      } finally {
        if (!cancelado) setCarregando(false)
      }
    }
    buscar()
    return () => { cancelado = true }
  }, [moeda, chave, versaoZoo])

  return { curvas, carregando, erro }
}
