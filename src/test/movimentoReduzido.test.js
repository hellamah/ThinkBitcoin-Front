import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

// `prefers-reduced-motion` é uma preferência de acessibilidade do sistema
// operacional, e quem a liga costuma ter sensibilidade vestibular. O defeito
// aqui não aparece para quem desenvolve: só quem tem a preferência ligada vê o
// app ignorá-la, e não há erro no console dizendo isso.
//
// Antes, o bloco nomeava vinte e três classes à mão. Ele cobria o que existia
// no dia em que foi escrito, deixava toda `transition` de fora, e componente
// novo com animação nascia fora dele sem nada acusando. O que estes testes
// travam é a forma da regra — universal, com exceções nomeadas — e não uma
// lista que precise ser mantida.

const raiz = new URL('../src/', import.meta.url)
const css = readFileSync(new URL('App.css', raiz), 'utf8')

const semComentarios = (texto) => texto.replace(/\/\*[\s\S]*?\*\//g, '')

/**
 * As regras de um trecho de CSS, como pares seletor/corpo.
 *
 * A âncora é lookbehind para não CONSUMIR a chave: a primeira regra de um
 * bloco vem logo depois da abertura dele, e um match que engolisse essa `{`
 * deixaria a regra seguinte sem âncora.
 */
const regrasDe = (trecho) =>
  [...semComentarios(trecho).matchAll(/(?<=^|[{}])\s*([^{}]+?)\s*\{([^{}]*)\}/g)]
    .map(([, seletor, corpo]) => ({ seletor: seletor.trim().replace(/\s+/g, ' '), corpo }))
    .filter(({ seletor }) => seletor.length > 0 && !seletor.startsWith('@'))

/** Recorta o @media contando as chaves, porque ele contém outros blocos. */
const recortarBloco = () => {
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

const bloco = recortarBloco()
const regras = regrasDe(bloco)
const regraUniversal = regras[0]

/** A regra do bloco cujo seletor casa com o padrão. */
const regraQue = (padrao) => regras.find(({ seletor }) => padrao.test(seletor))

describe('movimento reduzido — a forma da regra', () => {
  it('o bloco existe', () => {
    expect(bloco, 'App.css sem @media (prefers-reduced-motion: reduce)').not.toBeNull()
  })

  it('a regra vale para todo elemento, e não para uma lista de classes', () => {
    // A primeira regra é a rede que pega tudo, inclusive o componente que ainda
    // não foi escrito. As seguintes são as exceções.
    expect(regraUniversal.seletor).toMatch(/^\*/)
    expect(regraUniversal.seletor).toContain('::before')
    expect(regraUniversal.seletor).toContain('::after')
  })

  it('desliga animação E transição na própria regra universal', () => {
    // As declarações precisam estar NESTA regra, e não em qualquer outra do
    // bloco: a regra de peso de id que vem depois usa `:not()`, e um
    // pseudo-elemento que anima só é alcançado aqui.
    expect(regraUniversal.corpo).toMatch(/animation-duration:\s*0\.01ms\s*!important/)
    expect(regraUniversal.corpo).toMatch(/transition-duration:\s*0\.01ms\s*!important/)
    expect(regraUniversal.corpo).toMatch(/animation-delay:\s*0s\s*!important/)
    expect(regraUniversal.corpo).toMatch(/transition-delay:\s*0s\s*!important/)
  })

  it('corta o laço infinito de quem não estiver nomeado nas exceções', () => {
    // Sem isto, `animation-duration: 0.01ms` faria uma animação `infinite`
    // repetir o ciclo a cada centésimo de milissegundo: CPU em brasa e
    // cintilação, entregues a quem pediu menos movimento.
    expect(regraUniversal.corpo).toMatch(/animation-iteration-count:\s*1\s*!important/)
  })

  it('usa 0.01ms, e não zero: é o que ainda dispara animationend e transitionend', () => {
    // Zerar de verdade deixaria pela metade o que depende desses eventos para
    // concluir.
    expect(bloco).not.toMatch(/animation-duration:\s*0s\s*!important/)
    expect(bloco).not.toMatch(/transition-duration:\s*0s\s*!important/)
  })
})

describe('movimento reduzido — as exceções', () => {
  it('todo laço infinito do arquivo está nomeado na exceção que o faz parar', () => {
    // Esta é a única lista que sobrou, e é a que o commit anterior não
    // conseguiu eliminar: `animation-iteration-count: 1` congela um keyframe
    // que não feche o ciclo no seu estado final. `move-1` sai de
    // translate(0,0) e chega a translate(20%,15%) scale(1.1) — parar ali deixa
    // a mancha deslocada e maior do que o layout supõe.
    //
    // Como a lista não pode sumir, ao menos deixa de depender de alguém
    // lembrar dela: qualquer animação em laço nova falha aqui até ser
    // acrescentada.
    const foraDoBloco = css.replace(bloco, '')
    const emLaco = regrasDe(foraDoBloco).filter(({ corpo }) =>
      /animation[^;]*\binfinite\b/.test(corpo)
    )
    expect(emLaco.length, 'nenhum laço encontrado — o parser deve ter quebrado').toBeGreaterThan(0)

    const paradas = regraQue(/\.blob/)
    expect(paradas, 'sem a exceção que para os laços decorativos').toBeDefined()
    expect(paradas.corpo).toMatch(/animation:\s*none\s*!important/)

    const nomeados = paradas.seletor.split(',').map((s) => s.trim())

    // `.blob-1` é coberto por `.blob` porque o elemento carrega as duas
    // classes — algo que só o JSX sabe. Daí a comparação aceitar prefixo, e
    // não só igualdade.
    const cobre = (seletor) =>
      nomeados.some((nomeado) => seletor === nomeado || seletor.startsWith(`${nomeado}-`))

    const descobertos = emLaco.map(({ seletor }) => seletor).filter((s) => !cobre(s))
    expect(
      descobertos,
      `animação em laço fora da exceção: ${descobertos.join(', ')}`
    ).toEqual([])
  })

  it('o brilho que segue o cursor some', () => {
    // O comentário do bloco nomeia este e as manchas de 70vw como o movimento
    // mais pesado do produto. Não há estado parado dele que faça sentido.
    const spotlight = regraQue(/mouse-spotlight/)
    expect(spotlight, 'sem a exceção do mouse-spotlight').toBeDefined()
    expect(spotlight.corpo).toMatch(/display:\s*none/)
  })

  it('os indicadores de carregamento continuam girando', () => {
    // Parados, pareceriam travados, e a pessoa fica sem saber se a tela ainda
    // está trabalhando. Giro constante no lugar não é o movimento que incomoda
    // quem pede movimento reduzido; tela congelada, sim.
    const spinner = regraQue(/MuiCircularProgress/)
    expect(spinner, 'sem exceção para o CircularProgress').toBeDefined()
    expect(spinner.corpo).toMatch(/animation-iteration-count:\s*infinite\s*!important/)
    // O valor acompanha o do MUI; se um dia divergir, o spinner muda de ritmo
    // só para quem tem a preferência ligada.
    expect(spinner.corpo).toMatch(/animation-duration:\s*1\.4s\s*!important/)
  })
})

describe('movimento reduzido — as transições marcadas !important', () => {
  // Uma classe com !important pesa mais que o seletor universal com
  // !important. Sem uma regra de especificidade maior, essas continuavam
  // animando — medido no navegador: duas sobreviviam à regra universal.
  const marcadas = semComentarios(css).match(/transition(-duration)?:[^;]*!important/g) ?? []
  const pesoDeId = regras.filter(({ seletor }) => /:not\(#/.test(seletor))

  it('existe uma regra com peso de id para vencê-las', () => {
    if (marcadas.length === 0) return
    expect(pesoDeId.length, `${marcadas.length} transições usam !important e nada as vence`).toBeGreaterThan(0)
  })

  it('e essa regra realmente zera a transição — não basta existir', () => {
    if (marcadas.length === 0) return
    const corpo = pesoDeId.map((r) => r.corpo).join('')
    expect(corpo).toMatch(/transition-duration:\s*0\.01ms\s*!important/)
    expect(corpo).toMatch(/transition-delay:\s*0s\s*!important/)
  })

  it('e alcança pseudo-elementos, que `:not()` sozinho não casa', () => {
    if (marcadas.length === 0) return
    const seletores = pesoDeId.map((r) => r.seletor).join(',')
    expect(seletores).toMatch(/::before/)
    expect(seletores).toMatch(/::after/)
  })
})

// ---------------------------------------------------------------------------

const arquivosDeCodigo = (dir) =>
  readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome)
    if (statSync(caminho).isDirectory()) return arquivosDeCodigo(caminho)
    return /\.jsx?$/.test(nome) ? [caminho] : []
  })

describe('movimento reduzido — o que o CSS não alcança', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('nenhuma rolagem do app pede `smooth` fixo', () => {
    // Pela especificação do CSSOM View, `scrollIntoView` e `scrollBy` só
    // consultam o `scroll-behavior` do CSS quando `behavior` é `auto`. Um
    // `'smooth'` escrito à mão vence a preferência da pessoa, e rolagem
    // animada é movimento de tela inteira — o que mais pesa para sensibilidade
    // vestibular. O `scroll-behavior` do bloco acima não alcança nada disto.
    // `fileURLToPath`, e não `.pathname`: no Windows a pathname de um file://
    // vem como `/E:/...`, com uma barra à frente da letra do disco que o `fs`
    // não sabe resolver.
    const raizSrc = fileURLToPath(new URL('../src', import.meta.url))
    const infratores = arquivosDeCodigo(raizSrc).filter((caminho) => {
      if (caminho.includes('movimento.js')) return false
      return /behavior:\s*['"]smooth['"]/.test(readFileSync(caminho, 'utf8'))
    })

    expect(
      infratores,
      `use comportamentoDeRolagem() de utils/movimento em: ${infratores.join(', ')}`
    ).toEqual([])
  })

  it('comportamentoDeRolagem devolve salto direto quando a preferência está ligada', async () => {
    vi.stubGlobal('window', { matchMedia: () => ({ matches: true }) })
    const { comportamentoDeRolagem, prefereMovimentoReduzido } = await import('../src/utils/movimento.js')

    expect(prefereMovimentoReduzido()).toBe(true)
    expect(comportamentoDeRolagem()).toBe('auto')
  })

  it('e rolagem suave quando não está', async () => {
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) })
    const { comportamentoDeRolagem } = await import('../src/utils/movimento.js')

    expect(comportamentoDeRolagem()).toBe('smooth')
  })

  it('sem matchMedia, não presume a preferência', async () => {
    // Melhor manter o movimento como sempre foi do que apagá-lo para todo
    // mundo por causa de uma API ausente.
    vi.stubGlobal('window', {
      matchMedia: () => {
        throw new Error('sem matchMedia')
      },
    })
    const { prefereMovimentoReduzido } = await import('../src/utils/movimento.js')

    expect(prefereMovimentoReduzido()).toBe(false)
  })

  it('lê a preferência na hora, e não uma vez no carregamento', async () => {
    // Ela muda sem recarregar a página; um valor guardado no módulo ficaria
    // preso ao que valia quando o arquivo carregou.
    let ligada = false
    vi.stubGlobal('window', { matchMedia: () => ({ get matches() { return ligada } }) })
    const { comportamentoDeRolagem } = await import('../src/utils/movimento.js')

    expect(comportamentoDeRolagem()).toBe('smooth')
    ligada = true
    expect(comportamentoDeRolagem()).toBe('auto')
  })
})
