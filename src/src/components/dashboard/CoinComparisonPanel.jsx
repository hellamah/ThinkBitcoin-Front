import React from 'react'
import { MdLeaderboard } from 'react-icons/md'
import * as mathUtils from '../../utils/mathUtils'

const classe = (v) => (v > 0 ? 'up' : v < 0 ? 'down' : undefined)

/**
 * Desempenho das moedas selecionadas lado a lado.
 *
 * Só as leituras que existem por moeda. Fluxo de ordens e laboratório de
 * sinais continuam fora do modo comparativo porque misturariam ativos.
 *
 * @param {object} props
 * @param {Array<object>} props.comparativo - Retorno de compararMoedas.
 * @param {Function} props.t - Função de tradução.
 */
export default function CoinComparisonPanel({ comparativo, t }) {
  if (!comparativo || comparativo.length === 0) return null

  return (
    <section className="panel comparison-panel">
      <h2>
        <MdLeaderboard style={{ verticalAlign: 'middle', marginRight: '10px' }} />
        {t('coinComparison')}
      </h2>

      <p className="correlation-hint">{t('coinComparisonHint')}</p>

      <div className="correlation-scroll">
        <table className="signal-lab-table">
          <thead>
            <tr>
              <th scope="col">{t('coin')}</th>
              <th scope="col">{t('cumulativeReturn')}</th>
              <th scope="col">{t('maxDrawdown')}</th>
              <th scope="col">{t('winRate')}</th>
              <th scope="col">{t('volatility')}</th>
              <th scope="col">{t('vwap')}</th>
            </tr>
          </thead>
          <tbody>
            {comparativo.map((m) => (
              <tr key={m.sigla}>
                <th scope="row">{m.sigla}</th>
                <td className={classe(m.retorno)}>{mathUtils.formatPercent(m.retorno)}</td>
                {/* Drawdown é sempre ≤ 0; o sinal já vem no número. */}
                <td className="down">{mathUtils.formatPercent(m.drawdown, 2, false)}</td>
                <td>{m.winRate !== null ? `${m.winRate.toFixed(1)}%` : '—'}</td>
                <td>
                  {m.volatilidade !== null ? `${m.volatilidade.toFixed(2)}%` : '—'}
                </td>
                <td className={m.desvioVwap !== null ? classe(m.desvioVwap) : undefined}>
                  {m.desvioVwap !== null ? mathUtils.formatPercent(m.desvioVwap) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
