import { describe, expect, it } from 'vitest'
import { parseDocumentoMarkdown, parseInline } from '../src/utils/markdownLegal'

describe('parseInline', () => {
  it('separa os trechos entre asteriscos duplos', () => {
    expect(parseInline('A **ThinkBitcoin** é a controladora.')).toEqual([
      { texto: 'A ', negrito: false },
      { texto: 'ThinkBitcoin', negrito: true },
      { texto: ' é a controladora.', negrito: false },
    ])
  })

  it('aceita mais de um negrito na mesma linha', () => {
    const partes = parseInline('**um** e **dois**')
    expect(partes.filter((p) => p.negrito).map((p) => p.texto)).toEqual(['um', 'dois'])
  })

  // Marcação incompleta é erro de digitação no documento, não motivo para o
  // trecho sumir da página: quem lê precisa ver o texto de qualquer forma.
  it('mantém asteriscos sem par como texto literal', () => {
    expect(parseInline('valor **incompleto')).toEqual([{ texto: 'valor **incompleto', negrito: false }])
  })

  it('devolve lista vazia para entrada não textual', () => {
    expect(parseInline(null)).toEqual([])
    expect(parseInline('')).toEqual([])
  })
})

describe('parseDocumentoMarkdown', () => {
  it('reconhece título, parágrafo e lista', () => {
    const blocos = parseDocumentoMarkdown(
      ['## 2. Dados Coletados', '', 'Coletamos:', '', '- Nome', '- E-mail'].join('\n')
    )

    expect(blocos).toEqual([
      { tipo: 'titulo', nivel: 2, texto: '2. Dados Coletados' },
      { tipo: 'paragrafo', texto: 'Coletamos:' },
      { tipo: 'lista', itens: ['Nome', 'E-mail'] },
    ])
  })

  it('junta linhas seguidas num parágrafo só', () => {
    const blocos = parseDocumentoMarkdown('Primeira linha\nsegunda linha.')
    expect(blocos).toEqual([{ tipo: 'paragrafo', texto: 'Primeira linha segunda linha.' }])
  })

  it('agrupa a citação num bloco de destaque, preservando a ordem das linhas', () => {
    const blocos = parseDocumentoMarkdown(
      ['> ⚠ **Aviso Importante**', '>', '> Conteúdo meramente informativo.'].join('\n')
    )

    expect(blocos).toEqual([
      { tipo: 'destaque', linhas: ['⚠ **Aviso Importante**', 'Conteúdo meramente informativo.'] },
    ])
  })

  it('fecha o destaque ao encontrar o próximo título', () => {
    const blocos = parseDocumentoMarkdown(['> Aviso', '', '## 4. Uso Permitido'].join('\n'))

    expect(blocos.map((b) => b.tipo)).toEqual(['destaque', 'titulo'])
  })

  // O conteúdo vem do banco e pode ter sido gravado em qualquer sistema
  // operacional; CRLF não pode virar caractere solto no meio do texto.
  it('trata CRLF igual a LF', () => {
    const comCrlf = parseDocumentoMarkdown('## Título\r\n\r\nTexto.')
    const comLf = parseDocumentoMarkdown('## Título\n\nTexto.')
    expect(comCrlf).toEqual(comLf)
  })

  it('devolve lista vazia para conteúdo ausente', () => {
    expect(parseDocumentoMarkdown(null)).toEqual([])
    expect(parseDocumentoMarkdown('   ')).toEqual([])
  })

  it('aceita asterisco como marcador de lista', () => {
    expect(parseDocumentoMarkdown('* Item')).toEqual([{ tipo: 'lista', itens: ['Item'] }])
  })
})
