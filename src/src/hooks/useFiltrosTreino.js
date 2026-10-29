import { useCallback, useEffect, useState } from 'react'
import { apiRequest, TreinamentoEpisodioEndpoint } from '../utils/apiClient'

// Opções dos filtros da tela de treino: moedas e versões de todo o histórico.
// Mudam devagar — uma versão nova a cada poucos dias —, então o polling é bem
// mais espaçado que o dos episódios. O que chega entre uma consulta e outra os
// episódios carregados completam (ver versoesDoFiltro).

const INTERVALO_MS = 5 * 60 * 1000

/**
 * @returns {{ filtros: { moedas: string[], versoes: object[] } | null, recarregar: () => void }}
 *   `filtros` é null até a primeira resposta, e continua null se a consulta
 *   falhar: a tela cai nos episódios carregados, como fazia antes de o
 *   endpoint existir.
 */
export default function useFiltrosTreino() {
  const [filtros, setFiltros] = useState(null)
  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    let cancelado = false
    const buscar = async (emSegundoPlano) => {
      try {
        const resp = await apiRequest(TreinamentoEpisodioEndpoint.FILTROS, { emSegundoPlano })
        if (cancelado || !resp?.resultado) return
        setFiltros({
          moedas: Array.isArray(resp.resultado.moedas) ? resp.resultado.moedas : [],
          versoes: Array.isArray(resp.resultado.versoes) ? resp.resultado.versoes : [],
        })
      } catch { /* silencioso: sem filtros, a tela usa os episódios carregados */ }
    }
    // A carga inicial também vai em segundo plano: uma falha aqui não é erro
    // da tela, que funciona sem os filtros.
    buscar(true)
    const id = setInterval(() => { if (!document.hidden) buscar(true) }, INTERVALO_MS)
    return () => {
      cancelado = true
      clearInterval(id)
    }
  }, [recarga])

  const recarregar = useCallback(() => setRecarga((n) => n + 1), [])

  return { filtros, recarregar }
}
