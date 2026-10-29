import { useEffect, useRef, useState } from 'react'
import { apiRequest, TreinamentoEpisodioEndpoint } from '../utils/apiClient'

// Resumo por moeda desde o início do treino, para a coluna "desde o início" da
// aba de análise — o único lugar que o usa.
//
// Era carregado com os episódios, em toda troca de filtro e a cada minuto de
// polling, em qualquer aba: além da coluna, dava a lista de moedas do filtro,
// que agora vem dos filtros. A API monta o resumo lendo todos os episódios da
// versão, então ele só é pedido com a análise aberta, uma vez por versão; o
// botão de atualizar pede de novo. Sem polling: o início não muda, e o "atual"
// da coluna vem dos episódios carregados.

const SEM_RESUMO = []

const listaDoResumo = (resp) =>
  Array.isArray(resp?.resultado) ? resp.resultado : (Array.isArray(resp) ? resp : SEM_RESUMO)

/**
 * @param {object} opcoes
 * @param {string|null} opcoes.versao filtro de versão do modelo
 * @param {boolean} opcoes.ativo      a aba de análise está aberta
 * @param {number} opcoes.recarga     muda quando a pessoa pede para atualizar
 */
export default function useResumoTreino({ versao, ativo, recarga }) {
  const chave = versao ?? ''
  // O resumo guarda a versão a que pertence: trocada a versão, o da anterior
  // não aparece nem por um render.
  const [estado, setEstado] = useState({ chave: null, lista: SEM_RESUMO })
  // O pedido que já chegou: voltar para a aba não refaz a busca.
  const respondidoRef = useRef(null)

  useEffect(() => {
    if (!ativo) return undefined
    const pedido = `${chave}|${recarga}`
    if (respondidoRef.current === pedido) return undefined
    let cancelado = false
    apiRequest(TreinamentoEpisodioEndpoint.RESUMO({ versaoModelo: versao || undefined }), { emSegundoPlano: true })
      .then((resp) => {
        if (cancelado) return
        respondidoRef.current = pedido
        setEstado({ chave, lista: listaDoResumo(resp) })
      })
      // Sem o resumo a coluna mostra "–"; a próxima abertura da aba tenta de novo.
      .catch(() => {})
    return () => { cancelado = true }
  }, [chave, versao, ativo, recarga])

  return estado.chave === chave ? estado.lista : SEM_RESUMO
}
