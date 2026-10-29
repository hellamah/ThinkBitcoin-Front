// Leituras de robustez sobre um resultado já simulado.
//
// O motor responde "quanto a regra rendeu". Nada disso diz se o número
// sobrevive a um empurrão: uma amostra um pouco diferente, as duas melhores
// operações a menos, uma taxa um pouco maior, um mês que não se repete. Cada
// função aqui é um desses empurrões, e todas trabalham sobre as operações e a
// curva que o motor já devolveu — nenhuma volta aos candles.
//
// A régua aleatória, que é a outra metade da robustez, mora em acaso.js: ela
// SIMULA de novo, centenas de vezes, e por isso roda fora da thread da tela.

import { geradorAleatorio, paraNumero, quantil } from './mathUtils'
import { retornoLiquidoDe } from './backtest'
import { ExitReason } from './enums'

// Reamostragens do bootstrap. Mil dão quantis de 2,5% e 97,5% estáveis na
// primeira casa decimal, e custam alguns milissegundos mesmo com centenas de
// operações.
export const ITERACOES_BOOTSTRAP = 1000

// Quantas das melhores operações retirar para ver se o resultado depende delas.
// Três é o bastante para pegar "um mês de sorte" numa janela de 180 dias sem
// virar outro teste — retirar metade das operações mediria outra coisa.
export const MELHORES_A_RETIRAR = 3

// Teto da busca do custo de equilíbrio, em % por perna. Acima de 5% nenhuma
// corretora real cobra, e dizer "sobrevive até 37%" seria precisão sobre um
// cenário que não existe. Acima do teto a tela diz "acima de 5%".
export const CUSTO_MAXIMO_EQUILIBRIO = 5

// Fração das vencedoras que a leitura de excursão adversa descreve.
export const FRACAO_VENCEDORAS_EXCURSAO = 0.8

/**
 * Como o custo de equilíbrio terminou.
 *
 * NUNCA – nem com custo zero o alfa fica positivo: a regra perde para o buy &
 *   hold antes de pagar qualquer taxa.
 * ACIMA – o alfa continua positivo mesmo no teto da busca.
 * ENCONTRADO – há uma taxa em que o alfa zera.
 */
export const EquilibrioCusto = Object.freeze({
  NUNCA: 'nunca',
  ACIMA: 'acima',
  ENCONTRADO: 'encontrado',
})

const concluidasDe = (trades) =>
  (trades || []).filter((t) => t.motivoSaida !== ExitReason.FIM_DA_SERIE)

// Fator de capital de uma operação: só a fração comprometida anda com ela. Sem
// dimensionamento pelo risco a fração é 1.
const fatorDe = (trade, retorno) => 1 + ((trade.fracaoCapital ?? 1) * retorno) / 100

/**
 * Intervalo de confiança do retorno, por bootstrap das operações concluídas.
 *
 * A taxa de acerto já tinha intervalo (Wilson); o retorno, que é o número que
 * as pessoas de fato leem, não tinha nenhum. "+8%" com trinta operações pode
 * ser qualquer coisa entre perder e ganhar bem — e a tela exibia o ponto como
 * se fosse o resultado.
 *
 * Reamostra as operações COM reposição, no mesmo número, e compõe o capital de
 * cada reamostragem. Os quantis de 2,5% e 97,5% dessas mil composições são o
 * intervalo.
 *
 * **O que isto não captura:** a ordem das operações e o tempo fora do mercado.
 * O bootstrap trata cada operação como um sorteio independente — suposição
 * razoável para dizer "quão diferente poderia ter sido", e errada para dizer
 * "qual seria o drawdown". Por isso ele acompanha o retorno, não o risco.
 *
 * A operação que a janela não viu terminar fica de fora, como no win rate: o
 * desfecho dela não aconteceu.
 *
 * @param {Array<object>} trades - `resultado.trades`.
 * @param {{iteracoes?: number, semente?: number}} [opcoes]
 * @returns {{
 *   inferior: number, superior: number, mediana: number,
 *   probabilidadePositivo: number, iteracoes: number, operacoes: number
 * }|null} - Em %. null com menos de duas operações concluídas: com uma só,
 *   toda reamostragem é ela mesma, e o intervalo teria largura zero.
 */
export const bootstrapRetorno = (
  trades,
  { iteracoes = ITERACOES_BOOTSTRAP, semente = 1 } = {}
) => {
  const concluidas = concluidasDe(trades)
  if (concluidas.length < 2) return null

  const fatores = concluidas.map((t) => fatorDe(t, t.retornoLiquido))
  const n = fatores.length
  const sortear = geradorAleatorio(semente)

  const resultados = new Array(iteracoes)
  let positivos = 0
  for (let k = 0; k < iteracoes; k++) {
    let capital = 1
    for (let j = 0; j < n; j++) capital *= fatores[Math.floor(sortear() * n)]
    const retorno = (capital - 1) * 100
    resultados[k] = retorno
    if (retorno > 0) positivos++
  }
  resultados.sort((a, b) => a - b)

  return {
    inferior: quantil(resultados, 0.025),
    superior: quantil(resultados, 0.975),
    mediana: quantil(resultados, 0.5),
    probabilidadePositivo: (positivos / iteracoes) * 100,
    iteracoes,
    operacoes: n,
  }
}

/**
 * Retorno recomposto sem as melhores operações.
 *
 * Responde "o resultado é da regra ou de três dias?". Uma estratégia que rende
 * 15% e perde 4% sem as três melhores não descreve um comportamento — descreve
 * três eventos. É a pergunta que a tabela de operações responde se alguém
 * ordenar e somar à mão; aqui ela vira um número.
 *
 * Sobre TODAS as operações, inclusive a que a janela não viu terminar, porque é
 * assim que o retorno do card é composto: retirar três de uma conta e comparar
 * com outra conta mediria a diferença entre as contas.
 *
 * @param {Array<object>} trades
 * @param {number} [quantas]
 * @returns {{retorno: number, retiradas: number}|null} - null quando retirar
 *   deixaria a lista vazia.
 */
export const retornoSemMelhores = (trades, quantas = MELHORES_A_RETIRAR) => {
  const lista = trades || []
  if (lista.length <= quantas) return null

  const restantes = [...lista]
    .sort((a, b) => b.retornoLiquido - a.retornoLiquido)
    .slice(quantas)
  const capital = restantes.reduce((c, t) => c * fatorDe(t, t.retornoLiquido), 1)

  return { retorno: (capital - 1) * 100, retiradas: quantas }
}

/**
 * A taxa por perna em que o alfa da estratégia zera.
 *
 * O campo de custo deixa testar uma taxa por vez; esta função responde a
 * pergunta que se faz depois de testar três: "até quanto de taxa isto
 * aguenta?". Uma regra que só supera o buy & hold abaixo de 0,04% por perna só
 * existe para quem paga taxa maker de conta profissional — e isso cabe numa
 * linha em vez de exigir que cada um descubra mexendo no campo.
 *
 * Recalcula as MESMAS operações com outra taxa. É legítimo porque a taxa não
 * muda nenhuma entrada nem saída: stop e alvo são preços, o tempo é contagem de
 * candles. Só o retorno de cada operação muda — e ele cai monotonamente com a
 * taxa, o que permite a busca binária.
 *
 * @param {Array<object>} trades
 * @param {{direcao: number, buyAndHold: number|null, maximo?: number}} opcoes
 * @returns {{situacao: string, custo: number|null}|null} - `EquilibrioCusto`.
 *   null sem operação ou sem régua.
 */
export const custoDeEquilibrio = (
  trades,
  { direcao, buyAndHold, maximo = CUSTO_MAXIMO_EQUILIBRIO } = {}
) => {
  const lista = trades || []
  if (lista.length === 0) return null
  if (buyAndHold === null || buyAndHold === undefined || !Number.isFinite(buyAndHold)) return null

  const alfaCom = (custo) => {
    const capital = lista.reduce((c, t) => {
      const r = retornoLiquidoDe(t.precoEntrada, t.precoSaida, direcao, custo)
      // Taxa tão alta que a entrada efetiva sairia não positiva: a operação
      // perderia tudo que comprometeu.
      return c * fatorDe(t, r ?? -100)
    }, 1)
    return (capital - 1) * 100 - buyAndHold
  }

  if (alfaCom(0) <= 0) return { situacao: EquilibrioCusto.NUNCA, custo: null }
  if (alfaCom(maximo) > 0) return { situacao: EquilibrioCusto.ACIMA, custo: maximo }

  let baixo = 0
  let alto = maximo
  // 40 bissecções levam o intervalo de 5% a ~5e-12: muito além da precisão com
  // que a tela exibe o número, e barato o bastante para não pensar nisso.
  for (let k = 0; k < 40; k++) {
    const meio = (baixo + alto) / 2
    if (alfaCom(meio) > 0) baixo = meio
    else alto = meio
  }

  return { situacao: EquilibrioCusto.ENCONTRADO, custo: (baixo + alto) / 2 }
}

/**
 * Pontos e leituras da excursão das operações (MAE/MFE).
 *
 * É a forma de ajustar stop e alvo olhando para o que as operações FIZERAM,
 * em vez de testar distâncias até uma dar certo. Se oito em cada dez vencedoras
 * recuaram no máximo 1,8% antes de virar, um stop de 1,5% teria matado a
 * maioria delas — e isso se lê sem simular um stop de 1,5%.
 *
 * As leituras descrevem as operações; nenhuma recomenda uma distância. Escolher
 * o stop a partir destes pontos continua sendo escolher sobre o passado, com o
 * mesmo risco de sobreajuste — só que com os olhos abertos.
 *
 * @param {Array<object>} trades
 * @returns {{
 *   pontos: Array<{adversa: number, favoravel: number, resultado: number, indiceEntrada: number}>,
 *   vencedoras: number, perdedoras: number,
 *   adversaVencedoras: number|null, favoravelPerdedoras: number|null
 * }|null} - null sem operação concluída.
 */
export const resumirExcursoes = (trades) => {
  const concluidas = concluidasDe(trades).filter(
    (t) => Number.isFinite(t.excursaoAdversa) && Number.isFinite(t.excursaoFavoravel)
  )
  if (concluidas.length === 0) return null

  const vencedoras = concluidas.filter((t) => t.retornoLiquido > 0)
  const perdedoras = concluidas.filter((t) => t.retornoLiquido < 0)

  const ordenado = (lista, campo) => lista.map((t) => t[campo]).sort((a, b) => a - b)

  return {
    pontos: concluidas.map((t) => ({
      adversa: t.excursaoAdversa,
      favoravel: t.excursaoFavoravel,
      resultado: t.retornoLiquido,
      indiceEntrada: t.indiceEntrada,
    })),
    vencedoras: vencedoras.length,
    perdedoras: perdedoras.length,
    // Até quanto as vencedoras recuaram, no percentil 80.
    adversaVencedoras: quantil(ordenado(vencedoras, 'excursaoAdversa'), FRACAO_VENCEDORAS_EXCURSAO),
    // Quanto as perdedoras chegaram a andar a favor antes de virar, na mediana.
    favoravelPerdedoras: quantil(ordenado(perdedoras, 'excursaoFavoravel'), 0.5),
  }
}

const HORA_MS = 3600000

// Mês em UTC, e não no fuso de quem olha: o mesmo candle tem de cair no mesmo
// mês para todo mundo, e os testes precisam de um resultado que não dependa da
// máquina em que rodam. A diferença para o horário de Brasília são as três
// últimas horas de cada mês.
const mesDe = (instante) => {
  if (!instante) return null
  const d = new Date(instante)
  const t = d.getTime()
  if (!Number.isFinite(t)) return null
  return { ano: d.getUTCFullYear(), mes: d.getUTCMonth(), t }
}

/**
 * Resultado da estratégia e do buy & hold, mês a mês.
 *
 * Um número de 180 dias esconde de onde ele veio. "Superou o buy & hold em 4 de
 * 6 meses" e "perdeu em 5 e ganhou tudo num mês" produzem o mesmo alfa, e são
 * estratégias completamente diferentes — a segunda descreve aquele mês, não uma
 * regra.
 *
 * Cada mês começa onde o anterior terminou, no capital e no preço: o produto
 * dos meses recompõe o total, e a soma das partes não discute com o card.
 *
 * Mês sem nenhuma operação conta: ficar de fora é uma decisão da regra, e num
 * mês de queda ela é justamente o que a faz superar o buy & hold.
 *
 * @param {Array<object>} curva - `resultado.curva`.
 * @param {Array<object>} trades - Contadas no mês em que FECHARAM.
 * @param {number} capitalInicial
 * @returns {{
 *   meses: Array<{ano: number, mes: number, estrategia: number, buyAndHold: number|null,
 *     diferenca: number|null, operacoes: number, parcial: boolean}>,
 *   vencidos: number, comparaveis: number
 * }|null}
 */
export const resultadoPorMes = (curva, trades, capitalInicial) => {
  if (!Array.isArray(curva) || curva.length === 0) return null
  if (!(capitalInicial > 0)) return null

  const meses = []
  let atual = null
  let capitalReferencia = capitalInicial
  let precoReferencia = null

  const encerrar = (m) => {
    m.estrategia = (m.capitalFim / m.capitalInicio - 1) * 100
    m.buyAndHold =
      m.precoInicio !== null && m.precoFim !== null
        ? (m.precoFim / m.precoInicio - 1) * 100
        : null
    m.diferenca = m.buyAndHold !== null ? m.estrategia - m.buyAndHold : null
    capitalReferencia = m.capitalFim
    precoReferencia = m.precoFim ?? precoReferencia
  }

  curva.forEach((ponto) => {
    const quando = mesDe(ponto?.instante)
    if (!quando) return
    const preco = paraNumero(ponto?.precoFechamento)
    const capital = paraNumero(ponto?.capital)
    if (capital === null) return

    // A régua de preço do primeiro mês é o primeiro fechamento da curva — o
    // mesmo preço-base do buy & hold do card.
    if (precoReferencia === null && preco !== null && preco > 0) precoReferencia = preco

    if (!atual || atual.ano !== quando.ano || atual.mes !== quando.mes) {
      if (atual) encerrar(atual)
      atual = {
        ano: quando.ano,
        mes: quando.mes,
        capitalInicio: capitalReferencia,
        precoInicio: precoReferencia,
        capitalFim: capital,
        precoFim: preco !== null && preco > 0 ? preco : null,
        primeiro: quando.t,
        ultimo: quando.t,
        operacoes: 0,
      }
      meses.push(atual)
    }
    atual.capitalFim = capital
    if (preco !== null && preco > 0) atual.precoFim = preco
    atual.ultimo = quando.t
  })
  if (!atual) return null
  encerrar(atual)

  concluidasDe(trades).forEach((t) => {
    const quando = mesDe(t.instanteSaida)
    if (!quando) return
    const m = meses.find((x) => x.ano === quando.ano && x.mes === quando.mes)
    if (m) m.operacoes++
  })

  let vencidos = 0
  let comparaveis = 0
  const saida = meses.map((m) => {
    // Parcial: a curva cobre menos de 90% das horas do mês. Acontece no
    // primeiro e no último mês da janela, que quase nunca começam no dia 1 à
    // meia-noite — e um mês de nove dias não se compara com um de trinta.
    const inicioMes = Date.UTC(m.ano, m.mes, 1)
    const fimMes = Date.UTC(m.ano, m.mes + 1, 1)
    const cobertura = (m.ultimo - m.primeiro + HORA_MS) / (fimMes - inicioMes)
    if (m.diferenca !== null) {
      comparaveis++
      if (m.diferenca > 0) vencidos++
    }
    return {
      ano: m.ano,
      mes: m.mes,
      estrategia: m.estrategia,
      buyAndHold: m.buyAndHold,
      diferenca: m.diferenca,
      operacoes: m.operacoes,
      parcial: cobertura < 0.9,
    }
  })

  return { meses: saida, vencidos, comparaveis }
}

/**
 * Distância do pico, candle a candle, da estratégia e do buy & hold.
 *
 * O card de drawdown diz o tamanho do PIOR momento e nada sobre quanto tempo
 * ele durou nem quantas vezes aconteceu. Uma queda de 12% que se recupera em
 * dois dias e uma que fica submersa por três meses aparecem como o mesmo
 * número — e só a segunda é a que faz alguém desistir da estratégia.
 *
 * O buy & hold vem junto pelo mesmo motivo que vem na curva de capital: sem a
 * régua, "ficou 8% abaixo do pico" não diz se isso é muito para aquele ativo.
 *
 * @param {Array<object>} curva
 * @returns {{estrategia: Array<number|null>, buyAndHold: Array<number|null>}|null}
 *   - Em %, sempre ≤ 0.
 */
export const serieSubmersa = (curva) => {
  if (!Array.isArray(curva) || curva.length === 0) return null

  let picoEstrategia = -Infinity
  let picoPreco = -Infinity

  const estrategia = curva.map((p) => {
    const v = paraNumero(p?.capital)
    if (v === null) return null
    if (v > picoEstrategia) picoEstrategia = v
    return picoEstrategia > 0 ? (v / picoEstrategia - 1) * 100 : null
  })

  const buyAndHold = curva.map((p) => {
    const v = paraNumero(p?.precoFechamento)
    if (v === null || v <= 0) return null
    if (v > picoPreco) picoPreco = v
    return (v / picoPreco - 1) * 100
  })

  return { estrategia, buyAndHold }
}
