import { useCallback, useEffect, useState } from 'react'
import { apiRequest, HttpMethod, PedidoAlteracaoEndpoint } from '../utils/apiClient'

// Os pedidos de alteração da Equipe Pregão. A lista vem inteira (são dezenas
// de pedidos) e a tela filtra por status. O Pregão consolida três vezes por
// dia: sem polling — quem quer o que chegou depois recarrega.

// A busca comum às duas telas. `anonimo`: a chamada da página aberta, sem token
// e sem os efeitos de 401/403 na sessão (ver apiRequest).
function useListaDePedidos(endpoint, anonimo = false) {
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
        const resp = await apiRequest(endpoint, { anonimo })
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
  }, [endpoint, anonimo, recarga])

  const recarregar = useCallback(() => setRecarga((n) => n + 1), [])

  return { pedidos, setPedidos, carregando, erro, recarregar }
}

/** A fila do administrador (/pedidos-pregao), com a decisão. */
export default function usePedidosAlteracao() {
  const { pedidos, setPedidos, carregando, erro, recarregar } = useListaDePedidos(PedidoAlteracaoEndpoint.LIST())

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
    recarregar()
  }, [setPedidos, recarregar])

  return { pedidos, carregando, erro, recarregar, decidir }
}

/**
 * A lista da página aberta (/pregao): sem login, só leitura. Só os pedidos que
 * um administrador aprovou, com a linha do tempo até a correção.
 */
export function usePedidosPublicos() {
  const { pedidos, carregando, erro, recarregar } = useListaDePedidos(PedidoAlteracaoEndpoint.PUBLICO, true)
  return { pedidos, carregando, erro, recarregar }
}
