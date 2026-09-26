import { useEffect, useState } from 'react'
import { apiRequest, MarketEndpoint } from '../utils/apiClient'
import { DIAS_SERIE_LONGA, dividirEmBlocos, montarJanelaSimulacao } from '../utils/simulationWindow'
import { instanteDe } from '../utils/validacaoJanela'

// Por quanto tempo a série longa buscada vale. É a cadência da coleta: antes
// de uma hora não há candle novo, e voltar à aba não precisa buscar de novo os
// ~15 MB.
const VALIDADE_MS = 60 * 60 * 1000

// Por moeda, fora do componente: fechar a aba e abrir de novo não refaz a
// busca, e trocar de moeda e voltar também não.
const guardadas = new Map()

const VAZIO = Object.freeze({ registros: null, aPartirDe: null, carregando: false, erro: '' })

/**
 * Dois anos de candles de uma moeda, buscados só quando `ativo`.
 *
 * É a série da leitura "escolher pelo passado". Não é a da simulação: aquela
 * tem 180 dias e é buscada ao abrir a tela; esta tem quatro vezes isso, pesa
 * ~15 MB sem compressão (B-06), e só quem abre a aba paga por ela.
 *
 * A API recusa mais de 5.000 candles por pedido, então o período vai em
 * blocos, em paralelo, e volta junto, sem repetição, na ordem da API.
 *
 * @param {object} params
 * @param {string|null} params.token
 * @param {string|null} params.sigla
 * @param {boolean} params.ativo - A aba está aberta.
 * @returns {{registros: Array<object>|null, aPartirDe: string|null,
 *   carregando: boolean, erro: string}}
 */
export default function useSerieLonga({ token, sigla, ativo }) {
  const [estado, setEstado] = useState(VAZIO)

  useEffect(() => {
    if (!ativo || !token || !sigla) return undefined

    const guardada = guardadas.get(sigla)
    if (guardada && Date.now() - guardada.em < VALIDADE_MS) {
      setEstado({ registros: guardada.registros, aPartirDe: guardada.aPartirDe, carregando: false, erro: '' })
      return undefined
    }

    const controller = new AbortController()
    setEstado({ ...VAZIO, carregando: true })

    const janela = montarJanelaSimulacao(new Date(), DIAS_SERIE_LONGA)
    const pedidos = dividirEmBlocos(janela.dataInicio, janela.dataFim).map((bloco) => {
      const params = new URLSearchParams({
        dataInicio: bloco.dataInicio,
        dataFim: bloco.dataFim,
        quantidade: String(bloco.quantidade),
        ordemAsc: 'false',
      })
      return apiRequest(`${MarketEndpoint.COIN_VALUE(sigla.toLowerCase())}?${params.toString()}`, {
        signal: controller.signal,
      })
    })

    Promise.all(pedidos)
      .then((respostas) => {
        if (controller.signal.aborted) return
        // O candle da emenda vem nos dois blocos vizinhos: o carimbo de hora
        // decide qual fica.
        const porHora = new Map()
        respostas.forEach((resposta) => {
          const dados = resposta?.resultado ?? resposta
          const lista = dados?.registros ?? (Array.isArray(dados) ? dados : [])
          lista.forEach((r) => {
            const t = instanteDe(r)
            if (t !== null) porHora.set(t, r)
          })
        })
        // Na ordem da API: do mais recente ao mais antigo.
        const registros = [...porHora.entries()].sort((a, b) => b[0] - a[0]).map(([, r]) => r)
        guardadas.set(sigla, { registros, aPartirDe: janela.aPartirDe, em: Date.now() })
        setEstado({ registros, aPartirDe: janela.aPartirDe, carregando: false, erro: '' })
      })
      .catch((err) => {
        if (err?.name === 'AbortError' || controller.signal.aborted) return
        console.error('Erro ao carregar a série longa:', err)
        setEstado({ ...VAZIO, erro: err?.message || 'Falha ao carregar a série longa' })
      })

    return () => controller.abort()
  }, [token, sigla, ativo])

  return estado
}
