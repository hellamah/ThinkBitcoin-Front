// Formatação compartilhada pelas partes do painel de simulação.
//
// O painel virou vários componentes, e todos precisam escrever percentual,
// horizonte e regra do mesmo jeito. Espalhar isso por arquivo é o caminho para
// o ranking dizer "Alvo: 2,00%" e o diário dizer "Alvo 2%".

import * as mathUtils from '../../../utils/mathUtils'
import { PERIODO_MEDIA_TENDENCIA } from '../../../utils/backtest'
import { StopMode, TradeDirection, TrendFilter } from '../../../utils/enums'

// Percentual que pode ser null sem virar "0,00%" — a diferença entre "mediu e
// deu zero" e "não havia o que medir" é justamente o que esta tela não pode
// borrar.
export const pct = (v, casas = 2, comSinal = true) =>
  v === null || v === undefined || !Number.isFinite(v)
    ? '—'
    : mathUtils.formatPercent(v, casas, comSinal)

export const classeSinal = (v) => (v > 0 ? 'up' : v < 0 ? 'down' : undefined)

// Limiar da régua aleatória: "95", e não "95.0"; "99.5" quando a correção por
// tentativas o tira do inteiro.
export const formatarLimiar = (v) =>
  Math.abs(v - Math.round(v)) < 0.05 ? v.toFixed(0) : v.toFixed(1)

export const rotuloHorizonte = (n, t) => {
  if (n === null) return t('simulationHoldNone')
  return t(n === 1 ? 'simulationHoldOne' : 'simulationHoldMany', { count: n })
}

export const rotuloModoStop = (modo, t) => {
  if (modo === StopMode.ATR) return t('simulationStopAtr')
  if (modo === StopMode.ATR_MOVEL) return t('simulationStopTrailing')
  return t('simulationStopFixed')
}

export const rotuloTendencia = (filtro, t) => {
  if (filtro === TrendFilter.ALTA) return t('simulationTrendUp', { periodo: PERIODO_MEDIA_TENDENCIA })
  if (filtro === TrendFilter.BAIXA) return t('simulationTrendDown', { periodo: PERIODO_MEDIA_TENDENCIA })
  return t('simulationTrendAny')
}

// Os rótulos dos controles carregam o "%" embutido ("Alvo %", "Custo por perna
// %"). Isso serve num campo de formulário e atrapalha numa frase, então aqui a
// unidade sai do rótulo e volta junto do número, onde pertence. Vale nos cinco
// idiomas — todos terminam o rótulo no mesmo sinal.
export const semUnidade = (t, chave) => t(chave).replace(/\s*%\s*$/, '')

/**
 * A regra em vigor, em uma linha.
 *
 * O ranking compara as entradas sob a MESMA regra comum, e sem declará-la ele se
 * lê como absoluto: "o martelo rende 27%", quando o que a tabela mede é "o
 * martelo rende 27% comprado, segurando 5 candles, sem stop e pagando 0,1% por
 * perna". Trocar qualquer um desses reordena a tabela inteira. O diário usa a
 * mesma linha, com a entrada na frente, para cada configuração guardada dizer o
 * que ela é.
 *
 * Montada a partir dos rótulos que os próprios controles já usam: nenhuma
 * chance de a linha discordar dos botões logo acima dela.
 *
 * @param {object} p - Parâmetros da simulação.
 * @param {Function} t
 * @param {{comEntrada?: boolean}} [opcoes]
 */
export const resumoDaRegra = (p, t, { comEntrada = false } = {}) => {
  const partes = []
  if (comEntrada && p.sinalEntrada) partes.push(t(`signal_${p.sinalEntrada}`))
  partes.push(p.direcao === TradeDirection.VENDA ? t('simulationShort') : t('simulationLong'))
  if (p.filtroTendencia) {
    partes.push(`${t('simulationTrendFilter')}: ${rotuloTendencia(p.filtroTendencia, t)}`)
  }
  if (p.sinalConfirmacao) {
    partes.push(`${t('simulationConfirm')}: ${t(`signal_${p.sinalConfirmacao}`)}`)
  }
  partes.push(`${t('simulationHold')}: ${rotuloHorizonte(p.saidaPorTempo, t)}`)
  partes.push(
    `${t('simulationStopMode')}: ${
      p.modoStop === StopMode.PERCENTUAL
        ? pct(p.stopPercentual, 2, false)
        : rotuloModoStop(p.modoStop, t)
    }`
  )
  partes.push(`${semUnidade(t, 'simulationTarget')}: ${pct(p.alvoPercentual, 2, false)}`)
  if (p.sinalSaida) partes.push(`${t('simulationExitSignal')}: ${t(`signal_${p.sinalSaida}`)}`)
  if (p.riscoPorOperacao) {
    partes.push(`${semUnidade(t, 'simulationRisk')}: ${pct(p.riscoPorOperacao, 2, false)}`)
  }
  partes.push(`${semUnidade(t, 'simulationCost')}: ${pct(p.custoPercentual, 2, false)}`)
  return partes.join(' · ')
}

/**
 * Cor com transparência, para preenchimento em canvas.
 *
 * O canvas não resolve `var()` nem `color-mix`, e os tokens do tema chegam
 * como hex ou rgb conforme quem os definiu. Um formato que não se reconhece
 * volta como veio — opaco, mas visível, em vez de sumir.
 */
export const comAlfa = (cor, alfa) => {
  if (typeof cor !== 'string') return cor
  const c = cor.trim()
  if (/^#[0-9a-f]{3}$/i.test(c)) {
    const [r, g, b] = c.slice(1).split('').map((d) => parseInt(d + d, 16))
    return `rgba(${r}, ${g}, ${b}, ${alfa})`
  }
  if (/^#[0-9a-f]{6}$/i.test(c)) {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16))
    return `rgba(${r}, ${g}, ${b}, ${alfa})`
  }
  const rgb = c.match(/^rgba?\(([^)]+)\)$/i)
  if (rgb) {
    const [r, g, b] = rgb[1].split(/[\s,/]+/).filter(Boolean)
    return `rgba(${r}, ${g}, ${b}, ${alfa})`
  }
  return cor
}

/**
 * Eixos, tooltip e comportamento comuns aos gráficos do painel.
 *
 * Sem animação: as séries têm um ponto por candle — na janela de 180 dias são
 * ~4.300 —, e interpolar isso a cada troca de parâmetro é trabalho que não
 * acrescenta leitura nenhuma a uma linha dessa densidade. `normalized` porque
 * os dados já vêm ordenados e no formato que o Chart.js espera.
 *
 * `border` explícito nos eixos pelo mesmo motivo do gráfico de preço: sem ele a
 * linha do eixo vem do `defaults.borderColor` global e ignora o tema.
 */
export const opcoesBaseGrafico = (cores, { formatarY = (v) => v, legenda = true } = {}) => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: false,
  normalized: true,
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: {
      display: legenda,
      position: 'bottom',
      labels: { color: cores.tick, boxWidth: 12, usePointStyle: false },
    },
    tooltip: {
      backgroundColor: cores.tooltipBg,
      callbacks: {
        // O nome da série vai junto do valor: vários números empilhados sem
        // rótulo não dizem qual é a estratégia e qual é a régua.
        label: (ctx) =>
          ctx.parsed.y === null || ctx.parsed.y === undefined
            ? null
            : `${ctx.dataset.label}: ${formatarY(ctx.parsed.y)}`,
      },
    },
  },
  scales: {
    x: {
      ticks: { color: cores.tickSubtle, maxTicksLimit: 8 },
      grid: { display: false },
      border: { color: cores.borda },
    },
    y: {
      ticks: { color: cores.tick, maxTicksLimit: 6 },
      grid: { color: cores.grid },
      border: { color: cores.borda },
    },
  },
})
