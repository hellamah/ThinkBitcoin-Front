import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// `prefers-reduced-motion` é uma preferência de acessibilidade do sistema
// operacional, e quem a liga costuma ter sensibilidade vestibular. O defeito
// aqui não aparece para quem desenvolve: só quem tem a preferência ligada vê
// o app ignorá-la, e não há erro no console dizendo isso.
//
// Antes, o bloco nomeava vinte e três classes à mão. Ele cobria o que existia
// no dia em que foi escrito, deixava toda `transition` de fora, e componente
// novo com animação nascia fora dele sem nada acusando. O que estes testes
// travam é a forma da regra — universal, com exceções nomeadas — e não uma
// lista que precise ser mantida.

const css = readFileSync(new URL('../src/App.css', import.meta.url), 'utf8')

/** Recorta o bloco @media contando as chaves, porque ele contém outros blocos. */
const blocoDeMovimentoReduzido = () => {
  const abre = css.indexOf('@media (prefers-reduced-motion: reduce)')
  if (abre === -1) return null

  let i = css.indexOf('{', abre)
  let profundidade = 1
  i += 1
  while (profundidade > 0 && i < css.length) {
    if (css[i] === '{') profundidade += 1
    if (css[i] === '}') profundidade -= 1
    i += 1
  }
  return css.slice(abre, i)
}

const bloco = blocoDeMovimentoReduzido()

/** O corpo (só as declarações) da n-ésima regra do bloco, sem comentários. */
const corpoDaRegra = (indice) => {
  const corpos = [...bloco.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/\{([^{}]*)\}/g)].map(
    ([, corpo]) => corpo
  )
  return corpos[indice] ?? ''
}

/**
 * Os seletores declarados dentro do bloco, na ordem.
 *
 * Os comentários saem primeiro: cada regra daqui vem precedida de um, e sem
 * removê-los o texto do comentário entra junto no seletor capturado.
 */
const seletoresDo = (trecho) =>
  // A âncora é lookbehind para não CONSUMIR a chave: a primeira regra do bloco
  // vem logo depois da abertura do próprio @media, e um match que engolisse
  // essa `{` deixaria a regra seguinte sem âncora — era assim que a regra
  // universal ficava de fora da lista.
  [...trecho.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/(?<=^|[{}])\s*([^{}]+?)\s*\{/g)]
    .map(([, seletor]) => seletor.trim())
    .filter((s) => s.length > 0 && !s.startsWith('@'))

describe('movimento reduzido', () => {
  it('o bloco existe', () => {
    expect(bloco, 'App.css sem @media (prefers-reduced-motion: reduce)').not.toBeNull()
  })

  it('a regra vale para todo elemento, e não para uma lista de classes', () => {
    const seletores = seletoresDo(bloco)
    // A primeira regra é a rede que pega tudo, inclusive o componente que
    // ainda não foi escrito. As seguintes são as exceções.
    expect(seletores[0]).toMatch(/^\*/)
    expect(seletores[0]).toContain('::before')
    expect(seletores[0]).toContain('::after')
  })

  it('desliga animação E transição na própria regra universal', () => {
    // As declarações precisam estar NESTA regra, e não em qualquer outra do
    // bloco: a regra de peso de id que vem depois usa `:not()`, que não casa
    // pseudo-elementos. Um `::before` que anima só é alcançado aqui.
    const corpo = corpoDaRegra(0)

    expect(corpo).toMatch(/animation-duration:\s*0\.01ms\s*!important/)
    expect(corpo).toMatch(/transition-duration:\s*0\.01ms\s*!important/)
    expect(corpo).toMatch(/animation-delay:\s*0s\s*!important/)
    expect(corpo).toMatch(/transition-delay:\s*0s\s*!important/)
  })

  it('usa 0.01ms, e não zero: é o que ainda dispara animationend e transitionend', () => {
    // Zerar de verdade deixaria pela metade o que depende desses eventos para
    // concluir.
    expect(bloco).not.toMatch(/animation-duration:\s*0s\s*!important/)
    expect(bloco).not.toMatch(/transition-duration:\s*0s\s*!important/)
  })

  it('laço infinito para de vez, em vez de correr uma iteração', () => {
    // `move-1` vai de translate(0,0) a translate(20%,15%) scale(1.1) e volta
    // por `animation-direction: alternate`. Terminar uma iteração deixaria a
    // mancha parada no destino, deslocada e maior do que o layout supõe.
    expect(bloco).toMatch(/\.blob[^{]*\{[^}]*animation:\s*none\s*!important/s)
  })

  it('os indicadores de carregamento continuam girando', () => {
    // Parados, pareceriam travados, e a pessoa fica sem saber se a tela ainda
    // está trabalhando. Giro constante no lugar não é o movimento que incomoda
    // quem pede movimento reduzido; tela congelada, sim.
    const excecao = bloco.match(/\.MuiCircularProgress-root[^{]*\{([^}]*)\}/)
    expect(excecao, 'sem exceção para o CircularProgress').not.toBeNull()
    expect(excecao[1]).toMatch(/animation-iteration-count:\s*infinite\s*!important/)
    // O valor acompanha o do MUI; se um dia divergir, o spinner muda de ritmo
    // só para quem tem a preferência ligada.
    expect(excecao[1]).toMatch(/animation-duration:\s*1\.4s\s*!important/)
  })

  it('vence as transições marcadas !important no próprio arquivo', () => {
    // Uma classe com !important pesa mais que o seletor universal com
    // !important. Sem uma regra de especificidade maior, essas seis continuavam
    // animando — medido no navegador: duas sobreviviam à regra universal.
    const marcadas = css.match(/transition:[^;]*!important/g) ?? []
    if (marcadas.length === 0) return

    const seletores = seletoresDo(bloco)
    const temPesoDeId = seletores.some((s) => /:not\(#/.test(s))
    expect(
      temPesoDeId,
      `${marcadas.length} transições usam !important e nada no bloco tem peso para vencê-las`
    ).toBe(true)
  })
})
