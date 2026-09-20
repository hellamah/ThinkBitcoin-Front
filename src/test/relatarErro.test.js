// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// O relato de erro é código que só roda quando algo já deu errado. Se ele
// falhar, falha no pior momento possível e sem ninguém olhando — daí estes
// testes cobrirem sobretudo o que ele NÃO pode fazer: inundar o coletor,
// levar junto o que não deve, e lançar.

const carregarModulo = async ({ endpoint = null, dev = false } = {}) => {
  vi.resetModules()
  vi.stubEnv('DEV', dev)
  if (endpoint) vi.stubEnv('VITE_ERROR_ENDPOINT', endpoint)
  else vi.stubEnv('VITE_ERROR_ENDPOINT', '')
  return import('../src/utils/relatarErro.js')
}

let beacon

beforeEach(() => {
  beacon = vi.fn(() => true)
  Object.defineProperty(navigator, 'sendBeacon', { value: beacon, configurable: true, writable: true })
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

// sendBeacon recebe um Blob, não uma string: o corpo é lido de volta dele.
const corpoDe = async (chamada) => JSON.parse(await chamada[1].text())

describe('relatarErro — quando não há coletor', () => {
  it('sem VITE_ERROR_ENDPOINT, não envia nada e ainda assim registra no console', async () => {
    const { relatarErro } = await carregarModulo({ endpoint: null })

    relatarErro(new Error('quebrou'), { origem: 'render' })

    expect(beacon).not.toHaveBeenCalled()
    expect(console.error).toHaveBeenCalled()
  })

  it('em desenvolvimento não envia, mesmo com endpoint configurado', async () => {
    const { relatarErro } = await carregarModulo({ endpoint: 'https://api.exemplo/erros', dev: true })

    relatarErro(new Error('quebrou'))

    expect(beacon).not.toHaveBeenCalled()
  })
})

describe('relatarErro — o que chega ao coletor', () => {
  it('envia mensagem, tipo, pilha e rota', async () => {
    const { relatarErro } = await carregarModulo({ endpoint: 'https://api.exemplo/erros' })
    window.history.pushState({}, '', '/dashboard')

    relatarErro(new TypeError('x is not a function'), { origem: 'render', componentStack: '  em Dashboard' })

    expect(beacon).toHaveBeenCalledTimes(1)

    const [url, blob] = beacon.mock.calls[0]
    expect(url).toBe('https://api.exemplo/erros')
    // Sem o tipo explícito o beacon vai como text/plain e o coletor recebe
    // um corpo que não sabe ler.
    expect(blob.type).toBe('application/json')

    const corpo = await corpoDe(beacon.mock.calls[0])
    expect(corpo.mensagem).toBe('x is not a function')
    expect(corpo.tipo).toBe('TypeError')
    expect(corpo.origem).toBe('render')
    expect(corpo.rota).toBe('/dashboard')
    expect(corpo.pilhaDeComponentes).toBe('  em Dashboard')
    expect(corpo.pilha).toContain('TypeError')
    expect(corpo.quando).toMatch(/^[0-9]{4}-[0-9]{2}-[0-9]{2}T/)
  })

  it('não leva a query string junto — ela carrega filtros e identificadores que ninguém revisou sob essa ótica', async () => {
    const { relatarErro } = await carregarModulo({ endpoint: 'https://api.exemplo/erros' })
    window.history.pushState({}, '', '/dashboard?moeda=BTC&token=segredo')

    relatarErro(new Error('quebrou'))

    const blob = beacon.mock.calls[0][1]
    const texto = await blob.text()
    expect(texto).toContain('"rota":"/dashboard"')
    expect(texto).not.toContain('segredo')
    expect(texto).not.toContain('moeda=BTC')
  })
})

describe('relatarErro — contenção', () => {
  it('o mesmo erro na mesma rota vira um relato só', async () => {
    const { relatarErro } = await carregarModulo({ endpoint: 'https://api.exemplo/erros' })
    window.history.pushState({}, '', '/dashboard')

    const erro = new Error('render em loop')
    relatarErro(erro)
    relatarErro(erro)
    relatarErro(new Error('render em loop'))

    expect(beacon).toHaveBeenCalledTimes(1)
  })

  it('o mesmo erro em rota diferente vale um relato novo', async () => {
    const { relatarErro } = await carregarModulo({ endpoint: 'https://api.exemplo/erros' })

    window.history.pushState({}, '', '/dashboard')
    relatarErro(new Error('mesma falha'))
    window.history.pushState({}, '', '/settings')
    relatarErro(new Error('mesma falha'))

    expect(beacon).toHaveBeenCalledTimes(2)
  })

  it('para no teto de relatos por sessão', async () => {
    const { relatarErro } = await carregarModulo({ endpoint: 'https://api.exemplo/erros' })
    window.history.pushState({}, '', '/dashboard')

    for (let i = 0; i < 40; i += 1) relatarErro(new Error(`falha ${i}`))

    expect(beacon).toHaveBeenCalledTimes(10)
  })

  it('se o envio lançar, quem chamou não fica sabendo — relatar nunca vira um segundo erro', async () => {
    const { relatarErro } = await carregarModulo({ endpoint: 'https://api.exemplo/erros' })
    beacon.mockImplementation(() => { throw new Error('beacon indisponível') })

    expect(() => relatarErro(new Error('quebrou'))).not.toThrow()
  })
})
