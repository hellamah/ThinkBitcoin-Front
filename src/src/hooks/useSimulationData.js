import { useState, useEffect, useMemo } from 'react'
import { apiRequest, MarketEndpoint } from '../utils/apiClient'
import { montarJanelaSimulacao } from '../utils/simulationWindow'

/**
 * Série própria da simulação de estratégias.
 *
 * Existe separada do `useDashboardData` por duas razões medidas, não supostas —
 * ambas documentadas em `utils/simulationWindow.js`: a janela do dashboard é
 * curta demais para a amostra fechar, e é a resposta paginada, que a tabela de
 * histórico troca por baixo de todos os painéis.
 *
 * A janela é fixa e independente dos filtros da tela. Isso é intencional: o
 * usuário ajusta período no dashboard para OLHAR o mercado, e ajusta parâmetros
 * na simulação para TESTAR uma regra. Amarrar as duas coisas faria o resultado
 * da estratégia mudar ao mexer no zoom do gráfico.
 *
 * @param {object} params
 * @param {string|null} params.token
 * @param {string|null} params.sigla - Moeda única; sem ela não há o que simular.
 * @returns {{
 *   registros: Array<object>|null, aPartirDe: string|null,
 *   carregando: boolean, erro: string
 * }}
 */
export default function useSimulationData({ token, sigla }) {
  const [registros, setRegistros] = useState(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  // A janela é recalculada só quando a moeda muda. Sem isto, cada render
  // produziria um `agora` novo, o efeito rodaria de novo e a busca entraria em
  // laço — 180 dias de candles a cada ciclo.
  const janela = useMemo(() => montarJanelaSimulacao(), [sigla])

  useEffect(() => {
    if (!token || !sigla) {
      setRegistros(null)
      return undefined
    }

    const controller = new AbortController()

    const carregar = async () => {
      setCarregando(true)
      setErro('')

      const params = new URLSearchParams({
        dataInicio: janela.dataInicio,
        dataFim: janela.dataFim,
        quantidade: String(janela.quantidade),
        ordemAsc: 'false',
      })

      try {
        const resposta = await apiRequest(
          `${MarketEndpoint.COIN_VALUE(sigla.toLowerCase())}?${params.toString()}`,
          { signal: controller.signal }
        )
        if (controller.signal.aborted) return

        const dados = resposta?.resultado ?? resposta
        setRegistros(dados?.registros ?? (Array.isArray(dados) ? dados : []))
      } catch (err) {
        if (err.name === 'AbortError') return
        // A simulação é complementar: falhar aqui esconde o painel, não quebra
        // o dashboard. Guardar a mensagem permite dizer POR QUE ele sumiu.
        console.error('Erro ao carregar a série da simulação:', err)
        setErro(err.message || 'Falha ao carregar a série da simulação')
        setRegistros(null)
      } finally {
        if (!controller.signal.aborted) setCarregando(false)
      }
    }

    carregar()

    return () => controller.abort()
  }, [token, sigla, janela])

  return {
    registros,
    aPartirDe: janela.aPartirDe,
    carregando,
    erro,
  }
}
