import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

// Acima de quantas linhas vale virtualizar. Abaixo disso o custo de renderizar
// tudo é irrelevante, e a lista completa no DOM é melhor: o Ctrl+F do
// navegador acha qualquer linha e o leitor de tela percorre a tabela inteira
// sem depender de scroll. A virtualização só entra quando o preço de não usá-la
// passa a ser alto.
//
// Medido na tabela de histórico com o filtro de 1 mês: 759 linhas, e reordenar
// por uma coluna gerava uma long task de ~480 ms — meia tela travada num
// desktop, e bem pior num celular. Com 32 linhas na tela o mesmo trabalho é
// ordens de grandeza menor.
export const LIMIAR_DE_VIRTUALIZACAO = 120

// Linhas extras renderizadas acima e abaixo da área visível. Sem margem, uma
// rolagem rápida mostra faixa em branco até o próximo render; com margem
// grande demais, volta-se a pagar o preço que se queria evitar.
const MARGEM = 8

/**
 * Renderiza só a fatia visível de uma lista longa, mantendo a barra de rolagem
 * do tamanho da lista inteira.
 *
 * A altura de linha é MEDIDA, não estimada: ela muda com o idioma, com o zoom
 * do navegador e com a fonte que o sistema entrega. Um valor fixo chutado no
 * código erra o cálculo do deslocamento e a lista "desliza" conforme se rola.
 *
 * @param {object} params
 * @param {number} params.total Quantidade de itens da lista completa.
 * @param {boolean} params.ativo Desliga a virtualização quando a lista é curta.
 * @param {number} params.alturaInicial Palpite usado só no primeiro render,
 *   antes de haver uma linha na tela para medir.
 */
export default function useJanelaVirtual({ total, ativo, alturaInicial = 48 }) {
  const refRolagem = useRef(null)
  const refLinha = useRef(null)

  const [alturaLinha, setAlturaLinha] = useState(alturaInicial)
  const [scrollTop, setScrollTop] = useState(0)
  const [alturaVisivel, setAlturaVisivel] = useState(0)

  // Mede a linha de verdade assim que existe uma na tela. `useLayoutEffect`
  // porque a correção precisa acontecer antes da pintura — medir depois faria
  // a lista saltar visivelmente no primeiro scroll.
  useLayoutEffect(() => {
    if (!ativo) return
    const primeira = refLinha.current
    if (!primeira) return

    // A MAIOR da fatia, não a primeira. Todo o cálculo de deslocamento assume
    // altura uniforme, e uma linha mais alta que a medida faria a lista
    // deslizar conforme se rola. Medir a maior erra para o lado seguro: no
    // pior caso sobra um fio de espaço entre as linhas, em vez de o conteúdo
    // sair do lugar. Hoje as linhas da tabela de histórico têm todas a mesma
    // altura (o selo de anomalia é mais baixo que a linha de texto), mas isso
    // depende de fonte, idioma e zoom, e não é algo que valha supor.
    const irmas = primeira.parentElement
      ? Array.from(primeira.parentElement.children).filter(
          (no) => !no.hasAttribute('aria-hidden')
        )
      : [primeira]

    const medida = irmas.reduce(
      (maior, no) => Math.max(maior, no.getBoundingClientRect().height),
      0
    )

    // O piso de meio pixel evita um laço de render por diferença subpixel
    // entre uma medição e a seguinte.
    if (medida > 0 && Math.abs(medida - alturaLinha) > 0.5) setAlturaLinha(medida)
  }, [ativo, alturaLinha, total])

  const aoRolar = useCallback((evento) => {
    setScrollTop(evento.currentTarget.scrollTop)
  }, [])

  // A altura do contêiner vem do CSS (uma fração da viewport), então ela muda
  // quando a janela muda de tamanho — e com ela a quantidade de linhas que
  // cabem na tela.
  useEffect(() => {
    if (!ativo) return undefined
    const no = refRolagem.current
    if (!no) return undefined

    const medir = () => setAlturaVisivel(no.clientHeight)
    medir()

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', medir)
      return () => window.removeEventListener('resize', medir)
    }

    const observador = new ResizeObserver(medir)
    observador.observe(no)
    return () => observador.disconnect()
  }, [ativo])

  // Quando a lista encolhe (trocar o filtro de 1 mês para 7 dias), o
  // `scrollTop` do contêiner continua onde estava — apontando para além do
  // novo fim. Sem esta correção a fatia calculada ficava vazia e a tabela
  // aparecia em branco, com a barra de rolagem de tamanho normal por causa do
  // espaçador: nenhuma pista do que tinha acontecido.
  useEffect(() => {
    if (!ativo) return
    const no = refRolagem.current
    if (!no) return

    const limite = Math.max(0, total * alturaLinha - no.clientHeight)
    if (no.scrollTop > limite) {
      no.scrollTop = limite
      // O estado precisa acompanhar: atribuir `scrollTop` por código nem
      // sempre emite o evento de scroll, e sem isto a fatia continuaria
      // calculada a partir da posição antiga.
      setScrollTop(limite)
    }
  }, [ativo, total, alturaLinha])

  if (!ativo) {
    return {
      refRolagem,
      refLinha,
      inicio: 0,
      fim: total,
      alturaAcima: 0,
      alturaAbaixo: 0,
      aoRolar: undefined,
    }
  }

  // Enquanto a altura do contêiner ainda não foi medida, renderiza um punhado
  // de linhas: o suficiente para haver o que medir, sem montar a lista inteira.
  const cabemNaTela = alturaVisivel > 0 ? Math.ceil(alturaVisivel / alturaLinha) : 20

  const quantasRenderizar = cabemNaTela + MARGEM * 2

  // O teto é a defesa que não depende de efeito nenhum ter rodado: mesmo com
  // o `scrollTop` momentaneamente além do fim — entre o render que encolhe a
  // lista e o efeito que corrige a rolagem — `inicio` nunca ultrapassa o que
  // o total comporta, e a fatia nunca sai vazia.
  const ultimoInicioPossivel = Math.max(0, total - quantasRenderizar)
  const inicio = Math.min(
    Math.max(0, Math.floor(scrollTop / alturaLinha) - MARGEM),
    ultimoInicioPossivel
  )
  const fim = Math.min(total, inicio + quantasRenderizar)

  return {
    refRolagem,
    refLinha,
    inicio,
    fim,
    // Os dois espaçadores somados com as linhas visíveis dão a altura da lista
    // completa. É isso que mantém a barra de rolagem do tamanho certo e o
    // scroll proporcional ao total, e não ao que está renderizado.
    alturaAcima: inicio * alturaLinha,
    alturaAbaixo: Math.max(0, (total - fim) * alturaLinha),
    aoRolar,
  }
}
