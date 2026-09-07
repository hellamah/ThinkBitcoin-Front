import React from 'react'
import { MdTrendingUp, MdTrendingDown, MdPercent, MdSsidChart } from 'react-icons/md'
import * as mathUtils from '../../utils/mathUtils'
import RotuloComAjuda from './RotuloComAjuda'

/**
 * Desempenho consolidado do período filtrado.
 *
 * @param {object} props
 * @param {object} props.desempenho - Retorno de calcularDesempenho.
 * @param {Function} props.t - Função de tradução.
 */
export default function PeriodStatsPanel({ desempenho, t }) {
  if (!desempenho) return null

  const { retorno, drawdown, winRate, melhor, pior, amostras } = desempenho
  const positivo = retorno >= 0

  return (
    <section className="panel intelligence-panel">
      <h2>
        <MdSsidChart style={{ verticalAlign: 'middle', marginRight: '10px' }} /> {t('periodPerformance')}
      </h2>
      <div className="intelligence-grid">
        <div className="intel-card">
          <div className="intel-icon">{positivo ? <MdTrendingUp /> : <MdTrendingDown />}</div>
          <RotuloComAjuda className="intel-label" texto={t('cumulativeReturn')} ajuda={t('ajuda.retornoAcumulado')} />
          <div className={`intel-value ${positivo ? 'up' : 'down'}`}>
            {mathUtils.formatPercent(retorno)}
          </div>
          <div className="intel-subvalue" style={{ opacity: 0.7 }}>
            {t('candlesCounted', { count: amostras })}
          </div>
        </div>

        <div className="intel-card">
          <div className="intel-icon"><MdTrendingDown /></div>
          <RotuloComAjuda className="intel-label" texto={t('maxDrawdown')} ajuda={t('ajuda.drawdown')} />
          {/* Drawdown é sempre ≤ 0; o sinal já vem no número. */}
          <div className="intel-value down">{mathUtils.formatPercent(drawdown, 2, false)}</div>
          <div className="intel-subvalue" style={{ opacity: 0.7 }}>{t('maxDrawdownHint')}</div>
        </div>

        <div className="intel-card">
          <div className="intel-icon"><MdPercent /></div>
          <RotuloComAjuda className="intel-label" texto={t('winRate')} ajuda={t('ajuda.taxaAlta')} />
          {/* Traço, e não "0,0%": sem variação medida a taxa não existe, e um
              zero seria indistinguível de um período em que nenhum candle
              subiu de verdade. */}
          <div className="intel-value">{winRate !== null ? `${winRate.toFixed(1)}%` : '-'}</div>
          <div className="intel-subvalue" style={{ opacity: 0.7 }}>
            {winRate !== null ? t('winRateHint') : t('noReading')}
          </div>
        </div>

        <div className="intel-card">
          <div className="intel-icon"><MdTrendingUp /></div>
          <RotuloComAjuda className="intel-label" texto={t('bestWorstCandle')} ajuda={t('ajuda.melhorPior')} />
          <div className="intel-value up">{mathUtils.formatPercent(melhor)}</div>
          <div className="intel-subvalue down">{mathUtils.formatPercent(pior)}</div>
        </div>
      </div>
    </section>
  )
}
