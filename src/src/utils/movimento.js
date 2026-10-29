// A preferência de movimento reduzido do sistema operacional, para o código
// que o CSS não alcança.
//
// O bloco `@media (prefers-reduced-motion: reduce)` do App.css cobre toda
// animação e transição declarada em CSS, inclusive `scroll-behavior`. O que ele
// NÃO cobre é rolagem pedida por JavaScript: pela especificação do CSSOM View,
// `scrollIntoView` e `scrollBy` só consultam o `scroll-behavior` do CSS quando
// o argumento `behavior` é `auto`. Um `'smooth'` escrito à mão vence a
// preferência da pessoa, e rolagem animada é movimento de tela inteira —
// exatamente o que pesa para quem tem sensibilidade vestibular.

/**
 * `true` quando a pessoa pediu menos movimento ao sistema operacional.
 *
 * Lido na hora, e não guardado: a preferência muda sem recarregar a página, e
 * um valor de módulo ficaria preso ao que valia quando o arquivo carregou.
 */
export const prefereMovimentoReduzido = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    // Sem `matchMedia` (ambiente de teste em Node, navegador muito antigo) o
    // padrão é não presumir a preferência: o movimento continua como sempre
    // foi, em vez de sumir para todo mundo por causa de uma API ausente.
    return false
  }
}

/**
 * O `behavior` a passar para `scrollIntoView` / `scrollTo` / `scrollBy`.
 *
 * `auto` aqui não significa "o navegador escolhe": significa "siga o
 * `scroll-behavior` do CSS", que sob movimento reduzido é salto direto.
 */
export const comportamentoDeRolagem = () =>
  prefereMovimentoReduzido() ? 'auto' : 'smooth'
