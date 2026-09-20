// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import Modal from '../src/components/Modal'

// O que estes testes travam é o que a tela promete e o navegador não cumpre
// sozinho: `role="dialog"` e `aria-modal` dizem ao leitor de tela que o resto
// da página está inerte, mas o Tab não lê atributo nenhum. Medido no app antes
// da correção, com o modal de alertas aberto: o foco continuava no botão que o
// abriu, os seis Tabs seguintes caíam todos fora do diálogo, e 104 elementos
// seguiam alcançáveis atrás dele.
//
// Sem provider de tradução, `t` devolve a própria chave.

// jsdom não calcula layout, então `offsetParent` é null para TUDO — inclusive
// para botões visíveis — e o filtro de visibilidade do hook descartaria o
// diálogo inteiro. Aqui ele passa a refletir a árvore, que é o que a
// propriedade significa num navegador de verdade para os casos que o filtro
// quer pegar (`display:none` e ancestral oculto).
const instalarOffsetParent = () => {
  Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
    configurable: true,
    get() {
      let no = this
      while (no) {
        if (no.style?.display === 'none') return null
        no = no.parentElement
      }
      return this.parentElement ? document.body : null
    },
  })
}

beforeEach(instalarOffsetParent)

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const abrir = (props = {}) =>
  render(
    <Modal visible onClose={() => {}} rotulo="Alertas de preço" {...props}>
      <button type="button">primeiro do conteúdo</button>
      <button type="button">último do conteúdo</button>
    </Modal>
  )

const dialogo = () => screen.getByRole('dialog')
const botao = (nome) => screen.getByRole('button', { name: nome })

describe('Modal — foco de teclado', () => {
  it('leva o foco para o diálogo ao abrir, e não o deixa no botão que o abriu', () => {
    const abridor = document.createElement('button')
    abridor.textContent = 'abrir alertas'
    document.body.appendChild(abridor)
    abridor.focus()
    expect(document.activeElement).toBe(abridor)

    abrir()

    expect(document.activeElement).toBe(dialogo())
  })

  it('o Tab no último elemento volta para o primeiro, em vez de sair para a página atrás', () => {
    abrir()

    const ultimo = botao('último do conteúdo')
    ultimo.focus()

    fireEvent.keyDown(ultimo, { key: 'Tab' })

    // O primeiro focável do diálogo é o ✕, que o próprio Modal renderiza.
    expect(document.activeElement).toBe(botao('close'))
  })

  it('o Shift+Tab no primeiro elemento vai para o último', () => {
    abrir()

    const fechar = botao('close')
    fechar.focus()

    fireEvent.keyDown(fechar, { key: 'Tab', shiftKey: true })

    expect(document.activeElement).toBe(botao('último do conteúdo'))
  })

  it('logo após abrir, o Tab entra no diálogo — o foco está no contêiner, que não é tabulável', () => {
    abrir()
    expect(document.activeElement).toBe(dialogo())

    fireEvent.keyDown(dialogo(), { key: 'Tab' })

    expect(document.activeElement).toBe(botao('close'))
  })

  it('devolve o foco ao elemento que abriu o diálogo quando ele fecha', () => {
    const abridor = document.createElement('button')
    document.body.appendChild(abridor)
    abridor.focus()

    const { rerender } = abrir()
    expect(document.activeElement).not.toBe(abridor)

    rerender(
      <Modal visible={false} onClose={() => {}} rotulo="Alertas de preço">
        <button type="button">primeiro do conteúdo</button>
      </Modal>
    )

    expect(document.activeElement).toBe(abridor)
  })

  it('não tenta devolver o foco a um elemento que saiu do DOM junto com a ação', () => {
    // Excluir a conta e migrar de plano removem o próprio botão que abriu o
    // diálogo. Insistir nele lançaria.
    const abridor = document.createElement('button')
    document.body.appendChild(abridor)
    abridor.focus()

    const { rerender } = abrir()
    abridor.remove()

    expect(() =>
      rerender(
        <Modal visible={false} onClose={() => {}} rotulo="Alertas de preço">
          <button type="button">primeiro do conteúdo</button>
        </Modal>
      )
    ).not.toThrow()
  })
})

describe('Modal — o que o leitor de tela anuncia', () => {
  it('usa o rótulo de quem chama como nome do diálogo', () => {
    abrir()
    expect(dialogo()).toHaveProperty('ariaLabel', 'Alertas de preço')
  })

  it('sem rótulo, ainda assim não fica sem nome', () => {
    abrir({ rotulo: undefined })
    expect(dialogo().getAttribute('aria-label')).toBe('dialogo.generico')
  })
})

describe('Modal — página atrás', () => {
  it('trava o scroll do corpo enquanto está aberto e o devolve ao fechar', () => {
    expect(document.body.style.overflow).toBe('')

    const { rerender } = abrir()
    expect(document.body.style.overflow).toBe('hidden')

    rerender(
      <Modal visible={false} onClose={() => {}} rotulo="Alertas de preço">
        <button type="button">primeiro do conteúdo</button>
      </Modal>
    )
    expect(document.body.style.overflow).toBe('')
  })

  it('dois diálogos fechados fora de ordem não deixam o corpo travado', () => {
    // Cada diálogo guardava o overflow no momento em que abria, então o
    // segundo capturava o `hidden` que o primeiro tinha acabado de aplicar.
    // Fechando fora de ordem, o último a sair restaurava `hidden` e a página
    // inteira ficava sem rolagem, sem nenhum diálogo aberto.
    const Cena = ({ a, b }) => (
      <>
        <Modal visible={a} onClose={() => {}} rotulo="de baixo">
          <button type="button">a</button>
        </Modal>
        <Modal visible={b} onClose={() => {}} rotulo="de cima">
          <button type="button">b</button>
        </Modal>
      </>
    )

    const { rerender } = render(<Cena a b={false} />)
    expect(document.body.style.overflow).toBe('hidden')

    rerender(<Cena a b />)
    rerender(<Cena a={false} b />)
    rerender(<Cena a={false} b={false} />)

    expect(document.body.style.overflow, 'corpo ficou travado').toBe('')
  })

  it('não rouba o foco de um menu do MUI aberto de dentro do diálogo', () => {
    // Menu, seletor e autocomplete do MUI montam o próprio nó direto no body,
    // fora do nó do diálogo, e o MUI manda o foco para lá. Para o trap isso
    // parecia foco escapando para a página coberta, e puxá-lo de volta tirava
    // o foco do menu que a pessoa tinha acabado de abrir. O seletor de moeda
    // do modal de alertas é exatamente esse caso.
    abrir()

    const camada = document.createElement('div')
    camada.className = 'MuiPopover-root'
    const opcao = document.createElement('button')
    opcao.textContent = 'BTC'
    camada.appendChild(opcao)
    document.body.appendChild(camada)
    opcao.focus()

    fireEvent.keyDown(opcao, { key: 'Tab' })

    expect(document.activeElement, 'o trap puxou o foco de volta').toBe(opcao)

    camada.remove()
  })

  it('Esc fecha', () => {
    const aoFechar = vi.fn()
    abrir({ onClose: aoFechar })

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(aoFechar).toHaveBeenCalledTimes(1)
  })
})
