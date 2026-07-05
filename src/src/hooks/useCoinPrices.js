import { useState, useEffect, useRef } from 'react'
import { apiRequest, MarketEndpoint } from '../utils/apiClient'

// Intervalo de atualização dos preços do carrossel.
const POLLING_INTERVAL_MS = 60_000

export default function useCoinPrices() {
  const [moedas, setMoedas] = useState([])
  const [erro, setErro] = useState('')
  const moedasRef = useRef([])

  useEffect(() => {
    moedasRef.current = moedas
  }, [moedas])

  useEffect(() => {
    let ativo = true

    const inicializarMoedas = async () => {
      try {
        const json = await apiRequest(MarketEndpoint.COIN_LIST)
        const lista = (json?.resultado || [])
          .map((m) => ({
            id: m?.id,
            simbolo: m?.sigla,
            nome: m?.nome,
            valor: 0,
            dados: [],
            variacao: 0,
          }))
          .filter(
            (m) =>
              m && m.simbolo?.toUpperCase() !== 'USDT' &&
              (m.nome ? !m.nome.toLowerCase().includes('dolar') : true)
          )
        if (ativo) {
          setMoedas(lista)
          // Após inicializar a lista, busca os valores pela primeira vez
          obterValores(lista)
        }
      } catch (err) {
        console.error('Erro ao listar moedas:', err)
        // Sem lista não há o que exibir: sinaliza o erro em vez de inventar moedas.
        if (ativo) {
          setErro('Não foi possível carregar a lista de moedas. Tente novamente mais tarde.')
        }
      }
    }

    const obterValores = async (listaAtual) => {
      const listaParaProcessar = listaAtual || moedasRef.current
      if (listaParaProcessar.length === 0) return

      const atualizadas = await Promise.all(
        listaParaProcessar.map(async (m) => {
          try {
            // Usa o símbolo (sigla) para buscar o valor.
            // Fear/trend são complementares: em caso de falha ficam nulos e a UI
            // simplesmente não exibe sentimento, em vez de mostrar dados fictícios.
            const [resPreco, resFear, resTrend] = await Promise.all([
              apiRequest(MarketEndpoint.COIN_VALUE(m.simbolo.toLowerCase())),
              apiRequest(`/ThinkBitcoin/variavel-externa/fear-greed?idMoeda=${m.id}&quantidade=1&ordemAsc=false`).catch(() => null),
              apiRequest(`/ThinkBitcoin/variavel-externa/trend?idMoeda=${m.id}&quantidade=1&ordemAsc=false`).catch(() => null)
            ])

            // Tenta extrair o valor do preço
            let valor = 0
            const pRes = resPreco?.resultado ?? resPreco
            const registro = pRes?.registros?.[0] ?? (Array.isArray(pRes) ? pRes[0] : pRes)

            if (typeof resPreco === 'number') {
              valor = resPreco
            } else if (registro) {
              valor = registro.precoFechamento ??
                registro.valorNegociado ??
                registro.valor ??
                pRes?.valor ?? 0
            }

            const apiVariacao = registro?.precoPercentualVariacao ??
              registro?.variacaoPercentual ?? null

            const historico = [...m.dados.slice(-6), valor]
            const anterior = m.dados[m.dados.length - 1] ?? valor
            const variacao = apiVariacao !== null ? apiVariacao : (anterior !== 0 ? ((valor - anterior) / anterior) * 100 : 0)

            // Extrai dados de sentimento
            const fgRes = resFear?.resultado ?? resFear
            const fear = fgRes?.registros?.[0] ?? (Array.isArray(fgRes) ? fgRes[0] : null)

            const trRes = resTrend?.resultado ?? resTrend
            const trend = trRes?.registros?.[0] ?? (Array.isArray(trRes) ? trRes[0] : null)

            return { ...m, valor, dados: historico, variacao, fear, trend }
          } catch (err) {
            console.error(`Erro ao buscar valor para ${m.simbolo}:`, err)
            return m
          }
        })
      )
      if (ativo) setMoedas(atualizadas)
    }

    inicializarMoedas()

    // Mantém os valores do carrossel atualizados; sem isso os preços congelam
    // no primeiro fetch. Pausa quando a aba está em segundo plano.
    const intervalo = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return
      obterValores()
    }, POLLING_INTERVAL_MS)

    return () => {
      ativo = false
      clearInterval(intervalo)
    }
  }, [])

  return { moedas, erro, setErro }
}
