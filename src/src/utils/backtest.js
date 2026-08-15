// Simulação de estratégia baseada em regras sobre a série já carregada.
//
// O laboratório de sinais responde "o que costuma acontecer depois deste
// sinal?". Ele mede cada ocorrência isolada, e as janelas se sobrepõem. Aqui a
// pergunta é outra: "e se eu tivesse operado isso?" — o que exige estado
// sequencial, uma posição por vez, capital e custo.
//
// Três decisões definem se o número que sai daqui é honesto:
//
// 1. A entrada acontece na ABERTURA do candle seguinte ao do sinal. Entrar no
//    fechamento do próprio candle que gerou o sinal é comprar a um preço que só
//    é conhecido depois do evento — o erro que faz qualquer estratégia parecer
//    boa.
// 2. Quando o candle toca stop e alvo, o stop ganha. O OHLC não registra a
//    ordem dentro da barra; supor o alvo primeiro é escolher a versão
//    otimista de um dado que não existe.
// 3. Custo nas duas pernas, sempre contra o operador. Sem isso, estratégia de
//    horizonte curto em candle horário parece lucrativa por construção.
//
// Não há requisição aqui: é aritmética sobre o array que o dashboard já tem.

import { intervaloWilson, median, paraNumero } from './mathUtils'
import { calcularAtrSerie } from './marketStats'
import { montarSerieDeSinais } from './signalLab'
import { ExitReason, StopMode, TradeDirection } from './enums'

// Multiplicador e limites do stop por ATR. Copiados do ambiente de simulação do
// backend (`dynamic_stop_pct = max(0.01, min(0.10, atr_pct * 2.0))`), para que
// as duas ferramentas não dimensionem a mesma proteção de formas diferentes.
//
// Os limites não são detalhe: sem o piso, um período de calmaria produziria um
// stop de 0,1% que qualquer oscilação normal derruba; sem o teto, um candle de
// pânico produziria um stop de 40% que não protege de nada.
export const ATR_MULTIPLICADOR_STOP = 2
export const ATR_STOP_MINIMO_PERCENTUAL = 1
export const ATR_STOP_MAXIMO_PERCENTUAL = 10

/**
 * Distância do stop, em %, a partir do ATR daquele candle.
 *
 * @param {number|null} atr - ATR absoluto na posição da entrada.
 * @param {number} preco - Preço de entrada, para converter o ATR em percentual.
 * @returns {number|null} - null quando não há ATR ainda (início da série).
 */
export const stopPorAtr = (atr, preco) => {
  if (atr === null || !Number.isFinite(atr) || atr <= 0) return null
  if (!Number.isFinite(preco) || preco <= 0) return null
  const atrPercentual = (atr / preco) * 100
  return Math.max(
    ATR_STOP_MINIMO_PERCENTUAL,
    Math.min(ATR_STOP_MAXIMO_PERCENTUAL, atrPercentual * ATR_MULTIPLICADOR_STOP)
  )
}

// Taxa por perna, em %. Espelha o `fee_rate = 0.001` do ambiente de simulação
// do backend, que por sua vez é a taxa taker de spot.
export const CUSTO_PADRAO_PERCENTUAL = 0.1

// Capital inicial. Mesmo valor do `initial_cash` da avaliação out-of-sample do
// backend, para que as duas leituras sejam comparáveis.
export const CAPITAL_PADRAO = 1000

// Quantos múltiplos da cadência mediana ainda contam como série contínua. 1,5
// absorve o desencontro normal entre candles sem deixar passar uma hora
// inteira ausente.
export const FATOR_TOLERANCIA_BURACO = 1.5

// Abaixo disto as métricas existem mas não sustentam conclusão. Mesmo espírito
// do laboratório de sinais, que esmaece a linha sem intervalo conclusivo.
export const MINIMO_TRADES_CONCLUSIVO = 20

// Quanto da janela fica reservado para validação. Mesma fração da avaliação
// out-of-sample do backend, para que as duas telas signifiquem o mesmo por
// "fora da amostra".
export const FRACAO_VALIDACAO_PADRAO = 0.2

/**
 * Separa a janela em uma parte para ajustar e outra para validar.
 *
 * O problema que isto resolve: quem testa quinze combinações de sinal, stop e
 * horizonte na mesma janela e fica com a melhor não descobriu uma estratégia —
 * descobriu qual combinação se encaixou naquele pedaço de passado. A melhor
 * parece boa PORQUE foi escolhida depois de ver o resultado. Sem separar, a
 * ferramenta ajuda o usuário a se enganar com aparência de rigor.
 *
 * A parte de validação é a MAIS RECENTE. Reservar o passado e validar no que
 * veio antes inverteria a seta do tempo: o ajuste enxergaria o futuro da
 * validação.
 *
 * As duas séries devolvidas são usadas de formas diferentes, de propósito:
 *
 * - `registrosAjuste` é a série **cortada**: a validação não existe ali, nem
 *   como aquecimento. É o que o usuário manipula.
 * - `registrosValidacao` é a série **inteira**, acompanhada de
 *   `aPartirDeValidacao`. Assim os indicadores de janela móvel chegam aquecidos
 *   ao corte — desperdiçar os primeiros 20 candles da validação com RSI frio
 *   seria trocar um viés por outro.
 *
 * A fração é medida sobre a JANELA ESCOLHIDA, não sobre o array inteiro. Os
 * candles de aquecimento que vêm antes de `aPartirDe` não são período de
 * análise — são combustível de indicador. Contá-los inflaria a validação: numa
 * janela de 7 dias com 3 de aquecimento, 20% do array são 28% do que o usuário
 * de fato escolheu.
 *
 * @param {Array<object>} registros - Série na ordem da API (mais recente primeiro).
 * @param {number} [fracao] - Fração reservada para validação, em (0, 1).
 * @param {{aPartirDe?: string|number|null}} [opcoes] - Início da janela. Sem
 *   ele, a série inteira conta como janela.
 * @returns {{
 *   registrosAjuste: Array<object>,
 *   registrosValidacao: Array<object>,
 *   aPartirDeValidacao: string,
 *   candlesAjuste: number,
 *   candlesValidacao: number
 * }|null} - null quando algum dos lados ficaria curto demais para simular.
 */
export const dividirParaValidacao = (
  registros,
  fracao = FRACAO_VALIDACAO_PADRAO,
  { aPartirDe = null } = {}
) => {
  if (!Array.isArray(registros)) return null
  if (!(fracao > 0) || !(fracao < 1)) return null

  const total = registros.length

  const limite = aPartirDe !== null ? new Date(aPartirDe).getTime() : null
  const naJanela =
    limite !== null && Number.isFinite(limite)
      ? registros.filter((r) => {
          const t = instanteDe(r)
          return t !== null && t >= limite
        }).length
      : total

  const tamanhoValidacao = Math.floor(naJanela * fracao)

  // Dois candles é o mínimo do motor: um para o sinal, outro para a entrada.
  // Abaixo disso, de qualquer lado, o corte não produz duas simulações — só
  // uma simulação e um erro.
  if (tamanhoValidacao < 2 || total - tamanhoValidacao < 2) return null

  // A série chega do mais recente para o mais antigo, então a validação é o
  // COMEÇO do array. O candle mais antigo dela é o último desse trecho.
  const validacao = registros.slice(0, tamanhoValidacao)
  const maisAntigoDaValidacao = validacao[validacao.length - 1]

  const aPartirDeValidacao =
    maisAntigoDaValidacao?.horaReferencia ??
    maisAntigoDaValidacao?.HoraReferencia ??
    maisAntigoDaValidacao?.dataHora ??
    maisAntigoDaValidacao?.DataHora ??
    null

  if (!aPartirDeValidacao) return null

  return {
    registrosAjuste: registros.slice(tamanhoValidacao),
    registrosValidacao: registros,
    aPartirDeValidacao,
    candlesAjuste: total - tamanhoValidacao,
    candlesValidacao: tamanhoValidacao,
  }
}

const instanteDe = (registro) => {
  const bruto =
    registro?.horaReferencia ??
    registro?.HoraReferencia ??
    registro?.dataHora ??
    registro?.DataHora
  if (!bruto) return null
  const t = new Date(bruto).getTime()
  return Number.isFinite(t) ? t : null
}

/**
 * Um candle só entra na simulação se descrever negociação de verdade.
 *
 * Mesma régua do repositório de mercado do backend (preço > 0 e volume > 0),
 * acrescida da máxima e da mínima, que aqui não são enfeite: são a única fonte
 * sobre o que o preço tocou DENTRO da barra, e sem elas stop e alvo não podem
 * ser avaliados.
 */
const candleUtilizavel = (registro) => {
  const fechamento = paraNumero(registro?.precoFechamento)
  const volume = paraNumero(registro?.precoVolume)
  const maior = paraNumero(registro?.precoMaior)
  const menor = paraNumero(registro?.precoMenor)
  return (
    fechamento !== null && fechamento > 0 &&
    volume !== null && volume > 0 &&
    maior !== null && maior > 0 &&
    menor !== null && menor > 0
  )
}

// A abertura é o preço de entrada. Sem ela não há entrada possível — e ela vem
// direto da Binance, não é derivada.
const aberturaDe = (registro) => {
  const v = paraNumero(registro?.precoAbertura)
  return v !== null && v > 0 ? v : null
}

/**
 * Cadência da série, pela mediana dos intervalos entre candles consecutivos.
 *
 * Mediana e não média: um único buraco de 12 horas puxaria a média e a régua
 * passaria a tolerar exatamente aquilo que deveria acusar.
 */
const cadenciaDe = (instantes) => {
  const intervalos = []
  for (let i = 1; i < instantes.length; i++) {
    const a = instantes[i - 1]
    const b = instantes[i]
    if (a === null || b === null) continue
    const d = b - a
    if (d > 0) intervalos.push(d)
  }
  return median(intervalos)
}

/**
 * Retorno líquido de um trade, em %.
 *
 * O custo é aplicado como deslocamento do preço, e sempre contra o operador:
 * comprado, entra mais caro e sai mais barato; vendido, o contrário. Escrever
 * assim evita um ramo `if` para cada lado — e ramo duplicado neste cálculo é
 * exatamente onde um erro de sinal passaria despercebido.
 */
const retornoLiquidoDe = (entrada, saida, direcao, custoPercentual) => {
  const c = custoPercentual / 100
  const entradaEfetiva = entrada * (1 + direcao * c)
  const saidaEfetiva = saida * (1 - direcao * c)
  if (!(entradaEfetiva > 0)) return null
  return (direcao * (saidaEfetiva - entradaEfetiva) / entradaEfetiva) * 100
}

const retornoBrutoDe = (entrada, saida, direcao) =>
  (direcao * (saida - entrada) / entrada) * 100

/**
 * Simula uma estratégia de regra única sobre a série carregada.
 *
 * @param {Array<object>} registros - Série na ordem da API (mais recente
 *   primeiro, ordemAsc=false).
 * @param {object} opcoes
 * @param {string} opcoes.sinalEntrada - Chave do vocabulário de `signalLab`.
 * @param {number} [opcoes.direcao] - `TradeDirection`. Padrão: compra.
 * @param {number|null} [opcoes.saidaPorTempo] - Quantos candles segurar. É
 *   contagem de candles SEGURADOS, não o horizonte fechamento-a-fechamento do
 *   laboratório de sinais: segurar 1 candle é entrar na abertura e sair no
 *   fechamento do mesmo candle. null desliga a saída por tempo.
 * @param {number|null} [opcoes.stopPercentual] - Distância do stop, em %.
 * @param {number|null} [opcoes.alvoPercentual] - Distância do alvo, em %.
 * @param {number} [opcoes.custoPercentual] - Custo por perna, em %.
 * @param {number} [opcoes.capitalInicial]
 * @param {string|number|null} [opcoes.aPartirDe] - Instante a partir do qual é
 *   permitido ABRIR posição. Os candles anteriores continuam alimentando os
 *   indicadores de janela móvel — é para isso que a margem de aquecimento
 *   existe — mas não geram operação.
 * @param {number|null} [opcoes.toleranciaBuracoMs] - Acima disto, o salto entre
 *   dois candles é buraco. Padrão: cadência mediana × 1,5.
 * @returns {object|null} - null sem série utilizável.
 */
export const simular = (registros, opcoes = {}) => {
  const {
    sinalEntrada,
    direcao = TradeDirection.COMPRA,
    saidaPorTempo = 5,
    modoStop = StopMode.PERCENTUAL,
    stopPercentual = null,
    alvoPercentual = null,
    custoPercentual = CUSTO_PADRAO_PERCENTUAL,
    capitalInicial = CAPITAL_PADRAO,
    aPartirDe = null,
    toleranciaBuracoMs = null,
    // Série de sinais já montada, para quem vai simular a MESMA série várias
    // vezes. Comparar 14 estratégias recalcularia RSI, Bollinger, VWAP e
    // divergências 14 vezes sobre os mesmos candles — trabalho idêntico e
    // jogado fora. Omitido, o motor monta a sua.
    serieDeSinais = null,
  } = opcoes

  if (!Array.isArray(registros) || registros.length < 2) return null
  if (!sinalEntrada) return null
  if (direcao !== TradeDirection.COMPRA && direcao !== TradeDirection.VENDA) return null
  if (saidaPorTempo !== null && (!Number.isInteger(saidaPorTempo) || saidaPorTempo < 1)) return null
  // Sem nenhuma regra de saída a posição nunca fecha e a simulação não descreve
  // estratégia nenhuma — só a primeira entrada segurada até o fim da janela.
  const stopPorVolatilidade = modoStop === StopMode.ATR
  // No modo ATR o stop existe sempre, então ele já é regra de saída suficiente.
  if (
    saidaPorTempo === null &&
    !stopPorVolatilidade &&
    stopPercentual === null &&
    alvoPercentual === null
  ) return null
  if (!(capitalInicial > 0)) return null

  // A série recebida precisa descrever ESTES registros: ela é indexada por
  // posição, e uma série de outro array alinharia sinais com candles errados.
  const serie =
    Array.isArray(serieDeSinais) && serieDeSinais.length === registros.length
      ? serieDeSinais
      : montarSerieDeSinais(registros)

  // Alinhado com `serie` posição a posição — é o que permite ler a volatilidade
  // como ela era no candle da entrada, e não como está hoje.
  const atrPorPosicao = stopPorVolatilidade ? calcularAtrSerie(registros) : null
  if (serie.length < 2) return null

  const instantes = serie.map((s) => instanteDe(s.registro))
  const cadencia = cadenciaDe(instantes)
  const tolerancia =
    toleranciaBuracoMs ??
    (cadencia !== null ? cadencia * FATOR_TOLERANCIA_BURACO : null)

  // Um candle é "quebra" quando o salto desde o anterior passa da tolerância,
  // ou quando ele próprio não descreve negociação utilizável.
  const quebraEm = serie.map((s, i) => {
    if (!candleUtilizavel(s.registro)) return true
    if (i === 0 || tolerancia === null) return false
    const a = instantes[i - 1]
    const b = instantes[i]
    if (a === null || b === null) return true
    return b - a > tolerancia
  })

  const descontinuidades = []
  for (let i = 1; i < serie.length; i++) {
    if (!quebraEm[i]) continue
    const a = instantes[i - 1]
    const b = instantes[i]
    descontinuidades.push({
      de: serie[i - 1].registro?.horaReferencia ?? null,
      ate: serie[i].registro?.horaReferencia ?? null,
      horasFaltando: a !== null && b !== null ? (b - a) / 3600000 : null,
    })
  }

  const limiteAbertura = aPartirDe !== null ? new Date(aPartirDe).getTime() : null
  const podeAbrirEm = (i) => {
    if (limiteAbertura === null || !Number.isFinite(limiteAbertura)) return true
    const t = instantes[i]
    return t !== null && t >= limiteAbertura
  }

  // A curva cobre a janela que o usuário escolheu, não a margem de aquecimento.
  const inicio = serie.findIndex((_, i) => podeAbrirEm(i))
  if (inicio < 0 || inicio >= serie.length - 1) return null

  let capital = capitalInicial
  let posicao = null
  let entradaAgendada = false
  let candlesEmPosicao = 0

  const trades = []
  const curva = []

  const fechar = (i, precoSaida, motivo) => {
    const bruto = retornoBrutoDe(posicao.precoEntrada, precoSaida, direcao)
    const liquido = retornoLiquidoDe(posicao.precoEntrada, precoSaida, direcao, custoPercentual)
    if (liquido === null) {
      posicao = null
      return
    }
    const custoPago = (capital * (bruto - liquido)) / 100
    const capitalAntes = capital
    capital = capital * (1 + liquido / 100)

    trades.push({
      indiceEntrada: posicao.indice,
      instanteEntrada: posicao.registro?.horaReferencia ?? null,
      precoEntrada: posicao.precoEntrada,
      indiceSaida: i,
      instanteSaida: serie[i].registro?.horaReferencia ?? null,
      precoSaida,
      motivoSaida: motivo,
      retornoBruto: bruto,
      retornoLiquido: liquido,
      custoPago,
      capitalAntes,
      capitalDepois: capital,
      barrasSeguradas: i - posicao.indice + 1,
      // Qual distância valeu nesta operação. No modo ATR ela muda a cada
      // entrada, e sem este campo a tabela mostraria "Stop" como motivo sem
      // dizer stop de quanto.
      stopPercentualAplicado: posicao.stopPercentualAplicado,
    })
    posicao = null
  }

  for (let i = inicio; i < serie.length; i++) {
    const registro = serie[i].registro

    // Buraco fecha a posição no último preço conhecido: dentro dele não se sabe
    // o que o preço fez, e stop e alvo deixariam de significar qualquer coisa.
    if (posicao && quebraEm[i]) {
      const anterior = paraNumero(serie[i - 1].registro?.precoFechamento)
      if (anterior !== null && anterior > 0) {
        fechar(i - 1, anterior, ExitReason.DESCONTINUIDADE)
      } else {
        posicao = null
      }
      entradaAgendada = false
    }

    // Candle inutilizável não vira ponto de curva nem gera operação: repetir o
    // capital anterior ali seria desenhar uma linha reta onde não há medição.
    if (quebraEm[i] && !candleUtilizavel(registro)) {
      entradaAgendada = false
      continue
    }

    // 1. Entrada agendada no candle anterior executa AGORA, na abertura.
    if (entradaAgendada && !posicao) {
      const abertura = aberturaDe(registro)
      // Buraco entre o sinal e a execução invalida a entrada: o preço de
      // abertura já não é a continuação do candle que gerou o sinal.
      if (abertura !== null && !quebraEm[i]) {
        // No modo ATR a distância sai da volatilidade DESTE candle; no modo
        // percentual, do número que o usuário digitou. Sem ATR ainda — começo
        // da série, antes de a média fechar — a posição abre sem stop, e sai
        // pelo tempo ou pelo alvo. Inventar uma distância ali seria pior.
        const distanciaStop = stopPorVolatilidade
          ? stopPorAtr(atrPorPosicao?.[i] ?? null, abertura)
          : stopPercentual

        posicao = {
          indice: i,
          registro,
          precoEntrada: abertura,
          stopPercentualAplicado: distanciaStop,
          precoStop:
            distanciaStop !== null
              ? abertura * (1 - direcao * (distanciaStop / 100))
              : null,
          precoAlvo:
            alvoPercentual !== null
              ? abertura * (1 + direcao * (alvoPercentual / 100))
              : null,
        }
      }
    }
    entradaAgendada = false

    // 2. Saídas, avaliadas contra o range do candle corrente.
    if (posicao) {
      candlesEmPosicao++

      const maior = paraNumero(registro.precoMaior)
      const menor = paraNumero(registro.precoMenor)
      const fechamento = paraNumero(registro.precoFechamento)
      const comprado = direcao === TradeDirection.COMPRA

      const tocouStop =
        posicao.precoStop !== null &&
        (comprado ? menor <= posicao.precoStop : maior >= posicao.precoStop)
      const tocouAlvo =
        posicao.precoAlvo !== null &&
        (comprado ? maior >= posicao.precoAlvo : menor <= posicao.precoAlvo)

      if (tocouStop) {
        // Stop antes de alvo, sempre. Ver o cabeçalho deste arquivo.
        fechar(i, posicao.precoStop, ExitReason.STOP)
      } else if (tocouAlvo) {
        fechar(i, posicao.precoAlvo, ExitReason.ALVO)
      } else if (
        saidaPorTempo !== null &&
        i - posicao.indice >= saidaPorTempo - 1
      ) {
        fechar(i, fechamento, ExitReason.TEMPO)
      }
    }

    // 3. Sinal neste candle agenda entrada para a abertura do próximo.
    if (!posicao && i < serie.length - 1 && podeAbrirEm(i + 1)) {
      if (serie[i].sinais.includes(sinalEntrada)) entradaAgendada = true
    }

    // 4. Ponto da curva, marcado a mercado. Uma curva que só degrau nos
    //    fechamentos esconde o quanto a posição chegou a perder no meio — que é
    //    justamente o que o drawdown deveria medir.
    const fechamentoDoCandle = paraNumero(registro.precoFechamento)
    let capitalMarcado = capital
    if (posicao) {
      const naoRealizado =
        fechamentoDoCandle !== null
          ? retornoBrutoDe(posicao.precoEntrada, fechamentoDoCandle, direcao)
          : 0
      capitalMarcado = capital * (1 + naoRealizado / 100)
    }

    curva.push({
      instante: registro?.horaReferencia ?? null,
      capital: capitalMarcado,
      emPosicao: Boolean(posicao),
      // O fechamento viaja junto com o ponto para o gráfico poder desenhar o
      // buy & hold no MESMO eixo, sem precisar da série de candles de volta.
      // Sem ele, a régua que os cards exibem lado a lado com o retorno some
      // justamente do elemento que as pessoas de fato olham.
      precoFechamento: fechamentoDoCandle,
    })
  }

  // Posição aberta no fim da janela: fecha no último fechamento conhecido, mas
  // marcada — o desfecho não aconteceu.
  if (posicao) {
    const ultimo = serie.length - 1
    const fechamento = paraNumero(serie[ultimo].registro?.precoFechamento)
    if (fechamento !== null && fechamento > 0) {
      fechar(ultimo, fechamento, ExitReason.FIM_DA_SERIE)
      if (curva.length > 0) curva[curva.length - 1].capital = capital
    }
  }

  return {
    parametros: {
      sinalEntrada,
      direcao,
      saidaPorTempo,
      modoStop,
      stopPercentual,
      alvoPercentual,
      custoPercentual,
      capitalInicial,
      aPartirDe,
      cadenciaMs: cadencia,
      toleranciaBuracoMs: tolerancia,
    },
    trades,
    curva,
    descontinuidades,
    metricas: calcularMetricas({
      trades,
      curva,
      serie,
      inicio,
      capitalInicial,
      capitalFinal: capital,
      candlesEmPosicao,
    }),
  }
}

/**
 * Roda a MESMA regra de saída sobre todos os sinais de entrada disponíveis.
 *
 * O laboratório de sinais responde "este sinal desloca a probabilidade?". Esta
 * função responde a pergunta seguinte: "e operando cada um deles, com custo,
 * qual teria sobrado?". São coisas diferentes — um sinal pode deslocar a taxa
 * de alta e ainda assim perder dinheiro, porque a taxa não sabe do custo nem do
 * tamanho dos movimentos.
 *
 * A série de sinais é montada UMA vez e reaproveitada em todas as estratégias.
 * Sem isso, comparar catorze sinais recalcularia RSI, Bollinger, VWAP e
 * divergências catorze vezes sobre os mesmos candles.
 *
 * Cada linha traz o resultado na janela cheia e no trecho de validação. A
 * ordenação é pelo alfa da janela cheia — é o que tem mais operações e menos
 * ruído —, mas quem decide se a linha significa algo é a coluna de validação.
 *
 * **Sobre escolher a melhor:** testar N estratégias e ficar com a de cima é
 * sobreajuste por construção. Com catorze sinais a 95% de confiança, espera-se
 * que **menos de uma** pareça boa por puro acaso. Por isso a validação não é
 * enfeite da tela: é a única coluna que não foi usada para ordenar.
 *
 * @param {Array<object>} registros - Série na ordem da API.
 * @param {object} opcoes - As mesmas de `simular`, mais:
 * @param {Array<string>} [opcoes.sinais] - Chaves a testar. Omitido, testa
 *   todas as que ocorrem na série.
 * @param {number|null} [opcoes.fracaoValidacao] - null desliga o corte.
 * @param {Array<object>|null} [opcoes.serieDeSinais] - Série de sinais de
 *   `registros`, já montada. Quem chama isto normalmente já a tem em mãos para
 *   outra coisa, e remontá-la aqui é ~15 ms de trabalho idêntico.
 * @param {Array<object>|null} [opcoes.serieDeSinaisAjuste] - Idem para o trecho
 *   de ajuste. É outro array, então precisa da sua própria.
 * @returns {{linhas: Array<object>, buyAndHold: number|null}|null}
 */
export const compararEstrategias = (registros, opcoes = {}) => {
  const {
    sinais = null,
    fracaoValidacao = FRACAO_VALIDACAO_PADRAO,
    aPartirDe = null,
    serieDeSinais = null,
    serieDeSinaisAjuste = null,
    ...comuns
  } = opcoes

  if (!Array.isArray(registros) || registros.length < 2) return null

  // Mesma régua de `simular`: a série é indexada por posição, então uma série de
  // outro array alinharia sinais com candles errados. Não batendo o tamanho, o
  // certo é remontar, não confiar.
  //
  // Aqui a régua faz mais do que em `simular`: é desta série que sai o conjunto
  // de sinais PRESENTES, ou seja, quais estratégias entram na tabela. Uma série
  // alheia não produziria só números errados — produziria a lista errada.
  const serieCompleta =
    Array.isArray(serieDeSinais) && serieDeSinais.length === registros.length
      ? serieDeSinais
      : montarSerieDeSinais(registros)
  if (serieCompleta.length === 0) return null

  // Só os sinais que de fato ocorrem. Testar um sinal ausente devolveria uma
  // linha vazia que o usuário leria como "não presta", quando o certo é
  // "não aconteceu".
  const presentes = new Set()
  serieCompleta.forEach(({ sinais: doCandle }) => doCandle.forEach((s) => presentes.add(s)))

  const aTestar = (sinais ?? [...presentes]).filter((s) => presentes.has(s))
  if (aTestar.length === 0) return null

  const corte =
    fracaoValidacao !== null
      ? dividirParaValidacao(registros, fracaoValidacao, { aPartirDe })
      : null

  // A série do trecho de ajuste é outro array, então precisa da sua própria
  // montagem — mas também só de uma, compartilhada entre todas as estratégias.
  //
  // A conferência de tamanho aqui é de CUSTO, não de correção: `simular` já
  // recusa uma série que não descreva os registros que recebe, então passar uma
  // alheia não produziria número errado — produziria catorze remontagens em vez
  // de uma. Verificado por injeção: remover esta guarda não derruba teste
  // nenhum, e é por isso que ela está anotada em vez de afirmada.
  const serieAjuste = corte
    ? (Array.isArray(serieDeSinaisAjuste) &&
       serieDeSinaisAjuste.length === corte.registrosAjuste.length
        ? serieDeSinaisAjuste
        : montarSerieDeSinais(corte.registrosAjuste))
    : null

  const linhas = aTestar
    .map((sinalEntrada) => {
      const cheia = simular(registros, {
        ...comuns,
        sinalEntrada,
        aPartirDe,
        serieDeSinais: serieCompleta,
      })
      if (!cheia) return null

      const validacao = corte
        ? simular(corte.registrosValidacao, {
            ...comuns,
            sinalEntrada,
            aPartirDe: corte.aPartirDeValidacao,
            serieDeSinais: serieCompleta,
          })
        : null

      const ajuste = corte
        ? simular(corte.registrosAjuste, {
            ...comuns,
            sinalEntrada,
            aPartirDe,
            serieDeSinais: serieAjuste,
          })
        : null

      return {
        sinal: sinalEntrada,
        metricas: cheia.metricas,
        trades: cheia.trades.length,
        // null quando o corte não coube ou a estratégia não operou no trecho —
        // e "não operou" não é "rendeu zero".
        alfaValidacao:
          validacao && validacao.trades.length > 0 ? validacao.metricas.alfa : null,
        tradesValidacao: validacao ? validacao.metricas.tradesConcluidos : null,
        // O par que a tabela precisa mostrar é AJUSTE contra VALIDAÇÃO, e não
        // janela cheia contra validação: a janela cheia CONTÉM o trecho de
        // validação, então comparar as duas é comparar um número com um pedaço
        // dele mesmo. Ajuste e validação não se sobrepõem — a degradação entre
        // os dois é a única medida limpa de quanto o resultado sobrevive fora
        // da amostra.
        alfaAjuste: ajuste && ajuste.trades.length > 0 ? ajuste.metricas.alfa : null,
        tradesAjuste: ajuste ? ajuste.metricas.tradesConcluidos : null,
      }
    })
    .filter(Boolean)

  if (linhas.length === 0) return null

  // Maior alfa primeiro: a pergunta desta tabela é "qual sobrou melhor que não
  // fazer nada", e a resposta tem de estar na primeira linha.
  linhas.sort((a, b) => (b.metricas.alfa ?? -Infinity) - (a.metricas.alfa ?? -Infinity))

  return {
    linhas,
    // Igual para todas as linhas: é a mesma janela e o mesmo ativo. Fica fora
    // da linha para a tabela poder exibi-lo uma vez, como régua.
    buyAndHold: linhas[0]?.metricas?.buyAndHold ?? null,
    candlesValidacao: corte?.candlesValidacao ?? null,
  }
}

/**
 * Métricas da simulação.
 *
 * `calcularDesempenho` de marketStats não serve aqui: ela mede drawdown DO
 * PREÇO, lendo campos de candle. O que interessa nesta tela é o drawdown do
 * CAPITAL, que é outra série.
 */
const calcularMetricas = ({
  trades,
  curva,
  serie,
  inicio,
  capitalInicial,
  capitalFinal,
  candlesEmPosicao,
}) => {
  const retornoTotal = ((capitalFinal - capitalInicial) / capitalInicial) * 100

  // Maior queda a partir de um pico da curva de capital.
  let pico = curva.length > 0 ? curva[0].capital : capitalInicial
  let drawdownMaximo = 0
  curva.forEach(({ capital }) => {
    if (capital > pico) pico = capital
    const queda = pico > 0 ? ((capital - pico) / pico) * 100 : 0
    if (queda < drawdownMaximo) drawdownMaximo = queda
  })

  // Trade que a janela não viu terminar não é acerto nem erro.
  const concluidos = trades.filter((t) => t.motivoSaida !== ExitReason.FIM_DA_SERIE)
  const vitorias = concluidos.filter((t) => t.retornoLiquido > 0).length

  const ganhos = concluidos
    .filter((t) => t.retornoLiquido > 0)
    .reduce((a, t) => a + t.retornoLiquido, 0)
  const perdas = concluidos
    .filter((t) => t.retornoLiquido < 0)
    .reduce((a, t) => a + t.retornoLiquido, 0)

  const retornos = concluidos.map((t) => t.retornoLiquido)

  // Buy & hold sem custo, de propósito: é a régua mais alta, e uma ferramenta
  // de simulação erra para o lado de não bajular a estratégia. Mesma definição
  // usada na avaliação out-of-sample do backend.
  const primeiro = paraNumero(serie[inicio]?.registro?.precoFechamento)
  const ultimo = paraNumero(serie[serie.length - 1]?.registro?.precoFechamento)
  const buyAndHold =
    primeiro !== null && primeiro > 0 && ultimo !== null
      ? ((ultimo - primeiro) / primeiro) * 100
      : null

  return {
    retornoTotal,
    drawdownMaximo,
    totalTrades: trades.length,
    tradesConcluidos: concluidos.length,
    winRate: concluidos.length > 0 ? (vitorias / concluidos.length) * 100 : null,
    intervalo: intervaloWilson(vitorias, concluidos.length),
    // Infinito quando não houve perda alguma — que com amostra pequena é
    // rotina, não excelência. Fica null para a tela não exibir "∞" como mérito.
    profitFactor: perdas < 0 ? ganhos / Math.abs(perdas) : null,
    retornoMedio: retornos.length > 0 ? retornos.reduce((a, b) => a + b, 0) / retornos.length : null,
    melhorTrade: retornos.length > 0 ? Math.max(...retornos) : null,
    piorTrade: retornos.length > 0 ? Math.min(...retornos) : null,
    exposicao: curva.length > 0 ? (candlesEmPosicao / curva.length) * 100 : 0,
    custoTotal: trades.reduce((a, t) => a + t.custoPago, 0),
    buyAndHold,
    alfa: buyAndHold !== null ? retornoTotal - buyAndHold : null,
    candlesSimulados: curva.length,
    // A tela decide como mostrar; o motor só declara que a amostra é curta.
    amostraInsuficiente: concluidos.length < MINIMO_TRADES_CONCLUSIVO,
  }
}
