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
const buscarPeriodo = async (moeda, versaoModelo, inicioMs, fimMs, opcoes) => {
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
  const primeira = await apiRequest(TreinamentoEpisodioEndpoint.LIST(params(1)), opcoes)
  let todos = extrairLista(primeira)
  const totalPaginas = primeira?.resultado?.totalPaginas ?? 1
  if (totalPaginas > 1) {
    const demais = await Promise.all(
      Array.from({ length: totalPaginas - 1 }, (_, i) =>
        apiRequest(TreinamentoEpisodioEndpoint.LIST(params(i + 2)), opcoes)
      )
    )
    for (const r of demais) todos = todos.concat(extrairLista(r))
  }
  return todos
}

const listaDoResumo = (resp) =>
  Array.isArray(resp?.resultado) ? resp.resultado : (Array.isArray(resp) ? resp : [])

const INTERVALO_POLLING_MS = 60_000
const INTERVALO_MINIMO_NA_VOLTA_MS = 15_000

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
  // Grupos de 4h cuja busca sob demanda falhou. A falha era engolida: a janela
  // ficava pela metade, sem aviso e sem como tentar de novo a não ser trocando
  // de período e voltando.
  const [gruposComFalha, setGruposComFalha] = useState([])

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
    setGruposComFalha([])

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
    // Grupo que volta a ser buscado deixa de contar como falha enquanto isso.
    setGruposComFalha((atuais) => {
      const restantes = atuais.filter((g) => !faltantes.includes(g))
      return restantes.length === atuais.length ? atuais : restantes
    })

    Promise.all(faltantes.map((g) => buscarPeriodo(moeda, versao, g, g + QUATRO_HORAS_MS)))
      .then((lotes) => {
        if (geracaoRef.current !== geracao) return
        setItens((atuais) => mesclarEpisodios(atuais, lotes.flat()))
      })
      .catch(() => {
        if (geracaoRef.current !== geracao) return
        // Libera os grupos para uma nova tentativa, e avisa a tela.
        faltantes.forEach((g) => gruposRef.current.delete(g))
        setGruposComFalha((atuais) => [...new Set([...atuais, ...faltantes])])
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
  // busca cobre o intervalo parado.
  useEffect(() => {
    const geracao = geracaoRef.current
    let emVoo = false
    const tick = async () => {
      if (document.hidden || emVoo) return
      const agora = Date.now()
      const ultima = ultimaBuscaRef.current
      // Mais de 4h parada: a busca incremental era cortada em 4h, e o trecho
      // anterior a isso sumia — o grupo daquela hora já constava como
      // carregado, então nenhuma janela o pedia de novo. Recarregar é o que a
      // pessoa faria à mão.
      if (ultima > 0 && agora - ultima > QUATRO_HORAS_MS) {
        setRecarga((n) => n + 1)
        return
      }
      const desde = ultima > 0 ? ultima - 2 * UM_MINUTO_MS : agora - QUATRO_HORAS_MS
      emVoo = true
      try {
        const [novos, resumoResp] = await Promise.all([
          buscarPeriodo(moeda, versao, desde, agora + UM_MINUTO_MS, { emSegundoPlano: true }),
          apiRequest(
            TreinamentoEpisodioEndpoint.RESUMO({ versaoModelo: versao || undefined }),
            { emSegundoPlano: true }
          ).catch(() => null),
        ])
        if (geracaoRef.current !== geracao) return
        ultimaBuscaRef.current = agora
        setItens((atuais) => mesclarEpisodios(atuais, novos))
        if (resumoResp) setResumo(listaDoResumo(resumoResp))
        setAtualizadoEm(agora)
      } catch { /* silencioso: a próxima rodada tenta de novo */ } finally {
        emVoo = false
      }
    }
    // Na volta à aba, atualiza na hora: esperar o próximo tique deixava a tela
    // até um minuto mostrando "Parado, último episódio há 40 min" de um treino
    // que nunca parou. Volta rápida (menos que 15 s fora) não refaz a busca.
    const aoVoltar = () => {
      if (!document.hidden && Date.now() - ultimaBuscaRef.current >= INTERVALO_MINIMO_NA_VOLTA_MS) tick()
    }
    const id = setInterval(tick, INTERVALO_POLLING_MS)
    document.addEventListener('visibilitychange', aoVoltar)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', aoVoltar)
    }
  }, [moeda, versao, recarga])

  const recarregar = useCallback(() => setRecarga((n) => n + 1), [])

  /** Se algum grupo que cobre [inicioMs, fimMs] falhou ao carregar. */
  const falhouEntre = useCallback(
    (inicioMs, fimMs) => gruposComFalha.some((g) => g <= fimMs && g + QUATRO_HORAS_MS > inicioMs),
    [gruposComFalha]
  )

  return {
    itens,
    resumo,
    carregando,
    carregandoPeriodo,
    erro,
    atualizadoEm,
    recarregar,
    garantirPeriodo,
    falhouEntre,
  }
}
