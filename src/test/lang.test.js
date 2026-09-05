import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import pt from '../src/lang/pt.json'
import en from '../src/lang/en.json'
import es from '../src/lang/es.json'
import fr from '../src/lang/fr.json'
// Importado como `italiano`, e não `it`: o nome curto sombrearia o `it()` do
// vitest e a suíte inteira falha ao coletar, com um "is not a function" que não
// aponta para o import.
import italiano from '../src/lang/it.json'
import { LANGUAGE_CODES, IDIOMA_PADRAO } from '../src/lang'

// Guarda os arquivos de idioma. Divergência entre eles não quebra build nem
// aparece em tela: a chave ausente simplesmente cai no fallback e a interface
// exibe o nome da chave, que passa despercebido em revisão.

const IDIOMAS = { pt, en, es, fr, it: italiano }

// A referência acompanha o idioma padrão, e não fica cravada: é o dicionário
// estático, o que preenche a lacuna quando uma chave falta em outro idioma.
// Comparar contra ele é comparar contra o que o usuário realmente veria.
const REFERENCIA = IDIOMA_PADRAO

// Marcador de que o teste está olhando o arquivo inteiro, e não só a superfície.
const MINIMO_CHAVES = 150

const cru = (arquivo) =>
  readFileSync(fileURLToPath(new URL(`../src/lang/${arquivo}`, import.meta.url)), 'utf-8')

// Interpolação é feita por substituição literal de {{nome}} em useTranslation.
const marcadores = (texto) =>
  [...String(texto).matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort()

// Caminho completo de cada chave ("heatmap.fearGreed"), acompanhando a
// profundidade pelas chaves de bloco. Os arquivos têm uma chave por linha, que
// é o que torna essa varredura suficiente.
const caminhosDasChaves = (texto) => {
  const caminhos = []
  const pilha = []

  for (const linha of texto.split('\n')) {
    const chave = linha.match(/^\s*"([^"]+)"\s*:/)?.[1]
    if (chave) caminhos.push([...pilha, chave].filter(Boolean).join('.'))

    // Uma linha pode declarar a chave e abrir o objeto dela ao mesmo tempo.
    if (/\{\s*$/.test(linha)) pilha.push(chave ?? '')
    else if (/^\s*\}/.test(linha)) pilha.pop()
  }

  return caminhos
}

// Os arquivos têm seções aninhadas (heatmap, planos, treinamento). Comparar só
// o nível raiz deixaria passar divergência dentro delas.
const achatar = (objeto, prefixo = '') =>
  Object.entries(objeto).reduce((acc, [chave, valor]) => {
    const caminho = prefixo ? `${prefixo}.${chave}` : chave
    return valor && typeof valor === 'object' && !Array.isArray(valor)
      ? { ...acc, ...achatar(valor, caminho) }
      : { ...acc, [caminho]: valor }
  }, {})

const planos = Object.fromEntries(
  Object.entries(IDIOMAS).map(([nome, dicionario]) => [nome, achatar(dicionario)])
)
const planoReferencia = planos[REFERENCIA]

const OUTROS = Object.keys(IDIOMAS).filter((nome) => nome !== REFERENCIA)

describe('lang › registro de idiomas', () => {
  it('deve ter um arquivo para cada código declarado em lang/index.js', () => {
    // O registro é o que a interface percorre para montar o seletor. Um código
    // listado sem arquivo correspondente vira uma opção que, ao ser escolhida,
    // deixa a tela inteira no idioma de fallback.
    expect([...LANGUAGE_CODES].sort()).toEqual(Object.keys(IDIOMAS).sort())
  })
})

describe.each(OUTROS)(`lang › paridade de %s com ${REFERENCIA}`, (nome) => {
  const plano = planos[nome]

  it('deve ter exatamente o mesmo conjunto de chaves, em qualquer nível', () => {
    // toEqual em vez de comparar tamanhos: a mensagem de falha aponta qual
    // chave está sobrando ou faltando.
    expect(Object.keys(plano).sort()).toEqual(Object.keys(planoReferencia).sort())
  })

  it('deve usar os mesmos marcadores de interpolação que o idioma de referência', () => {
    // Um {{razao}} que existe só na referência faz a outra versão exibir o
    // texto sem o número, sem erro nenhum no console.
    const divergentes = Object.keys(planoReferencia)
      .filter((chave) => chave in plano)
      .filter(
        (chave) => marcadores(planoReferencia[chave]).join() !== marcadores(plano[chave]).join()
      )
      .map((chave) => ({
        chave,
        [REFERENCIA]: marcadores(planoReferencia[chave]),
        [nome]: marcadores(plano[chave]),
      }))

    expect(divergentes).toEqual([])
  })
})

describe.each(Object.entries(IDIOMAS))('lang › %s.json', (nome, dicionario) => {
  it('deve cobrir o arquivo inteiro, não só o nível raiz', () => {
    // Se um refactor achatar ou aninhar demais o arquivo, os testes abaixo
    // continuariam verdes olhando quase nada.
    expect(Object.keys(achatar(dicionario)).length).toBeGreaterThan(MINIMO_CHAVES)
  })

  it('não deve ter tradução vazia', () => {
    const vazias = Object.entries(achatar(dicionario))
      .filter(([, valor]) => typeof valor === 'string' && valor.trim() === '')
      .map(([chave]) => chave)

    expect(vazias).toEqual([])
  })

  it('não deve repetir chave dentro do mesmo objeto', () => {
    // JSON.parse fica com a última ocorrência sem avisar, então a duplicata só
    // é detectável no texto cru. O caminho completo importa: heatmap.fearGreed
    // e treinamento.fearGreed são chaves distintas, não repetição.
    const caminhos = caminhosDasChaves(cru(`${nome}.json`))
    const repetidos = caminhos.filter((c, i) => caminhos.indexOf(c) !== i)

    expect([...new Set(repetidos)]).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Cobertura no sentido inverso: do código para o dicionário.
//
// Os testes acima garantem que os cinco arquivos combinam entre si. Não diziam
// nada sobre uma chave que o código pede e que não existe em arquivo nenhum —
// e `t` devolve a própria chave quando não acha tradução, então a tela exibe
// "enabled" ou "percentChange" em letra crua, nos cinco idiomas, sem erro no
// console e sem build vermelho. Foi assim que cinco delas chegaram à produção.
// ---------------------------------------------------------------------------

const DIRETORIO_FONTE = fileURLToPath(new URL('../src', import.meta.url))

const arquivosDeCodigo = (diretorio) =>
  readdirSync(diretorio, { withFileTypes: true }).flatMap((entrada) => {
    const caminho = `${diretorio}/${entrada.name}`
    if (entrada.isDirectory()) return arquivosDeCodigo(caminho)
    return /\.(js|jsx)$/.test(entrada.name) ? [caminho] : []
  })

// Só chamadas com chave literal. `t(`alertas.erro.${erro}`)` e
// `t(result.messageKey)` montam o nome em tempo de execução e ficam de fora —
// não há como conferi-los sem executar a tela.
const CHAMADA_LITERAL = /\bt\(\s*(['"])([^'"]+)\1/g

describe('lang › chaves pedidas pelo código', () => {
  it('deve existir no dicionário de referência todas as chaves literais usadas em t()', () => {
    const ausentes = []

    for (const arquivo of arquivosDeCodigo(DIRETORIO_FONTE)) {
      const codigo = readFileSync(arquivo, 'utf-8')
      for (const [, , chave] of codigo.matchAll(CHAMADA_LITERAL)) {
        if (!(chave in planoReferencia)) {
          ausentes.push({ chave, arquivo: arquivo.slice(DIRETORIO_FONTE.length + 1) })
        }
      }
    }

    expect(ausentes).toEqual([])
  })
})
