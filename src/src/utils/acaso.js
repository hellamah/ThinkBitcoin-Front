// Régua aleatória: a estratégia contra entradas sorteadas.
//
// O alfa compara a regra com o buy & hold, e isso mistura três coisas: o valor
// do sinal, a regra de saída e a direção do mercado. Uma regra que fica 10% do
// tempo posicionada "perde" em qualquer alta e "ganha" em qualquer queda só por
// estar fora; vendida numa queda de 20%, qualquer entrada mostra alfa enorme.
// Nenhuma dessas coisas é mérito do sinal.
//
// A régua daqui isola o sinal. Mesma saída, mesmo custo, mesma direção, mesmo
// filtro, e as MESMAS entradas — só que deslocadas no tempo por uma distância
// sorteada. Se o sinal não supera a maioria dos deslocamentos, o que a curva
// mostra é a saída e o mercado, não ele.
//
// ---------------------------------------------------------------------------
// Por que deslocar, e não sortear candles soltos
// ---------------------------------------------------------------------------
// A régua sorteava candles avulsos, no mesmo número em que o sinal apareceu. Só
// que sinal de verdade vem em rajadas: RSI em sobrecompra, rompimento de banda
// e divergência disparam em candles seguidos enquanto a condição dura, e com a
// posição aberta as ocorrências seguintes são ignoradas. Os sorteios não tinham
// rajada nenhuma, e operavam muito mais que o sinal:
//
//   divergência altista, 120 dias de demonstração: 208 ocorrências,
//   76 operações do sinal, 161 dos sorteios
//
// Com o dobro de operações, o sorteio pagava o dobro de custo e ficava o dobro
// do tempo exposto. O percentil comparava duas estratégias de tamanhos
// diferentes — e um sinal sem valor nenhum, que só operava menos, passava na
// régua pelo custo que deixava de pagar. O erro também ia para o outro lado:
// sinal de ocorrências espaçadas (volume atípico) operava MAIS que os sorteios.
//
// A rotação circular mantém tudo que não é o momento: quantas ocorrências,
// quantas seguidas, a distância entre uma rajada e outra. Com isso as operações
// batem com as do sinal, e o que sobra para comparar é só QUANDO ele dispara.
//
// Tudo com semente: o mesmo pedido produz o mesmo percentil, então o número na
// tela só muda quando a regra muda.

import { geradorAleatorio, median, quantil } from './mathUtils'
import { oportunidadesDeEntrada, simular } from './backtest'

// Fração das candidatas, em cada ponta, que o deslocamento não usa. Deslocado
// em um candle, o sinal ainda é o sinal — entrar uma hora depois colhe quase o
// mesmo movimento —, e uma régua feita de cópias do sinal o julgaria contra ele
// mesmo. Em 180 dias, 5% são uns nove dias: mais que qualquer operação dura
// nos horizontes da tela, e ainda sobram 90% dos deslocamentos para sortear.
export const MARGEM_DESLOCAMENTO = 0.05

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
// deslocamento que reproduz exatamente as entradas do sinal (acontece quando o
// sinal aparece em quase todo candle) cairia de um lado ou de outro por ruído
// de ponto flutuante.
const EMPATE = 1e-9

/**
 * Quais deslocamentos a rotação pode usar, para `n` candidatas.
 *
 * Os dois extremos ficam de fora pelo mesmo motivo: deslocar `n − 1` posições
 * é deslocar uma para TRÁS, e isso também é quase o sinal.
 *
 * @param {number} n
 * @returns {{minimo: number, total: number}|null} - Do `minimo` ao
 *   `n − minimo`, inclusive. null quando a margem não deixa nenhum.
 */
const faixaDeDeslocamento = (n) => {
  const minimo = Math.max(1, Math.ceil(n * MARGEM_DESLOCAMENTO))
  const total = n - 2 * minimo + 1
  return total > 0 ? { minimo, total } : null
}

/**
 * Deslocamentos distintos para a régua da estratégia.
 *
 * Sem reposição: repetir um deslocamento é repetir exatamente o mesmo sorteio,
 * e ele contaria duas vezes no percentil. Quando a faixa inteira cabe nas
 * iterações pedidas, usa todos — aí o percentil deixa de ser estimativa e passa
 * a ser a conta exata.
 */
const sortearDeslocamentos = ({ minimo, total }, quantos, sortear) => {
  const todos = Array.from({ length: total }, (_, k) => minimo + k)
  if (total <= quantos) return todos
  // Fisher–Yates parcial: embaralha só o começo, que é o que vai ser usado.
  for (let j = 0; j < quantos; j++) {
    const r = j + Math.floor(sortear() * (total - j))
    const troca = todos[j]
    todos[j] = todos[r]
    todos[r] = troca
  }
  return todos.slice(0, quantos)
}

// Em quais posições da lista de candidatas o sinal aparece. É a posição na
// LISTA, e não no array de candles, que a rotação desloca: assim as ocorrências
// só caem em candles onde o sinal poderia ter aparecido.
const posicoesDoSinal = (serie, candidatas, sinal) => {
  const posicoes = []
  candidatas.forEach((i, p) => {
    if (serie[i].sinais.includes(sinal)) posicoes.push(p)
  })
  return posicoes
}

// A rotação é uma bijeção das candidatas nelas mesmas: posições distintas
// continuam distintas, e desmarcar com o mesmo deslocamento apaga exatamente o
// que foi marcado.
const marcarRotacao = (candidatas, posicoes, deslocamento, mascara, valor) => {
  const n = candidatas.length
  for (let j = 0; j < posicoes.length; j++) {
    mascara[candidatas[(posicoes[j] + deslocamento) % n]] = valor
  }
}

/**
 * Onde a estratégia cai na distribuição do mesmo sinal deslocado no tempo.
 *
 * O deslocamento acontece dentro dos candles em que o sinal PODERIA ter
 * aparecido (ver `oportunidadesDeEntrada`): a lista de candidatas é girada, e a
 * ocorrência que estava na posição `p` passa para a `p + d`. A que passa do fim
 * volta pelo começo. Ver o cabeçalho deste arquivo sobre por que girar em vez
 * de sortear candles soltos.
 *
 * @param {Array<object>} registros - Série na ordem da API.
 * @param {object} opcoes - As mesmas de `simular`, com `sinalEntrada`.
 * @param {{iteracoes?: number, semente?: number}} [config] - `iteracoes` é o
 *   teto: com poucas candidatas, todos os deslocamentos possíveis são menos.
 * @returns {{
 *   percentil: number, retornoReal: number, buyAndHold: number|null,
 *   distribuicao: number[], mediana: number, p05: number, p95: number,
 *   operacoesMedianas: number|null, operacoesReais: number,
 *   iteracoes: number, entradas: number, candidatas: number
 * }|null} - Retornos em %. null quando o sinal não aparece ou não opera, ou
 *   quando há candidatas de menos para deslocar.
 */
export const compararComAcaso = (
  registros,
  opcoes,
  { iteracoes = ITERACOES_ACASO, semente = 1 } = {}
) => {
  const oportunidades = oportunidadesDeEntrada(registros, opcoes)
  if (!oportunidades || oportunidades.comSinal === 0) return null
  const { serie, candidatas } = oportunidades

  const faixa = faixaDeDeslocamento(candidatas.length)
  if (!faixa) return null

  const base = { ...opcoes, serieDeSinais: serie, enxuto: true }
  const real = simular(registros, base)
  if (!real || real.totalTrades === 0) return null

  const posicoes = posicoesDoSinal(serie, candidatas, opcoes.sinalEntrada)
  const deslocamentos = sortearDeslocamentos(faixa, iteracoes, geradorAleatorio(semente))
  const mascara = new Uint8Array(serie.length)
  const retornos = []
  const operacoes = []

  deslocamentos.forEach((d) => {
    marcarRotacao(candidatas, posicoes, d, mascara, 1)
    const r = simular(registros, { ...base, posicoesDeEntrada: mascara })
    marcarRotacao(candidatas, posicoes, d, mascara, 0)
    if (!r) return
    retornos.push(r.retornoTotal)
    operacoes.push(r.tradesConcluidos)
  })
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
    entradas: posicoes.length,
    candidatas: candidatas.length,
  }
}

/**
 * Até onde o MELHOR de N sinais sorteados chega, para ler o topo do ranking.
 *
 * O ranking ordena os sinais pelo alfa do ajuste e põe o maior em cima. Mesmo
 * que nenhum sinal valha nada, o de cima vai ter alfa positivo com frequência —
 * é o máximo de N números ruidosos. O aviso de sobreajuste dizia isso em texto;
 * aqui vira uma régua: em cada sorteio, cada sinal tem suas ocorrências
 * deslocadas no tempo (como na régua da estratégia), e o melhor alfa entre eles
 * é anotado. A distribuição desses máximos diz que alfa o topo da tabela
 * alcançaria só por ter sido escolhido.
 *
 * Deslocamentos independentes por sinal, e não um compartilhado: sinais
 * deslocados independentemente produzem máximos MAIORES que sinais
 * correlacionados, e errar aqui para o lado de uma régua mais alta é errar para
 * o lado de não bajular o ranking.
 *
 * O deslocamento importa aqui tanto quanto lá. Com candles soltos, um sinal em
 * rajadas operava um terço do que operavam os sorteios, pagava um terço do
 * custo — e ganhava o ▲ sem valer nada.
 *
 * @param {Array<object>} registros - Normalmente o trecho de AJUSTE, que é
 *   onde o ranking ordena.
 * @param {object} opcoesComuns - Regra de saída, filtro e custo do ranking.
 * @param {Array<string>} sinais - Os sinais da tabela.
 * @param {{iteracoes?: number, semente?: number}} [config]
 * @returns {{mediana: number, p95: number, iteracoes: number, sinais: number}|null}
 *   - Alfa em %. `sinais` é quantos entraram de fato: um sinal ausente do
 *   trecho não tem ocorrência para deslocar.
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

  const faixa = faixaDeDeslocamento(candidatas.length)
  if (!faixa) return null

  const posicoesPorSinal = new Map(
    sinais.map((s) => [s, posicoesDoSinal(serie, candidatas, s)])
  )
  const ativos = sinais.filter((s) => posicoesPorSinal.get(s).length > 0)
  if (ativos.length === 0) return null

  const base = { ...opcoesComuns, serieDeSinais: serie, enxuto: true }
  const sortear = geradorAleatorio(semente)
  const mascara = new Uint8Array(serie.length)
  const maximos = []

  for (let k = 0; k < iteracoes; k++) {
    let melhor = -Infinity
    ativos.forEach((sinal) => {
      const posicoes = posicoesPorSinal.get(sinal)
      // Com reposição, ao contrário da régua da estratégia: o que se repete
      // aqui seria a combinação inteira dos deslocamentos de todos os sinais,
      // e com mais de um sinal isso praticamente não acontece.
      const d = faixa.minimo + Math.floor(sortear() * faixa.total)
      marcarRotacao(candidatas, posicoes, d, mascara, 1)
      const r = simular(registros, { ...base, sinalEntrada: sinal, posicoesDeEntrada: mascara })
      marcarRotacao(candidatas, posicoes, d, mascara, 0)
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
