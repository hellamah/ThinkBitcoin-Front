import { useCallback, useEffect, useState } from 'react'
import { apiRequest, ZooEstrategiaEndpoint } from '../utils/apiClient'
import { JANELAS, parametroDaJanela } from '../utils/zooEstrategia'

// A rodada mais recente do zoo de estratégias numa janela (o histórico ou a
// janela de teste do agente). O zoo roda uma vez por dia, depois do
// fechamento: sem polling — quem quer a rodada nova recarrega.

export default function useZooEstrategia(janela = JANELAS.HISTORICO) {
  // A resposta guarda a janela que a pediu: ao trocar de aba, a rodada da
  // outra janela não aparece nem por um instante sob o título desta.
  // rodada: undefined = ainda não carregou; null = carregou e o zoo ainda não rodou.
  const [resposta, setResposta] = useState({ janela: null, rodada: undefined, erro: null })
  const [carregando, setCarregando] = useState(false)
  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    let cancelado = false
    const buscar = async () => {
      setCarregando(true)
      try {
        const resp = await apiRequest(ZooEstrategiaEndpoint.RODADA({ janela: parametroDaJanela(janela) }))
        if (cancelado) return
        setResposta({ janela, rodada: resp?.resultado ?? null, erro: null })
      } catch (e) {
        if (!cancelado) {
          setResposta((atual) => ({
            janela,
            rodada: atual.janela === janela ? atual.rodada : undefined,
            erro: e instanceof Error ? e : new Error(String(e ?? '')),
          }))
        }
      } finally {
        if (!cancelado) setCarregando(false)
      }
    }
    buscar()
    return () => { cancelado = true }
  }, [recarga, janela])

  const recarregar = useCallback(() => setRecarga((n) => n + 1), [])
  const daJanela = resposta.janela === janela

  return {
    rodada: daJanela ? resposta.rodada : undefined,
    carregando,
    erro: daJanela ? resposta.erro : null,
    recarregar,
  }
}

/**
 * Curvas de patrimônio de uma moeda, para as estratégias pedidas (a escolhida e
 * o buy & hold, que é a referência do gráfico). Trocar a moeda, a estratégia ou
 * a janela busca de novo; a resposta de uma escolha antiga que chega atrasada é
 * descartada.
 */
export function useCurvaZoo({ moeda, estrategias, versaoZoo, janela = JANELAS.HISTORICO }) {
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
          moeda, estrategias: chave.split(','), versaoZoo, janela: parametroDaJanela(janela),
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
  }, [moeda, chave, versaoZoo, janela])

  return { curvas, carregando, erro }
}
