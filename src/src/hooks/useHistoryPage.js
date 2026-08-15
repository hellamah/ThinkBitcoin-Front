// Página de candles da tabela de histórico.
//
// Existe separada do `useDashboardData` por um motivo de correção, não de
// organização: navegar na tabela NÃO pode trocar a série que os outros painéis
// analisam.
//
// Era o que acontecia. `pagina` era estado global, e a busca do dashboard
// dependia dele — clicar na página 2 do histórico refazia a requisição e
// substituía `historicosPorMoeda`, que alimenta os gráficos, o laboratório de
// sinais e a matriz de correlação. Três painéis mudavam de resposta porque o
// usuário navegou numa tabela ao lado, sem nenhuma relação aparente, e a
// `cobertura` — o aviso de "o período foi cortado" — era recalculada sobre a
// página nova.
//
// Ficava inerte nos presets (24h, 7d e 1m cabem numa página de 1000), então só
// aparecia com filtro de data customizado longo o bastante para paginar. Inerte
// não é corrigido: é um defeito esperando o usuário certo.
//
// A separação é a mesma que a simulação já faz desde a janela de 180 dias: quem
// ANALISA quer a janela inteira, sempre a mesma; quem NAVEGA quer uma página de
// cada vez. Eram dois trabalhos numa requisição só.

import { useState, useEffect } from 'react'
import { apiRequest, MarketEndpoint } from '../utils/apiClient'
import { useDashboard } from '../context/DashboardContext'

/**
 * Uma página do histórico da moeda selecionada.
 *
 * Só faz sentido no modo de moeda única — é a única condição em que o controle
 * de paginação aparece. Com várias moedas a tabela empilha as séries que os
 * painéis já carregaram, e não há o que paginar.
 *
 * @param {object} params
 * @param {string|null} params.token
 * @param {string|null} params.sigla - Moeda única; sem ela o hook não busca.
 * @param {string|null} params.dataInicio - Início do período escolhido (ISO).
 * @param {string|null} params.dataFim - Fim do período escolhido (ISO).
 * @param {number} params.pagina
 * @param {number} params.quantidade - Candles por página.
 * @returns {{
 *   registros: Array<object>, totalPaginas: number,
 *   carregando: boolean, erro: string
 * }}
 */
export default function useHistoryPage({
  token,
  sigla,
  dataInicio,
  dataFim,
  pagina,
  quantidade,
}) {
  // O botão de atualizar é global: ele existe para dizer "busque tudo de novo",
  // e a tabela ficar parada enquanto o resto atualiza seria a mesma classe de
  // incoerência que este hook nasceu para desfazer.
  const { refreshTrigger } = useDashboard()

  const [registros, setRegistros] = useState([])
  const [totalPaginas, setTotalPaginas] = useState(1)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (!token || !sigla) {
      setRegistros([])
      setTotalPaginas(1)
      return undefined
    }

    const controller = new AbortController()

    const carregar = async () => {
      setCarregando(true)
      setErro('')

      // Sem margem de aquecimento aqui, ao contrário da busca de análise: a
      // tabela EXIBE os candles, e o aquecimento é combustível de indicador que
      // o usuário não pediu para ver. Quem precisa dele são os painéis que
      // calculam Bollinger e RSI, não quem está lendo uma lista de preços.
      const url = MarketEndpoint.COIN_VALUE(sigla.toLowerCase(), {
        dataInicio: dataInicio || undefined,
        dataFim: dataFim || undefined,
        pagina,
        quantidade,
        ordemAsc: false,
      })

      try {
        const resposta = await apiRequest(url, { signal: controller.signal })
        if (controller.signal.aborted) return

        const dados = resposta?.resultado ?? resposta
        setRegistros(dados?.registros ?? (Array.isArray(dados) ? dados : []))
        setTotalPaginas(dados?.totalPaginas ?? 1)
      } catch (err) {
        if (err.name === 'AbortError') return
        console.error('Erro ao carregar a página do histórico:', err)
        setErro(err.message || 'Falha ao carregar o histórico')
        setRegistros([])
        setTotalPaginas(1)
      } finally {
        if (!controller.signal.aborted) setCarregando(false)
      }
    }

    carregar()

    return () => controller.abort()
  }, [token, sigla, dataInicio, dataFim, pagina, quantidade, refreshTrigger])

  return { registros, totalPaginas, carregando, erro }
}
