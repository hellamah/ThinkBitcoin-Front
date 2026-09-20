import { useEffect, useRef } from 'react'

// Seletor do que o navegador considera tabulável. `[tabindex="-1"]` fica de
// fora de propósito: é focável por código (o próprio contêiner do diálogo usa
// isso) mas não por Tab, e incluí-lo faria o ciclo parar num nó que o usuário
// não alcança sozinho.
const FOCAVEIS = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

// Elemento renderizado mas invisível (aba oculta, `display:none` num passo da
// animação) continua batendo no seletor acima e viraria uma parada morta no
// ciclo do Tab. `offsetParent` resolve os dois casos de uma vez; `position:
// fixed` é a exceção conhecida da propriedade, daí o segundo teste.
const estaVisivel = (el) =>
  el.offsetParent !== null || getComputedStyle(el).position === 'fixed'

const focaveisDe = (raiz) =>
  raiz ? Array.from(raiz.querySelectorAll(FOCAVEIS)).filter(estaVisivel) : []

// Camadas flutuantes do MUI. Elas montam o próprio nó direto no body — fora
// do nó do diálogo — e é para lá que o MUI manda o foco ao abrir um menu, um
// seletor ou um autocomplete DE DENTRO do diálogo.
//
// O mesmo detalhe que o `useFecharComEsc` abaixo já documenta: para o trap,
// esse foco parece ter escapado para a página coberta, e puxá-lo de volta
// tira o foco do menu que a pessoa acabou de abrir. O seletor de moeda do
// modal de alertas é exatamente esse caso.
const CAMADAS_FLUTUANTES = '.MuiPopover-root, .MuiPopper-root, .MuiMenu-root, .MuiAutocomplete-popper, .MuiDialog-root'

const estaEmCamadaFlutuante = (el) =>
  typeof el?.closest === 'function' && el.closest(CAMADAS_FLUTUANTES) !== null

// Quantos diálogos estão abertos agora. Sem esta conta, fechar um diálogo
// aberto por cima de outro devolvia o scroll à página enquanto o de baixo
// ainda cobria a tela.
let dialogosAbertos = 0

// O overflow de antes do PRIMEIRO diálogo, e não o de cada um. Quando cada
// diálogo guardava o seu, o segundo a abrir capturava o `hidden` que o
// primeiro tinha acabado de aplicar e o restaurava ao fechar — bastava
// fecharem fora de ordem para a página inteira ficar sem rolagem até um
// reload, sem nenhum diálogo aberto.
let overflowAntesDosDialogos = ''

/**
 * Prende o foco do teclado dentro de um diálogo enquanto ele está aberto e o
 * devolve, ao fechar, para o elemento que o abriu.
 *
 * Sem isto, `role="dialog"` e `aria-modal` são só uma promessa: eles dizem ao
 * leitor de tela que o resto da página está inerte, mas o Tab do navegador não
 * lê atributo nenhum e continua percorrendo a página coberta. Medido antes
 * desta mudança, com o modal de alertas aberto: o foco permanecia no botão que
 * o abriu e os seis Tabs seguintes caíam todos fora do diálogo, com 104
 * elementos ainda alcançáveis atrás dele.
 *
 * Devolve a ref que deve ir no nó do diálogo. Esse nó precisa de
 * `tabIndex={-1}`: o foco inicial vai nele, e não no primeiro botão, para o
 * leitor de tela anunciar o diálogo inteiro antes de qualquer controle — com o
 * foco no "fechar", é a única coisa que a pessoa ouve ao abrir.
 */
export function useDialogoAcessivel(ativo) {
  const refDialogo = useRef(null)

  useEffect(() => {
    if (!ativo) return undefined

    const no = refDialogo.current
    if (!no) return undefined

    // Quem tinha o foco antes de abrir. É para cá que ele volta no fim — sem
    // isso, fechar o diálogo joga o foco no <body> e quem navega por teclado
    // recomeça do topo da página.
    const anterior = document.activeElement

    no.focus()

    const aoTabular = (e) => {
      if (e.key !== 'Tab') return

      // A lista é recalculada a cada Tab, não no mount: o conteúdo do diálogo
      // muda enquanto ele está aberto (campos que aparecem conforme a escolha,
      // botão de salvar que só existe com o formulário válido), e uma lista
      // congelada mandaria o foco para um nó que já saiu do DOM.
      const alvos = focaveisDe(no)
      if (alvos.length === 0) {
        // Diálogo sem nenhum controle: manter o foco no contêiner é melhor que
        // deixá-lo escapar para a página atrás.
        e.preventDefault()
        no.focus()
        return
      }

      const primeiro = alvos[0]
      const ultimo = alvos[alvos.length - 1]
      const atual = document.activeElement

      // Menu, seletor ou autocomplete aberto de dentro do diálogo: o foco
      // está legitimamente fora do nó, e quem cuida do ciclo ali é o MUI.
      if (!no.contains(atual) && estaEmCamadaFlutuante(atual)) return

      // O contêiner tem tabIndex -1 e não está em `alvos`, então logo depois de
      // abrir o foco está nele: o primeiro Tab não casaria com nenhuma das duas
      // bordas e escaparia. Por isso o `!no.contains(atual)` e o caso do
      // próprio contêiner entram aqui.
      if (e.shiftKey) {
        if (atual === primeiro || atual === no || !no.contains(atual)) {
          e.preventDefault()
          ultimo.focus()
        }
        return
      }

      if (atual === ultimo || atual === no || !no.contains(atual)) {
        e.preventDefault()
        primeiro.focus()
      }
    }

    // Em captura: o ciclo precisa ser decidido antes que qualquer componente de
    // dentro trate o Tab por conta própria.
    document.addEventListener('keydown', aoTabular, true)

    // A página atrás não deve rolar sob o diálogo. É comportamento de diálogo
    // modal, e sem ele a roda do mouse sobre o scrim move o conteúdo coberto.
    if (dialogosAbertos === 0) overflowAntesDosDialogos = document.body.style.overflow
    dialogosAbertos += 1
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', aoTabular, true)

      dialogosAbertos = Math.max(0, dialogosAbertos - 1)
      if (dialogosAbertos === 0) document.body.style.overflow = overflowAntesDosDialogos

      // Só devolve o foco se o elemento ainda existe e ainda é focável. Depois
      // de excluir a conta ou migrar de plano, o botão que abriu o diálogo
      // costuma ter sumido junto — insistir nele lançaria, e o foco ficaria no
      // <body> de qualquer jeito.
      if (anterior && document.contains(anterior) && typeof anterior.focus === 'function') {
        anterior.focus()
      }
    }
  }, [ativo])

  return refDialogo
}

/**
 * Esc fecha o diálogo.
 *
 * O listener fica no `document` e na fase de bolha de propósito: popups do MUI
 * abertos DENTRO do diálogo (o menu do seletor de moeda, por exemplo) montam o
 * próprio nó direto no body e chamam `stopPropagation()` no Escape antes que
 * ele suba até aqui. Com isso o Esc fecha primeiro o menu e só depois o
 * diálogo, que é a ordem que o usuário espera. Em captura, ou preso ao nó do
 * diálogo, os dois fechariam de uma vez.
 */
export function useFecharComEsc(ativo, aoFechar) {
  useEffect(() => {
    if (!ativo || !aoFechar) return undefined
    const aoTeclar = (e) => {
      if (e.key === 'Escape') aoFechar()
    }
    document.addEventListener('keydown', aoTeclar)
    return () => document.removeEventListener('keydown', aoTeclar)
  }, [ativo, aoFechar])
}
