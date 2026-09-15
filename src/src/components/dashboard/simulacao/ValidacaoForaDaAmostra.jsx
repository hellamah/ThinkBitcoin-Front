import React from 'react'
import { MdContentCut } from 'react-icons/md'

import RotuloComAjuda from '../RotuloComAjuda'
import { FRACAO_VALIDACAO_PADRAO } from '../../../utils/backtest'
import { classeSinal, pct } from './formatacao'

/**
 * Ajuste contra validação, para a estratégia em detalhe.
 *
 * Fica fora das abas: é a única leitura que julga a escolha dos parâmetros, e
 * escondê-la atrás de um clique seria deixar à vista só os números que se
 * escolhe.
 */
export default function ValidacaoForaDaAmostra({ ajuste, validacao, t }) {
  if (!ajuste || !validacao) return <p className="simulation-vazio">{t('simulationTooShort')}</p>

  return (
    <div className="simulation-holdout">
      <h3>
        <MdContentCut style={{ verticalAlign: 'middle', marginRight: '8px' }} />
        <RotuloComAjuda texto={t('simulationHoldout')} ajuda={t('ajuda.simHoldout')} />
      </h3>
      <p className="correlation-hint">
        {t('simulationHoldoutHint', { fracao: Math.round(FRACAO_VALIDACAO_PADRAO * 100) })}
      </p>
      <div className="correlation-scroll">
        <table className="signal-lab-table">
          <thead>
            <tr>
              <th scope="col" />
              <th scope="col">{t('simulationReturn')}</th>
              <th scope="col">{t('simulationBuyHold')}</th>
              <th scope="col">{t('simulationAlpha')}</th>
              <th scope="col">{t('simulationTrades')}</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['simulationTuning', ajuste],
              ['simulationValidation', validacao],
            ].map(([rotulo, r]) => {
              // Sem nenhuma operação, retorno e alfa não são resultado — são a
              // ausência dele. Exibir "+0,00%" faria "não operou" parecer
              // "operou e ficou estável". O buy & hold continua, porque ele não
              // depende de ter operado.
              const operou = r && r.trades.length > 0
              return (
                <tr
                  key={rotulo}
                  className={r?.metricas.amostraInsuficiente ? 'signal-lab-fraco' : undefined}
                >
                  <th scope="row">{t(rotulo)}</th>
                  <td className={operou ? classeSinal(r.metricas.retornoTotal) : undefined}>
                    {operou ? pct(r.metricas.retornoTotal) : '—'}
                  </td>
                  <td>{r ? pct(r.metricas.buyAndHold) : '—'}</td>
                  <td className={operou ? classeSinal(r.metricas.alfa) : undefined}>
                    {operou ? pct(r.metricas.alfa) : '—'}
                  </td>
                  <td>{r ? r.metricas.tradesConcluidos : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
