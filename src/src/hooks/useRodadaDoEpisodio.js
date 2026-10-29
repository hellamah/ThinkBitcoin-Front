import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiRequest, MarketEndpoint, TreinamentoEpisodioEndpoint } from '../utils/apiClient'
import { toUTCISO } from '../utils/dateUtils'
import {
  UMA_HORA_MS,
  UM_MINUTO_MS,
  extrairLista,
  instanteDe,
  rodadaDoEpisodio,
  variacaoEntreVelas,
} from '../utils/treinamento'

// A rodada de um episódio: as outras moedas que negociaram o mesmo lote de
// dados (ver rodadaDoEpisodio) e quanto o preço de cada uma andou nele.
//
// Busca própria, sem os filtros da página: com uma moeda escolhida a lista
// carregada só tem ela, e a versão filtrada também corta. Os episódios da
// rodada rodam em sequência (~18 s cada; dez moedas, uns 3 min), mas a rodada
// pode atravessar a troca de treino — a sessão nova retoma as moedas que
// faltavam depois da avaliação e da pausa de 5 a 8 min. ±45 min cobre isso
// com folga.
const MARGEM_MS = 45 * UM_MINUTO_MS
const QUANTIDADE = 1000

// O preço do lote é histórico e não muda: guardado por moeda e janela, para
// abrir outro episódio da mesma rodada não pedir tudo de novo.
const variacoesEmCache = new Map()

const variacaoDaMoeda = (moeda, inicioMs, fimMs) => {
  const chave = `${moeda}|${inicioMs}|${fimMs}`
  if (!variacoesEmCache.has(chave)) {
    // Só as velas da primeira e da última hora, em qualquer ordem: são duas
    // por ponta (uma vela por hora); a folga cobre hora gravada em dobro.
    const velas = (de, ate) => apiRequest(MarketEndpoint.COIN_VALUE(moeda.toLowerCase(), {
      dataInicio: toUTCISO(new Date(de)),
      dataFim: toUTCISO(new Date(ate)),
      quantidade: 10,
    })).then((resp) => resp?.resultado?.registros ?? [])
    const promessa = Promise.all([velas(inicioMs, inicioMs + UMA_HORA_MS), velas(fimMs - UMA_HORA_MS, fimMs)])
      .then(([doInicio, doFim]) => variacaoEntreVelas(doInicio, doFim))
      .catch(() => {
        // Falha não fica guardada: a próxima abertura tenta de novo.
        variacoesEmCache.delete(chave)
        return null
      })
    variacoesEmCache.set(chave, promessa)
  }
  return variacoesEmCache.get(chave)
}

/**
 * @param {object} item o episódio aberto
 * @returns {{ valida: boolean, carregando: boolean, erro: boolean, rodada: object|null,
 *   mercados: Record<string, number|null>, recarregar: () => void }}
 *   `mercados[moeda]` ausente = carregando; null = sem preço.
 */
export default function useRodadaDoEpisodio(item) {
  const inicioMs = item?.dataInicioDados ? new Date(item.dataInicioDados).getTime() : NaN
  const fimMs = item?.dataFimDados ? new Date(item.dataFimDados).getTime() : NaN
  const fimDoEpisodio = instanteDe(item)
  const valida = Number.isFinite(inicioMs) && Number.isFinite(fimMs) && Number.isFinite(fimDoEpisodio)

  // null = carregando.
  const [episodios, setEpisodios] = useState(null)
  const [erro, setErro] = useState(false)
  const [mercados, setMercados] = useState({})
  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    if (!valida) return undefined
    let cancelado = false
    setEpisodios(null)
    setErro(false)
    apiRequest(TreinamentoEpisodioEndpoint.LIST({
      dataInicio: toUTCISO(fimDoEpisodio - MARGEM_MS),
      dataFim: toUTCISO(fimDoEpisodio + MARGEM_MS),
      quantidade: QUANTIDADE,
      ordenarAscendente: false,
    }))
      .then((resp) => { if (!cancelado) setEpisodios(extrairLista(resp)) })
      .catch(() => {
        if (cancelado) return
        setEpisodios([])
        setErro(true)
      })
    return () => { cancelado = true }
  }, [valida, fimDoEpisodio, recarga])

  const rodada = useMemo(
    () => (valida && episodios ? rodadaDoEpisodio(item, episodios) : null),
    [valida, episodios, item]
  )

  // Uma chave estável: a lista de episódios muda de identidade a cada busca,
  // as moedas da rodada não.
  const moedas = rodada ? [...new Set(rodada.episodios.map((r) => r.moeda))].sort().join(',') : ''

  useEffect(() => {
    if (!moedas) return undefined
    let cancelado = false
    setMercados({})
    for (const moeda of moedas.split(',')) {
      variacaoDaMoeda(moeda, inicioMs, fimMs).then((v) => {
        if (!cancelado) setMercados((atual) => ({ ...atual, [moeda]: v }))
      })
    }
    return () => { cancelado = true }
  }, [moedas, inicioMs, fimMs])

  const recarregar = useCallback(() => setRecarga((n) => n + 1), [])

  return { valida, carregando: valida && episodios === null, erro, rodada, mercados, recarregar }
}
