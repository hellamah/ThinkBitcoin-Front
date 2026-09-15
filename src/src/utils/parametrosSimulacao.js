// Parâmetros da simulação: padrão, saneamento e ida e volta pela URL.
//
// Estavam soltos no Dashboard, num useState com o objeto literal. Com a
// estratégia indo para a URL — para poder ser compartilhada e sobreviver a um
// recarregamento —, passam a ter três leitores: o estado inicial, a URL e o
// diário de configurações. Três leitores de um formato sem dono é como os
// valores divergem, então o formato ganhou um arquivo.
//
// Tudo que entra por aqui é SANEADO. A URL é texto que qualquer um edita, e o
// diário vem do localStorage de versões anteriores da tela; um `saidaPorTempo`
// de 7, que nenhum botão oferece, ou um stop de "-3" não podem chegar ao motor.

import { paraNumero } from './mathUtils'
import { CUSTO_PADRAO_PERCENTUAL } from './backtest'
import { StopMode, TradeDirection, TrendFilter } from './enums'

// Quantos candles segurar. Três opções em vez de campo livre: o número aqui não
// é ajuste fino, é a escala do que está sendo testado — intrabarra, algumas
// horas ou um dia inteiro na cadência horária. null é "sem limite de tempo",
// que só faz sentido com outra regra de saída.
export const HORIZONTES_SIMULACAO = [1, 3, 5, 24]

export const PARAMETROS_PADRAO = Object.freeze({
  // null: o painel cai no primeiro sinal disponível da janela.
  sinalEntrada: null,
  direcao: TradeDirection.COMPRA,
  saidaPorTempo: 5,
  modoStop: StopMode.PERCENTUAL,
  stopPercentual: null,
  alvoPercentual: null,
  custoPercentual: CUSTO_PADRAO_PERCENTUAL,
  sinalSaida: null,
  filtroTendencia: null,
  sinalConfirmacao: null,
  riscoPorOperacao: null,
})

const MODOS_STOP = Object.values(StopMode)
const FILTROS = Object.values(TrendFilter)

// Chave de sinal: letras, sem espaço. O vocabulário é camelCase, e qualquer
// outra coisa vinda da URL é lixo — não um sinal que o painel não conhece.
const ehChaveDeSinal = (v) => typeof v === 'string' && /^[A-Za-z]{1,40}$/.test(v)

const positivoOuNulo = (v) => {
  const n = paraNumero(v)
  return n !== null && n > 0 ? n : null
}

/**
 * Parâmetros válidos a partir de qualquer objeto parecido.
 *
 * Campo ausente cai no padrão; campo presente e inválido também. A exceção é o
 * que o próprio padrão permite ser null (stop, alvo, tempo, sinais, filtro,
 * risco): null explícito é uma escolha e é mantido.
 *
 * @param {object} [bruto]
 * @returns {object} - Sempre completo.
 */
export const sanearParametros = (bruto = {}) => {
  const b = bruto && typeof bruto === 'object' ? bruto : {}
  const custo = paraNumero(b.custoPercentual)

  return {
    sinalEntrada: ehChaveDeSinal(b.sinalEntrada) ? b.sinalEntrada : null,
    direcao: b.direcao === TradeDirection.VENDA ? TradeDirection.VENDA : TradeDirection.COMPRA,
    saidaPorTempo:
      b.saidaPorTempo === null
        ? null
        : HORIZONTES_SIMULACAO.includes(b.saidaPorTempo)
          ? b.saidaPorTempo
          : PARAMETROS_PADRAO.saidaPorTempo,
    modoStop: MODOS_STOP.includes(b.modoStop) ? b.modoStop : PARAMETROS_PADRAO.modoStop,
    stopPercentual: positivoOuNulo(b.stopPercentual),
    alvoPercentual: positivoOuNulo(b.alvoPercentual),
    // Custo zero é legítimo (é o cenário "sem taxa"); negativo não é.
    custoPercentual: custo !== null && custo >= 0 ? custo : PARAMETROS_PADRAO.custoPercentual,
    sinalSaida: ehChaveDeSinal(b.sinalSaida) ? b.sinalSaida : null,
    filtroTendencia: FILTROS.includes(b.filtroTendencia) ? b.filtroTendencia : null,
    sinalConfirmacao: ehChaveDeSinal(b.sinalConfirmacao) ? b.sinalConfirmacao : null,
    riscoPorOperacao: positivoOuNulo(b.riscoPorOperacao),
  }
}

// ---------------------------------------------------------------------------
// URL
// ---------------------------------------------------------------------------
// Prefixo `sim.` para não disputar nome com o `moeda` que o dashboard já lê, e
// para quem olha a URL saber de qual painel são esses campos. Nomes por
// extenso: a URL é o formato em que alguém manda a estratégia para outra
// pessoa, e "sim.segurar=24" se lê sem manual.
const CHAVES_URL = Object.freeze({
  sinalEntrada: 'sim.sinal',
  direcao: 'sim.direcao',
  saidaPorTempo: 'sim.segurar',
  modoStop: 'sim.modoStop',
  stopPercentual: 'sim.stop',
  alvoPercentual: 'sim.alvo',
  custoPercentual: 'sim.custo',
  sinalSaida: 'sim.saida',
  filtroTendencia: 'sim.tendencia',
  sinalConfirmacao: 'sim.confirmacao',
  riscoPorOperacao: 'sim.risco',
})

// A direção é o multiplicador do retorno no motor (1 / -1); na URL, palavra.
const DIRECAO_URL = { [TradeDirection.COMPRA]: 'compra', [TradeDirection.VENDA]: 'venda' }
// "Sem limite de tempo" precisa de uma grafia: campo ausente já quer dizer
// "padrão", que é 5 candles.
const SEM_LIMITE_URL = 'sem'

/**
 * Parâmetros a partir da query string.
 *
 * @param {URLSearchParams} params
 * @returns {object} - Saneado e completo.
 */
export const lerParametrosDaUrl = (params) => {
  if (!params || typeof params.get !== 'function') return sanearParametros()

  const bruto = {}
  Object.entries(CHAVES_URL).forEach(([campo, chave]) => {
    const valor = params.get(chave)
    if (valor === null) return
    if (campo === 'direcao') {
      bruto.direcao = valor === DIRECAO_URL[TradeDirection.VENDA] ? TradeDirection.VENDA : TradeDirection.COMPRA
    } else if (campo === 'saidaPorTempo') {
      bruto.saidaPorTempo = valor === SEM_LIMITE_URL ? null : Number(valor)
    } else if (['stopPercentual', 'alvoPercentual', 'custoPercentual', 'riscoPorOperacao'].includes(campo)) {
      bruto[campo] = Number(valor)
    } else {
      bruto[campo] = valor
    }
  })
  return sanearParametros(bruto)
}

/**
 * Query string com os parâmetros da simulação, preservando o resto.
 *
 * Só escreve o que difere do padrão. Uma visita comum ao dashboard não ganha
 * onze campos na URL, e a URL compartilhada carrega só o que a pessoa mudou —
 * que é também o que interessa a quem a recebe.
 *
 * @param {URLSearchParams|string} atuais - Query string de hoje.
 * @param {object} parametros
 * @returns {URLSearchParams} - Nova instância; `atuais` não é alterado.
 */
export const escreverParametrosNaUrl = (atuais, parametros) => {
  const saida = new URLSearchParams(atuais)
  const p = sanearParametros(parametros)

  Object.entries(CHAVES_URL).forEach(([campo, chave]) => {
    const valor = p[campo]
    if (valor === PARAMETROS_PADRAO[campo]) {
      saida.delete(chave)
      return
    }
    if (campo === 'direcao') saida.set(chave, DIRECAO_URL[valor])
    else if (campo === 'saidaPorTempo') saida.set(chave, valor === null ? SEM_LIMITE_URL : String(valor))
    else if (valor === null) saida.delete(chave)
    else saida.set(chave, String(valor))
  })

  return saida
}

/**
 * Identidade de uma configuração, para contar tentativas e reconhecer uma
 * configuração já guardada no diário.
 *
 * Fica de fora o CUSTO: ele é hipótese sobre o mundo, não grau de liberdade da
 * regra. Trocar a taxa não é testar outra estratégia — é perguntar quanto a
 * mesma aguenta, que o custo de equilíbrio já responde. E fica de fora o stop
 * percentual quando o modo é ATR, porque nesse modo o campo nem aparece e o
 * valor que sobrou nele não manda em nada.
 *
 * @param {object} parametros
 * @returns {string}
 */
export const impressaoDaConfiguracao = (parametros) => {
  const p = sanearParametros(parametros)
  return JSON.stringify([
    p.sinalEntrada,
    p.direcao,
    p.saidaPorTempo,
    p.modoStop,
    p.modoStop === StopMode.PERCENTUAL ? p.stopPercentual : null,
    p.alvoPercentual,
    p.sinalSaida,
    p.filtroTendencia,
    p.sinalConfirmacao,
    p.riscoPorOperacao,
  ])
}
