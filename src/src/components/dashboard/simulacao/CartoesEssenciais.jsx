import React from 'react'

import RotuloComAjuda from '../RotuloComAjuda'
import { FRACAO_VALIDACAO_PADRAO, MINIMO_TRADES_CONCLUSIVO } from '../../../utils/backtest'
import { classeSinal, pct } from './formatacao'

const LARGURA = 140
const ALTURA = 32
const FAIXAS = 24

/**
 * Histograma dos retornos sorteados, com a estratégia marcada.
 *
 * O percentil sozinho diz ONDE a estratégia caiu; o desenho diz COMO é a
 * distribuição em volta — se ela ficou na cauda de um sino estreito ou só um
 * pouco à direita do meio de uma distribuição larga. SVG estático, como a
 * sparkline dos outros cards: não há interação que justifique um canvas.
 */
const MiniDistribuicao = ({ distribuicao, real }) => {
  if (!distribuicao?.length || !Number.isFinite(real)) return null
  const menor = Math.min(distribuicao[0], real)
  const maior = Math.max(distribuicao[distribuicao.length - 1], real)
  const largura = maior - menor || 1

  const contagem = new Array(FAIXAS).fill(0)
  distribuicao.forEach((v) => {
    const k = Math.min(FAIXAS - 1, Math.floor(((v - menor) / largura) * FAIXAS))
    contagem[k]++
  })
  const pico = Math.max(...contagem) || 1
  const xReal = ((real - menor) / largura) * LARGURA
  const passo = LARGURA / FAIXAS

  return (
    <svg className="simulation-distribuicao" viewBox={`0 0 ${LARGURA} ${ALTURA}`} aria-hidden="true">
      {contagem.map((c, k) => {
        const h = (c / pico) * (ALTURA - 4)
        return <rect key={k} x={k * passo + 0.5} width={Math.max(0.5, passo - 1)} y={ALTURA - h} height={h} />
      })}
      <line x1={xReal} x2={xReal} y1={0} y2={ALTURA} />
    </svg>
  )
}

/**
 * Os três cards logo abaixo da curva.
 *
 * Um para cada pergunta que vem depois de "funcionou?": o sinal vale mais que
 * entradas sorteadas? o resultado sobrevive fora do trecho em que foi
 * escolhido? quantas operações sustentam isso? As outras leituras (drawdown,
 * Sharpe, custo, intervalo, dependência das melhores) continuam no painel,
 * dentro de "Dá para confiar?".
 */
export default function CartoesEssenciais({ metricas, robustez, validacao, disparo, fraco, t }) {
  const { acaso, calculando } = robustez
  const operouNaValidacao = Boolean(validacao && validacao.trades.length > 0)
  const opsValidacao = validacao?.metricas.tradesConcluidos ?? 0

  const linhaDisparo = !disparo
    ? t('simulationLastSignalNone')
    : disparo.candlesAtras === 0
      ? t('simulationLastSignalNow')
      : t('simulationLastSignal', { candles: disparo.candlesAtras })

  return (
    <div className={`intelligence-grid simulation-essenciais ${fraco ? 'simulation-fraco' : ''}`}>
      <div className={`intel-card ${calculando && acaso ? 'simulation-desatualizado' : ''}`}>
        <RotuloComAjuda className="intel-label" texto={t('simulationChance')} ajuda={t('ajuda.simAcaso')} />
        <div className="intel-value">
          {acaso ? `${Math.round(acaso.percentil)}%` : calculando ? '…' : '—'}
        </div>
        {acaso && <MiniDistribuicao distribuicao={acaso.distribuicao} real={acaso.retornoReal} />}
        <div className="intel-subvalue" style={{ opacity: 0.7 }}>
          {acaso
            ? t('simulationChanceSub', { mediana: pct(acaso.mediana, 1), iteracoes: acaso.iteracoes })
            : calculando ? t('simulationCalculating') : '—'}
        </div>
      </div>

      <div className="intel-card">
        <RotuloComAjuda className="intel-label" texto={t('simulationOutOfSample')} ajuda={t('ajuda.simHoldout')} />
        <div className={`intel-value ${operouNaValidacao ? classeSinal(validacao.metricas.alfa) || '' : ''}`}>
          {operouNaValidacao ? pct(validacao.metricas.alfa) : '—'}
        </div>
        <div className="intel-subvalue" style={{ opacity: 0.7 }}>
          {operouNaValidacao
            ? t('simulationOutOfSampleSub', { fracao: Math.round(FRACAO_VALIDACAO_PADRAO * 100) })
            : t('simulationOutOfSampleNone')}
        </div>
        {operouNaValidacao && opsValidacao < MINIMO_TRADES_CONCLUSIVO && (
          <div className="intel-subvalue simulation-nota-alerta">
            {t('simulationOutOfSampleShort', { count: opsValidacao })}
          </div>
        )}
      </div>

      <div className="intel-card">
        <RotuloComAjuda className="intel-label" texto={t('simulationTrades')} />
        <div className="intel-value">{metricas.tradesConcluidos}</div>
        <div className="intel-subvalue" style={{ opacity: 0.7 }}>
          {t('simulationWinRate')}:{' '}
          {metricas.winRate === null ? '—' : `${metricas.winRate.toFixed(1)}%`}
          {metricas.intervalo
            ? ` (${metricas.intervalo.inferior.toFixed(0)}–${metricas.intervalo.superior.toFixed(0)}%)`
            : ''}
        </div>
        <div className="intel-subvalue" style={{ opacity: 0.5 }}>{linhaDisparo}</div>
      </div>
    </div>
  )
}
