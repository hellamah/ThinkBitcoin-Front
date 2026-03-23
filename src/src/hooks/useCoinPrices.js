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
        const lista = (json.resultado || []).map((m) => ({
          simbolo: m.sigla,
          nome: m.nome,
          valor: 0,
          dados: [],
          variacao: 0,
        }))
        if (ativo) {
          setMoedas(lista)
          // Após inicializar a lista, busca os valores pela primeira vez
          obterValores(lista)
        }
      } catch (err) {
        console.error('Erro ao listar moedas:', err)
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
            
            // O backend agora retorna ObterValorMoedaHistoricoRespostaDTO com registros
            const registros = json?.resultado?.registros || json?.resultado?.Registros
            const valor = registros?.[0]?.valor ?? 0
            
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
