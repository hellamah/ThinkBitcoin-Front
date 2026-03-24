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
        const lista = (json.resultado || [])
          .map((m) => ({
            id: m.id || m.Id,
            simbolo: m.sigla || m.Sigla,
            nome: m.nome || m.Nome,
            valor: 0,
            dados: [],
            variacao: 0,
          }))
          .filter(
            (m) =>
              m.simbolo?.toUpperCase() !== 'USDT' &&
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
            const json = await apiRequest(MarketEndpoint.COIN_VALUE(m.simbolo.toLowerCase()))
            
            // Tenta extrair o valor de várias formas possíveis (suporte a real API e Paginação)
            let valor = 0
            if (typeof json === 'number') {
              valor = json
            } else if (json?.resultado?.registros?.[0]) {
              valor = json.resultado.registros[0].valor ?? json.resultado.registros[0].Valor ?? 0
            } else if (json?.registros?.[0]) {
              valor = json.registros[0].valor ?? json.registros[0].Valor ?? 0
            } else if (json?.resultado?.valor !== undefined) {
              valor = json.resultado.valor ?? json.resultado.Valor ?? 0
            } else if (json?.valor !== undefined) {
              valor = json.valor ?? json.Valor ?? 0
            }
            
            const historico = [...m.dados.slice(-6), valor]
            const anterior = m.dados[m.dados.length - 1] ?? valor
            const variacao = anterior !== 0 ? ((valor - anterior) / anterior) * 100 : 0
            
            return { ...m, valor, dados: historico, variacao }
          } catch (err) {
            console.error(`Erro ao buscar valor para ${m.simbolo}:`, err)
            return m
          }
        })
      )
      if (ativo) setMoedas(atualizadas)
    }

    inicializarMoedas()
    
    const id = setInterval(() => obterValores(), 30000)
    
    return () => {
      ativo = false
      clearInterval(id)
    }
  }, [])

  return moedas
}
