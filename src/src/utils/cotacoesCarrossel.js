import { apiRequest, MarketEndpoint, VariavelExternaEndpoint } from './apiClient'

/**
 * Cotações do carrossel, compartilhadas entre as telas que o exibem.
 *
 * Dashboard e Heatmap montavam cada um o seu `useCoinPrices`, com lista,
 * cotações e polling próprios — e o `<main key={pathname}>` do Layout desmonta
 * a página a cada navegação. Ir do dashboard ao heatmap e voltar refazia, a
 * cada troca, a lista e as três requisições por moeda (preço, medo/ganância e
 * tendência), jogava fora o histórico do mini gráfico e mostrava o carrossel
 * zerado até a rodada nova chegar.
 *
 * Aqui o estado vive no módulo, e o polling roda enquanto houver ao menos uma
 * tela inscrita. Quem chega dentro do intervalo reaproveita a última rodada e
 * só agenda a próxima para quando ela vencer.
 *
 * É uma fábrica, além do singleton, para os testes injetarem a requisição.
 */

export const INTERVALO_COTACOES_MS = 60_000

// Pontos guardados para o mini gráfico de cada moeda.
const PONTOS_NO_HISTORICO = 7

const primeiroRegistro = (res) => {
  const r = res?.resultado ?? res
  return r?.registros?.[0] ?? (Array.isArray(r) ? r[0] : null)
}

const montarLista = (json) =>
  (json?.resultado || [])
    .map((m) => ({
      id: m?.id,
      simbolo: m?.sigla,
      nome: m?.nome,
      valor: 0,
      dados: [],
      variacao: 0,
    }))
    .filter(
      (m) =>
        m && m.simbolo?.toUpperCase() !== 'USDT' &&
        (m.nome ? !m.nome.toLowerCase().includes('dolar') : true)
    )

/** Aplica a resposta de uma rodada a uma moeda. Pura, para ser testável. */
export const aplicarCotacao = (moeda, resPreco, resFear, resTrend) => {
  let valor = 0
  const pRes = resPreco?.resultado ?? resPreco
  const registro = pRes?.registros?.[0] ?? (Array.isArray(pRes) ? pRes[0] : pRes)

  if (typeof resPreco === 'number') {
    valor = resPreco
  } else if (registro) {
    valor = registro.precoFechamento ??
      registro.valorNegociado ??
      registro.valor ??
      pRes?.valor ?? 0
  }

  const apiVariacao = registro?.precoPercentualVariacao ??
    registro?.variacaoPercentual ?? null
  const anterior = moeda.dados[moeda.dados.length - 1] ?? valor
  const variacao = apiVariacao !== null
    ? apiVariacao
    : (anterior !== 0 ? ((valor - anterior) / anterior) * 100 : 0)

  return {
    ...moeda,
    valor,
    dados: [...moeda.dados.slice(-(PONTOS_NO_HISTORICO - 1)), valor],
    variacao,
    // Fear/trend são complementares: em caso de falha ficam nulos e a UI
    // simplesmente não exibe sentimento, em vez de mostrar dados fictícios.
    fear: primeiroRegistro(resFear),
    trend: primeiroRegistro(resTrend),
  }
}

const buscarCotacao = async (moeda, requisitar) => {
  try {
    // Os três parâmetros vão EXPLÍCITOS. O carrossel só consome `registros[0]`,
    // então pedir uma página inteira de candles por moeda, a cada minuto, era
    // desperdício. E `ordemAsc` é correção, não economia: ler o índice 0 como
    // "preço agora" só vale se a série vier decrescente. Confiar no default do
    // servidor faria o carrossel exibir o candle mais ANTIGO como cotação atual
    // se esse default um dia fosse ascendente — erro plausível, que não quebra
    // nada e ninguém percebe.
    const [resPreco, resFear, resTrend] = await Promise.all([
      requisitar(
        MarketEndpoint.COIN_VALUE(moeda.simbolo.toLowerCase(), {
          pagina: 1,
          quantidade: 1,
          ordemAsc: false,
        })
      ),
      requisitar(`${VariavelExternaEndpoint.FEAR_GREED}?idMoeda=${moeda.id}&quantidade=1&ordemAsc=false`).catch(() => null),
      requisitar(`${VariavelExternaEndpoint.TREND}?idMoeda=${moeda.id}&quantidade=1&ordemAsc=false`).catch(() => null),
    ])
    return aplicarCotacao(moeda, resPreco, resFear, resTrend)
  } catch (err) {
    console.error(`Erro ao buscar valor para ${moeda.simbolo}:`, err)
    return moeda
  }
}

export const criarCotacoesCarrossel = ({
  requisitar = apiRequest,
  intervaloMs = INTERVALO_COTACOES_MS,
  agora = () => Date.now(),
  abaOculta = () => typeof document !== 'undefined' && document.hidden,
} = {}) => {
  // `erro` guarda a CHAVE, não a frase: isto roda fora de qualquer tela e não
  // tem `t`. Quem exibe traduz — montar o texto aqui deixava o banner em
  // português nos outros quatro idiomas.
  let estado = { moedas: [], erro: '' }
  let ultimaRodada = -Infinity
  let listaFalhando = false
  let rodadaEmCurso = null
  let timer = null
  // Muda a cada início e fim do polling. Um timer que disparou antes de a
  // última tela sair, e ainda aguarda a rodada, não pode se reagendar depois.
  let geracao = 0
  const inscritos = new Set()

  const publicar = (mudanca) => {
    estado = { ...estado, ...mudanca }
    inscritos.forEach((avisar) => avisar())
  }

  // Uma rodada por vez. Duas telas chegando juntas — ou o duplo montar do
  // StrictMode — recebem a mesma promessa em vez de disparar duas.
  const rodar = () => {
    if (rodadaEmCurso) return rodadaEmCurso
    rodadaEmCurso = (async () => {
      let moedas = estado.moedas
      if (moedas.length === 0) {
        try {
          moedas = montarLista(await requisitar(MarketEndpoint.COIN_LIST))
        } catch (err) {
          console.error('Erro ao listar moedas:', err)
          // A lista é tentada de novo a cada rodada — antes, uma falha na
          // entrada deixava o carrossel vazio até recarregar a página. Mas o
          // aviso sai uma vez por sequência de falhas: reabri-lo a cada minuto,
          // depois de a pessoa tê-lo fechado, seria insistência, não informação.
          if (!listaFalhando) publicar({ erro: 'coinListError' })
          listaFalhando = true
          return
        }
        listaFalhando = false
        publicar({ moedas, erro: '' })
      }
      const atualizadas = await Promise.all(moedas.map((m) => buscarCotacao(m, requisitar)))
      ultimaRodada = agora()
      publicar({ moedas: atualizadas })
    })().finally(() => {
      rodadaEmCurso = null
    })
    return rodadaEmCurso
  }

  const programar = (espera, minhaGeracao) => {
    timer = setTimeout(async () => {
      // Aba em segundo plano não gasta requisição com carrossel que ninguém vê.
      if (!abaOculta()) await rodar()
      if (minhaGeracao === geracao) programar(intervaloMs, minhaGeracao)
    }, espera)
  }

  const subscribe = (avisar) => {
    inscritos.add(avisar)
    if (inscritos.size === 1) {
      const minhaGeracao = ++geracao
      const idade = agora() - ultimaRodada
      if (idade >= intervaloMs) {
        rodar()
        programar(intervaloMs, minhaGeracao)
      } else {
        programar(intervaloMs - idade, minhaGeracao)
      }
    }
    return () => {
      inscritos.delete(avisar)
      if (inscritos.size === 0) {
        geracao++
        clearTimeout(timer)
        timer = null
      }
    }
  }

  return {
    subscribe,
    getSnapshot: () => estado,
    definirErro: (erro) => publicar({ erro }),
  }
}

export const cotacoesCarrossel = criarCotacoesCarrossel()
