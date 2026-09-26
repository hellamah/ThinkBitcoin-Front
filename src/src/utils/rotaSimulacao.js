// Endereço da tela da simulação, sem nenhuma dependência.
//
// Fica fora do parametrosSimulacao.js de propósito: o App.jsx, que vai no
// pacote inicial, precisa reconhecer um link antigo da simulação para
// redirecioná-lo, e o parametrosSimulacao importa o backtest — importá-lo ali
// levaria o motor inteiro para quem só abriu a página inicial.

// A simulação saiu do dashboard para uma tela própria.
export const ROTA_SIMULACAO = '/simulacao'

// Prefixo dos parâmetros da simulação na URL (ver parametrosSimulacao.js).
export const PREFIXO_URL_SIMULACAO = 'sim.'

/**
 * A query string carrega uma configuração da simulação?
 *
 * É o que reconhece um link de antes da tela própria — `/dashboard?sim.sinal=…`
 * —, para ele continuar abrindo a simulação em vez de cair num dashboard que
 * não a tem mais.
 *
 * @param {string|URLSearchParams} busca
 * @returns {boolean}
 */
export const temParametrosDaSimulacao = (busca) =>
  [...new URLSearchParams(busca).keys()].some((chave) => chave.startsWith(PREFIXO_URL_SIMULACAO))
