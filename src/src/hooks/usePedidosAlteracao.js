import { useCallback, useEffect, useState } from 'react'
import { apiRequest, HttpMethod, PedidoAlteracaoEndpoint } from '../utils/apiClient'

// Os pedidos de alteração da Equipe Pregão e a decisão do administrador. A
// lista vem inteira (são dezenas de pedidos) e a tela filtra por status. O
// Pregão consolida três vezes por dia: sem polling — quem quer o que chegou
// depois recarrega.

export default function usePedidosAlteracao() {
  // pedidos: undefined = ainda não carregou; [] = carregou e não há nenhum.
  const [pedidos, setPedidos] = useState(undefined)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState(null)
  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    let cancelado = false
    const buscar = async () => {
      setCarregando(true)
      try {
        const resp = await apiRequest(PedidoAlteracaoEndpoint.LIST())
        if (cancelado) return
        setPedidos(Array.isArray(resp?.resultado) ? resp.resultado : [])
        setErro(null)
      } catch (e) {
        // A lista que já estava na tela fica: o erro aparece em cima dela.
        if (!cancelado) setErro(e instanceof Error ? e : new Error(String(e ?? '')))
      } finally {
        if (!cancelado) setCarregando(false)
      }
    }
    buscar()
    return () => { cancelado = true }
  }, [recarga])

  const recarregar = useCallback(() => setRecarga((n) => n + 1), [])

  /**
   * Aprova ou descarta um pedido. O erro da API (400 com a mensagem da regra)
   * sobe para quem chamou, que o mostra junto do pedido. Com sucesso, o pedido
   * muda de status na hora — sai da fila "esperando decisão" sem esperar a
   * rede — e a lista é buscada de novo para confirmar.
   */
  const decidir = useCallback(async (idPedidoAlteracao, decisao, motivo) => {
    await apiRequest(PedidoAlteracaoEndpoint.DECISAO(idPedidoAlteracao), {
      method: HttpMethod.POST,
      body: motivo ? { decisao, motivo } : { decisao },
    })
    setPedidos((atual) => (Array.isArray(atual)
      ? atual.map((p) => (p.idPedidoAlteracao === idPedidoAlteracao
        ? { ...p, status: decisao, motivoDecisao: motivo || null }
        : p))
      : atual))
    setRecarga((n) => n + 1)
  }, [])

  return { pedidos, carregando, erro, recarregar, decidir }
}
