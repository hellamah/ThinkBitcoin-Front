// Memória da simulação: quantas configurações já foram testadas e quais foram
// guardadas para comparar.
//
// As duas coisas vivem no localStorage, por moeda. Não são dado da conta — são
// o rastro do que ESTA pessoa olhou NESTE navegador, e a contagem só serve
// enquanto descreve isso. Mandá-la para o backend faria dela uma métrica sobre
// o usuário, que não é o que ela é.
//
// Todo acesso engole erro de storage (aba anônima, cota cheia, storage
// bloqueado): perder a contagem é ruim, quebrar o painel por causa dela é pior.

import { getStorage } from './preferences'

// Teto de tentativas guardadas. Acima disso a contagem para de crescer — mil
// configurações distintas já põem o limiar de acaso no percentil 99,995, que a
// régua de 300 sorteios nem consegue resolver.
export const MAX_TENTATIVAS = 1000

// Configurações no diário. Dez cabem numa tabela legível; mais que isso deixa
// de ser comparação e vira arquivo.
export const MAX_DIARIO = 10

const chaveTentativas = (sigla) => `tb_sim_tentativas_${sigla}`
const chaveDiario = (sigla) => `tb_sim_diario_${sigla}`

const lerLista = (chave) => {
  try {
    const bruto = getStorage()?.getItem(chave)
    const valor = bruto ? JSON.parse(bruto) : []
    return Array.isArray(valor) ? valor : []
  } catch {
    return []
  }
}

const gravarLista = (chave, lista) => {
  try {
    getStorage()?.setItem(chave, JSON.stringify(lista))
  } catch {
    // Cota cheia ou storage bloqueado: a lista em memória continua valendo
    // até o próximo recarregamento.
  }
}

/**
 * Configurações distintas já simuladas nesta moeda.
 *
 * @param {string|null} sigla
 * @returns {string[]} - Impressões (ver `impressaoDaConfiguracao`).
 */
export const lerTentativas = (sigla) => (sigla ? lerLista(chaveTentativas(sigla)) : [])

/**
 * Anota uma configuração como testada. Repetir uma já anotada não conta de
 * novo: voltar a olhar a mesma regra não é um teste a mais.
 *
 * @param {string|null} sigla
 * @param {string} impressao
 * @returns {string[]} - A lista depois da anotação.
 */
export const registrarTentativa = (sigla, impressao) => {
  if (!sigla || !impressao) return lerTentativas(sigla)
  const lista = lerTentativas(sigla)
  if (lista.includes(impressao)) return lista
  const nova = [...lista, impressao].slice(-MAX_TENTATIVAS)
  gravarLista(chaveTentativas(sigla), nova)
  return nova
}

export const zerarTentativas = (sigla) => {
  if (!sigla) return []
  try {
    getStorage()?.removeItem(chaveTentativas(sigla))
  } catch {
    // Idem ao gravar.
  }
  return []
}

/**
 * Configurações guardadas nesta moeda, da mais antiga para a mais nova.
 *
 * @param {string|null} sigla
 * @returns {Array<object>}
 */
export const lerDiario = (sigla) =>
  sigla
    ? lerLista(chaveDiario(sigla)).filter(
        (e) => e && typeof e.id === 'string' && e.parametros && typeof e.parametros === 'object'
      )
    : []

/**
 * Guarda uma configuração. A mesma configuração guardada de novo SUBSTITUI a
 * anterior (com o resultado de agora) em vez de duplicar a linha.
 *
 * @param {string|null} sigla
 * @param {{impressao: string, parametros: object, resumo: object}} entrada
 * @returns {{lista: Array<object>, cheio: boolean}} - `cheio` quando o diário
 *   já tinha o máximo e a configuração era nova: nada foi guardado.
 */
export const guardarNoDiario = (sigla, entrada) => {
  const lista = lerDiario(sigla)
  if (!sigla || !entrada?.impressao) return { lista, cheio: false }

  const existente = lista.findIndex((e) => e.impressao === entrada.impressao)
  if (existente < 0 && lista.length >= MAX_DIARIO) return { lista, cheio: true }

  const registro = {
    id: existente >= 0 ? lista[existente].id : `${Date.now().toString(36)}-${lista.length}`,
    criadoEm: new Date().toISOString(),
    impressao: entrada.impressao,
    parametros: entrada.parametros,
    resumo: entrada.resumo ?? {},
  }
  const nova =
    existente >= 0
      ? lista.map((e, i) => (i === existente ? registro : e))
      : [...lista, registro]

  gravarLista(chaveDiario(sigla), nova)
  return { lista: nova, cheio: false }
}

export const removerDoDiario = (sigla, id) => {
  const nova = lerDiario(sigla).filter((e) => e.id !== id)
  if (sigla) gravarLista(chaveDiario(sigla), nova)
  return nova
}
