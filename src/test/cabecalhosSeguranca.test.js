import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import viteConfig from '../vite.config.mjs'

// A política de segurança vive em quatro cópias e três arquivos: o preview do
// Vite, o vercel.json (produção) e o default.conf do nginx — este duas vezes,
// porque um `add_header` dentro de `location` descarta os herdados do server.
// Arquivo estático não importa constante de JS, então a cópia é inevitável; o
// que dá para evitar é ela divergir em silêncio.
//
// Foi o que aconteceu no /assets do nginx: o bloco repetia quatro dos seis
// cabeçalhos, e todo .js e .css da imagem saía sem CSP e sem
// Permissions-Policy. Nada falhava — só a postura de segurança dependia de por
// qual caminho o produto tinha subido. Este teste transforma esse tipo de
// esquecimento em job vermelho.

const ler = (arquivo) => readFileSync(new URL(`../${arquivo}`, import.meta.url), 'utf8')

// A única divergência proposital: as cópias que servem localmente liberam a API
// local, porque o api.js ignora VITE_API_URL em localhost e monta a URL pelas
// portas do minikube. Produção não tem API em localhost.
const ORIGENS_LOCAIS = ['http://localhost:*', 'http://127.0.0.1:*', 'https://thinkbitcoin.local:*']

const CSP = 'Content-Security-Policy'

/** "default-src 'self'; img-src data:" -> { 'default-src': ["'self'"], 'img-src': ['data:'] } */
const lerCsp = (politica) =>
  Object.fromEntries(
    politica
      .split(';')
      .map((diretiva) => diretiva.trim())
      .filter(Boolean)
      .map((diretiva) => {
        const [nome, ...fontes] = diretiva.split(/\s+/)
        return [nome, fontes]
      })
  )

const lerAddHeaders = (trecho) =>
  Object.fromEntries(
    [...trecho.matchAll(/^\s*add_header\s+([\w-]+)\s+"([^"]*)"(?:\s+always)?;/gm)].map(([, nome, valor]) => [
      nome,
      valor,
    ])
  )

/**
 * Separa o default.conf em cabeçalhos do nível do server e cabeçalhos de cada
 * `location`. As chaves são contadas em vez de casadas por regex porque os
 * blocos podem aninhar e a indentação não é contrato.
 */
const lerNginx = (conf) => {
  const semComentarios = conf
    .split('\n')
    .filter((linha) => !linha.trim().startsWith('#'))
    .join('\n')

  const locations = {}
  let server = ''
  let cursor = 0
  const inicio = /location\s+(\S+)\s*\{/g
  let achado
  while ((achado = inicio.exec(semComentarios))) {
    server += semComentarios.slice(cursor, achado.index)
    let profundidade = 1
    let i = inicio.lastIndex
    while (profundidade > 0 && i < semComentarios.length) {
      if (semComentarios[i] === '{') profundidade++
      if (semComentarios[i] === '}') profundidade--
      i++
    }
    locations[achado[1]] = lerAddHeaders(semComentarios.slice(inicio.lastIndex, i - 1))
    cursor = i
    inicio.lastIndex = i
  }
  server += semComentarios.slice(cursor)

  return { server: lerAddHeaders(server), locations }
}

const nginx = lerNginx(ler('default.conf'))

const vercel = Object.fromEntries(
  JSON.parse(ler('vercel.json'))
    .headers.find((regra) => regra.source === '/(.*)')
    .headers.map(({ key, value }) => [key, value])
)

const cspPreview = viteConfig({ command: 'serve', mode: 'test' }).preview.headers[CSP]

describe('cabeçalhos de segurança', () => {
  it('o nginx repete no /assets todos os cabeçalhos do server, com o mesmo valor', () => {
    const assets = nginx.locations['/assets/']
    expect(assets).toBeDefined()
    for (const [nome, valor] of Object.entries(nginx.server)) {
      expect(assets[nome], `/assets sem ${nome}`).toBe(valor)
    }
  })

  it('o nginx publica os mesmos cabeçalhos que o vercel.json', () => {
    expect(Object.keys(nginx.server).sort()).toEqual(Object.keys(vercel).sort())
    for (const [nome, valor] of Object.entries(vercel)) {
      if (nome === CSP) continue // comparada diretiva a diretiva abaixo
      expect(nginx.server[nome], nome).toBe(valor)
    }
  })

  describe('CSP', () => {
    const producao = lerCsp(vercel[CSP])

    it('produção não libera a API local', () => {
      for (const origem of ORIGENS_LOCAIS) {
        expect(producao['connect-src']).not.toContain(origem)
      }
    })

    it.each([
      ['preview do vite', cspPreview],
      ['nginx', nginx.server[CSP]],
    ])('%s: igual à de produção, acrescida só da API local no connect-src', (_, politica) => {
      const local = lerCsp(politica)

      expect(Object.keys(local).sort()).toEqual(Object.keys(producao).sort())
      for (const [diretiva, fontes] of Object.entries(producao)) {
        const esperado = diretiva === 'connect-src' ? [...fontes, ...ORIGENS_LOCAIS] : fontes
        expect([...local[diretiva]].sort(), diretiva).toEqual([...esperado].sort())
      }
    })
  })
})
