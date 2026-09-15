import React from 'react'

import RotuloComAjuda from '../RotuloComAjuda'
import { classeSinal, pct } from './formatacao'

/**
 * Estratégia contra buy & hold, mês a mês.
 *
 * Um alfa de 180 dias não diz de onde veio. "Superou em 4 de 6 meses" e
 * "perdeu em 5 e ganhou tudo num" produzem o mesmo número e são estratégias
 * opostas. A tabela mostra qual das duas está na tela.
 */
export default function ConsistenciaMensal({ porMes, t, locale }) {
  if (!porMes || porMes.meses.length === 0) {
    return <p className="simulation-vazio">{t('simulationNoTrades')}</p>
  }

  // Em UTC, como o agrupamento: o rótulo tem de nomear o mesmo mês que a conta
  // usou.
  const nomeDoMes = (ano, mes) =>
    new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric', timeZone: 'UTC' })
      .format(new Date(Date.UTC(ano, mes, 1)))

  return (
    <div className="simulation-mensal">
      <h3>
        <RotuloComAjuda texto={t('simulationMonthly')} ajuda={t('ajuda.simMensal')} />
      </h3>
      <p className="correlation-hint">{t('simulationMonthlyHint')}</p>
      <p className="simulation-regra-saida">
        {t('simulationMonthlySummary', { vencidos: porMes.vencidos, total: porMes.comparaveis })}
      </p>
      <div className="correlation-scroll">
        <table className="signal-lab-table">
          <thead>
            <tr>
              <th scope="col">{t('simulationMonth')}</th>
              <th scope="col">{t('simulationStrategy')}</th>
              <th scope="col">{t('simulationBuyHold')}</th>
              <th scope="col">{t('simulationDifference')}</th>
              <th scope="col">{t('simulationTrades')}</th>
            </tr>
          </thead>
          <tbody>
            {porMes.meses.map((m) => (
              <tr key={`${m.ano}-${m.mes}`} className={m.parcial ? 'signal-lab-fraco' : undefined}>
                <th scope="row">
                  {nomeDoMes(m.ano, m.mes)}
                  {m.parcial && <span className="simulation-stop-aplicado"> ({t('simulationPartialMonth')})</span>}
                </th>
                <td className={classeSinal(m.estrategia)}>{pct(m.estrategia)}</td>
                <td>{pct(m.buyAndHold)}</td>
                <td className={classeSinal(m.diferenca)}>{pct(m.diferenca)}</td>
                <td>{m.operacoes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
