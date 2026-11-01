import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiRequest, HttpMethod, PedidoAlteracaoEndpoint } from '../utils/apiClient'
import { AGUARDANDO_DECISAO, STATUS, STATUS_PUBLICOS } from '../utils/pedidoAlteracao'

// Os pedidos de alteração da Equipe Pregão. A lista vem inteira (são dezenas
// de pedidos) e a tela filtra por status. O Pregão consolida três vezes por
// dia: sem polling — quem quer o que chegou depois recarrega.

// A fila avisa o cabeçalho de quantos esperam decisão a cada lista que ela
// carrega ou muda (decidir, Atualizar): o número do menu do Pregão acompanha a
// tela sem uma segunda busca.
const EVENTO_ESPERANDO_DECISAO = 'pregao-esperando-decisao'

const contarEsperando = (pedidos) => pedidos.filter((p) => AGUARDANDO_DECISAO.includes(p.status)).length

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

  /**
   * Descarta vários pedidos, um por vez: é a mesma regra da decisão de um pedido,
   * e a falha num não desfaz os outros. Devolve os que falharam, [{ id, erro }].
   */
  const descartarVarios = useCallback(async (ids, motivo) => {
    const falhas = []
    for (const id of ids) {
      try {
        await apiRequest(PedidoAlteracaoEndpoint.DECISAO(id), {
          method: HttpMethod.POST,
          body: { decisao: STATUS.DESCARTADO, motivo },
        })
        setPedidos((atual) => (Array.isArray(atual)
          ? atual.map((p) => (p.idPedidoAlteracao === id ? { ...p, status: STATUS.DESCARTADO, motivoDecisao: motivo } : p))
          : atual))
      } catch (e) {
        falhas.push({ id, erro: e })
      }
    }
    recarregar()
    return falhas
  }, [setPedidos, recarregar])

  useEffect(() => {
    if (!Array.isArray(pedidos)) return
    window.dispatchEvent(new CustomEvent(EVENTO_ESPERANDO_DECISAO, { detail: contarEsperando(pedidos) }))
  }, [pedidos])

  return { pedidos, carregando, erro, recarregar, decidir, descartarVarios }
}

/**
 * Quantos pedidos esperam a decisão de um administrador, para o menu do Pregão
 * no cabeçalho. Busca uma vez ao entrar; depois, segue o que a fila avisa.
 * Nulo enquanto não sabe (ou sem `ativo`): o menu fica sem número.
 */
export function usePedidosEsperando(ativo) {
  const [esperando, setEsperando] = useState(null)

  useEffect(() => {
    if (!ativo) return undefined
    let cancelado = false
    // Em segundo plano: ninguém pediu nada, a barra do topo não acende.
    apiRequest(PedidoAlteracaoEndpoint.LIST(), { emSegundoPlano: true })
      .then((resp) => {
        if (!cancelado) setEsperando(contarEsperando(Array.isArray(resp?.resultado) ? resp.resultado : []))
      })
      // Sem o número o menu funciona igual; o erro aparece na própria fila.
      .catch(() => {})
    const aoMudar = (e) => setEsperando(e.detail)
    window.addEventListener(EVENTO_ESPERANDO_DECISAO, aoMudar)
    return () => {
      cancelado = true
      window.removeEventListener(EVENTO_ESPERANDO_DECISAO, aoMudar)
    }
  }, [ativo])

  return ativo ? esperando : null
}

/**
 * A lista da página aberta (/pregao): sem login, só leitura. Só os pedidos que
 * um administrador aprovou, com a linha do tempo até a correção.
 */
export function usePedidosPublicos() {
  const { pedidos, carregando, erro, recarregar } = useListaDePedidos(PedidoAlteracaoEndpoint.PUBLICO, true)
  // A API já devolve só os aprovados; este filtro é a segunda barreira. Em
  // 10/10/2026 a API ainda mostrava os abertos quando o Pregão publicou os
  // primeiros 18 pedidos, e eles foram a público sem revisão. Uma API antiga,
  // ou uma regra mudada por engano, não põe pedido sem revisão nesta página.
  const publicos = useMemo(() => pedidos?.filter((p) => STATUS_PUBLICOS.includes(p.status)), [pedidos])
  return { pedidos: publicos, carregando, erro, recarregar }
}
