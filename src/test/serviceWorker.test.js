import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// O service worker decide o que a pessoa vê quando o app abre. O que ele
// devolve errado não aparece como erro em lugar nenhum: aparece como preço
// velho com cara de preço atual, ou como uma versão antiga do app que não
// consegue se atualizar sozinha. Nenhum dos dois falha ruidosamente, e é por
// isso que as regras do arquivo vêm para cá.
//
// O sw.js não passa pelo bundler — vive em public/ e é servido como está —
// então não há como importá-lo. Ele é executado aqui dentro de um escopo
// falso, que é como o navegador o executa: um `self` com os poucos objetos que
// um worker tem.

const codigoDoSw = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8')

const ORIGEM = 'https://minerthinkbitcoin.com'

/** Executa o sw.js e devolve os listeners que ele registrou. */
const carregarSw = () => {
  const listeners = {}
  const cacheFalso = {
    match: vi.fn(async () => undefined),
    put: vi.fn(async () => undefined),
    add: vi.fn(async () => undefined),
    keys: vi.fn(async () => []),
  }

  const self = {
    addEventListener: (nome, fn) => { listeners[nome] = fn },
    location: { origin: ORIGEM },
    clients: { claim: vi.fn(async () => undefined) },
    caches: {
      open: vi.fn(async () => cacheFalso),
      keys: vi.fn(async () => []),
      delete: vi.fn(async () => true),
    },
  }

  const executar = new Function('self', 'caches', 'fetch', 'URL', 'Promise', codigoDoSw)
  executar(self, self.caches, vi.fn(async () => new Response('', { status: 200 })), URL, Promise)

  return { listeners, self, cacheFalso }
}

/** Monta o evento que o navegador entrega ao listener de fetch. */
const eventoFetch = (url, { metodo = 'GET', modo = 'no-cors' } = {}) => {
  const evento = {
    request: { url, method: metodo, mode: modo },
    respondWith: vi.fn(),
    waitUntil: vi.fn(),
  }
  return evento
}

let sw

beforeEach(() => {
  sw = carregarSw()
})

describe('service worker — o que ele NUNCA pode guardar', () => {
  // Esta é a regra que não pode ceder: servir resposta de API do cache é
  // mostrar número velho com cara de número atual, e num painel financeiro
  // esse é o pior defeito possível.
  it.each([
    ['listagem de moedas', `${ORIGEM}/ThinkBitcoin/moedas`],
    ['cotação', `${ORIGEM}/ThinkBitcoin/moeda/btc/valor?pagina=1&quantidade=1000`],
    ['patrimônio', `${ORIGEM}/ThinkBitcoin/patrimonio/7`],
    ['planos de pagamento', `${ORIGEM}/ThinkBitcoin/planos-pagamento`],
    ['episódios de treinamento', `${ORIGEM}/api/TreinamentoEpisodio/resumo`],
  ])('não intercepta %s — a requisição segue direto para a rede', (_, url) => {
    const evento = eventoFetch(url)

    sw.listeners.fetch(evento)

    expect(evento.respondWith).not.toHaveBeenCalled()
  })

  // Os casos acima passariam mesmo sem a guarda explícita de /ThinkBitcoin e
  // /api: nenhuma daquelas URLs casa com as regras de asset ou de navegação,
  // então elas escapariam por ausência de regra, e não por decisão. Verificado
  // apagando a guarda do sw.js — os cinco continuavam verdes.
  //
  // Os dois abaixo é que a exercitam de fato. São também os únicos jeitos de a
  // API acabar em cache por engano.
  it('não guarda resposta de API só porque a rota termina em extensão de arquivo', () => {
    // A regra dos estáticos da raiz casa por extensão (.txt, .svg, .png). Sem
    // a guarda, um documento legal servido como .txt entraria no cache e
    // passaria a ser servido de lá — versão vigente de um termo de uso,
    // congelada no navegador de quem já aceitou a anterior.
    const evento = eventoFetch(`${ORIGEM}/ThinkBitcoin/documentos-legais/termos.txt`)

    sw.listeners.fetch(evento)

    expect(evento.respondWith).not.toHaveBeenCalled()
  })

  it('não trata rota de API como navegação, nem quando o navegador a marca assim', () => {
    // Abrir um endpoint direto na barra de endereços chega como `navigate`, e
    // sem a guarda o SW responderia com o index.html guardado no lugar do que
    // a API devolve.
    const evento = eventoFetch(`${ORIGEM}/api/TreinamentoEpisodio`, { modo: 'navigate' })

    sw.listeners.fetch(evento)

    expect(evento.respondWith).not.toHaveBeenCalled()
  })

  it('não intercepta requisição que muda estado, qualquer que seja a rota', () => {
    for (const metodo of ['POST', 'PUT', 'DELETE']) {
      const evento = eventoFetch(`${ORIGEM}/assets/index-abc123.js`, { metodo })
      sw.listeners.fetch(evento)
      expect(evento.respondWith, metodo).not.toHaveBeenCalled()
    }
  })

  it('não intercepta outra origem — o mapa do Google carrega direto', () => {
    const evento = eventoFetch('https://www.gstatic.com/charts/loader.js')

    sw.listeners.fetch(evento)

    expect(evento.respondWith).not.toHaveBeenCalled()
  })
})

describe('service worker — o que ele serve', () => {
  it('assume os assets do build, que têm hash no nome e nunca mudam', () => {
    const evento = eventoFetch(`${ORIGEM}/assets/react-vendor-CJtOgP5x.js`)

    sw.listeners.fetch(evento)

    expect(evento.respondWith).toHaveBeenCalledTimes(1)
  })

  it('assume a navegação, para o app abrir sem rede', () => {
    const evento = eventoFetch(`${ORIGEM}/dashboard`, { modo: 'navigate' })

    sw.listeners.fetch(evento)

    expect(evento.respondWith).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['fonte', `${ORIGEM}/assets/outfit-latin-200-normal.woff2`],
    ['ícone', `${ORIGEM}/favicon.svg`],
    ['manifest', `${ORIGEM}/manifest.webmanifest`],
  ])('assume o estático da raiz: %s', (_, url) => {
    const evento = eventoFetch(url)

    sw.listeners.fetch(evento)

    expect(evento.respondWith).toHaveBeenCalledTimes(1)
  })
})

describe('service worker — atualização', () => {
  // Sem isto, um deploy novo não chega a quem já instalou: o app fica preso
  // numa versão antiga sem nenhuma forma de se corrigir sozinho.
  it('não chama skipWaiting — só assume quando todas as abas do app fecham', () => {
    expect(codigoDoSw).not.toMatch(/skipWaiting\s*\(/)
  })

  it('apaga os caches de versões anteriores ao ativar', async () => {
    const chaves = ['thinkbitcoin-assets-v0', 'thinkbitcoin-paginas-v0', 'outro-app-v1']
    sw.self.caches.keys.mockResolvedValue(chaves)

    const evento = { waitUntil: vi.fn((p) => p) }
    sw.listeners.activate(evento)
    await evento.waitUntil.mock.calls[0][0]

    const apagados = sw.self.caches.delete.mock.calls.map(([chave]) => chave)
    expect(apagados).toContain('thinkbitcoin-assets-v0')
    expect(apagados).toContain('thinkbitcoin-paginas-v0')
    // Cache de outra aplicação na mesma origem não é nosso para apagar.
    expect(apagados).not.toContain('outro-app-v1')
  })
})
