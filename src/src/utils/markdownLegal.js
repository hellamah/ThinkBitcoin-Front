/**
 * Leitor do subconjunto de Markdown usado nos documentos legais.
 *
 * Por que um parser próprio e não uma biblioteca: o texto vem do banco e é
 * renderizado como HTML numa página pública. Toda biblioteca de Markdown
 * conhecida resolve isso entregando uma string de HTML, o que obrigaria a usar
 * `dangerouslySetInnerHTML` e a confiar na sanitização dela. Aqui o parser
 * devolve uma estrutura de dados, e o componente monta elementos React — não
 * existe caminho por onde marcação do conteúdo vire marcação da página.
 *
 * O subconjunto é o que os documentos usam, e nada além: título de seção,
 * parágrafo, lista, destaque e negrito. Uma sintaxe não reconhecida vira texto
 * literal em vez de sumir da tela.
 */

const TITULO = /^#{1,6}\s+(.*)$/
const ITEM_LISTA = /^[-*]\s+(.*)$/
const CITACAO = /^>\s?(.*)$/

/** Quebra o texto em trechos, marcando os que estão entre asteriscos duplos. */
export const parseInline = (texto) => {
  if (typeof texto !== 'string' || texto === '') return []

  const partes = []
  // Split com grupo de captura: os índices ímpares são o conteúdo em negrito.
  const fatias = texto.split(/\*\*(.+?)\*\*/g)

  fatias.forEach((fatia, indice) => {
    if (fatia === '') return
    partes.push({ texto: fatia, negrito: indice % 2 === 1 })
  })

  return partes
}

const bloco = (tipo, extra) => ({ tipo, ...extra })

/**
 * Converte o Markdown do documento numa lista de blocos.
 *
 * @param {string} markdown
 * @returns {Array<{tipo: string, nivel?: number, texto?: string, itens?: string[], linhas?: string[]}>}
 */
export const parseDocumentoMarkdown = (markdown) => {
  if (typeof markdown !== 'string' || markdown.trim() === '') return []

  const linhas = markdown.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  const blocos = []

  let paragrafo = []
  let itens = []
  let citacao = []

  const fecharParagrafo = () => {
    if (paragrafo.length === 0) return
    blocos.push(bloco('paragrafo', { texto: paragrafo.join(' ').trim() }))
    paragrafo = []
  }

  const fecharLista = () => {
    if (itens.length === 0) return
    blocos.push(bloco('lista', { itens: [...itens] }))
    itens = []
  }

  const fecharCitacao = () => {
    if (citacao.length === 0) return
    // Linhas vazias dentro do destaque separam parágrafos dele; o componente
    // recebe as linhas já limpas e decide o espaçamento.
    blocos.push(bloco('destaque', { linhas: citacao.filter((l) => l.trim() !== '') }))
    citacao = []
  }

  const fecharTudo = () => {
    fecharParagrafo()
    fecharLista()
    fecharCitacao()
  }

  for (const linhaBruta of linhas) {
    const linha = linhaBruta.trimEnd()

    if (linha.trim() === '') {
      // Linha em branco dentro de uma citação continua sendo dela: é o que
      // separa o título do destaque do corpo dele.
      if (citacao.length > 0) {
        citacao.push('')
        continue
      }
      fecharTudo()
      continue
    }

    const tituloEncontrado = linha.match(TITULO)
    if (tituloEncontrado) {
      fecharTudo()
      const nivel = linha.match(/^#+/)[0].length
      blocos.push(bloco('titulo', { nivel, texto: tituloEncontrado[1].trim() }))
      continue
    }

    const citacaoEncontrada = linha.match(CITACAO)
    if (citacaoEncontrada) {
      fecharParagrafo()
      fecharLista()
      citacao.push(citacaoEncontrada[1])
      continue
    }

    const itemEncontrado = linha.match(ITEM_LISTA)
    if (itemEncontrado) {
      fecharParagrafo()
      fecharCitacao()
      itens.push(itemEncontrado[1].trim())
      continue
    }

    fecharLista()
    fecharCitacao()
    paragrafo.push(linha.trim())
  }

  fecharTudo()

  return blocos
}
