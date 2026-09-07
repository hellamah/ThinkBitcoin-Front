import { useState, useEffect, useCallback, useRef } from 'react'
import { apiRequest, AlertaPrecoEndpoint, HttpMethod } from '../utils/apiClient'
import { podeUsarAlertas } from '../utils/alertaPreco'

/**
 * Carrega e mantém a lista de alertas de preço do usuário.
 *
 * Só busca quando o usuário tem plano que dá acesso: para os demais a API
 * responde 403, e o apiClient traduz 403 em `subscription-required`, que o
 * Layout usa para abrir o convite de assinatura. Buscar mesmo assim faria o
 * convite saltar sozinho a cada carga do dashboard, sem ninguém ter clicado.
 */
export default function useAlertasPreco(user) {
  const [alertas, setAlertas] = useState([])
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  const temAcesso = podeUsarAlertas(user)
  const montadoRef = useRef(true)

  useEffect(() => {
    montadoRef.current = true
    return () => {
      montadoRef.current = false
    }
  }, [])

  const carregar = useCallback(async () => {
    if (!temAcesso) {
      setAlertas([])
      return
    }

    setCarregando(true)
    setErro('')
    try {
      const json = await apiRequest(AlertaPrecoEndpoint.LIST)
      if (montadoRef.current) setAlertas(json?.resultado || [])
    } catch (err) {
      console.error('Erro ao listar alertas de preço:', err)
      if (montadoRef.current) {
        setErro(err?.hasBackendMessage ? err.message : 'alertas.erroCarregar')
      }
    } finally {
      if (montadoRef.current) setCarregando(false)
    }
  }, [temAcesso])

  useEffect(() => {
    carregar()
  }, [carregar])

  /**
   * Cria o alerta e recarrega a lista.
   *
   * Recarrega em vez de anexar o que foi enviado: a direção e o valor de
   * referência são decididos no servidor, contra o último candle. Montar o item
   * aqui exibiria um palpite que pode divergir do que ficou gravado.
   */
  const criar = useCallback(
    async ({ siglaMoeda, valorAlvo }) => {
      await apiRequest(AlertaPrecoEndpoint.CREATE, {
        method: HttpMethod.POST,
        body: { siglaMoeda, valorAlvo: Number(valorAlvo) },
      })
      await carregar()
    },
    [carregar]
  )

  const excluir = useCallback(
    async (id) => {
      await apiRequest(AlertaPrecoEndpoint.DELETE(id), { method: HttpMethod.DELETE })
      await carregar()
    },
    [carregar]
  )

  return { alertas, carregando, erro, temAcesso, criar, excluir }
}
