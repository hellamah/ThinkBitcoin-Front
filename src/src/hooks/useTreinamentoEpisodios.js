import { useCallback, useEffect, useRef, useState } from 'react'
import { apiRequest, TreinamentoEpisodioEndpoint } from '../utils/apiClient'
import { toUTCISO } from '../utils/dateUtils'
import {
  QUATRO_HORAS_MS,
  UM_MINUTO_MS,
  extrairLista,
  inicioDoGrupo,
  mesclarEpisodios,
} from '../utils/treinamento'

// Carga dos episódios de treinamento: primeira janela, períodos sob demanda e
// polling. Saiu da página, onde dividia o componente com oito gráficos, para a
// tela poder trocar de layout sem mexer em nada disto.

// Busca TODOS os episódios de [inicioMs, fimMs), paginando se preciso.
//
// As bordas vão em UTC, com o Z. Iam em componentes LOCAIS e sem marca de fuso —
// "2026-09-08T04:00:00" para um instante que era 07:00Z. Quem lê do outro lado
// não tem como adivinhar que aquilo era hora local, e o carimbo que a API
// devolve sem fuso É UTC (ver marcarUtcQuandoFaltarFuso no apiClient). A janela
// pedida saía deslocada pelo fuso do usuário inteiro: em UTC-3, três horas.
const buscarPeriodo = async (moeda, versaoModelo, inicioMs, fimMs) => {
  const QTD = 1000
  const params = (pagina) => ({
    moeda: moeda || undefined,
    versaoModelo: versaoModelo || undefined,
    dataInicio: toUTCISO(inicioMs),
    dataFim: toUTCISO(fimMs),
    quantidade: QTD,
    pagina,
    ordenarAscendente: false,
  })
  const primeira = await apiRequest(TreinamentoEpisodioEndpoint.LIST(params(1)))
  let todos = extrairLista(primeira)
  const totalPaginas = primeira?.resultado?.totalPaginas ?? 1
  if (totalPaginas > 1) {
    const demais = await Promise.all(
      Array.from({ length: totalPaginas - 1 }, (_, i) =>
        apiRequest(TreinamentoEpisodioEndpoint.LIST(params(i + 2)))
      )
    )
    for (const r of demais) todos = todos.concat(extrairLista(r))
  }
  return todos
}

const listaDoResumo = (resp) =>
  Array.isArray(resp?.resultado) ? resp.resultado : (Array.isArray(resp) ? resp : [])

const INTERVALO_POLLING_MS = 60_000

/**
 * @param {object} opcoes
 * @param {string|null} opcoes.moeda  filtro do servidor (só com UMA moeda)
 * @param {string|null} opcoes.versao filtro de versão do modelo
 * @param {number} [opcoes.alvoMs]    instante de um episódio aberto por link,
 *                                    cujo período precisa vir na primeira carga
 */
export default function useTreinamentoEpisodios({ moeda, versao, alvoMs }) {
  const [itens, setItens] = useState([])
  const [resumo, setResumo] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [carregandoPeriodo, setCarregandoPeriodo] = useState(false)
  const [erro, setErro] = useState(null)
  const [atualizadoEm, setAtualizadoEm] = useState(null)
  const [recarga, setRecarga] = useState(0)

  // Grupos de 4h já buscados, pelo timestamp de início.
  const gruposRef = useRef(new Set())
  // Invalida respostas de uma geração antiga (troca de filtro ou recarga).
  const geracaoRef = useRef(0)
  const emAndamentoRef = useRef(0)
  const ultimaBuscaRef = useRef(0)

  // O alvo entra por ref: ele muda a cada episódio aberto, e refazer a carga
  // inteira por isso jogaria fora tudo o que já estava na tela.
  const alvoRef = useRef(alvoMs)
  useEffect(() => { alvoRef.current = alvoMs }, [alvoMs])

  useEffect(() => {
    let cancelado = false
    geracaoRef.current += 1
    gruposRef.current.clear()
    emAndamentoRef.current = 0
    setCarregandoPeriodo(false)

    const carregar = async () => {
      setCarregando(true)
      setErro(null)
      try {
        const [sondagem, resumoResp] = await Promise.all([
          apiRequest(TreinamentoEpisodioEndpoint.LIST({
            moeda: moeda || undefined,
            versaoModelo: versao || undefined,
            quantidade: 1,
            ordenarAscendente: false,
          })),
          apiRequest(TreinamentoEpisodioEndpoint.RESUMO({ versaoModelo: versao || undefined })),
        ])
        if (cancelado) return
        setResumo(listaDoResumo(resumoResp))

        const maisRecente = extrairLista(sondagem)[0]
        if (!maisRecente) {
          setItens([])
          setAtualizadoEm(Date.now())
          return
        }

        // Os dois grupos mais recentes cobrem a janela padrão de cada aba e a
        // janela anterior, que as comparações usam.
        const grupoAtual = inicioDoGrupo(new Date(maisRecente.dataHora).getTime())
        const grupos = [grupoAtual - QUATRO_HORAS_MS, grupoAtual]

        const alvo = alvoRef.current
        if (Number.isFinite(alvo)) {
          const grupoAlvo = inicioDoGrupo(alvo)
          for (const g of [grupoAlvo - QUATRO_HORAS_MS, grupoAlvo]) {
            if (!grupos.includes(g)) grupos.push(g)
          }
        }

        const lotes = await Promise.all(
          grupos.map((g) => buscarPeriodo(moeda, versao, g, g + QUATRO_HORAS_MS))
        )
        if (cancelado) return
        grupos.forEach((g) => gruposRef.current.add(g))
        ultimaBuscaRef.current = Date.now()
        setItens(mesclarEpisodios(lotes[0], lotes.slice(1).flat()))
        setAtualizadoEm(Date.now())
      } catch (e) {
        if (!cancelado) setErro(e instanceof Error ? e : new Error(String(e ?? '')))
      } finally {
        if (!cancelado) setCarregando(false)
      }
    }
    carregar()
    return () => { cancelado = true }
  }, [moeda, versao, recarga])

  /**
   * Garante que os grupos de 4h que cobrem [inicioMs, fimMs] estejam
   * carregados. Cada grupo é buscado uma única vez; tudo o que chega é mesclado.
   */
  const garantirPeriodo = useCallback((inicioMs, fimMs) => {
    if (!Number.isFinite(inicioMs) || !Number.isFinite(fimMs)) return
    const faltantes = []
    for (let g = inicioDoGrupo(inicioMs); g <= inicioDoGrupo(fimMs); g += QUATRO_HORAS_MS) {
      if (!gruposRef.current.has(g)) faltantes.push(g)
    }
    if (faltantes.length === 0) return

    // Marca já, para chamadas repetidas não dispararem a mesma busca.
    faltantes.forEach((g) => gruposRef.current.add(g))
    const geracao = geracaoRef.current
    emAndamentoRef.current += faltantes.length
    setCarregandoPeriodo(true)

    Promise.all(faltantes.map((g) => buscarPeriodo(moeda, versao, g, g + QUATRO_HORAS_MS)))
      .then((lotes) => {
        if (geracaoRef.current !== geracao) return
        setItens((atuais) => mesclarEpisodios(atuais, lotes.flat()))
      })
      .catch(() => {
        // Libera os grupos para uma nova tentativa.
        if (geracaoRef.current === geracao) faltantes.forEach((g) => gruposRef.current.delete(g))
      })
      .finally(() => {
        emAndamentoRef.current = Math.max(0, emAndamentoRef.current - faltantes.length)
        if (emAndamentoRef.current === 0) setCarregandoPeriodo(false)
      })
  }, [moeda, versao])

  // Polling: a cada 60s busca o que chegou desde a última consulta, com folga
  // de 2min. Buscava só o grupo de 4h do relógio, e na virada do grupo os
  // episódios dos últimos segundos do anterior ficavam de fora até o próximo
  // refresh. Pausa com a aba em segundo plano; na volta, a folga pela última
  // busca cobre o intervalo parado (até 4h).
  useEffect(() => {
    const geracao = geracaoRef.current
    const tick = async () => {
      if (document.hidden) return
      const agora = Date.now()
      const desde = Math.max(ultimaBuscaRef.current - 2 * UM_MINUTO_MS, agora - QUATRO_HORAS_MS)
      try {
        const [novos, resumoResp] = await Promise.all([
          buscarPeriodo(moeda, versao, desde, agora + UM_MINUTO_MS),
          apiRequest(TreinamentoEpisodioEndpoint.RESUMO({ versaoModelo: versao || undefined })).catch(() => null),
        ])
        if (geracaoRef.current !== geracao) return
        ultimaBuscaRef.current = agora
        setItens((atuais) => mesclarEpisodios(atuais, novos))
        if (resumoResp) setResumo(listaDoResumo(resumoResp))
        setAtualizadoEm(agora)
      } catch { /* silencioso: a próxima rodada tenta de novo */ }
    }
    const id = setInterval(tick, INTERVALO_POLLING_MS)
    return () => clearInterval(id)
  }, [moeda, versao, recarga])

  const recarregar = useCallback(() => setRecarga((n) => n + 1), [])

  return {
    itens,
    resumo,
    carregando,
    carregandoPeriodo,
    erro,
    atualizadoEm,
    recarregar,
    garantirPeriodo,
  }
}
