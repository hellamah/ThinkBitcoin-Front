/**
 * Quanto trabalho a tela está esperando agora — requisições à API e o código
 * de uma página sob demanda. É o que alimenta a barra do topo.
 *
 * Um contador, e não um booleano: o dashboard dispara três requisições por
 * moeda ao mesmo tempo, e a primeira a voltar não pode apagar a barra enquanto
 * as outras ainda estão no caminho.
 *
 * Vive no módulo, fora do React, porque quem inicia a espera é o apiClient —
 * que não tem contexto nem hook — e quem a exibe é um componente só.
 */

let pendentes = 0
const inscritos = new Set()

const avisar = () => inscritos.forEach((avisarInscrito) => avisarInscrito())

/**
 * Marca o começo de uma espera e devolve a função que a encerra.
 *
 * A função de encerrar pode ser chamada mais de uma vez: só a primeira conta.
 * Sem isso, um `finally` e um cleanup de efeito encerrando a mesma espera
 * levariam o contador abaixo do real — e a barra sumiria com trabalho ainda
 * em andamento.
 */
export const iniciarCarregamento = () => {
  pendentes += 1
  if (pendentes === 1) avisar()

  let encerrada = false
  return () => {
    if (encerrada) return
    encerrada = true
    pendentes -= 1
    if (pendentes === 0) avisar()
  }
}

export const haCarregamento = () => pendentes > 0

/** Assinatura no formato de `useSyncExternalStore`. */
export const inscreverCarregamento = (avisarInscrito) => {
  inscritos.add(avisarInscrito)
  return () => inscritos.delete(avisarInscrito)
}
