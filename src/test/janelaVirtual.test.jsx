// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import useJanelaVirtual, { LIMIAR_DE_VIRTUALIZACAO } from '../src/hooks/useJanelaVirtual'

// A virtualização é invisível quando funciona e muito visível quando falha:
// linha que não aparece, barra de rolagem do tamanho errado, lista que desliza
// conforme se rola. O que estes testes travam é a aritmética que sustenta as
// três coisas.
//
// jsdom não calcula layout — `clientHeight` é 0 e `getBoundingClientRect`
// devolve zeros — então as duas medidas que o hook tira do DOM são fornecidas
// aqui. É o mesmo que o navegador entregaria, só que explícito.

const ALTURA_LINHA = 60
const ALTURA_VISIVEL = 600

const instalarMedidas = () => {
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get() {
      return this.dataset.papel === 'rolagem' ? ALTURA_VISIVEL : 0
    },
  })
  HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
    const altura = this.dataset.papel === 'linha' ? ALTURA_LINHA : 0
    return { height: altura, width: 0, top: 0, left: 0, right: 0, bottom: altura, x: 0, y: 0 }
  }
}

const Lista = ({ total, ativo = true }) => {
  const janela = useJanelaVirtual({ total, ativo, alturaInicial: ALTURA_LINHA })
  const visiveis = Array.from({ length: janela.fim - janela.inicio }, (_, i) => janela.inicio + i)

  return (
    <div data-papel="rolagem" data-testid="rolagem" onScroll={janela.aoRolar} ref={janela.refRolagem}>
      <div data-testid="acima" style={{ height: janela.alturaAcima }} />
      {visiveis.map((indice, i) => (
        <div
          key={indice}
          data-papel="linha"
          data-testid="linha"
          data-indice={indice}
          ref={i === 0 ? janela.refLinha : undefined}
        >
          item {indice}
        </div>
      ))}
      <div data-testid="abaixo" style={{ height: janela.alturaAbaixo }} />
    </div>
  )
}

const indicesRenderizados = () =>
  screen.queryAllByTestId('linha').map((no) => Number(no.dataset.indice))

const alturaDe = (testid) => {
  const valor = screen.getByTestId(testid).style.height
  return valor ? Number.parseFloat(valor) : 0
}

const rolarPara = (scrollTop) => {
  const no = screen.getByTestId('rolagem')
  // O evento carrega o alvo; o hook lê `currentTarget.scrollTop`, que é o que
  // o navegador entrega numa rolagem de verdade.
  Object.defineProperty(no, 'scrollTop', { configurable: true, value: scrollTop })
  act(() => {
    no.dispatchEvent(new Event('scroll', { bubbles: false }))
  })
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('useJanelaVirtual', () => {
  it('renderiza só uma fatia de uma lista longa', () => {
    instalarMedidas()
    render(<Lista total={744} />)

    const indices = indicesRenderizados()
    expect(indices.length).toBeLessThan(50)
    expect(indices[0]).toBe(0)
  })

  it('a lista inteira continua alcançável: os espaçadores somam a altura que falta', () => {
    instalarMedidas()
    render(<Lista total={744} />)

    const renderizadas = indicesRenderizados().length
    const alturaTotal = alturaDe('acima') + renderizadas * ALTURA_LINHA + alturaDe('abaixo')

    // É isto que mantém a barra de rolagem proporcional à lista toda: sem os
    // espaçadores ela teria o tamanho da fatia, e rolar chegaria ao fim em um
    // palmo.
    expect(alturaTotal).toBe(744 * ALTURA_LINHA)
  })

  it('a fatia acompanha a rolagem', () => {
    instalarMedidas()
    render(<Lista total={744} />)

    expect(indicesRenderizados()[0]).toBe(0)

    rolarPara(300 * ALTURA_LINHA)

    const indices = indicesRenderizados()
    expect(indices[0]).toBeGreaterThan(280)
    expect(indices[0]).toBeLessThanOrEqual(300)
    expect(indices).toContain(300)
  })

  it('o espaçador de cima acompanha a fatia, para as linhas caírem na posição certa', () => {
    instalarMedidas()
    render(<Lista total={744} />)

    rolarPara(300 * ALTURA_LINHA)

    // O deslocamento do topo tem de ser exatamente o número de linhas puladas
    // vezes a altura de cada uma. Errar aqui faz a lista "deslizar" conforme
    // se rola, que é o defeito clássico deste tipo de código.
    expect(alturaDe('acima')).toBe(indicesRenderizados()[0] * ALTURA_LINHA)
  })

  it('no fim da lista não sobra espaçador embaixo nem índice além do total', () => {
    instalarMedidas()
    render(<Lista total={744} />)

    rolarPara(744 * ALTURA_LINHA)

    const indices = indicesRenderizados()
    expect(Math.max(...indices)).toBe(743)
    expect(alturaDe('abaixo')).toBe(0)
  })

  it('lista curta não é virtualizada: tudo vai para o DOM', () => {
    instalarMedidas()
    render(<Lista total={30} ativo={false} />)

    expect(indicesRenderizados()).toHaveLength(30)
    expect(alturaDe('acima')).toBe(0)
    expect(alturaDe('abaixo')).toBe(0)
  })

  it('o limiar é alto o bastante para o caso comum passar inteiro', () => {
    // Os presets curtos do painel (24h ≈ 24 candles, 7d ≈ 168) não deveriam
    // pagar o custo de complexidade da virtualização sem necessidade — mas 7d
    // já passa do limiar, e é aí que a conta começa a valer a pena.
    expect(LIMIAR_DE_VIRTUALIZACAO).toBeGreaterThan(24)
    expect(LIMIAR_DE_VIRTUALIZACAO).toBeLessThan(168)
  })
})
