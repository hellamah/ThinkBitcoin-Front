// Relato de erros de produção.
//
// Antes disto, um erro de render em produção virava a tela vermelha do
// ErrorBoundary e um `console.error` que só existia na máquina de quem
// esbarrou nele. Ninguém do outro lado ficava sabendo — nem que aconteceu, nem
// em qual rota, nem quantas vezes.
//
// PARA ONDE VAI: a URL sai de `VITE_ERROR_ENDPOINT`. Sem a variável, nada é
// enviado e o módulo se resume ao `console.error` de sempre — que é
// exatamente o comportamento desejado em dev e em qualquer build que ainda não
// tenha um coletor.
//
// ATENÇÃO À CSP: `connect-src` está fechado nas quatro cópias da política
// (vite.config.mjs, vercel.json e as duas do default.conf). Hoje ele libera
// 'self' e as origens da API. Um endpoint fora dessas origens — um coletor de
// terceiros, por exemplo — é bloqueado pelo navegador antes de sair, e o
// test/cabecalhosSeguranca.test.js falha se as cópias divergirem. Apontar para
// a própria API é o caminho que não exige tocar em nada disso.
//
// O QUE NÃO VAI JUNTO: token, e-mail, nome, nada de formulário. O relato leva
// mensagem, pilha, rota e ambiente. Num produto que pede consentimento
// explícito para tratar dado pessoal, o coletor de erro não é a porta dos
// fundos para recolher o que não foi consentido.

const ENDPOINT = (() => {
  try {
    return import.meta.env?.VITE_ERROR_ENDPOINT || null
  } catch {
    return null
  }
})()

const EM_DESENVOLVIMENTO = (() => {
  try {
    return Boolean(import.meta.env?.DEV)
  } catch {
    return false
  }
})()

// Teto por sessão. Um erro dentro de um efeito que se repete — render em loop,
// polling que falha a cada cinco segundos — geraria centenas de requisições
// para dizer sempre a mesma coisa. O primeiro relato já conta a história.
const MAXIMO_POR_SESSAO = 10

// Assinaturas já enviadas. A mesma falha repetida em telas diferentes ainda
// vale um relato por rota, por isso a rota entra na chave.
const jaRelatados = new Set()
let enviados = 0

const assinatura = (erro, rota) =>
  `${rota}::${erro?.name ?? 'Error'}::${erro?.message ?? ''}`

/**
 * Envia o relato sem bloquear nada e sem poder derrubar quem chamou.
 *
 * `sendBeacon` primeiro porque ele sobrevive à navegação: boa parte dos erros
 * graves acontece junto com o usuário fechando a aba, e um `fetch` comum é
 * cancelado nesse momento. O `keepalive` do fetch é o plano B, para navegador
 * sem beacon.
 */
const enviar = (corpo) => {
  const json = JSON.stringify(corpo)

  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      // Blob com o tipo explícito: sem ele o beacon vai como text/plain e o
      // coletor recebe um corpo que não sabe ler.
      const enviado = navigator.sendBeacon(ENDPOINT, new Blob([json], { type: 'application/json' }))
      if (enviado) return
    }

    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: json,
      keepalive: true,
    }).catch(() => {
      /* O relato de erro falhando não pode virar outro erro na tela. */
    })
  } catch {
    /* idem: relatar é melhor esforço, nunca um caminho que possa lançar. */
  }
}

/**
 * Relata um erro. Seguro de chamar de qualquer lugar, inclusive de dentro de
 * um catch que já está tratando outra falha.
 *
 * @param {Error} erro
 * @param {{ origem?: string, componentStack?: string }} [contexto]
 */
export const relatarErro = (erro, contexto = {}) => {
  // O console continua, e continua primeiro: em dev é o único canal, e em
  // produção é o que a pessoa vê ao abrir o DevTools para contar o que houve.
  console.error('[ThinkBitcoin]', contexto.origem ?? 'erro', erro, contexto.componentStack ?? '')

  if (!ENDPOINT || EM_DESENVOLVIMENTO) return
  if (typeof window === 'undefined') return
  if (enviados >= MAXIMO_POR_SESSAO) return

  const rota = window.location?.pathname ?? '?'
  const chave = assinatura(erro, rota)
  if (jaRelatados.has(chave)) return

  jaRelatados.add(chave)
  enviados += 1

  enviar({
    mensagem: erro?.message ?? String(erro),
    tipo: erro?.name ?? 'Error',
    pilha: erro?.stack ?? null,
    pilhaDeComponentes: contexto.componentStack ?? null,
    origem: contexto.origem ?? 'desconhecida',
    // Só o pathname. A query string carrega filtros e identificadores que não
    // fazem falta aqui e que ninguém revisou sob essa ótica.
    rota,
    idioma: document?.documentElement?.lang ?? null,
    navegador: navigator?.userAgent ?? null,
    quando: new Date().toISOString(),
  })
}

/**
 * Liga a captura do que o ErrorBoundary não alcança.
 *
 * O boundary do React pega erro de render, e só. Falha dentro de um
 * `setTimeout`, de um handler de clique ou de uma promise sem `.catch()` passa
 * direto por ele e some — o app continua de pé, meio quebrado, sem nenhum
 * registro de que algo aconteceu.
 */
export const instalarCapturaGlobal = () => {
  if (typeof window === 'undefined') return

  window.addEventListener('error', (evento) => {
    // Erro de carregamento de recurso (imagem, chunk) chega neste mesmo evento
    // sem `error` preenchido. Vira um relato próprio, com o que dá para saber.
    const erro = evento.error ?? new Error(evento.message || 'Erro sem detalhes')
    relatarErro(erro, { origem: 'window.onerror' })
  })

  window.addEventListener('unhandledrejection', (evento) => {
    const motivo = evento.reason
    const erro = motivo instanceof Error ? motivo : new Error(String(motivo))
    relatarErro(erro, { origem: 'promise não tratada' })
  })
}
