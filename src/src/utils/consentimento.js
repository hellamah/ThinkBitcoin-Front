/**
 * Vocabulário do consentimento LGPD, compartilhado entre o cadastro, o banner
 * de cookies, o modal de re-consentimento e a tela de Configurações.
 *
 * Os valores são os rótulos que a API entende. Ficam aqui em vez de escritos à
 * mão em cada tela porque um erro de digitação num deles não quebra nada de
 * imediato: o back recusa, a tela mostra "corpo inválido", e ninguém associa o
 * aceite que sumiu com a string errada.
 */

export const TipoConsentimento = Object.freeze({
  PRIVACIDADE: 'PRIVACIDADE',
  TERMOS: 'TERMOS',
  COOKIES: 'COOKIES_NAO_ESSENCIAIS',
})

export const OrigemConsentimento = Object.freeze({
  // CADASTRO não entra aqui: essa origem é carimbada pelo próprio fluxo de
  // criação de conta no servidor, e a API recusa o cliente que a declara.
  ATUALIZACAO_VERSAO: 'ATUALIZACAO_VERSAO',
  CONFIGURACOES: 'CONFIGURACOES',
  BANNER_COOKIES: 'BANNER_COOKIES',
})

export const MotivoPendencia = Object.freeze({
  NUNCA_ACEITO: 'NUNCA_ACEITO',
  REVOGADO: 'REVOGADO',
  VERSAO_NOVA: 'VERSAO_NOVA',
})

/** Documentos que o cadastro exige e que o modal de re-consentimento cobra. */
export const DOCUMENTOS_OBRIGATORIOS = Object.freeze([
  TipoConsentimento.PRIVACIDADE,
  TipoConsentimento.TERMOS,
])

/** Rótulo do tipo de documento nas rotas públicas (/termos, /privacidade). */
export const DocumentoSlug = Object.freeze({
  PRIVACIDADE: 'privacidade',
  TERMOS: 'termos',
})

const TIPO_POR_SLUG = Object.freeze({
  [DocumentoSlug.PRIVACIDADE]: TipoConsentimento.PRIVACIDADE,
  [DocumentoSlug.TERMOS]: TipoConsentimento.TERMOS,
})

export const tipoDoSlug = (slug) => TIPO_POR_SLUG[slug] ?? null

/**
 * Monta o corpo de aceite de um documento.
 *
 * A versão vai junto sempre: aceitar sem dizer o quê é o mesmo problema que
 * esta funcionalidade veio resolver, e a API recusa o aceite sem versão.
 */
export const montarAceite = (tipo, idDocumentoLegal) => ({
  tipo,
  idDocumentoLegal: idDocumentoLegal ?? null,
  concedido: true,
})

/**
 * Diz se os dois documentos obrigatórios foram aceitos e têm versão conhecida.
 *
 * Serve ao botão de cadastro: sem isso ele enviaria um aceite que o servidor vai
 * recusar, e o usuário veria a falha só depois de preencher o formulário todo.
 */
export const aceitesCompletos = (aceites) => {
  if (!Array.isArray(aceites)) return false

  return DOCUMENTOS_OBRIGATORIOS.every((tipo) =>
    aceites.some((a) => a?.tipo === tipo && a?.concedido === true && !!a?.idDocumentoLegal)
  )
}

/**
 * Último registro de cada tipo — o estado que vale hoje.
 *
 * O back já marca `atual` em cada item; esta função existe para o caso de a
 * lista chegar sem a marca (mock, resposta antiga) e para dar ao chamador um
 * mapa por tipo em vez de uma lista que ele teria que varrer.
 */
export const consentimentosAtuais = (historico) => {
  if (!Array.isArray(historico)) return {}

  const porTipo = {}
  for (const item of historico) {
    if (!item?.tipo) continue
    const atual = porTipo[item.tipo]
    if (!atual || new Date(item.dataRegistro) > new Date(atual.dataRegistro)) {
      porTipo[item.tipo] = item
    }
  }
  return porTipo
}

/** Se o tipo está concedido hoje. Ausência de registro conta como não. */
export const estaConcedido = (historico, tipo) =>
  consentimentosAtuais(historico)[tipo]?.concedido === true

/**
 * Se algum registro da trilha aponta para uma redação que mudou depois de
 * assinada. É a única situação em que a tela precisa avisar o usuário de que a
 * prova está comprometida.
 */
export const temIntegridadeComprometida = (historico) =>
  Array.isArray(historico) && historico.some((item) => item?.conteudoIntegro === false)
