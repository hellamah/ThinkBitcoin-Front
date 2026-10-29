// Escolher pelo passado funciona? — walk-forward do procedimento do ranking.
//
// O ranking ordena os sinais pelo alfa do ajuste e põe o maior em cima: a
// primeira linha convida a escolher. Esta função mede o que acontece com quem
// aceita o convite, repetidamente: a cada período de teste, escolhe o sinal de
// maior alfa no período de treino imediatamente anterior e o opera no teste,
// com a regra de saída da tela. Os testes não se sobrepõem, e juntos formam um
// histórico fora da amostra DO PROCEDIMENTO — centenas de operações, contra as
// dezenas do corte único de validação.
//
// ---------------------------------------------------------------------------
// O controle é o que torna o número legível
// ---------------------------------------------------------------------------
// Comparar o escolhido com a média dos sinais engana: quem opera menos paga
// menos custo, e o alfa do treino favorece justamente os sinais raros — que
// continuam "melhores" no teste só por operarem menos. É a mesma confusão que
// a régua aleatória tinha (A-17).
//
// Por isso cada período tem também um CONTROLE que não olha resultado nenhum:
// o sinal que menos operou no treino. Se escolher pelo alfa não supera isso, a
// escolha não tem habilidade — tem só a frequência. Medido em dois anos de
// BTC, ETH e SOL (D-04): o controle ganhou nas 9 combinações testadas.
//
// Os sinais são causais (A-19): montados uma vez, valem para todos os
// períodos sem que nenhum enxergue o futuro. E cada simulação usa `aPartirDe`
// e `ate` sobre a mesma série, para o preparo dela ser feito uma vez só.

import { simular } from './backtest'
import { montarSerieDeSinais } from './signalLab'
import { instanteDe } from './validacaoJanela'

// Treino e teste, em dias. Fixos de propósito (D-04, decisão 2): deixar
// escolher o tamanho do treino recriaria o problema que a tela combate —
// testar 60, 90 e 180 até um parecer bom.
export const DIAS_TREINO = 90
export const DIAS_TESTE = 30

// Abaixo disto a composição dos períodos não sustenta leitura: seis meses de
// teste é o mínimo para um mês ruim não decidir o resultado sozinho.
export const MINIMO_PERIODOS = 6

const DIA_MS = 24 * 60 * 60 * 1000

const paraInstante = (valor) => {
  if (valor === null || valor === undefined) return null
  const t = new Date(valor).getTime()
  return Number.isFinite(t) ? t : null
}

const iso = (t) => new Date(t).toISOString()

/**
 * Onde cada período de treino e teste começa e acaba.
 *
 * @param {number} inicio - Primeiro instante utilizável, em ms.
 * @param {number} fim - Instante em que a série acaba, exclusivo.
 * @returns {Array<{treino: number, teste: number, fim: number}>}
 */
export const periodosDaCaminhada = (inicio, fim, { diasTreino = DIAS_TREINO, diasTeste = DIAS_TESTE } = {}) => {
  const periodos = []
  for (let teste = inicio + diasTreino * DIA_MS; teste + diasTeste * DIA_MS <= fim; teste += diasTeste * DIA_MS) {
    periodos.push({ treino: teste - diasTreino * DIA_MS, teste, fim: teste + diasTeste * DIA_MS })
  }
  return periodos
}

// Posição de um sinal entre os que operaram no teste: 0 é o pior, 1 o melhor.
// null quando ele não operou ou não havia com quem comparar.
const posicaoEntre = (sinal, noTeste) => {
  const proprio = noTeste.find((x) => x.sinal === sinal)
  if (!proprio || noTeste.length < 2) return null
  const abaixo = noTeste.filter((x) => x.retorno < proprio.retorno).length
  return abaixo / (noTeste.length - 1)
}

const media = (valores) => {
  const validos = valores.filter((v) => v !== null && Number.isFinite(v))
  return validos.length ? validos.reduce((a, b) => a + b, 0) / validos.length : null
}

/**
 * Prepara a caminhada: a série de sinais, os sinais a disputar e os períodos.
 *
 * Separado de `avaliarPeriodo` para quem chama poder avaliar um período por vez
 * e devolver a vez à tela entre eles.
 *
 * @param {Array<object>} registros - Série na ordem da API.
 * @param {object} regra - Opções de `simular` comuns a todos os sinais: saída,
 *   stop, alvo, custo, direção, filtros. Sem `sinalEntrada` nem janela.
 * @param {object} [opcoes]
 * @param {string|number|null} [opcoes.aPartirDe] - Início do primeiro treino.
 *   Antes dele, só aquecimento de indicador.
 * @param {string|number|null} [opcoes.ate] - Onde a caminhada para, exclusivo.
 *   A tela passa o início do trecho reservado da validação, para os períodos
 *   não o enxergarem.
 * @param {Array<object>|null} [opcoes.serieDeSinais]
 * @param {Array<string>|null} [opcoes.sinais] - Quais disputam. Omitido, todos
 *   os que ocorrem na série — como no ranking.
 * @returns {object|null} - null sem série utilizável.
 */
export const prepararCaminhada = (
  registros,
  regra,
  {
    aPartirDe = null,
    ate = null,
    serieDeSinais = null,
    sinais = null,
    diasTreino = DIAS_TREINO,
    diasTeste = DIAS_TESTE,
  } = {}
) => {
  if (!Array.isArray(registros) || registros.length < 2) return null
  const serie =
    Array.isArray(serieDeSinais) && serieDeSinais.length === registros.length
      ? serieDeSinais
      : montarSerieDeSinais(registros)

  const instantes = serie.map((c) => instanteDe(c.registro)).filter((t) => t !== null)
  if (instantes.length < 2) return null
  const primeiro = instantes[0]
  const ultimo = instantes[instantes.length - 1]

  const pedidoInicio = paraInstante(aPartirDe)
  const inicio = pedidoInicio !== null ? Math.max(pedidoInicio, primeiro) : primeiro
  // Sem `ate`, a série acaba depois do último candle — ele entra no último teste.
  const pedidoFim = paraInstante(ate)
  const fim = pedidoFim !== null ? Math.min(pedidoFim, ultimo + 1) : ultimo + 1

  const presentes = new Set()
  serie.forEach(({ sinais }) => sinais.forEach((s) => presentes.add(s)))

  return {
    registros,
    serie,
    regra: { ...regra, sinalEntrada: undefined, aPartirDe: undefined, ate: undefined },
    sinais: (sinais ?? [...presentes]).filter((s) => presentes.has(s)).sort(),
    periodos: periodosDaCaminhada(inicio, fim, { diasTreino, diasTeste }),
    diasTreino,
    diasTeste,
  }
}

/**
 * Um período: escolhe no treino, opera no teste.
 *
 * @param {object} caminhada - De `prepararCaminhada`.
 * @param {{treino: number, teste: number, fim: number}} periodo
 * @returns {object} - O escolhido e o controle, com o retorno e a posição de
 *   cada um no teste, e o buy & hold do teste.
 */
export const avaliarPeriodo = (caminhada, periodo) => {
  const { registros, serie, regra, sinais } = caminhada
  const rodar = (sinalEntrada, de, ate) =>
    simular(registros, {
      ...regra,
      sinalEntrada,
      aPartirDe: iso(de),
      ate: iso(ate),
      serieDeSinais: serie,
      enxuto: true,
    })

  // Treino: só disputa quem operou. "Não operou" não entra como alfa zero.
  const treino = sinais
    .map((sinal) => ({ sinal, r: rodar(sinal, periodo.treino, periodo.teste) }))
    .filter(({ r }) => r && r.totalTrades > 0 && r.alfa !== null)

  // O primeiro na ordem da lista vence os empates: a escolha precisa ser a
  // mesma toda vez que a conta for refeita.
  const escolhido = treino.reduce((a, b) => (!a || b.r.alfa > a.r.alfa ? b : a), null)
  const controle = treino.reduce(
    (a, b) => (!a || b.r.tradesConcluidos < a.r.tradesConcluidos ? b : a),
    null
  )

  const teste = sinais.map((sinal) => ({ sinal, r: rodar(sinal, periodo.teste, periodo.fim) }))
  const noTeste = teste
    .filter(({ r }) => r && r.totalTrades > 0)
    .map(({ sinal, r }) => ({ sinal, retorno: r.retornoTotal }))
  const doTeste = (sinal) => teste.find((x) => x.sinal === sinal)?.r ?? null

  // Quem não operou no teste ficou fora do mercado: retorno zero, que é o que
  // aconteceu com o capital.
  const resumo = (vencedor) =>
    vencedor
      ? {
          sinal: vencedor.sinal,
          retorno: doTeste(vencedor.sinal)?.retornoTotal ?? 0,
          operacoes: doTeste(vencedor.sinal)?.tradesConcluidos ?? 0,
          posicao: posicaoEntre(vencedor.sinal, noTeste),
        }
      : null

  return {
    inicio: iso(periodo.teste),
    fim: iso(periodo.fim),
    escolhido: resumo(escolhido),
    controle: resumo(controle),
    buyAndHold: teste.find(({ r }) => r && r.buyAndHold !== null)?.r.buyAndHold ?? null,
  }
}

/**
 * Compõe os períodos avaliados num resultado.
 *
 * Cada período começa com o capital com que o anterior terminou: o retorno
 * composto é o de quem seguiu o procedimento o tempo todo.
 *
 * @param {Array<object>} avaliados - Saídas de `avaliarPeriodo`, em ordem.
 * @returns {object}
 */
export const resumirCaminhada = (avaliados, { minimo = MINIMO_PERIODOS } = {}) => {
  const compor = (retornos) => (retornos.reduce((c, r) => c * (1 + (r ?? 0) / 100), 1) - 1) * 100
  const lado = (campo) => ({
    retorno: compor(avaliados.map((p) => p[campo]?.retorno ?? 0)),
    operacoes: avaliados.reduce((a, p) => a + (p[campo]?.operacoes ?? 0), 0),
    posicaoMedia: media(avaliados.map((p) => p[campo]?.posicao ?? null)),
  })

  return {
    periodos: avaliados,
    escolhido: lado('escolhido'),
    controle: lado('controle'),
    buyAndHold: compor(avaliados.map((p) => p.buyAndHold)),
    suficiente: avaliados.length >= minimo,
  }
}

/**
 * A caminhada inteira, de uma vez. Para testes e para quem não precisa
 * devolver a vez à tela.
 */
export const caminharParaFrente = (registros, regra, opcoes = {}) => {
  const caminhada = prepararCaminhada(registros, regra, opcoes)
  if (!caminhada) return null
  const avaliados = caminhada.periodos.map((p) => avaliarPeriodo(caminhada, p))
  return { ...resumirCaminhada(avaliados, opcoes), diasTreino: caminhada.diasTreino, diasTeste: caminhada.diasTeste }
}
