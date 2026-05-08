import { useState, useEffect, useRef } from 'react'
import { apiRequest, MarketEndpoint } from '../utils/apiClient'


export default function useCoinPrices() {
  const [moedas, setMoedas] = useState([])
  const moedasRef = useRef([])

  useEffect(() => {
    moedasRef.current = moedas
  }, [moedas])

  useEffect(() => {
    let ativo = true

    const inicializarMoedas = async () => {
      try {
        const json = await apiRequest(MarketEndpoint.COIN_LIST)
        const lista = ((json?.resultado || json?.Resultado) || [])
          .map((m) => ({
            id: m?.id || m?.Id,
            simbolo: m?.sigla || m?.Sigla,
            nome: m?.nome || m?.Nome,
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
        // Fallback Premium: Garante que o usuário veja algo mesmo se o backend falhar
        const mockLista = [
          { id: 'btc-id', simbolo: 'BTC', nome: 'Bitcoin', valor: 0, dados: [], variacao: 0 },
          { id: 'eth-id', simbolo: 'ETH', nome: 'Ethereum', valor: 0, dados: [], variacao: 0 },
          { id: 'sol-id', simbolo: 'SOL', nome: 'Solana', valor: 0, dados: [], variacao: 0 },
        ]
        if (ativo) {
          setMoedas(mockLista)
          obterValores(mockLista)
        }
      }
    }

    const obterValores = async (listaAtual) => {
      const listaParaProcessar = listaAtual || moedasRef.current
      if (listaParaProcessar.length === 0) return

      const atualizadas = await Promise.all(
        listaParaProcessar.map(async (m) => {
          try {
            // Usa o símbolo (sigla) para buscar o valor. Convertemos para lowercase conforme o exemplo do usuário.
            const [resPreco, resFear, resTrend] = await Promise.all([
              apiRequest(MarketEndpoint.COIN_VALUE(m.simbolo.toLowerCase())),
              apiRequest(`/ThinkBitcoin/variavel-externa/fear-greed?idMoeda=${m.id}&quantidade=1&ordemAsc=false`),
              apiRequest(`/ThinkBitcoin/variavel-externa/trend?idMoeda=${m.id}&quantidade=1&ordemAsc=false`)
            ])
            
            // Tenta extrair o valor do preço
            let valor = 0
            const pRes = resPreco?.resultado ?? resPreco?.Resultado ?? resPreco
            const registro = pRes?.registros?.[0] ?? pRes?.Registros?.[0] ?? (Array.isArray(pRes) ? pRes[0] : pRes)
            
            if (typeof resPreco === 'number') {
              valor = resPreco
            } else if (registro) {
              valor = registro.precoFechamento ?? registro.PrecoFechamento ?? 
                      registro.valorNegociado ?? registro.ValorNegociado ?? 
                      registro.valor ?? registro.Valor ?? 
                      pRes?.valor ?? pRes?.Valor ?? 0
            }
            
            const apiVariacao = registro?.precoPercentualVariacao ?? registro?.PrecoPercentualVariacao ?? 
                                registro?.variacaoPercentual ?? registro?.VariacaoPercentual ?? null
            
            const historico = [...m.dados.slice(-6), valor]
            const anterior = m.dados[m.dados.length - 1] ?? valor
            const variacao = apiVariacao !== null ? apiVariacao : (anterior !== 0 ? ((valor - anterior) / anterior) * 100 : 0)
            
            // Extrai dados de sentimento
            const fgRes = resFear?.resultado ?? resFear?.Resultado ?? resFear
            const fear = fgRes?.registros?.[0] ?? fgRes?.Registros?.[0] ?? (Array.isArray(fgRes) ? fgRes[0] : null)
            
            const trRes = resTrend?.resultado ?? resTrend?.Resultado ?? resTrend
            const trend = trRes?.registros?.[0] ?? trRes?.Registros?.[0] ?? (Array.isArray(trRes) ? trRes[0] : null)

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
    
    return () => {
      ativo = false
    }
  }, [])

  return moedas
}
