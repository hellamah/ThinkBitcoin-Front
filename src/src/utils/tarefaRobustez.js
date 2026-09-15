// As medições pesadas da simulação, em fases.
//
// Régua aleatória, mapa de sensibilidade e sorte esperada do ranking somam
// algumas centenas de milissegundos de simulação a cada ajuste de parâmetro —
// o bastante para travar a tela se rodassem junto do resto. Este módulo é o
// que o Web Worker executa; quando não há Worker (teste, navegador antigo), o
// hook roda a mesma função na thread principal, com pausas entre as fases.
//
// Um lugar só, para que as duas vias não calculem coisas diferentes.

import { montarSerieDeSinais } from './signalLab'
import { dividirParaValidacao } from './validacaoJanela'
import { compararComAcaso, sorteDoRanking } from './acaso'
import { mapaDeSensibilidade } from './sensibilidade'

// Quantos resultados guardar por série. Voltar a uma configuração já vista —
// clicar de volta num sinal do ranking, desfazer um alvo — é o caso comum, e
// refazer 300 sorteios para ele é trabalho repetido.
const MAX_MEMORIA = 60

// Sementes fixas por fase: o mesmo pedido produz o mesmo número na tela.
const SEMENTE_ACASO = 1
const SEMENTE_SORTE = 2

/**
 * O que só depende dos candles: a série de sinais, o corte de validação e a
 * série do trecho de ajuste. Montado uma vez por série carregada.
 *
 * @param {Array<object>} registros - Série na ordem da API.
 * @param {string|null} aPartirDe - Início da janela analisada.
 * @returns {object|null}
 */
export const prepararContextoRobustez = (registros, aPartirDe) => {
  if (!Array.isArray(registros) || registros.length < 2) return null

  const serie = montarSerieDeSinais(registros)
  const corte = dividirParaValidacao(registros, undefined, { aPartirDe })

  const presentes = new Set()
  serie.forEach(({ sinais }) => sinais.forEach((s) => presentes.add(s)))

  return {
    registros,
    serie,
    sinais: [...presentes].sort(),
    corte: corte
      ? {
          registrosAjuste: corte.registrosAjuste,
          serieAjuste: montarSerieDeSinais(corte.registrosAjuste),
        }
      : null,
    memoria: new Map(),
  }
}

const lembrar = (contexto, chave, calcular) => {
  if (contexto.memoria.has(chave)) return contexto.memoria.get(chave)
  const valor = calcular()
  contexto.memoria.set(chave, valor)
  if (contexto.memoria.size > MAX_MEMORIA) {
    contexto.memoria.delete(contexto.memoria.keys().next().value)
  }
  return valor
}

const pausa = () => new Promise((resolver) => setTimeout(resolver, 0))

/**
 * Roda as três medições e entrega cada uma assim que fica pronta.
 *
 * A ordem é a de importância para a leitura: a régua aleatória da estratégia
 * em detalhe primeiro, o mapa (barato) depois, a sorte do ranking (a mais cara)
 * por último. Entre uma e outra há uma pausa, que é quando um pedido mais novo
 * consegue chegar e cancelar o resto.
 *
 * Cada fase é memorizada pelo que ela de fato lê: o mapa ignora stop e alvo,
 * porque os varre; a sorte do ranking ignora o sinal de entrada, porque roda
 * todos. Clicar num nome do ranking, então, só refaz a régua daquele sinal.
 *
 * @param {object} contexto - De `prepararContextoRobustez`.
 * @param {{opcoes: object}} pedido - Opções completas da simulação, com
 *   `sinalEntrada` e `aPartirDe`.
 * @param {{emitir: Function, cancelado?: Function}} canal
 */
export const executarRobustez = async (contexto, pedido, { emitir, cancelado = () => false }) => {
  const opcoes = pedido?.opcoes ?? {}
  const { registros, serie, corte, sinais } = contexto

  const acaso = opcoes.sinalEntrada
    ? lembrar(contexto, `acaso:${JSON.stringify(opcoes)}`, () =>
        compararComAcaso(registros, { ...opcoes, serieDeSinais: serie }, { semente: SEMENTE_ACASO })
      )
    : null
  emitir('acaso', acaso)

  await pausa()
  if (cancelado()) return

  const { modoStop: _modo, stopPercentual: _stop, alvoPercentual: _alvo, ...semStopAlvo } = opcoes
  const mapa =
    corte && opcoes.sinalEntrada
      ? lembrar(contexto, `mapa:${JSON.stringify(semStopAlvo)}`, () =>
          mapaDeSensibilidade(corte.registrosAjuste, { ...semStopAlvo, serieDeSinais: corte.serieAjuste })
        )
      : null
  emitir('mapa', mapa)

  await pausa()
  if (cancelado()) return

  const { sinalEntrada: _sinal, ...comuns } = opcoes
  const sorte =
    corte && sinais.length > 1
      ? lembrar(contexto, `sorte:${JSON.stringify(comuns)}`, () =>
          sorteDoRanking(
            corte.registrosAjuste,
            { ...comuns, serieDeSinais: corte.serieAjuste },
            sinais,
            { semente: SEMENTE_SORTE }
          )
        )
      : null
  emitir('sorte', sorte)
}
