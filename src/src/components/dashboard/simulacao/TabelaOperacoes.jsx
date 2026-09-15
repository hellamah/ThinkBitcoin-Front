import React from 'react'

import * as mathUtils from '../../../utils/mathUtils'
import { ExitReason, StopMode } from '../../../utils/enums'
import { toLocalChartLabel } from '../../../utils/dateUtils'
import { classeSinal, pct } from './formatacao'

/**
 * Lista de todas as operações.
 *
 * A tabela lista TODAS; o card de retorno conta só as concluídas. Sem dizer
 * isso, quem contasse as linhas achava um número e lia outro logo acima, sem
 * nada na tela explicando a diferença. O título traz o total, e a ressalva só
 * aparece quando há de fato divergência.
 *
 * Cada linha abre a operação no gráfico de preço. O botão fica no instante de
 * entrada, e não na linha inteira: `onClick` numa `<tr>` o mouse alcança e o
 * teclado não.
 */
export default function TabelaOperacoes({ resultado, foco, onFocar, t, locale }) {
  const { trades, metricas, parametros } = resultado
  const naoConcluidas = metricas.totalTrades - metricas.tradesConcluidos
  const dimensionado = trades.some((op) => op.fracaoCapital < 1)
  const stopMovel = parametros.modoStop === StopMode.ATR_MOVEL

  return (
    <div className="simulation-operacoes">
      <h3>{t('simulationTrades')}: {metricas.totalTrades}</h3>
      {naoConcluidas > 0 && (
        <p className="correlation-hint">
          {t('simulationOpenAtEnd', { count: naoConcluidas, concluidas: metricas.tradesConcluidos })}
        </p>
      )}
      <div className="correlation-scroll simulation-trades">
        <table className="signal-lab-table">
          <thead>
            <tr>
              <th scope="col">{t('simulationTradeEntry')}</th>
              <th scope="col">{t('simulationTradeExit')}</th>
              <th scope="col">{t('simulationTradeBars')}</th>
              <th scope="col">{t('simulationTradeReason')}</th>
              <th scope="col">{t('simulationTradeExcursion')}</th>
              {dimensionado && <th scope="col">{t('simulationTradeSize')}</th>}
              <th scope="col">{t('simulationTradeResult')}</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((op, idx) => (
              <tr
                key={`${op.indiceEntrada}-${op.indiceSaida}`}
                className={[
                  op.motivoSaida === ExitReason.FIM_DA_SERIE ? 'signal-lab-fraco' : '',
                  foco === idx ? 'simulation-linha-ativa' : '',
                ].filter(Boolean).join(' ') || undefined}
              >
                {/* O instante acompanha cada preço. Sem ele a tabela diz quanto
                    cada operação rendeu e nunca QUANDO. */}
                <td>
                  <button
                    type="button"
                    className="botao-nu simulation-link-sinal"
                    onClick={() => onFocar(idx)}
                    aria-label={t('simulationTradeFocus', { numero: idx + 1 })}
                  >
                    {mathUtils.formatCurrency(op.precoEntrada)}
                  </button>
                  <span className="simulation-instante">{toLocalChartLabel(op.instanteEntrada, locale)}</span>
                </td>
                <td>
                  {mathUtils.formatCurrency(op.precoSaida)}
                  <span className="simulation-instante">{toLocalChartLabel(op.instanteSaida, locale)}</span>
                </td>
                <td>{op.barrasSeguradas}</td>
                <td>
                  {t(`exit_${op.motivoSaida}`)}
                  {/* No modo ATR a distância muda a cada entrada; sem mostrá-la,
                      "Stop" não diz stop de quanto. No stop móvel a distância
                      é a de partida — o preço em que ele terminou está no
                      gráfico. */}
                  {op.motivoSaida === ExitReason.STOP && op.stopPercentualAplicado !== null && (
                    <span className="simulation-stop-aplicado">
                      {' '}({op.stopPercentualAplicado.toFixed(1)}%{stopMovel ? ' ↗' : ''})
                    </span>
                  )}
                </td>
                <td className="simulation-excursao-celula">
                  <span className="down">−{op.excursaoAdversa.toFixed(1)}%</span>
                  {' / '}
                  <span className="up">+{op.excursaoFavoravel.toFixed(1)}%</span>
                </td>
                {dimensionado && <td>{(op.fracaoCapital * 100).toFixed(0)}%</td>}
                <td className={classeSinal(op.retornoLiquido)}>{pct(op.retornoLiquido)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
