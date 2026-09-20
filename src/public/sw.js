// Service worker do ThinkBitcoin.
//
// O que ele resolve: quem instalou o app na tela inicial abria uma tela branca
// sem rede, e quem voltava ao site baixava de novo o mesmo JavaScript que já
// tinha. O que ele NÃO pode fazer é mais importante, e está nas três regras
// abaixo.
//
// REGRA 1 — nada da API entra em cache. Nunca.
//   Preço de ativo, patrimônio, alerta, plano: servir isso do cache é mostrar
//   número velho com cara de número atual, e num painel financeiro esse é o
//   pior defeito possível. Só requisição de mesma origem e de asset estático
//   passa por aqui; o resto sai direto para a rede, como se este arquivo não
//   existisse.
//
// REGRA 2 — o app nunca fica preso numa versão.
//   Sem `skipWaiting`, de propósito. Um service worker que assume no meio da
//   sessão troca os assets sob os pés de uma aba aberta: o HTML já carregado
//   pede um chunk que o deploy novo renomeou, e a tela quebra. Este só assume
//   quando todas as abas do app fecham, e o HTML vai sempre à rede primeiro —
//   então um deploy novo chega na primeira visita depois dele.
//
// REGRA 3 — falhar aqui não pode derrubar a página.
//   Todo caminho tem saída pela rede. Se o cache falhar, se o SW estiver a
//   meio de uma atualização, se o storage estiver cheio: a requisição segue
//   para a rede e a pessoa não percebe nada.

// Suba este número ao mudar a estratégia deste arquivo. Ele não precisa
// acompanhar cada deploy: os assets têm hash no nome, então um build novo já
// gera chaves novas. Trocar a versão apaga o cache antigo inteiro, e é a saída
// se um dia algo aqui servir conteúdo errado.
const VERSAO = 'v1'
const CACHE_ASSETS = `thinkbitcoin-assets-${VERSAO}`
const CACHE_PAGINAS = `thinkbitcoin-paginas-${VERSAO}`

// O app é uma SPA: toda rota é servida pelo mesmo index.html. É ele o que
// precisa existir offline — as rotas internas o React resolve sozinho.
const PAGINA_RAIZ = '/index.html'

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches
      .open(CACHE_PAGINAS)
      .then((cache) => cache.add(PAGINA_RAIZ))
      // Instalação que falha deixaria o SW antigo no ar, o que é aceitável.
      // O que não é aceitável é o erro subir e virar ruído sem consequência.
      .catch(() => undefined)
  )
})

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((chaves) =>
        Promise.all(
          chaves
            .filter((chave) => chave.startsWith('thinkbitcoin-') && !chave.endsWith(VERSAO))
            .map((chave) => caches.delete(chave))
        )
      )
      // `clients.claim` sem `skipWaiting` é seguro: este SW só chega a ativar
      // quando nenhuma aba do app está presa ao anterior (ver REGRA 2). O
      // claim só evita que a primeira aba depois disso fique sem controlador.
      .then(() => self.clients.claim())
      .catch(() => undefined)
  )
})

// Os assets do build carregam hash no nome e são publicados com `immutable`:
// o conteúdo de uma URL dessas nunca muda. Cache primeiro é correto e é onde
// está o ganho — quem volta ao site não rebaixa nada.
const ehAssetComHash = (url) => url.pathname.startsWith('/assets/')

// Fontes, ícone e manifest: mudam raramente e não têm hash. Vão para o mesmo
// cache, mas revalidando em segundo plano.
const ehEstaticoDaRaiz = (url) =>
  /\.(woff2?|svg|png|ico|webmanifest|txt)$/.test(url.pathname)

const cacheFirst = async (requisicao) => {
  const cache = await caches.open(CACHE_ASSETS)
  const guardado = await cache.match(requisicao)
  if (guardado) return guardado

  const resposta = await fetch(requisicao)
  // Só 200 de mesma origem entra. `opaque` (status 0) não dá para inspecionar
  // e ocuparia espaço para armazenar um erro disfarçado.
  if (resposta.ok && resposta.status === 200) cache.put(requisicao, resposta.clone())
  return resposta
}

const revalidandoEmSegundoPlano = async (requisicao) => {
  const cache = await caches.open(CACHE_ASSETS)
  const guardado = await cache.match(requisicao)

  const daRede = fetch(requisicao)
    .then((resposta) => {
      if (resposta.ok) cache.put(requisicao, resposta.clone())
      return resposta
    })
    .catch(() => null)

  // Entrega o que tem agora e atualiza para a próxima vez. Sem cache, espera a
  // rede como qualquer requisição normal.
  return guardado || (await daRede) || fetch(requisicao)
}

// Navegação vai à rede primeiro: é assim que um deploy novo chega. O cache só
// entra quando a rede não responde — avião, metrô, sinal ruim.
const redePrimeiro = async (requisicao) => {
  try {
    const resposta = await fetch(requisicao)
    if (resposta.ok) {
      const cache = await caches.open(CACHE_PAGINAS)
      cache.put(PAGINA_RAIZ, resposta.clone())
    }
    return resposta
  } catch (erroDeRede) {
    const cache = await caches.open(CACHE_PAGINAS)
    const guardado = await cache.match(PAGINA_RAIZ)
    if (guardado) return guardado
    throw erroDeRede
  }
}

self.addEventListener('fetch', (evento) => {
  const { request } = evento

  // POST, PUT, DELETE: passam direto. Cache de requisição que muda estado não
  // existe, e interceptá-las só adiciona um ponto de falha.
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // Outra origem (gstatic, do mapa) fica fora: a CSP já decide o que pode
  // carregar, e guardar resposta de terceiro aqui não traz ganho nenhum.
  if (url.origin !== self.location.origin) return

  // REGRA 1. A API do ThinkBitcoin vive sob /ThinkBitcoin e /api; em produção
  // ela está noutra origem e já cairia no teste acima, mas em desenvolvimento
  // e atrás do proxy do Vite ela é de mesma origem — e é exatamente aí que o
  // engano aconteceria sem esta linha.
  if (url.pathname.startsWith('/ThinkBitcoin') || url.pathname.startsWith('/api')) return

  if (request.mode === 'navigate') {
    evento.respondWith(redePrimeiro(request))
    return
  }

  if (ehAssetComHash(url)) {
    evento.respondWith(cacheFirst(request))
    return
  }

  if (ehEstaticoDaRaiz(url)) {
    evento.respondWith(revalidandoEmSegundoPlano(request))
  }
})
