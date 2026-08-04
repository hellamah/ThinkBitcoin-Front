import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import pt from '../src/lang/pt.json'
import en from '../src/lang/en.json'

// Guarda os arquivos de idioma. Divergência entre eles não quebra build nem
// aparece em tela: a chave ausente simplesmente cai no fallback e a interface
// exibe o nome da chave, que passa despercebido em revisão.

const IDIOMAS = { pt, en }

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

const planoPt = achatar(pt)
const planoEn = achatar(en)

describe('lang › paridade entre idiomas', () => {
  it('deve ter exatamente o mesmo conjunto de chaves, em qualquer nível', () => {
    // toEqual em vez de comparar tamanhos: a mensagem de falha aponta qual
    // chave está sobrando ou faltando.
    expect(Object.keys(planoEn).sort()).toEqual(Object.keys(planoPt).sort())
  })

  it('deve usar os mesmos marcadores de interpolação nos dois idiomas', () => {
    // Um {{razao}} que existe só em pt faz a versão em inglês exibir o texto
    // sem o número, sem erro nenhum no console.
    const divergentes = Object.keys(planoPt)
      .filter((chave) => chave in planoEn)
      .filter((chave) => marcadores(planoPt[chave]).join() !== marcadores(planoEn[chave]).join())
      .map((chave) => ({ chave, pt: marcadores(planoPt[chave]), en: marcadores(planoEn[chave]) }))

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
