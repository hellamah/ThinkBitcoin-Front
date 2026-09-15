// Régua aleatória: a estratégia contra entradas sorteadas.
//
// O alfa compara a regra com o buy & hold, e isso mistura três coisas: o valor
// do sinal, a regra de saída e a direção do mercado. Uma regra que fica 10% do
// tempo posicionada "perde" em qualquer alta e "ganha" em qualquer queda só por
// estar fora; vendida numa queda de 20%, qualquer entrada mostra alfa enorme.
// Nenhuma dessas coisas é mérito do sinal.
//
// A régua daqui isola o sinal. Mesma saída, mesmo custo, mesma direção, mesmo
// filtro, mesmo número de entradas — só que em candles sorteados. Se o sinal
// não supera a maioria dos sorteios, o que a curva mostra é a saída e o
// mercado, não ele.
//
// Tudo com semente: o mesmo pedido produz o mesmo percentil, então o número na
// tela só muda quando a regra muda.

import { geradorAleatorio, median, quantil } from './mathUtils'
import { oportunidadesDeEntrada, simular } from './backtest'

// Sorteios da régua da estratégia em detalhe. Com 300, o percentil tem
// resolução de um terço de ponto — mais fino do que qualquer leitura que se
// faça dele —, e a conta toda cabe em algumas dezenas de milissegundos.
export const ITERACOES_ACASO = 300

// Sorteios do "melhor de N" do ranking. Cada um simula todos os sinais, então
// é N vezes mais caro que um sorteio da régua acima.
export const ITERACOES_SORTE_RANKING = 200

// Nível de significância da leitura isolada: 5%, o mesmo dos intervalos de
// confiança do resto da plataforma.
export const NIVEL_ACASO = 0.05

// Diferença abaixo da qual dois retornos contam como empate. Sem isto, um
// sorteio que reproduz exatamente as entradas do sinal (acontece quando o sinal
// aparece em quase todo candle) cairia de um lado ou de outro por ruído de
// ponto flutuante.
const EMPATE = 1e-9

/**
 * Marca `quantas` posições distintas, sorteadas de `pool`, em `mascara`.
 *
 * Fisher–Yates parcial: embaralha só o começo do array, que é o que vai ser
 * usado. O `pool` é reaproveitado entre sorteios, embaralhado no lugar — a
 * ordem que sobra de um sorteio não vicia o próximo, porque cada troca é com
 * uma posição uniforme do restante.
 */
const marcarSorteio = (pool, quantas, sortear, mascara) => {
  for (let j = 0; j < quantas; j++) {
    const r = j + Math.floor(sortear() * (pool.length - j))
    const troca = pool[j]
    pool[j] = pool[r]
    pool[r] = troca
    mascara[pool[j]] = 1
  }
}

const desmarcarSorteio = (pool, quantas, mascara) => {
  for (let j = 0; j < quantas; j++) mascara[pool[j]] = 0
}

/**
 * Onde a estratégia cai na distribuição de entradas sorteadas.
 *
 * O sorteio acontece nos mesmos candles em que o sinal PODERIA ter aparecido
 * (ver `oportunidadesDeEntrada`) e no mesmo número de vezes em que ele
 * apareceu. Mesmo número de oportunidades, e não de operações: é o que o sinal
 * teve, e as operações que saem delas dependem da saída do mesmo jeito para o
 * sinal e para o sorteio.
 *
 * @param {Array<object>} registros - Série na ordem da API.
 * @param {object} opcoes - As mesmas de `simular`, com `sinalEntrada`.
 * @param {{iteracoes?: number, semente?: number}} [config]
 * @returns {{
 *   percentil: number, retornoReal: number, buyAndHold: number|null,
 *   distribuicao: number[], mediana: number, p05: number, p95: number,
 *   operacoesMedianas: number|null, operacoesReais: number,
 *   iteracoes: number, entradas: number, candidatas: number
 * }|null} - Retornos em %. null quando o sinal não aparece ou não opera.
 */
export const compararComAcaso = (
  registros,
  opcoes,
  { iteracoes = ITERACOES_ACASO, semente = 1 } = {}
) => {
  const oportunidades = oportunidadesDeEntrada(registros, opcoes)
  if (!oportunidades || oportunidades.comSinal === 0) return null
  const { serie, candidatas, comSinal } = oportunidades

  const base = { ...opcoes, serieDeSinais: serie, enxuto: true }
  const real = simular(registros, base)
  if (!real || real.totalTrades === 0) return null

  const sortear = geradorAleatorio(semente)
  const pool = candidatas.slice()
  const mascara = new Uint8Array(serie.length)
  const retornos = []
  const operacoes = []

  for (let k = 0; k < iteracoes; k++) {
    marcarSorteio(pool, comSinal, sortear, mascara)
    const r = simular(registros, { ...base, posicoesDeEntrada: mascara })
    desmarcarSorteio(pool, comSinal, mascara)
    if (!r) continue
    retornos.push(r.retornoTotal)
    operacoes.push(r.tradesConcluidos)
  }
  if (retornos.length === 0) return null

  retornos.sort((a, b) => a - b)

  // Empates contam pela metade, como na definição usual de posto: sem isso,
  // um sinal presente em TODOS os candles candidatos — cujos sorteios são
  // idênticos a ele — sairia no percentil 0 ou 100 conforme o arredondamento.
  let abaixo = 0
  let empates = 0
  retornos.forEach((v) => {
    if (Math.abs(v - real.retornoTotal) <= EMPATE) empates++
    else if (v < real.retornoTotal) abaixo++
  })

  return {
    percentil: ((abaixo + empates / 2) / retornos.length) * 100,
    retornoReal: real.retornoTotal,
    buyAndHold: real.buyAndHold,
    distribuicao: retornos,
    mediana: quantil(retornos, 0.5),
    p05: quantil(retornos, 0.05),
    p95: quantil(retornos, 0.95),
    operacoesMedianas: median(operacoes),
    operacoesReais: real.tradesConcluidos,
    iteracoes: retornos.length,
    entradas: comSinal,
    candidatas: candidatas.length,
  }
}

/**
 * Até onde o MELHOR de N sinais sorteados chega, para ler o topo do ranking.
 *
 * O ranking ordena os sinais pelo alfa do ajuste e põe o maior em cima. Mesmo
 * que nenhum sinal valha nada, o de cima vai ter alfa positivo com frequência —
 * é o máximo de N números ruidosos. O aviso de sobreajuste dizia isso em texto;
 * aqui vira uma régua: em cada sorteio, cada sinal troca suas ocorrências por
 * candles sorteados (no mesmo número), e o melhor alfa entre eles é anotado.
 * A distribuição desses máximos diz que alfa o topo da tabela alcançaria só
 * por ter sido escolhido.
 *
 * Sorteios independentes por sinal, e não um sorteio compartilhado: sinais
 * sorteados independentes produzem máximos MAIORES que sinais correlacionados,
 * e errar aqui para o lado de uma régua mais alta é errar para o lado de não
 * bajular o ranking.
 *
 * @param {Array<object>} registros - Normalmente o trecho de AJUSTE, que é
 *   onde o ranking ordena.
 * @param {object} opcoesComuns - Regra de saída, filtro e custo do ranking.
 * @param {Array<string>} sinais - Os sinais da tabela.
 * @param {{iteracoes?: number, semente?: number}} [config]
 * @returns {{mediana: number, p95: number, iteracoes: number, sinais: number}|null}
 *   - Alfa em %. `sinais` é quantos entraram de fato: um sinal ausente do
 *   trecho não tem ocorrência para sortear.
 */
export const sorteDoRanking = (
  registros,
  opcoesComuns,
  sinais,
  { iteracoes = ITERACOES_SORTE_RANKING, semente = 1 } = {}
) => {
  if (!Array.isArray(sinais) || sinais.length === 0) return null

  // As candidatas não dependem do sinal — só da janela e do filtro, que são
  // comuns à tabela inteira. Uma consulta basta.
  const primeira = oportunidadesDeEntrada(registros, { ...opcoesComuns, sinalEntrada: sinais[0] })
  if (!primeira || primeira.candidatas.length === 0) return null
  const { serie, candidatas } = primeira

  const contagem = new Map(sinais.map((s) => [s, 0]))
  candidatas.forEach((i) => {
    serie[i].sinais.forEach((s) => {
      if (contagem.has(s)) contagem.set(s, contagem.get(s) + 1)
    })
  })
  const ativos = sinais.filter((s) => contagem.get(s) > 0)
  if (ativos.length === 0) return null

  const base = { ...opcoesComuns, serieDeSinais: serie, enxuto: true }
  const sortear = geradorAleatorio(semente)
  const pool = candidatas.slice()
  const mascara = new Uint8Array(serie.length)
  const maximos = []

  for (let k = 0; k < iteracoes; k++) {
    let melhor = -Infinity
    ativos.forEach((sinal) => {
      const quantas = contagem.get(sinal)
      marcarSorteio(pool, quantas, sortear, mascara)
      const r = simular(registros, { ...base, sinalEntrada: sinal, posicoesDeEntrada: mascara })
      desmarcarSorteio(pool, quantas, mascara)
      // Mesma regra do ranking: sem operação no trecho, não há alfa — e "não
      // operou" não entra na disputa como zero.
      if (r && r.totalTrades > 0 && r.alfa !== null && r.alfa > melhor) melhor = r.alfa
    })
    if (melhor > -Infinity) maximos.push(melhor)
  }
  if (maximos.length === 0) return null

  maximos.sort((a, b) => a - b)
  return {
    mediana: quantil(maximos, 0.5),
    p95: quantil(maximos, 0.95),
    iteracoes: maximos.length,
    sinais: ativos.length,
  }
}

/**
 * Percentil que a régua aleatória precisa alcançar, dado quantas configurações
 * já foram testadas.
 *
 * Cada ajuste de parâmetro é um teste. A 5%, um teste isolado tem uma chance em
 * vinte de parecer bom por acaso; quem testa vinte configurações e fica com a
 * melhor tem, na prática, a certeza de achar uma. A correção de Bonferroni
 * divide o nível pelo número de testes: com 10 tentativas, o limiar sobe do
 * percentil 95 para o 99,5.
 *
 * É conservadora — trata as tentativas como independentes, e configurações
 * vizinhas não são. O número real de testes "efetivos" é menor. Errar para
 * esse lado é a escolha coerente com o resto da tela.
 *
 * @param {number} tentativas
 * @param {number} [nivel]
 * @returns {number} - Percentil, em (0, 100).
 */
export const limiarPorTentativas = (tentativas, nivel = NIVEL_ACASO) =>
  (1 - nivel / Math.max(1, Math.floor(tentativas) || 1)) * 100
