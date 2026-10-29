import { useCallback, useEffect, useRef, useState } from 'react'
import { apiRequest, ConsentimentoEndpoint, HttpMethod } from '../utils/apiClient'

/**
 * Aviso de que a trilha mudou.
 *
 * O hook é usado por duas telas ao mesmo tempo — o painel de Configurações e o
 * Layout, que decide se abre o modal de re-consentimento —, e cada uma tem seu
 * próprio estado. Sem este aviso, revogar o consentimento em Configurações
 * deixava a sessão inteira seguir sem cobrança até a próxima navegação.
 */
const EVENTO_ALTERACAO = 'consentimento-alterado'

/**
 * Trilha de consentimento do usuário autenticado: o que falta aceitar e o
 * histórico completo do que já foi aceito ou revogado.
 *
 * Só busca com token. Sem usuário não há trilha — o banner de cookies de
 * visitante continua resolvido no localStorage, porque não existe titular a
 * quem associar o registro.
 *
 * @param {string|null} token
 */
export default function useConsentimento(token) {
  const [pendencias, setPendencias] = useState([])
  const [historico, setHistorico] = useState([])
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  const montadoRef = useRef(true)
  // Só quem exibe o histórico precisa recarregá-lo quando a trilha muda. O
  // Layout, que usa o hook apenas para decidir sobre o modal, não paga por uma
  // consulta que não vai renderizar.
  const historicoCarregadoRef = useRef(false)
  // Quem dispara o aviso também o escuta — dispatchEvent é síncrono. Sem esta
  // marca, a instância que gravou recarregaria duas vezes em paralelo.
  const ignorandoProprioEventoRef = useRef(false)

  useEffect(() => {
    montadoRef.current = true
    return () => {
      montadoRef.current = false
    }
  }, [])

  const carregarPendencias = useCallback(async () => {
    if (!token) {
      setPendencias([])
      return
    }

    try {
      const json = await apiRequest(ConsentimentoEndpoint.PENDENTES)
      if (montadoRef.current) setPendencias(json?.resultado || [])
    } catch (err) {
      // Falhar ao consultar pendências não pode bloquear a navegação: o modal
      // simplesmente não aparece nesta sessão, e a cobrança volta na próxima.
      console.error('Erro ao consultar pendências de consentimento:', err)
      if (montadoRef.current) setPendencias([])
    }
  }, [token])

  const carregarHistorico = useCallback(async () => {
    if (!token) {
      setHistorico([])
      return
    }

    historicoCarregadoRef.current = true
    setCarregando(true)
    setErro('')
    try {
      const json = await apiRequest(ConsentimentoEndpoint.MEUS)
      if (montadoRef.current) setHistorico(json?.resultado || [])
    } catch (err) {
      console.error('Erro ao carregar histórico de consentimento:', err)
      if (montadoRef.current) {
        setErro(err?.hasBackendMessage ? err.message : 'consentimento.erroCarregar')
      }
    } finally {
      if (montadoRef.current) setCarregando(false)
    }
  }, [token])

  useEffect(() => {
    carregarPendencias()
  }, [carregarPendencias])

  // Toda instância do hook reage à alteração feita por qualquer outra.
  useEffect(() => {
    if (typeof window === 'undefined') return

    const aoAlterar = () => {
      if (ignorandoProprioEventoRef.current) return
      carregarPendencias()
      if (historicoCarregadoRef.current) carregarHistorico()
    }
    window.addEventListener(EVENTO_ALTERACAO, aoAlterar)
    return () => window.removeEventListener(EVENTO_ALTERACAO, aoAlterar)
  }, [carregarPendencias, carregarHistorico])

  /**
   * Grava aceites e revogações.
   *
   * Recarrega em vez de ajustar o estado local: data, versão e origem de cada
   * registro são decididas no servidor, e montar o item aqui exibiria um palpite
   * que pode divergir do que ficou gravado.
   */
  const registrar = useCallback(
    async ({ itens, origem }) => {
      await apiRequest(ConsentimentoEndpoint.REGISTRAR, {
        method: HttpMethod.POST,
        body: { itens, origem },
      })

      // Avisa as outras instâncias; esta recarrega logo abaixo, com await, para
      // que quem chamou registrar() já encontre o estado atualizado.
      if (typeof window !== 'undefined') {
        ignorandoProprioEventoRef.current = true
        window.dispatchEvent(new CustomEvent(EVENTO_ALTERACAO))
        ignorandoProprioEventoRef.current = false
      }

      await carregarPendencias()
      if (historicoCarregadoRef.current) await carregarHistorico()
    },
    [carregarPendencias, carregarHistorico]
  )

  return {
    pendencias,
    historico,
    carregando,
    erro,
    setErro,
    carregarPendencias,
    carregarHistorico,
    registrar,
  }
}
