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
    const linha = refLinha.current
    if (!linha) return
    const medida = linha.getBoundingClientRect().height
    // O arredondamento evita um loop de render por diferenças subpixel entre
    // uma medição e a seguinte.
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

  const inicio = Math.max(0, Math.floor(scrollTop / alturaLinha) - MARGEM)
  const fim = Math.min(total, inicio + cabemNaTela + MARGEM * 2)

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
