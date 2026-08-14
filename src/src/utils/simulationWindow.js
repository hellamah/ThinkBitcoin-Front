// Janela de dados da simulação de estratégias.
//
// A simulação NÃO usa a série do dashboard, e isso é deliberado. Dois motivos,
// os dois medidos e não supostos:
//
// 1. Tamanho. O preset padrão do dashboard traz ~168 candles, e uma entrada
//    seletiva nisso produz 5 a 15 operações — amostra que não sustenta
//    conclusão nenhuma. O banco tem ~20.500 candles por moeda (medido em
//    2026-08-14), então a limitação era da tela, não do dado.
//
// 2. Estabilidade. A série do dashboard é a resposta PAGINADA, e a paginação da
//    tabela de histórico troca essa página para todos os painéis. Uma simulação
//    que muda de resultado porque o usuário navegou numa tabela ao lado não é
//    utilizável. Buscando por conta própria, o painel fica imune.
//
// O teto de 180 dias não é arredondamento: é o maior valor redondo que cabe
// numa requisição sob o limite de 5.000 candles da API (183 dias com a margem
// de aquecimento dão 4.392) e ainda deixa folga. Ir além exige paginar, que é
// outro problema.

import { QUANTIDADE_MAXIMA_CANDLES } from './apiClient'

// Quantos dias a simulação analisa.
export const DIAS_JANELA_SIMULACAO = 180

// Dias pedidos ANTES da janela só para aquecer indicadores de janela móvel.
// Mesmo motivo e mesmo valor do dashboard: Bollinger de 20 e RSI de 14 precisam
// de candles anteriores ao primeiro ponto analisado, senão o indicador só passa
// a existir no meio do período. Estes candles não geram operação — quem barra é
// o `aPartirDe` do motor.
export const DIAS_DE_AQUECIMENTO = 3

const HORA_MS = 3600000

/**
 * Parâmetros da requisição da simulação.
 *
 * @param {Date} [agora] - Instante de referência; injetável para teste.
 * @param {number} [dias] - Tamanho da janela analisada.
 * @returns {{
 *   dataInicio: string, dataFim: string, quantidade: number, aPartirDe: string
 * }} - Datas em ISO UTC. `dataInicio` inclui o aquecimento; `aPartirDe` é o
 *   começo do período que de fato vira operação.
 */
export const montarJanelaSimulacao = (agora = new Date(), dias = DIAS_JANELA_SIMULACAO) => {
  const fim = new Date(agora)
  const inicioAnalise = new Date(fim.getTime() - dias * 24 * HORA_MS)
  const inicioBusca = new Date(inicioAnalise.getTime() - DIAS_DE_AQUECIMENTO * 24 * HORA_MS)

  // Uma linha por hora, mais o aquecimento. Pedir mais candles do que existem é
  // inofensivo; pedir menos cortaria a janela em silêncio, que é o defeito que
  // o `cobertura.truncado` do dashboard existe para denunciar.
  const horasPedidas = Math.ceil((fim.getTime() - inicioBusca.getTime()) / HORA_MS)

  return {
    dataInicio: inicioBusca.toISOString(),
    dataFim: fim.toISOString(),
    // O teto é da API: acima dele a resposta é 400, e a tela ficaria vazia sem
    // dizer por quê.
    quantidade: Math.min(horasPedidas, QUANTIDADE_MAXIMA_CANDLES),
    aPartirDe: inicioAnalise.toISOString(),
  }
}
