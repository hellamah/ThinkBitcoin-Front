// Laboratório de sinais: mede o que aconteceu DEPOIS de cada sinal.
//
// Detectar um martelo ou um volume atípico é trivia enquanto ninguém responde
// "e daí?". Aqui cada sinal é cruzado com o retorno dos candles seguintes.
//
// A leitura só existe contra a taxa base do próprio período: 68% de acerto não
// significa nada se o período inteiro fechou em alta 67% das vezes. Por isso
// todo resultado sai acompanhado do delta contra a base.
//
// E o delta sozinho ainda engana: com amostra pequena ele é grande por acaso.
// Quem decide se a linha diz alguma coisa é o intervalo de confiança — se a
// taxa base cabe dentro dele, os dois números são indistinguíveis.
//
// O intervalo, porém, só responde por UMA linha de cada vez. Esta tabela mede
// quinze sinais na mesma janela e ordena pelo maior deslocamento, e aí entra um
// erro que nenhum intervalo pega: a 95% de confiança, cada linha tem 5% de
// chance de parecer significante por acaso, e quinze linhas independentes têm
// ~54% de chance de ao menos uma parecer. Ordenar pelo maior deslocamento é
// exatamente o procedimento que traz essa linha para o topo. O usuário lê a
// primeira linha da tabela, que é a que mais se destaca — e a que mais se
// destaca é justamente a que o acaso mais favorece.
//
// A resposta é a mesma que a simulação já dava ao ranking dela: reservar o
// trecho mais recente da janela, medir nele também, e mostrar os dois lado a
// lado. A validação é a única coluna que não participou da ordenação, e por
// isso a única que pode desmentir a tabela.

import { intervaloWilson } from './mathUtils'
import { avaliarAnomalia, calcularLimites } from './marketStats'
import { CandlePattern, classificarCandle } from './candlePatterns'
import { detectarDivergencias } from './flowDivergence'
import { resumirVwap } from './vwap'
import { resumirOsciladores } from './oscillators'
import { FRACAO_VALIDACAO_PADRAO, dividirParaValidacao, instanteDe } from './validacaoJanela'

export const SignalKey = Object.freeze({
  VOLUME_ATIPICO: 'volumeAtipico',
  VARIACAO_ATIPICA: 'variacaoAtipica',
  TICKET_ALTO: 'ticketAlto',
})

const fechamentoDe = (r) => {
  const v = Number(r?.precoFechamento)
  return Number.isFinite(v) && v > 0 ? v : null
}

const resumir = (retornos) => {
  if (retornos.length === 0) return null
  const positivos = retornos.filter((v) => v > 0).length
  const soma = retornos.reduce((a, b) => a + b, 0)
  return {
    ocorrencias: retornos.length,
    positivos,
    taxaAlta: (positivos / retornos.length) * 100,
    retornoMedio: soma / retornos.length,
  }
}

/**
 * Vocabulário de sinais de cada candle, em ordem CRONOLÓGICA.
 *
 * Função pura sobre a série já carregada: sem requisição, sem conexão, sem
 * estado. Fica separada de `analisarSinais` porque o simulador de estratégias
 * precisa do MESMO vocabulário no MESMO alinhamento — duplicar este laço faria
 * os dois divergirem no primeiro sinal novo que alguém acrescentasse.
 *
 * O alinhamento é a parte delicada e o motivo de existir um lugar só: padrão de
 * candle e anomalia são avaliados registro a registro, mas divergência, VWAP e
 * osciladores chegam prontos, como array indexado por posição cronológica
 * montado fora do laço. Errar o índice de um desses não quebra nada visível —
 * só atribui o sinal ao candle vizinho e muda todos os números depois dele.
 *
 * @param {Array<object>} registros - Série na ordem da API (mais recente
 *   primeiro, ordemAsc=false).
 * @returns {Array<{registro: object, sinais: string[]}>} - Uma entrada por
 *   candle, do mais antigo ao mais recente. Vazia sem série utilizável.
 */
export const montarSerieDeSinais = (registros) => {
  if (!Array.isArray(registros) || registros.length === 0) return []

  // O desfecho é cronológico; a API entrega ao contrário.
  const cronologico = [...registros].reverse()
  const limites = calcularLimites(registros)

  // Já vem em ordem cronológica, alinhado com `cronologico` posição a posição.
  const divergencias = detectarDivergencias(registros, limites?.medianaVolume)
  const cruzamentosVwap = resumirVwap(registros)?.cruzamentos ?? []
  // Cada posição pode carregar mais de uma marca (RSI e banda no mesmo candle).
  const osciladores = resumirOsciladores(registros)?.marcas ?? []

  return cronologico.map((registro, i) => {
    const sinais = []

    const padrao = classificarCandle(registro)
    // NEUTRO é a ausência de padrão; agrupá-lo produziria uma linha que é
    // quase a própria base e não ensina nada.
    if (padrao && padrao !== CandlePattern.NEUTRO) sinais.push(padrao)

    const anomalia = avaliarAnomalia(registro, limites)
    if (anomalia?.volume) sinais.push(SignalKey.VOLUME_ATIPICO)
    if (anomalia?.variacao) sinais.push(SignalKey.VARIACAO_ATIPICA)
    if (anomalia?.ticket) sinais.push(SignalKey.TICKET_ALTO)
    if (divergencias[i]) sinais.push(divergencias[i])
    if (cruzamentosVwap[i]) sinais.push(cruzamentosVwap[i])
    ;(osciladores[i] || []).forEach((marca) => sinais.push(marca))

    return { registro, sinais }
  })
}

/**
 * Mede o desfecho de cada sinal num trecho da série.
 *
 * Separado de `analisarSinais` porque agora roda três vezes sobre a mesma
 * janela — cheia, ajuste e validação — e as três precisam medir do mesmo jeito.
 * Enquanto isto era o corpo da função, acrescentar o trecho de validação
 * significaria uma segunda cópia do laço, que é onde mora o alinhamento entre
 * sinal e desfecho.
 *
 * @param {Array<{registro: object, sinais: string[]}>} serie - Saída de
 *   `montarSerieDeSinais`, em ordem cronológica.
 * @param {number} horizonte
 * @param {string|number|null} aPartirDe - Início do trecho medido.
 * @returns {{base: object, porSinal: Map<string, number[]>}|null}
 */
const medirDesfechos = (serie, horizonte, aPartirDe) => {
  // A série carregada inclui a margem de aquecimento: o dashboard pede alguns
  // dias ANTES do período escolhido para que Bollinger e RSI cheguem prontos ao
  // primeiro candle exibido. Esses candles alimentam o indicador, mas não são
  // período de análise — contá-los faria o painel dizer "239 candles" onde o
  // usuário pediu sete dias, e discordar da simulação ao lado sobre a mesma
  // janela.
  //
  // É o mesmo mecanismo que delimita o trecho de validação: lá o `aPartirDe` é
  // o primeiro candle reservado, e tudo antes dele vira aquecimento.
  const limite = aPartirDe !== null ? new Date(aPartirDe).getTime() : null
  const dentroDaJanela = (entrada) => {
    if (limite === null || !Number.isFinite(limite)) return true
    const t = instanteDe(entrada?.registro)
    return t !== null && t >= limite
  }

  const porSinal = new Map()
  const retornosBase = []

  // Os últimos `horizonte` candles não têm futuro dentro da janela carregada.
  // Ficam de fora do sinal E da base, senão a comparação deixa de ser
  // sobre o mesmo conjunto de instantes.
  //
  // No trecho de AJUSTE isto tem um segundo efeito, e ele é desejável: os
  // últimos candles do ajuste até têm futuro no mundo real, mas esse futuro é o
  // começo da validação. Como a série de ajuste vem cortada, eles simplesmente
  // não são medidos — o ajuste não enxerga um único candle do trecho reservado.
  for (let i = 0; i < serie.length - horizonte; i++) {
    if (!dentroDaJanela(serie[i])) continue

    const atual = fechamentoDe(serie[i].registro)
    const futuro = fechamentoDe(serie[i + horizonte].registro)
    if (atual === null || futuro === null) continue

    const retorno = ((futuro - atual) / atual) * 100
    retornosBase.push(retorno)

    serie[i].sinais.forEach((chave) => {
      if (!porSinal.has(chave)) porSinal.set(chave, [])
      porSinal.get(chave).push(retorno)
    })
  }

  const base = resumir(retornosBase)
  return base ? { base, porSinal } : null
}

/**
 * Leitura de um sinal dentro de um trecho, sempre contra a base DAQUELE trecho.
 *
 * Comparar a taxa bruta do ajuste com a da validação seria a leitura errada, e
 * é a que salta aos olhos: a taxa base se move entre os dois trechos. Um sinal
 * que acerta 60% nos dois lados pode ter ido de +10 p.p. (base 50%) para −5
 * p.p. (base 65%) — ou seja, deixou de dizer qualquer coisa enquanto o número
 * na tela não mudou. O que atravessa os trechos é o deslocamento, não a taxa.
 */
const leituraNoTrecho = (medida, chave) => {
  if (!medida) return null
  const retornos = medida.porSinal.get(chave)
  // Sinal que não ocorreu no trecho não é sinal que falhou nele. Fica null, e a
  // tela mostra um traço em vez de fingir um número.
  if (!retornos || retornos.length === 0) return null
  const r = resumir(retornos)
  return {
    ocorrencias: r.ocorrencias,
    taxaAlta: r.taxaAlta,
    deltaTaxa: r.taxaAlta - medida.base.taxaAlta,
  }
}

/**
 * Cruza cada sinal com o retorno dos candles seguintes.
 *
 * @param {Array<object>} registros - Série na ordem da API (mais recente
 *   primeiro, ordemAsc=false).
 * @param {object} opcoes
 * @param {number} [opcoes.horizonte] - Quantos candles à frente medir.
 * @param {string|number|null} [opcoes.aPartirDe] - Delimita o período
 *   ANALISADO: os candles anteriores continuam alimentando os indicadores de
 *   janela móvel, mas não entram na base nem nas ocorrências.
 * @param {number|null} [opcoes.fracaoValidacao] - Fração mais recente da janela
 *   reservada para validação. `null` desliga o corte; janela curta demais para
 *   dividir também sai sem ele.
 * @returns {{
 *   horizonte: number,
 *   base: {ocorrencias: number, taxaAlta: number, retornoMedio: number},
 *   sinais: Array<object>,
 *   corte: {
 *     candlesAjuste: number, candlesValidacao: number,
 *     baseAjuste: object|null, baseValidacao: object|null
 *   }|null
 * }|null}
 */
export const analisarSinais = (
  registros,
  { horizonte = 1, aPartirDe = null, fracaoValidacao = FRACAO_VALIDACAO_PADRAO } = {}
) => {
  if (!Array.isArray(registros) || registros.length === 0) return null
  if (!Number.isInteger(horizonte) || horizonte < 1) return null

  const serie = montarSerieDeSinais(registros)

  const cheia = medirDesfechos(serie, horizonte, aPartirDe)
  if (!cheia) return null
  const { base, porSinal } = cheia

  const corte =
    fracaoValidacao !== null
      ? dividirParaValidacao(registros, fracaoValidacao, { aPartirDe })
      : null

  // O trecho de ajuste é OUTRO array, mais curto, e por isso precisa da própria
  // montagem: recortar a série de sinais já pronta manteria limiares e médias
  // móveis calculados com os candles reservados dentro: o ajuste saberia da
  // validação por vias tortas, que é o vazamento que o corte existe para
  // impedir.
  //
  // Já a validação usa `registros` inteiro — é o que `dividirParaValidacao`
  // devolve em `registrosValidacao`, de propósito, para os indicadores
  // chegarem aquecidos ao corte. Sendo o mesmo array, a série já montada serve,
  // e o `aPartirDe` é que delimita o que entra na conta.
  const ajuste = corte
    ? medirDesfechos(montarSerieDeSinais(corte.registrosAjuste), horizonte, aPartirDe)
    : null
  const validacao = corte
    ? medirDesfechos(serie, horizonte, corte.aPartirDeValidacao)
    : null

  const sinais = [...porSinal.entries()]
    .map(([chave, retornos]) => {
      const r = resumir(retornos)
      const intervalo = intervaloWilson(r.positivos, r.ocorrencias)

      // Se a taxa base cabe dentro do intervalo de confiança do sinal, os dois
      // números são indistinguíveis com esta amostra. É o que separa "o sinal
      // desloca a probabilidade" de "o sinal parece deslocar por acaso" — e
      // com n pequeno o segundo caso é a regra, não a exceção.
      const significante =
        intervalo !== null &&
        (base.taxaAlta < intervalo.inferior || base.taxaAlta > intervalo.superior)

      return {
        chave,
        ...r,
        // O delta é a leitura útil: quanto o sinal desloca a probabilidade em
        // relação a não filtrar nada.
        deltaTaxa: r.taxaAlta - base.taxaAlta,
        deltaRetorno: r.retornoMedio - base.retornoMedio,
        intervalo,
        significante,
        // Os dois trechos que não se sobrepõem. A janela cheia CONTÉM a
        // validação, então comparar as duas seria comparar um número com um
        // pedaço dele mesmo; ajuste contra validação é a única comparação
        // limpa da tabela.
        ajuste: leituraNoTrecho(ajuste, chave),
        validacao: leituraNoTrecho(validacao, chave),
      }
    })
    // Maior deslocamento absoluto primeiro: é o que merece o olho. E é também o
    // que torna a validação necessária — ordenar pelo extremo é o que faz o
    // acaso subir na tabela.
    .sort((a, b) => Math.abs(b.deltaTaxa) - Math.abs(a.deltaTaxa))

  return {
    horizonte,
    base,
    sinais,
    corte: corte
      ? {
          candlesAjuste: corte.candlesAjuste,
          candlesValidacao: corte.candlesValidacao,
          baseAjuste: ajuste?.base ?? null,
          baseValidacao: validacao?.base ?? null,
        }
      : null,
  }
}
