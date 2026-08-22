import { useCallback, useEffect, useRef, useState } from 'react'
import { apiRequest, DocumentoLegalEndpoint } from '../utils/apiClient'

/**
 * Carrega a versão vigente de um documento legal e, sob demanda, o histórico de
 * versões.
 *
 * O texto vem da API e não do bundle: era JSX duplicado entre o modal de aceite
 * e as páginas /termos e /privacidade, e nesse formato publicar uma redação nova
 * era um deploy que não deixava registro de que algo mudou.
 *
 * @param {'PRIVACIDADE'|'TERMOS'|null} tipo
 */
export default function useDocumentoLegal(tipo) {
  const [documento, setDocumento] = useState(null)
  const [versoes, setVersoes] = useState([])
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  const montadoRef = useRef(true)

  useEffect(() => {
    montadoRef.current = true
    return () => {
      montadoRef.current = false
    }
  }, [])

  const carregar = useCallback(async () => {
    if (!tipo) {
      setDocumento(null)
      return
    }

    setCarregando(true)
    setErro('')
    try {
      const json = await apiRequest(DocumentoLegalEndpoint.VIGENTE(tipo))
      if (montadoRef.current) setDocumento(json?.resultado || null)
    } catch (err) {
      console.error('Erro ao carregar documento legal:', err)
      if (montadoRef.current) {
        setErro(err?.hasBackendMessage ? err.message : 'documentos.erroCarregar')
        setDocumento(null)
      }
    } finally {
      if (montadoRef.current) setCarregando(false)
    }
  }, [tipo])

  useEffect(() => {
    carregar()
  }, [carregar])

  /**
   * Busca os metadados de todas as versões. Separado do carregamento inicial
   * porque o histórico só interessa a quem abre a página do documento e clica
   * para vê-lo — quem está aceitando quer ler o texto, não a lista de revisões.
   */
  const carregarVersoes = useCallback(async () => {
    if (!tipo) return
    try {
      const json = await apiRequest(DocumentoLegalEndpoint.VERSOES(tipo))
      if (montadoRef.current) setVersoes(json?.resultado || [])
    } catch (err) {
      console.error('Erro ao listar versões do documento legal:', err)
    }
  }, [tipo])

  /** Lê uma versão específica, inclusive já encerrada. */
  const obterVersao = useCallback(async (idDocumentoLegal) => {
    const json = await apiRequest(DocumentoLegalEndpoint.VERSAO(idDocumentoLegal))
    return json?.resultado || null
  }, [])

  return { documento, versoes, carregando, erro, carregar, carregarVersoes, obterVersao }
}
