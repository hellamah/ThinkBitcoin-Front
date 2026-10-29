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
  // O modificador é opcional e não faz parte do caminho: `location = /sw.js`,
  // `location ^~ /assets/`, `location ~* \.svg`. Sem reconhecê-lo, um location
  // com modificador não casava e o bloco inteiro era lido como se fosse do
  // server — os add_header dele entravam na lista tida por herdada, e o teste
  // dava por cumprida uma repetição que não existia.
  const inicio = /location\s+(?:(=|\^~|~\*?)\s+)?(\S+)\s*\{/g
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
    locations[achado[2]] = lerAddHeaders(semComentarios.slice(inicio.lastIndex, i - 1))
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
  // A regra do nginx: um `location` que declara QUALQUER add_header descarta
  // todos os herdados do server. Quem não declara nenhum (o `location /`)
  // herda a lista inteira e está correto.
  //
  // Isto cobria só o /assets/, que era o único location com cabeçalhos na
  // época. Vale para todos porque o próximo a ser criado — o /sw.js foi o
  // segundo — cai na mesma armadilha, e o teste precisa pegá-lo sem que
  // alguém lembre de vir aqui acrescentá-lo à mão.
  const locationsComCabecalhos = Object.entries(nginx.locations).filter(
    ([, cabecalhos]) => Object.keys(cabecalhos).length > 0
  )

  it('todo location do nginx que declara cabeçalhos declara também os seis de segurança', () => {
    expect(locationsComCabecalhos.length).toBeGreaterThan(0)

    for (const [caminho, cabecalhos] of locationsComCabecalhos) {
      for (const [nome, valor] of Object.entries(nginx.server)) {
        expect(cabecalhos[nome], `${caminho} sem ${nome}`).toBe(valor)
      }
    }
  })

  it('o service worker é revalidado a cada visita, nos dois caminhos de deploy', () => {
    // Um sw.js servido do cache é a única forma de o app ficar preso numa
    // versão antiga sem conseguir se corrigir sozinho: é ele quem decide o
    // que sai do cache.
    expect(nginx.locations['/sw.js']?.['Cache-Control'], 'default.conf sem no-cache no /sw.js').toBe('no-cache')

    const regra = JSON.parse(ler('vercel.json')).headers.find((r) => r.source === '/sw.js')
    expect(regra, 'vercel.json sem regra para /sw.js').toBeDefined()
    const cabecalhos = Object.fromEntries(regra.headers.map(({ key, value }) => [key, value]))
    expect(cabecalhos['Cache-Control']).toBe('no-cache')
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
