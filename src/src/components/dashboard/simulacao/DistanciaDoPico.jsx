import React, { useMemo } from 'react'
import { Line } from 'react-chartjs-2'

import RotuloComAjuda from '../RotuloComAjuda'
import { toLocalChartLabel } from '../../../utils/dateUtils'
import { comAlfa, opcoesBaseGrafico, pct } from './formatacao'

/**
 * Quanto o capital ficou abaixo do melhor momento, candle a candle.
 *
 * O drawdown máximo diz o tamanho do pior momento e nada sobre quanto tempo ele
 * durou nem quantas vezes aconteceu. Uma queda de 12% que se recupera em dois
 * dias e uma que fica submersa por três meses aparecem como o mesmo número — e
 * só a segunda é a que faz alguém desistir da estratégia.
 */
export default function DistanciaDoPico({ curva, submersa, cores, t, locale }) {
  const dados = useMemo(() => {
    if (!submersa) return null
    return {
      labels: curva.map((p) => (p.instante ? toLocalChartLabel(p.instante, locale) : '')),
      datasets: [
        {
          label: t('simulationEquity'),
          data: submersa.estrategia,
          borderColor: cores.baixa,
          backgroundColor: comAlfa(cores.baixa, 0.18),
          fill: 'origin',
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0,
        },
        {
          label: t('simulationBuyHold'),
          data: submersa.buyAndHold,
          borderColor: cores.tick,
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderDash: [5, 4],
          pointRadius: 0,
          tension: 0,
        },
      ],
    }
  }, [curva, submersa, cores, t, locale])

  const opcoes = useMemo(() => {
    const base = opcoesBaseGrafico(cores, { formatarY: (v) => pct(v, 1, false) })
    return {
      ...base,
      scales: {
        ...base.scales,
        // O topo é o próprio pico: a faixa só existe abaixo de zero.
        y: { ...base.scales.y, max: 0, ticks: { ...base.scales.y.ticks, maxTicksLimit: 3 } },
      },
    }
  }, [cores])

  if (!dados) return null

  return (
    <div>
      <h4 className="simulation-subtitulo">
        <RotuloComAjuda texto={t('simulationUnderwater')} ajuda={t('ajuda.simSubmerso')} />
      </h4>
      <div className="simulation-submersa-container">
        <Line data={dados} options={opcoes} />
      </div>
    </div>
  )
}
