import { useCallback, useEffect, useState } from 'react'
import { apiRequest, TreinamentoEpisodioEndpoint } from '../utils/apiClient'

// Avaliações out-of-sample das sessões de treino, para a aba de validação.
// Uma por sessão — cerca de uma a cada hora e meia —, então o polling é bem mais
// espaçado que o dos episódios, e só corre com a aba aberta e visível.

const INTERVALO_MS = 5 * 60 * 1000
// Das mais recentes: cobre mais de uma semana de treino.
const QUANTIDADE = 200

/**
 * @param {object} opcoes
 * @param {string|null} opcoes.versao filtro de versão do modelo
 * @param {boolean} opcoes.ativo      a aba está aberta
 */
export default function useAvaliacoesSessao({ versao, ativo }) {
  // null = ainda não carregou; [] = carregou e não há sessão avaliada.
  const [avaliacoes, setAvaliacoes] = useState(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState(null)
  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    if (!ativo) return undefined
    let cancelado = false

    const buscar = async (emSegundoPlano) => {
      if (!emSegundoPlano) setCarregando(true)
      try {
        const resp = await apiRequest(
          TreinamentoEpisodioEndpoint.AVALIACOES({ versaoModelo: versao || undefined, quantidade: QUANTIDADE }),
          { emSegundoPlano }
        )
        if (cancelado) return
        setAvaliacoes(Array.isArray(resp?.resultado) ? resp.resultado : [])
        setErro(null)
      } catch (e) {
        // No polling, uma falha não apaga o que já está na tela.
        if (!cancelado && !emSegundoPlano) setErro(e instanceof Error ? e : new Error(String(e ?? '')))
      } finally {
        if (!cancelado && !emSegundoPlano) setCarregando(false)
      }
    }

    buscar(false)
    const id = setInterval(() => { if (!document.hidden) buscar(true) }, INTERVALO_MS)
    return () => {
      cancelado = true
      clearInterval(id)
    }
  }, [versao, ativo, recarga])

  const recarregar = useCallback(() => setRecarga((n) => n + 1), [])

  return { avaliacoes, carregando, erro, recarregar }
}
