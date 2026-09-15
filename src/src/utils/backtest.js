// Simulação de estratégia baseada em regras sobre a série já carregada.
//
// O laboratório de sinais responde "o que costuma acontecer depois deste
// sinal?". Ele mede cada ocorrência isolada, e as janelas se sobrepõem. Aqui a
// pergunta é outra: "e se eu tivesse operado isso?" — o que exige estado
// sequencial, uma posição por vez, capital e custo.
//
// Cinco decisões definem se o número que sai daqui é honesto. Todas são a
// mesma pergunta feita em lugares diferentes: o motor está usando algum dado
// que o operador não teria no instante em que agiu?
//
// 1. A entrada acontece na ABERTURA do candle seguinte ao do sinal. Entrar no
//    fechamento do próprio candle que gerou o sinal é comprar a um preço que só
//    é conhecido depois do evento — o erro que faz qualquer estratégia parecer
//    boa. A saída por sinal segue a mesma regra.
// 2. Quando o candle toca stop e alvo, o stop ganha. O OHLC não registra a
//    ordem dentro da barra; supor o alvo primeiro é escolher a versão
//    otimista de um dado que não existe.
// 3. Custo nas duas pernas, sempre contra o operador. Sem isso, estratégia de
//    horizonte curto em candle horário parece lucrativa por construção.
// 4. O stop por volatilidade sai do ATR do último candle FECHADO. Ele saía do
//    ATR do candle da entrada, que inclui a amplitude desse candle — e a
//    entrada é na abertura dele, quando a amplitude ainda não existe. O erro
//    ia sempre para o mesmo lado: candle largo dava stop largo justamente
//    quando o stop largo salvava a operação.
// 5. Candle que ABRE além do stop sai na abertura, não no preço do stop. A
//    ordem de stop vira ordem a mercado quando é atingida, e se o preço já
//    começou o candle do outro lado, o primeiro preço disponível é a abertura.
//    Preencher no stop era vender a um preço pelo qual o mercado não passou —
//    e o erro, de novo, só ia para um lado. O alvo não recebe o tratamento
//    espelhado de propósito: uma abertura além do alvo daria preço MELHOR que
//    o alvo, e aqui o motor erra para o lado de não bajular.
//
// ---------------------------------------------------------------------------
// O que AINDA usa informação do período inteiro, e por quê
// ---------------------------------------------------------------------------
// Três sinais do vocabulário — volume atípico, variação atípica e ticket alto —
// e a normalização da divergência de fluxo saem do `calcularLimites`, que mede
// a régua de normalidade sobre a série INTEIRA. Um candle no começo da janela é
// classificado contra a mediana de candles que ainda não aconteceram.
//
// Para a EXIBIÇÃO isso é defensável, e é a escolha declarada lá: "atípico para
// este período" é uma afirmação descritiva legítima. Para a SIMULAÇÃO não é —
// no instante do trade, aquela mediana não existia.
//
// Fica registrado em vez de corrigido porque o tamanho foi medido e é pequeno:
// recalculando os sinais sem o futuro, 5 candles em 1440 mudam de classificação
// nos dados de demonstração (0,3%). Corrigir de verdade significa separar a
// régua de exibição da régua causal, e isso muda o laboratório de sinais junto.
// Quem for mexer nisso: o custo não é o cálculo, é a distinção. E quem for
// esticar a janela da simulação precisa mexer nisto ANTES — quanto mais longa a
// série, mais a mediana do período inteiro se afasta da que existia no começo.
//
// Não há requisição aqui: é aritmética sobre o array que o dashboard já tem.

import { intervaloWilson, median, paraNumero } from './mathUtils'
import { calcularAtrSerie } from './marketStats'
import { montarSerieDeSinais } from './signalLab'
import { ExitReason, StopMode, TradeDirection, TrendFilter } from './enums'
import {
  FRACAO_VALIDACAO_PADRAO,
  dividirParaValidacao,
  instanteDe,
} from './validacaoJanela'

// O corte de validação saiu daqui para o validacaoJanela.js quando o
// laboratório de sinais passou a precisar do mesmo: este módulo importa o
// signalLab, então o signalLab importar deste fecharia um ciclo. Reexportado
// para quem já o importava daqui — a tela e os testes — não ter de mudar de
// endereço por causa de uma reorganização interna.
export { FRACAO_VALIDACAO_PADRAO, dividirParaValidacao }

// Multiplicador e limites do stop por ATR. Copiados do ambiente de simulação do
// backend (`dynamic_stop_pct = max(0.01, min(0.10, atr_pct * 2.0))`), para que
// as duas ferramentas não dimensionem a mesma proteção de formas diferentes.
//
// Os limites não são detalhe: sem o piso, um período de calmaria produziria um
// stop de 0,1% que qualquer oscilação normal derruba; sem o teto, um candle de
// pânico produziria um stop de 40% que não protege de nada.
const ATR_MULTIPLICADOR_STOP = 2
export const ATR_STOP_MINIMO_PERCENTUAL = 1
export const ATR_STOP_MAXIMO_PERCENTUAL = 10

// Média móvel do filtro de tendência, em candles. 50 e não 200, embora os dois
// sejam padrões de literatura: a margem de aquecimento da janela é de 3 dias
// (72 candles horários), que cobre 50 mas não 200. Com 200, o filtro reprovaria
// toda entrada dos primeiros cinco dias da janela — não por tendência nenhuma,
// mas porque a média ainda não existia.
export const PERIODO_MEDIA_TENDENCIA = 50

// Quantos candles, contando o do próprio sinal, a confirmação pode ter
// acontecido antes. Um só exigiria coincidência exata no mesmo candle, que para
// sinais de natureza diferente (um padrão de candle e um cruzamento de VWAP) é
// raro a ponto de a regra quase nunca operar; muitos transformariam
// "confirmação" em "aconteceu algum dia desta semana".
export const JANELA_CONFIRMACAO = 3

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
const CAPITAL_PADRAO = 1000

// Quantos múltiplos da cadência mediana ainda contam como série contínua. 1,5
// absorve o desencontro normal entre candles sem deixar passar uma hora
// inteira ausente.
const FATOR_TOLERANCIA_BURACO = 1.5

// Abaixo disto as métricas existem mas não sustentam conclusão. Mesmo espírito
// do laboratório de sinais, que esmaece a linha sem intervalo conclusivo.
export const MINIMO_TRADES_CONCLUSIVO = 20

// Milissegundos num ano. Serve para anualizar risco a partir da cadência real da
// série, medida pelo motor, em vez de assumir "horário" numa constante. Se a
// coleta virar diária ou de 15 minutos, a conta acompanha sozinha.
const MS_POR_ANO = 365.25 * 24 * 60 * 60 * 1000

/**
 * Risco da curva de capital: Sharpe anualizado e volatilidade anualizada.
 *
 * O painel media retorno e drawdown e mais nada sobre risco. Duas estratégias
 * com o mesmo retorno e volatilidades muito diferentes liam idênticas, e a que
 * balança mais parecia tão boa quanto a outra.
 *
 * Medido sobre os retornos da CURVA, candle a candle — não sobre os retornos por
 * operação. É a diferença entre "o que o meu capital fez" e "como foram as
 * operações": os trechos sem posição fazem parte do primeiro e somem do segundo.
 *
 * **Taxa livre de risco tratada como zero.** A plataforma não tem uma, e inventar
 * um número seria pior que assumir o caso mais conservador para uma estratégia
 * comprada.
 *
 * **A ressalva que precisa acompanhar o número:** quem fica fora do mercado a
 * maior parte do tempo tem curva parada, e curva parada tem desvio pequeno — o
 * Sharpe sobe sem que a estratégia tenha ficado melhor. É por isso que a
 * exposição já é exibida no painel; os dois números se leem juntos.
 *
 * @param {Array<{capital: number}>} curva - Um ponto por candle.
 * @param {number|null} cadenciaMs - Intervalo mediano entre candles.
 * @returns {{sharpe: number|null, volatilidade: number|null}} - Volatilidade em
 *   % anualizada. Ambos null quando não há o que medir.
 */
export const riscoDaCurva = (curva, cadenciaMs) => {
  const vazio = { sharpe: null, volatilidade: null }
  if (!Array.isArray(curva) || curva.length < 3) return vazio
  if (!Number.isFinite(cadenciaMs) || cadenciaMs <= 0) return vazio

  const retornos = []
  for (let i = 1; i < curva.length; i++) {
    const anterior = paraNumero(curva[i - 1]?.capital)
    const atual = paraNumero(curva[i]?.capital)
    if (anterior === null || atual === null || anterior <= 0) continue
    retornos.push((atual - anterior) / anterior)
  }
  // Com menos de dois retornos não há dispersão para medir — um ponto sozinho
  // tem desvio zero por definição, não por ausência de risco.
  if (retornos.length < 2) return vazio

  const media = retornos.reduce((a, b) => a + b, 0) / retornos.length
  // Divisor n-1: estes retornos são uma amostra do que a estratégia faria, não
  // a população inteira dos retornos possíveis.
  const variancia =
    retornos.reduce((a, r) => a + (r - media) ** 2, 0) / (retornos.length - 1)
  const desvio = Math.sqrt(variancia)

  const periodosPorAno = MS_POR_ANO / cadenciaMs
  const volatilidade = desvio * Math.sqrt(periodosPorAno) * 100

  return {
    // Capital que nunca se moveu não tem risco medido. Dividir por zero daria
    // Infinity, que a tela leria como excelência — mesmo motivo pelo qual o
    // profit factor sai null quando não houve perda nenhuma.
    sharpe: desvio > 0 ? (media / desvio) * Math.sqrt(periodosPorAno) : null,
    volatilidade,
  }
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

// ---------------------------------------------------------------------------
// Preparo da série
// ---------------------------------------------------------------------------
// Tudo o que depende só dos candles — e de nenhum parâmetro — calculado uma vez
// por série de sinais e guardado junto dela.
//
// Enquanto a simulação rodava algumas dezenas de vezes por clique, refazer isto
// a cada chamada custava pouco. A régua aleatória roda a MESMA série centenas
// de vezes, e aí ler 4.300 carimbos de data, reconverter cada preço e remedir
// a cadência em toda chamada passa a ser a maior parte do trabalho — trabalho
// idêntico, jogado fora.
//
// A chave é o array da série de sinais, por identidade. É o mesmo contrato que
// o `serieDeSinais` já tinha: quem passa a série garante que ela descreve
// aqueles registros, e o motor confere o tamanho. Uma série nova é um preparo
// novo; o WeakMap solta o antigo quando ninguém mais segura a série.
const preparos = new WeakMap()

const prepararSerie = (serie) => {
  const existente = preparos.get(serie)
  if (existente) return existente

  const n = serie.length
  const instantes = new Array(n)
  const aberturas = new Array(n)
  const maiores = new Array(n)
  const menores = new Array(n)
  const fechamentos = new Array(n)
  const utilizavel = new Array(n)

  for (let i = 0; i < n; i++) {
    const registro = serie[i].registro
    instantes[i] = instanteDe(registro)
    aberturas[i] = aberturaDe(registro)
    maiores[i] = paraNumero(registro?.precoMaior)
    menores[i] = paraNumero(registro?.precoMenor)
    fechamentos[i] = paraNumero(registro?.precoFechamento)
    utilizavel[i] = candleUtilizavel(registro)
  }

  const preparo = {
    instantes,
    aberturas,
    maiores,
    menores,
    fechamentos,
    utilizavel,
    cadencia: cadenciaDe(instantes),
    // Os três abaixo dependem de um parâmetro (a tolerância, ou nenhum mas são
    // caros e nem toda simulação precisa deles) e nascem sob demanda.
    quebras: new Map(),
    atr: null,
    media: null,
    filtros: new Map(),
  }
  preparos.set(serie, preparo)
  return preparo
}

/**
 * Onde a série quebra, para uma tolerância de buraco.
 *
 * Um candle é "quebra" quando o salto desde o anterior passa da tolerância, ou
 * quando ele próprio não descreve negociação utilizável.
 */
const quebrasDaSerie = (preparo, serie, tolerancia) => {
  const chave = tolerancia ?? 'sem-tolerancia'
  const existente = preparo.quebras.get(chave)
  if (existente) return existente

  const { instantes, utilizavel } = preparo
  const quebraEm = instantes.map((b, i) => {
    if (!utilizavel[i]) return true
    if (i === 0 || tolerancia === null) return false
    const a = instantes[i - 1]
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

  const resultado = { quebraEm, descontinuidades }
  preparo.quebras.set(chave, resultado)
  return resultado
}

// Alinhado com `serie` posição a posição — é o que permite ler a volatilidade
// como ela era no candle da entrada, e não como está hoje.
const atrDaSerie = (preparo, registros) => {
  if (!preparo.atr) preparo.atr = calcularAtrSerie(registros)
  return preparo.atr
}

/**
 * Média móvel simples dos fechamentos, em ordem cronológica.
 *
 * Uma janela que contenha um fechamento ausente sai null, e não com a média dos
 * que sobraram: com um buraco dentro, a "média de 50" seria de 49, e o filtro
 * passaria a comparar o preço com uma régua diferente sem avisar.
 */
const mediaMovelDaSerie = (preparo) => {
  if (preparo.media) return preparo.media

  const { fechamentos } = preparo
  const periodo = PERIODO_MEDIA_TENDENCIA
  const saida = new Array(fechamentos.length).fill(null)
  let soma = 0
  let ausentes = 0

  for (let i = 0; i < fechamentos.length; i++) {
    const entra = fechamentos[i]
    if (entra === null) ausentes++
    else soma += entra

    if (i >= periodo) {
      const sai = fechamentos[i - periodo]
      if (sai === null) ausentes--
      else soma -= sai
    }

    if (i >= periodo - 1 && ausentes === 0) saida[i] = soma / periodo
  }

  preparo.media = saida
  return saida
}

/**
 * Em quais candles o filtro de entrada deixa a regra operar.
 *
 * Avaliado no candle do SINAL, com o que se sabe no fechamento dele — a entrada
 * é na abertura do seguinte, então nada aqui olha para depois do instante da
 * decisão.
 *
 * @returns {Uint8Array|null} - null quando não há filtro: "sem filtro" é
 *   ausência, não um filtro que sempre passa.
 */
const filtroDeEntrada = (preparo, serie, { filtroTendencia, sinalConfirmacao }) => {
  if (!filtroTendencia && !sinalConfirmacao) return null

  const chave = `${filtroTendencia ?? ''}|${sinalConfirmacao ?? ''}`
  const existente = preparo.filtros.get(chave)
  if (existente) return existente

  const { fechamentos } = preparo
  const media = filtroTendencia ? mediaMovelDaSerie(preparo) : null
  const passa = new Uint8Array(serie.length)
  let ultimaConfirmacao = -Infinity

  for (let i = 0; i < serie.length; i++) {
    if (sinalConfirmacao && serie[i].sinais.includes(sinalConfirmacao)) ultimaConfirmacao = i

    let ok = true
    if (filtroTendencia) {
      const m = media[i]
      const f = fechamentos[i]
      // Sem média ainda, o filtro reprova. Aprovar seria dizer "está em
      // tendência de alta" sobre um candle do qual não se sabe isso.
      ok = m !== null && f !== null &&
        (filtroTendencia === TrendFilter.ALTA ? f > m : f < m)
    }
    if (ok && sinalConfirmacao) ok = i - ultimaConfirmacao < JANELA_CONFIRMACAO

    passa[i] = ok ? 1 : 0
  }

  preparo.filtros.set(chave, passa)
  return passa
}

// Instante a partir do qual é permitido abrir posição. Os candles anteriores
// continuam alimentando os indicadores, mas não geram operação.
const limiteDeAbertura = (aPartirDe) => {
  if (aPartirDe === null || aPartirDe === undefined) return null
  const t = new Date(aPartirDe).getTime()
  return Number.isFinite(t) ? t : null
}

const podeAbrir = (instantes, limite, i) => {
  if (limite === null) return true
  const t = instantes[i]
  return t !== null && t >= limite
}

// A série de sinais a usar: a recebida, se descreve ESTES registros, ou uma
// nova. Ela é indexada por posição, e uma série de outro array alinharia sinais
// com candles errados.
const serieParaOsRegistros = (registros, serieDeSinais) =>
  Array.isArray(serieDeSinais) && serieDeSinais.length === registros.length
    ? serieDeSinais
    : montarSerieDeSinais(registros)

/**
 * Retorno líquido de um trade, em %.
 *
 * O custo é aplicado como deslocamento do preço, e sempre contra o operador:
 * comprado, entra mais caro e sai mais barato; vendido, o contrário. Escrever
 * assim evita um ramo `if` para cada lado — e ramo duplicado neste cálculo é
 * exatamente onde um erro de sinal passaria despercebido.
 */
export const retornoLiquidoDe = (entrada, saida, direcao, custoPercentual) => {
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
 * @param {string} [opcoes.modoStop] - `StopMode`.
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
 * @param {string|null} [opcoes.sinalSaida] - Sinal que fecha a posição, na
 *   abertura do candle seguinte ao dele.
 * @param {string|null} [opcoes.filtroTendencia] - `TrendFilter`.
 * @param {string|null} [opcoes.sinalConfirmacao] - Segundo sinal exigido nos
 *   últimos `JANELA_CONFIRMACAO` candles.
 * @param {number|null} [opcoes.riscoPorOperacao] - % do capital que cada
 *   operação arrisca até o stop. null usa o capital inteiro.
 * @param {ArrayLike<number>|null} [opcoes.posicoesDeEntrada] - Uma marca por
 *   candle; onde ≠ 0, conta como sinal de entrada. Substitui `sinalEntrada` —
 *   é por aqui que a régua aleatória entra com posições sorteadas mantendo
 *   todo o resto da regra.
 * @param {boolean} [opcoes.enxuto] - Só o desfecho, sem curva, operações nem
 *   métricas de risco. Para quem vai rodar a mesma série centenas de vezes e só
 *   precisa do retorno.
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
    sinalSaida = null,
    filtroTendencia = null,
    sinalConfirmacao = null,
    riscoPorOperacao = null,
    posicoesDeEntrada = null,
    enxuto = false,
  } = opcoes

  if (!Array.isArray(registros) || registros.length < 2) return null
  const porPosicao = posicoesDeEntrada !== null && posicoesDeEntrada !== undefined
  if (!sinalEntrada && !porPosicao) return null
  if (direcao !== TradeDirection.COMPRA && direcao !== TradeDirection.VENDA) return null
  if (saidaPorTempo !== null && (!Number.isInteger(saidaPorTempo) || saidaPorTempo < 1)) return null
  const stopPorVolatilidade = modoStop === StopMode.ATR || modoStop === StopMode.ATR_MOVEL
  const stopMovel = modoStop === StopMode.ATR_MOVEL
  // Sem nenhuma regra de saída a posição nunca fecha e a simulação não descreve
  // estratégia nenhuma — só a primeira entrada segurada até o fim da janela.
  // No modo ATR o stop existe sempre, então ele já é regra de saída suficiente.
  if (
    saidaPorTempo === null &&
    !stopPorVolatilidade &&
    stopPercentual === null &&
    alvoPercentual === null &&
    !sinalSaida
  ) return null
  if (!(capitalInicial > 0)) return null
  // Zero ou negativo não é "arriscar nada": é campo apagado pela metade. Cai no
  // capital inteiro, que é o comportamento sem o campo.
  const risco = riscoPorOperacao > 0 ? riscoPorOperacao : null

  const serie = serieParaOsRegistros(registros, serieDeSinais)
  if (serie.length < 2) return null

  const preparo = prepararSerie(serie)
  const { instantes, aberturas, maiores, menores, fechamentos, utilizavel } = preparo
  const atrPorPosicao = stopPorVolatilidade ? atrDaSerie(preparo, registros) : null

  const cadencia = preparo.cadencia
  const tolerancia =
    toleranciaBuracoMs ??
    (cadencia !== null ? cadencia * FATOR_TOLERANCIA_BURACO : null)
  const { quebraEm, descontinuidades } = quebrasDaSerie(preparo, serie, tolerancia)
  const passaFiltro = filtroDeEntrada(preparo, serie, { filtroTendencia, sinalConfirmacao })

  const limite = limiteDeAbertura(aPartirDe)

  // A curva cobre a janela que o usuário escolheu, não a margem de aquecimento.
  let inicio = -1
  for (let i = 0; i < serie.length; i++) {
    if (podeAbrir(instantes, limite, i)) { inicio = i; break }
  }
  if (inicio < 0 || inicio >= serie.length - 1) return null

  const comprado = direcao === TradeDirection.COMPRA
  let capital = capitalInicial
  let posicao = null
  let entradaAgendada = false
  let saidaAgendada = false
  let candlesEmPosicao = 0
  let totalTrades = 0
  let tradesConcluidos = 0

  const trades = enxuto ? null : []
  const curva = enxuto ? null : []

  // Quanto a posição chegou a andar contra e a favor, em % do preço de
  // entrada, antes do custo. Só se acumula com preço que de fato aconteceu
  // ENQUANTO a posição existia — ver o comentário do candle de saída.
  const registrarExcursao = (precoFavoravel, precoAdverso) => {
    if (precoFavoravel !== null) {
      const f = retornoBrutoDe(posicao.precoEntrada, precoFavoravel, direcao)
      if (f > posicao.favoravel) posicao.favoravel = f
    }
    if (precoAdverso !== null) {
      const a = -retornoBrutoDe(posicao.precoEntrada, precoAdverso, direcao)
      if (a > posicao.adversa) posicao.adversa = a
    }
  }

  const fechar = (i, precoSaida, motivo) => {
    const bruto = retornoBrutoDe(posicao.precoEntrada, precoSaida, direcao)
    const liquido = retornoLiquidoDe(posicao.precoEntrada, precoSaida, direcao, custoPercentual)
    if (liquido === null) {
      posicao = null
      return
    }
    // Só a fração comprometida anda com a operação; o resto do capital fica
    // parado. Sem dimensionamento pelo risco a fração é 1 e a conta é a de
    // sempre.
    const fracao = posicao.fracaoCapital
    const custoPago = (capital * fracao * (bruto - liquido)) / 100
    const capitalAntes = capital
    capital = capital * (1 + (fracao * liquido) / 100)

    totalTrades++
    if (motivo !== ExitReason.FIM_DA_SERIE) tradesConcluidos++

    if (!enxuto) {
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
        // Onde o stop estava quando a posição fechou. No stop móvel é outro
        // preço que o da entrada, e é o que o gráfico precisa desenhar.
        precoStopFinal: posicao.precoStop,
        precoAlvo: posicao.precoAlvo,
        fracaoCapital: fracao,
        // MAE e MFE: o pior e o melhor momento da operação antes de fechar,
        // em % do preço de entrada e antes do custo. Sempre ≥ 0.
        excursaoAdversa: posicao.adversa,
        excursaoFavoravel: posicao.favoravel,
      })
    }
    posicao = null
  }

  // Limites da curva, para os dias analisados. Acompanhados no laço porque a
  // curva enxuta não existe e a completa não precisa ser relida.
  let primeiroInstante = null
  let ultimoInstante = null

  for (let i = inicio; i < serie.length; i++) {
    // Buraco fecha a posição no último preço conhecido: dentro dele não se sabe
    // o que o preço fez, e stop e alvo deixariam de significar qualquer coisa.
    if (posicao && quebraEm[i]) {
      const anterior = fechamentos[i - 1]
      if (anterior !== null && anterior > 0) {
        fechar(i - 1, anterior, ExitReason.DESCONTINUIDADE)
      } else {
        posicao = null
      }
      entradaAgendada = false
      saidaAgendada = false
    }

    // Candle inutilizável não vira ponto de curva nem gera operação: repetir o
    // capital anterior ali seria desenhar uma linha reta onde não há medição.
    if (quebraEm[i] && !utilizavel[i]) {
      entradaAgendada = false
      continue
    }

    const abertura = aberturas[i]

    // 1. Saída agendada pelo sinal de saída executa AGORA, na abertura. Sem
    //    abertura neste candle, a ordem espera o próximo que tenha uma — sair
    //    no fechamento anterior seria usar o preço do candle em que o sinal
    //    foi visto, o mesmo erro que a entrada evita.
    if (saidaAgendada && posicao && abertura !== null) {
      registrarExcursao(abertura, abertura)
      fechar(i, abertura, ExitReason.SINAL)
      saidaAgendada = false
    }
    if (!posicao) saidaAgendada = false

    // 2. Entrada agendada no candle anterior executa AGORA, na abertura.
    if (entradaAgendada && !posicao) {
      // Buraco entre o sinal e a execução invalida a entrada: o preço de
      // abertura já não é a continuação do candle que gerou o sinal.
      if (abertura !== null && !quebraEm[i]) {
        // No modo ATR a distância sai da volatilidade medida até o ÚLTIMO
        // CANDLE FECHADO — `i - 1`, e não `i`. O `calcularAtrSerie` devolve em
        // cada posição o ATR já incluindo a amplitude daquele candle, e a
        // entrada acontece na ABERTURA de `i`: a essa altura ninguém sabe qual
        // vai ser a máxima nem a mínima dele.
        //
        // Usar `i` dava ao stop exatamente o dado que ele não podia ter, e
        // sempre do jeito conveniente: candle largo produzia stop largo
        // justamente quando o stop largo era necessário para sobreviver. É a
        // mesma família dos erros que o cabeçalho deste arquivo enumera.
        //
        // Sem ATR ainda — começo da série, antes de a média fechar — a posição
        // abre sem stop, e sai pelo tempo ou pelo alvo. Inventar uma distância
        // ali seria pior.
        const distanciaStop = stopPorVolatilidade
          ? stopPorAtr(atrPorPosicao?.[i - 1] ?? null, abertura)
          : stopPercentual

        // Dimensionamento pelo risco: quanto do capital comprometer para que,
        // se o stop for atingido, a perda seja `risco`% do capital. Nunca
        // alavanca — acima de 1 a conta pediria dinheiro emprestado. Sem stop
        // não há distância para dividir, e a posição usa o capital inteiro,
        // como sem o campo. Só acontece no modo ATR, nos primeiros candles da
        // série, que caem na margem de aquecimento.
        const fracaoCapital =
          risco !== null && distanciaStop !== null && distanciaStop > 0
            ? Math.min(1, risco / distanciaStop)
            : 1

        posicao = {
          indice: i,
          registro: serie[i].registro,
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
          fracaoCapital,
          // Melhor preço desde a entrada: é dele que o stop móvel mede a
          // distância.
          extremo: abertura,
          adversa: 0,
          favoravel: 0,
        }
      }
    }
    entradaAgendada = false

    // 3. Saídas, avaliadas contra o range do candle corrente.
    if (posicao) {
      candlesEmPosicao++

      const maior = maiores[i]
      const menor = menores[i]
      const fechamento = fechamentos[i]
      const precoFavoravel = comprado ? maior : menor
      const precoAdverso = comprado ? menor : maior

      const tocouStop =
        posicao.precoStop !== null &&
        (comprado ? menor <= posicao.precoStop : maior >= posicao.precoStop)
      const tocouAlvo =
        posicao.precoAlvo !== null &&
        (comprado ? maior >= posicao.precoAlvo : menor <= posicao.precoAlvo)

      // No candle de saída a excursão só conta com o que certamente aconteceu
      // ANTES da saída. O OHLC não diz se a máxima veio antes ou depois do
      // stop — contá-la seria atribuir à operação um lucro momentâneo que ela
      // pode nunca ter tido. A abertura sempre vem antes, então ela entra.
      if (tocouStop) {
        // Stop antes de alvo, sempre. Ver o cabeçalho deste arquivo.
        //
        // Abriu além do stop: sai na abertura (item 5 do cabeçalho). No candle
        // da entrada isso não acontece — a abertura É o preço de entrada, e o
        // stop está sempre do outro lado dela.
        const abriuAlem =
          i > posicao.indice &&
          abertura !== null &&
          (comprado ? abertura <= posicao.precoStop : abertura >= posicao.precoStop)
        const precoSaida = abriuAlem ? abertura : posicao.precoStop
        if (abertura !== null) registrarExcursao(abertura, abertura)
        registrarExcursao(null, precoSaida)
        fechar(i, precoSaida, ExitReason.STOP)
      } else if (tocouAlvo) {
        // O lado adverso do candle entra inteiro: o stop não foi tocado, então
        // o pior preço dele aconteceu com a posição aberta ou depois do alvo —
        // e contar a mais aqui erra para o lado de não embelezar a operação.
        registrarExcursao(posicao.precoAlvo, precoAdverso)
        fechar(i, posicao.precoAlvo, ExitReason.ALVO)
      } else {
        registrarExcursao(precoFavoravel, precoAdverso)
        if (saidaPorTempo !== null && i - posicao.indice >= saidaPorTempo - 1) {
          fechar(i, fechamento, ExitReason.TEMPO)
        }
      }

      // Stop móvel: com o candle FECHADO, o melhor preço pode ter mudado, e o
      // stop acompanha. Só vale a partir do próximo candle — atualizar dentro
      // deste seria supor que a máxima veio antes de qualquer recuo, e o OHLC
      // não diz isso. O stop nunca recua.
      if (posicao && stopMovel && posicao.stopPercentualAplicado !== null) {
        posicao.extremo = comprado
          ? Math.max(posicao.extremo, maior)
          : Math.min(posicao.extremo, menor)
        const novoStop = posicao.extremo * (1 - direcao * (posicao.stopPercentualAplicado / 100))
        posicao.precoStop = comprado
          ? Math.max(posicao.precoStop, novoStop)
          : Math.min(posicao.precoStop, novoStop)
      }
    }

    // 4. Sinal de saída neste candle agenda a saída para a abertura do próximo.
    if (posicao && sinalSaida && serie[i].sinais.includes(sinalSaida)) saidaAgendada = true

    // 5. Sinal de entrada neste candle agenda entrada para a abertura do
    //    próximo — se o filtro deixar.
    if (!posicao && i < serie.length - 1 && podeAbrir(instantes, limite, i + 1)) {
      const temSinal = porPosicao
        ? Boolean(posicoesDeEntrada[i])
        : serie[i].sinais.includes(sinalEntrada)
      if (temSinal && (!passaFiltro || passaFiltro[i])) entradaAgendada = true
    }

    if (instantes[i] !== null) {
      if (primeiroInstante === null) primeiroInstante = instantes[i]
      ultimoInstante = instantes[i]
    }

    // 6. Ponto da curva, marcado a mercado. Uma curva que só degrau nos
    //    fechamentos esconde o quanto a posição chegou a perder no meio — que é
    //    justamente o que o drawdown deveria medir.
    if (!enxuto) {
      const fechamentoDoCandle = fechamentos[i]
      let capitalMarcado = capital
      if (posicao) {
        const naoRealizado =
          fechamentoDoCandle !== null
            ? retornoBrutoDe(posicao.precoEntrada, fechamentoDoCandle, direcao)
            : 0
        capitalMarcado = capital * (1 + (posicao.fracaoCapital * naoRealizado) / 100)
      }

      curva.push({
        // Posição do candle na série. O gráfico de operações precisa dela para
        // achar, na curva, o ponto de cada entrada e saída.
        indice: i,
        instante: serie[i].registro?.horaReferencia ?? null,
        capital: capitalMarcado,
        emPosicao: Boolean(posicao),
        // O fechamento viaja junto com o ponto para o gráfico poder desenhar o
        // buy & hold no MESMO eixo, sem precisar da série de candles de volta.
        // Sem ele, a régua que os cards exibem lado a lado com o retorno some
        // justamente do elemento que as pessoas de fato olham.
        precoFechamento: fechamentoDoCandle,
      })
    }
  }

  // Posição aberta no fim da janela: fecha no último fechamento conhecido, mas
  // marcada — o desfecho não aconteceu.
  if (posicao) {
    const ultimo = serie.length - 1
    const fechamento = fechamentos[ultimo]
    if (fechamento !== null && fechamento > 0) {
      fechar(ultimo, fechamento, ExitReason.FIM_DA_SERIE)
      if (!enxuto && curva.length > 0) curva[curva.length - 1].capital = capital
    }
  }

  const retornoTotal = ((capital - capitalInicial) / capitalInicial) * 100
  const buyAndHold = buyAndHoldDe(fechamentos[inicio], fechamentos[serie.length - 1])

  if (enxuto) {
    return {
      retornoTotal,
      buyAndHold,
      alfa: buyAndHold !== null ? retornoTotal - buyAndHold : null,
      totalTrades,
      tradesConcluidos,
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
      sinalSaida,
      filtroTendencia,
      sinalConfirmacao,
      riscoPorOperacao: risco,
      cadenciaMs: cadencia,
      toleranciaBuracoMs: tolerancia,
    },
    trades,
    curva,
    descontinuidades,
    metricas: calcularMetricas({
      trades,
      curva,
      retornoTotal,
      buyAndHold,
      capitalInicial,
      candlesEmPosicao,
      cadenciaMs: cadencia,
      diasAnalisados:
        primeiroInstante !== null && ultimoInstante !== null && curva.length >= 2
          ? (ultimoInstante - primeiroInstante) / (24 * 3600000)
          : null,
    }),
  }
}

// Buy & hold sem custo, de propósito: é a régua mais alta, e uma ferramenta de
// simulação erra para o lado de não bajular a estratégia. Mesma definição usada
// na avaliação out-of-sample do backend.
const buyAndHoldDe = (primeiro, ultimo) =>
  primeiro !== null && primeiro > 0 && ultimo !== null
    ? ((ultimo - primeiro) / primeiro) * 100
    : null

/**
 * Onde a regra PODERIA ter entrado, e em quantos desses candles o sinal de fato
 * apareceu.
 *
 * É a matéria-prima da régua aleatória: sortear entradas "no mesmo número" só
 * compara alguma coisa se o sorteio acontece no mesmo conjunto de candles em
 * que o sinal poderia ter aparecido — dentro da janela, com candle utilizável,
 * e passando pelo mesmo filtro. Sortear também nos candles que o filtro
 * reprova mediria o filtro junto com o sinal.
 *
 * @param {Array<object>} registros - Série na ordem da API.
 * @param {object} opcoes - As mesmas de `simular`.
 * @returns {{serie: Array<object>, candidatas: number[], comSinal: number}|null}
 */
export const oportunidadesDeEntrada = (registros, opcoes = {}) => {
  const {
    sinalEntrada,
    aPartirDe = null,
    filtroTendencia = null,
    sinalConfirmacao = null,
    serieDeSinais = null,
  } = opcoes
  if (!Array.isArray(registros) || registros.length < 2 || !sinalEntrada) return null

  const serie = serieParaOsRegistros(registros, serieDeSinais)
  const preparo = prepararSerie(serie)
  const passaFiltro = filtroDeEntrada(preparo, serie, { filtroTendencia, sinalConfirmacao })
  const limite = limiteDeAbertura(aPartirDe)

  const candidatas = []
  let comSinal = 0
  // Mesmas condições do laço de `simular` para AGENDAR uma entrada: candle
  // dentro da janela, utilizável, com um seguinte também dentro dela.
  for (let i = 0; i < serie.length - 1; i++) {
    if (!podeAbrir(preparo.instantes, limite, i)) continue
    if (!podeAbrir(preparo.instantes, limite, i + 1)) continue
    if (!preparo.utilizavel[i]) continue
    if (passaFiltro && !passaFiltro[i]) continue
    candidatas.push(i)
    if (serie[i].sinais.includes(sinalEntrada)) comSinal++
  }

  return { serie, candidatas, comSinal }
}

/**
 * Último candle em que a regra teria agendado uma entrada.
 *
 * Liga a simulação ao presente: o painel inteiro fala do passado, e a pergunta
 * natural de quem terminou de ler é "e agora, esse sinal está aparecendo?".
 * Responde com o que aconteceu — quando o sinal passou pelo filtro pela última
 * vez — e nada sobre o que fazer com isso.
 *
 * @param {Array<object>} registros - Série na ordem da API.
 * @param {object} opcoes - `sinalEntrada`, filtros e `serieDeSinais`.
 * @returns {{instante: string|null, candlesAtras: number}|null} - null quando o
 *   sinal não passou pelo filtro nenhuma vez na série. `candlesAtras` é 0 quando
 *   o disparo foi no último candle.
 */
export const ultimoDisparo = (registros, opcoes = {}) => {
  const {
    sinalEntrada,
    filtroTendencia = null,
    sinalConfirmacao = null,
    serieDeSinais = null,
  } = opcoes
  if (!Array.isArray(registros) || registros.length === 0 || !sinalEntrada) return null

  const serie = serieParaOsRegistros(registros, serieDeSinais)
  const preparo = prepararSerie(serie)
  const passaFiltro = filtroDeEntrada(preparo, serie, { filtroTendencia, sinalConfirmacao })

  for (let i = serie.length - 1; i >= 0; i--) {
    if (!serie[i].sinais.includes(sinalEntrada)) continue
    if (passaFiltro && !passaFiltro[i]) continue
    return {
      instante: serie[i].registro?.horaReferencia ?? null,
      candlesAtras: serie.length - 1 - i,
    }
  }
  return null
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
 * Cada linha traz o resultado na janela cheia, no trecho de ajuste e no de
 * validação. Filtro de entrada, saída por sinal e dimensionamento valem para
 * TODAS as linhas: são parte da regra comum, como o stop e o custo.
 *
 * **A ordenação é pelo alfa do AJUSTE.** Era pelo da janela cheia, com a
 * justificativa de que ali há mais operações e menos ruído — e com a afirmação,
 * escrita aqui, de que a validação era "a única coluna que não foi usada para
 * ordenar". A afirmação era falsa: a janela cheia CONTÉM o trecho de validação,
 * então ordenar por ela é escolher a melhor usando também os candles que foram
 * reservados justamente para julgar a escolha. Uma regra que se saísse bem só
 * no trecho reservado subia na tabela POR CAUSA dele, e a coluna de validação
 * então "confirmava" a subida que ela mesma tinha causado.
 *
 * Selecionar no ajuste e julgar na validação é o que "fora da amostra"
 * significa. O custo é pequeno — o ajuste tem 80% da janela, não é um resto —
 * e o ganho é que a coluna da direita volta a ser o que a tela promete.
 *
 * A ordenação cai para o alfa da janela cheia quando não há corte: janela curta
 * demais para dividir não tem trecho de ajuste, e aí a janela cheia é tudo o
 * que existe.
 *
 * **Sobre escolher a melhor:** testar N estratégias e ficar com a de cima é
 * sobreajuste por construção. Com catorze sinais a 95% de confiança, espera-se
 * que **menos de uma** pareça boa por puro acaso. Por isso a validação não é
 * enfeite da tela — e por isso a régua aleatória mede também quanto o melhor de
 * N sinais sorteados alcançaria (`sorteDoRanking`, em acaso.js).
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
  const serieCompleta = serieParaOsRegistros(registros, serieDeSinais)
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
  //
  // Pelo alfa do AJUSTE, e não pelo da janela cheia: a cheia contém o trecho de
  // validação, e ordenar por ela contamina a coluna que existe para julgar a
  // ordenação. Ver o cabeçalho desta função. Sem corte não há ajuste, e aí a
  // janela cheia é tudo o que existe para ordenar.
  const criterio = corte
    ? (l) => l.alfaAjuste ?? -Infinity
    : (l) => l.metricas.alfa ?? -Infinity
  linhas.sort((a, b) => criterio(b) - criterio(a))

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
  retornoTotal,
  buyAndHold,
  capitalInicial,
  candlesEmPosicao,
  cadenciaMs = null,
  diasAnalisados = null,
}) => {
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

  const { sharpe, volatilidade } = riscoDaCurva(curva, cadenciaMs)

  return {
    retornoTotal,
    drawdownMaximo,
    // Retorno por unidade de risco, anualizado. Lê-se junto com `exposicao`:
    // curva parada tem desvio pequeno, então quem opera pouco tem Sharpe alto
    // sem que a estratégia seja melhor.
    sharpe,
    volatilidade,
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
    // Quantos dias a curva de fato cobre, do primeiro ao último ponto
    // analisado. É MEDIDO, e não o tamanho da janela pedida: quando a coleta
    // não tem todo o período — moeda listada há pouco, buraco na série, teto da
    // API —, o que foi pedido e o que existe são coisas diferentes, e é sobre o
    // que existe que as operações, o alfa e o corte de validação se apoiam.
    diasAnalisados,
    buyAndHold,
    alfa: buyAndHold !== null ? retornoTotal - buyAndHold : null,
    candlesSimulados: curva.length,
    // A tela decide como mostrar; o motor só declara que a amostra é curta.
    amostraInsuficiente: concluidos.length < MINIMO_TRADES_CONCLUSIVO,
  }
}
